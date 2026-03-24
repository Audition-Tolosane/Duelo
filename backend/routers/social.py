import secrets
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Match, WallPost, PostLike, PostComment, PlayerFollow, Theme, UserThemeXP
from schemas import WallPostCreate, CommentCreate, FollowToggle, PlayerFollowToggle
from constants import COUNTRY_FLAGS, SUPER_CATEGORY_META
from services.xp import get_level, get_theme_title, get_streak_badge
from services.notifications import create_notification
from auth_middleware import get_current_user_id

router = APIRouter(tags=["social"])


# ── Wall Posts ──

@router.get("/category/{category_id}/wall")
async def get_wall_posts(category_id: str, user_id: Optional[str] = None, limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)):
    limit = min(limit, 100)
    offset = min(offset, 10000)
    result = await db.execute(
        select(WallPost).where(WallPost.category_id == category_id)
        .order_by(WallPost.created_at.desc()).limit(limit).offset(offset)
    )
    posts = result.scalars().all()

    if not posts:
        return []

    post_ids = [p.id for p in posts]
    author_ids = list(set(p.user_id for p in posts))

    # Batch fetch authors
    authors_res = await db.execute(select(User).where(User.id.in_(author_ids)))
    authors_map = {u.id: u for u in authors_res.scalars().all()}

    # Batch fetch like counts
    likes_res = await db.execute(
        select(PostLike.post_id, func.count(PostLike.id))
        .where(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
    )
    likes_map = dict(likes_res.all())

    # Batch fetch comment counts
    comments_res = await db.execute(
        select(PostComment.post_id, func.count(PostComment.id))
        .where(PostComment.post_id.in_(post_ids))
        .group_by(PostComment.post_id)
    )
    comments_map = dict(comments_res.all())

    # Batch fetch user likes
    user_liked_set = set()
    if user_id:
        user_likes_res = await db.execute(
            select(PostLike.post_id).where(PostLike.post_id.in_(post_ids), PostLike.user_id == user_id)
        )
        user_liked_set = set(r[0] for r in user_likes_res.all())

    posts_data = []
    for p in posts:
        post_user = authors_map.get(p.user_id)

        posts_data.append({
            "id": p.id,
            "user": {
                "id": post_user.id if post_user else "",
                "pseudo": post_user.pseudo if post_user else "Inconnu",
                "avatar_seed": post_user.avatar_seed if post_user else "",
                "avatar_url": getattr(post_user, 'avatar_url', None) if post_user else None,
            },
            "content": p.content, "image_base64": p.image_base64,
            "likes_count": likes_map.get(p.id, 0), "comments_count": comments_map.get(p.id, 0),
            "is_liked": p.id in user_liked_set, "created_at": p.created_at.isoformat(),
        })
    return posts_data


@router.post("/category/{category_id}/wall")
async def create_wall_post(category_id: str, data: WallPostCreate, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if data.user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Le contenu ne peut pas être vide")
    if data.image_base64 and len(data.image_base64) > 700000:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 500KB)")

    post = WallPost(user_id=data.user_id, category_id=category_id, content=data.content.strip(), image_base64=data.image_base64)
    db.add(post)
    await db.commit()
    await db.refresh(post)

    u_res = await db.execute(select(User).where(User.id == data.user_id))
    post_user = u_res.scalar_one_or_none()

    return {
        "id": post.id,
        "user": {
            "id": post_user.id if post_user else "",
            "pseudo": post_user.pseudo if post_user else "Inconnu",
            "avatar_seed": post_user.avatar_seed if post_user else "",
            "avatar_url": getattr(post_user, 'avatar_url', None) if post_user else None,
        },
        "content": post.content, "image_base64": post.image_base64,
        "likes_count": 0, "comments_count": 0, "is_liked": False,
        "created_at": post.created_at.isoformat(),
    }


@router.post("/wall/{post_id}/like")
async def toggle_like(post_id: str, data: FollowToggle, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if data.user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    existing = await db.execute(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == data.user_id)
    )
    like = existing.scalar_one_or_none()

    if like:
        await db.delete(like)
        await db.commit()
        return {"liked": False}
    else:
        new_like = PostLike(user_id=data.user_id, post_id=post_id)
        db.add(new_like)
        post_res = await db.execute(select(WallPost).where(WallPost.id == post_id))
        post = post_res.scalar_one_or_none()
        if post and post.user_id != data.user_id:
            liker_res = await db.execute(select(User).where(User.id == data.user_id))
            liker = liker_res.scalar_one_or_none()
            liker_name = liker.pseudo if liker else "Quelqu'un"
            await create_notification(
                db, post.user_id, "like", "notif.new_like", f"notif.like_body:{liker_name}",
                actor_id=data.user_id,
                data={"screen": "category-detail", "params": {"id": post.category_id}},
            )
        await db.commit()
        return {"liked": True}


@router.post("/wall/{post_id}/comment")
async def add_comment(post_id: str, data: CommentCreate, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if data.user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Le commentaire ne peut pas être vide")

    comment = PostComment(user_id=data.user_id, post_id=post_id, content=data.content.strip())
    db.add(comment)

    post_res = await db.execute(select(WallPost).where(WallPost.id == post_id))
    post = post_res.scalar_one_or_none()
    if post and post.user_id != data.user_id:
        commenter_res = await db.execute(select(User).where(User.id == data.user_id))
        commenter = commenter_res.scalar_one_or_none()
        commenter_name = commenter.pseudo if commenter else "Quelqu'un"
        await create_notification(
            db, post.user_id, "comment", "notif.new_comment", f"notif.comment_body:{commenter_name}",
            actor_id=data.user_id,
            data={"screen": "category-detail", "params": {"id": post.category_id}},
        )

    await db.commit()
    await db.refresh(comment)

    u_res = await db.execute(select(User).where(User.id == data.user_id))
    user = u_res.scalar_one_or_none()

    return {
        "id": comment.id,
        "user": {
            "id": user.id if user else "", "pseudo": user.pseudo if user else "Inconnu",
            "avatar_seed": user.avatar_seed if user else "",
            "avatar_url": getattr(user, 'avatar_url', None) if user else None,
        },
        "content": comment.content, "created_at": comment.created_at.isoformat(),
    }


@router.get("/wall/{post_id}/comments")
async def get_comments(post_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PostComment).where(PostComment.post_id == post_id).order_by(PostComment.created_at.asc())
    )
    comments = result.scalars().all()

    comments_data = []
    for c in comments:
        u_res = await db.execute(select(User).where(User.id == c.user_id))
        user = u_res.scalar_one_or_none()
        comments_data.append({
            "id": c.id,
            "user": {
                "id": user.id if user else "", "pseudo": user.pseudo if user else "Inconnu",
                "avatar_seed": user.avatar_seed if user else "",
                "avatar_url": getattr(user, 'avatar_url', None) if user else None,
            },
            "content": c.content, "created_at": c.created_at.isoformat(),
        })
    return comments_data


# ── Helper: get theme name/color from theme_id ──

async def _get_theme_info(db: AsyncSession, theme_id: str):
    """Look up theme name and color from DB."""
    res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = res.scalar_one_or_none()
    if theme:
        return theme.name, theme.color_hex or "#8A2BE2"
    return theme_id, "#8A2BE2"


async def _get_user_best_theme(db: AsyncSession, user_id: str):
    """Get the user's best theme (highest XP) and corresponding level/title."""
    xp_res = await db.execute(
        select(UserThemeXP).where(UserThemeXP.user_id == user_id).order_by(UserThemeXP.xp.desc()).limit(1)
    )
    best_uxp = xp_res.scalar_one_or_none()
    if not best_uxp:
        return None, 0, ""
    theme_res = await db.execute(select(Theme).where(Theme.id == best_uxp.theme_id))
    theme = theme_res.scalar_one_or_none()
    if not theme:
        return best_uxp.theme_id, get_level(best_uxp.xp), ""
    lvl = get_level(best_uxp.xp)
    return theme.id, lvl, get_theme_title(theme, lvl)


# ── Player Profile & Follow ──

@router.get("/player/{user_id}/profile")
async def get_player_profile(user_id: str, viewer_id: Optional[str] = None, posts_limit: int = 20, posts_offset: int = 0, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Joueur non trouvé")

    # Get theme-based stats
    xp_res = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == user_id))
    user_xps = xp_res.scalars().all()
    xp_map = {uxp.theme_id: uxp.xp for uxp in user_xps}

    themes_data = {}
    champion_titles = []
    if xp_map:
        theme_ids = list(xp_map.keys())
        themes_res = await db.execute(select(Theme).where(Theme.id.in_(theme_ids)))
        themes = {t.id: t for t in themes_res.scalars().all()}

        # Batch fetch top XP per theme to check champion status
        top_xp_res = await db.execute(
            select(UserThemeXP.theme_id, func.max(UserThemeXP.xp).label('max_xp'))
            .where(UserThemeXP.theme_id.in_(theme_ids))
            .group_by(UserThemeXP.theme_id)
        )
        top_xp_map = dict(top_xp_res.all())

        for tid, xp in xp_map.items():
            t = themes.get(tid)
            if not t:
                continue
            lvl = get_level(xp)
            themes_data[tid] = {
                "xp": xp, "level": lvl, "title": get_theme_title(t, lvl),
                "name": t.name, "color_hex": t.color_hex or "#8A2BE2",
            }

            # Check if this user is #1 in this theme (their xp equals the max)
            if top_xp_map.get(tid) is not None and xp >= top_xp_map[tid]:
                champion_titles.append({
                    "theme_id": tid, "theme_name": t.name,
                    "scope": "Monde",
                    "date": datetime.now(timezone.utc).strftime("%B %Y").capitalize(),
                })

    followers_count_res = await db.execute(
        select(func.count(PlayerFollow.id)).where(PlayerFollow.followed_id == user_id)
    )
    followers_count = followers_count_res.scalar() or 0

    following_count_res = await db.execute(
        select(func.count(PlayerFollow.id)).where(PlayerFollow.follower_id == user_id)
    )
    following_count = following_count_res.scalar() or 0

    is_following = False
    if viewer_id and viewer_id != user_id:
        f_check = await db.execute(
            select(PlayerFollow).where(
                PlayerFollow.follower_id == viewer_id, PlayerFollow.followed_id == user_id
            )
        )
        is_following = f_check.scalar_one_or_none() is not None

    posts_limit = min(posts_limit, 100)
    posts_result = await db.execute(
        select(WallPost).where(WallPost.user_id == user_id).order_by(WallPost.created_at.desc()).limit(posts_limit).offset(posts_offset)
    )
    user_posts = posts_result.scalars().all()

    posts_data = []
    if user_posts:
        post_ids = [p.id for p in user_posts]
        category_ids = list(set(p.category_id for p in user_posts))

        # Batch fetch like counts for profile posts
        p_likes_res = await db.execute(
            select(PostLike.post_id, func.count(PostLike.id))
            .where(PostLike.post_id.in_(post_ids))
            .group_by(PostLike.post_id)
        )
        p_likes_map = dict(p_likes_res.all())

        # Batch fetch comment counts for profile posts
        p_comments_res = await db.execute(
            select(PostComment.post_id, func.count(PostComment.id))
            .where(PostComment.post_id.in_(post_ids))
            .group_by(PostComment.post_id)
        )
        p_comments_map = dict(p_comments_res.all())

        # Batch fetch viewer likes for profile posts
        p_user_liked_set = set()
        if viewer_id:
            p_user_likes_res = await db.execute(
                select(PostLike.post_id).where(PostLike.post_id.in_(post_ids), PostLike.user_id == viewer_id)
            )
            p_user_liked_set = set(r[0] for r in p_user_likes_res.all())

        # Batch fetch themes for post categories
        p_themes_res = await db.execute(select(Theme).where(Theme.id.in_(category_ids)))
        p_themes_map = {t.id: t for t in p_themes_res.scalars().all()}

        for p in user_posts:
            p_theme = p_themes_map.get(p.category_id)
            theme_name = p_theme.name if p_theme else p.category_id
            posts_data.append({
                "id": p.id, "category_id": p.category_id,
                "category_name": theme_name,
                "content": p.content, "image_base64": p.image_base64,
                "likes_count": p_likes_map.get(p.id, 0), "comments_count": p_comments_map.get(p.id, 0),
                "is_liked": p.id in p_user_liked_set, "created_at": p.created_at.isoformat(),
            })

    country_flag = COUNTRY_FLAGS.get(user.country or "", "")

    # Get best theme title as default
    _, best_level, best_title = await _get_user_best_theme(db, user_id)

    return {
        "id": user.id, "pseudo": user.pseudo, "avatar_seed": user.avatar_seed,
        "avatar_url": getattr(user, 'avatar_url', None),
        "selected_title": user.selected_title or best_title or "Novice",
        "country": user.country, "country_flag": country_flag,
        "matches_played": user.matches_played, "matches_won": user.matches_won,
        "win_rate": round(user.matches_won / max(user.matches_played, 1) * 100),
        "current_streak": user.current_streak, "best_streak": user.best_streak,
        "total_xp": user.total_xp, "themes": themes_data,
        "champion_titles": champion_titles,
        "followers_count": followers_count, "following_count": following_count,
        "is_following": is_following, "posts": posts_data,
    }


@router.post("/player/{user_id}/follow")
async def toggle_player_follow(user_id: str, data: PlayerFollowToggle, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if data.follower_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if data.follower_id == user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous suivre vous-même")

    existing = await db.execute(
        select(PlayerFollow).where(
            PlayerFollow.follower_id == data.follower_id, PlayerFollow.followed_id == user_id
        )
    )
    follow = existing.scalar_one_or_none()

    if follow:
        await db.delete(follow)
        await db.commit()
        return {"following": False}
    else:
        new_follow = PlayerFollow(follower_id=data.follower_id, followed_id=user_id)
        db.add(new_follow)
        follower_res = await db.execute(select(User).where(User.id == data.follower_id))
        follower_user = follower_res.scalar_one_or_none()
        follower_name = follower_user.pseudo if follower_user else "Quelqu'un"
        await create_notification(
            db, user_id, "follow", "notif.new_follower", f"notif.follow_body:{follower_name}",
            actor_id=data.follower_id,
            data={"screen": "player-profile", "params": {"id": data.follower_id}},
        )
        await db.commit()
        return {"following": True}


@router.get("/players/search")
async def search_players(
    q: Optional[str] = None, country: Optional[str] = None,
    limit: int = 20, offset: int = min(0, 10000),
    db: AsyncSession = Depends(get_db)
):
    limit = min(limit, 100)
    offset = min(offset, 10000)
    query = select(User)
    if q and q.strip():
        query = query.where(User.pseudo.ilike(f"%{q.strip()}%"))
    if country and country.strip():
        query = query.where(User.country == country.strip())
    query = query.order_by(User.total_xp.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    users = result.scalars().all()

    if not users:
        return []

    # Batch fetch best theme for all users in one query (fixes N+1)
    user_ids = [u.id for u in users]
    uxp_res = await db.execute(
        select(UserThemeXP)
        .where(UserThemeXP.user_id.in_(user_ids), UserThemeXP.xp > 0)
        .order_by(UserThemeXP.xp.desc())
    )
    all_uxp = uxp_res.scalars().all()

    # Group by user_id, keep highest XP entry
    best_uxp: dict = {}
    for uxp in all_uxp:
        if uxp.user_id not in best_uxp:
            best_uxp[uxp.user_id] = uxp

    # Fetch relevant themes
    theme_ids = list({uxp.theme_id for uxp in best_uxp.values()})
    themes_map: dict = {}
    if theme_ids:
        themes_res = await db.execute(select(Theme).where(Theme.id.in_(theme_ids)))
        themes_map = {t.id: t for t in themes_res.scalars().all()}

    players = []
    for u in users:
        uxp = best_uxp.get(u.id)
        best_level = get_level(uxp.xp) if uxp else 0
        theme = themes_map.get(uxp.theme_id) if uxp else None
        best_title = get_theme_title(theme, best_level) if theme else ""
        players.append({
            "id": u.id, "pseudo": u.pseudo, "avatar_seed": u.avatar_seed,
            "avatar_url": getattr(u, 'avatar_url', None),
            "country": u.country, "country_flag": COUNTRY_FLAGS.get(u.country or "", ""),
            "total_xp": u.total_xp, "matches_played": u.matches_played,
            "selected_title": u.selected_title or best_title or "Novice",
            "best_level": best_level,
        })
    return players


# ── Social Pulse, Tribes, Coach ──

@router.get("/social/pulse/{user_id}")
async def social_pulse(user_id: str, db: AsyncSession = Depends(get_db)):
    u_res = await db.execute(select(User).where(User.id == user_id))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    feed = []

    recent_rows = (await db.execute(
        select(Match, User).join(User, User.id == Match.player1_id)
        .order_by(Match.created_at.desc()).limit(20)
    )).all()

    if recent_rows:
        category_ids = list({row[0].category for row in recent_rows})
        user_ids = list({row[1].id for row in recent_rows})

        themes_res = await db.execute(select(Theme).where(Theme.id.in_(category_ids)))
        themes_map = {t.id: t for t in themes_res.scalars().all()}

        uxp_res = await db.execute(
            select(UserThemeXP).where(
                UserThemeXP.user_id.in_(user_ids),
                UserThemeXP.theme_id.in_(category_ids),
            )
        )
        uxp_map = {(ux.user_id, ux.theme_id): ux for ux in uxp_res.scalars().all()}
    else:
        themes_map: dict = {}
        uxp_map: dict = {}

    for row in recent_rows:
        m, u = row[0], row[1]
        theme_obj = themes_map.get(m.category)
        theme_name = theme_obj.name if theme_obj else m.category
        theme_color = (theme_obj.color_hex if theme_obj else None) or "#8A2BE2"
        is_perfect = m.player1_correct == 7
        is_self = u.id == user_id

        exploit_type = "victory" if m.winner_id == m.player1_id else "defeat"
        if is_perfect:
            exploit_type = "perfect"

        uxp = uxp_map.get((u.id, m.category))
        user_level = get_level(uxp.xp) if uxp else 0

        feed.append({
            "type": exploit_type, "id": f"match_{m.id}",
            "user_id": u.id, "user_pseudo": u.pseudo, "user_avatar_seed": u.avatar_seed,
            "user_avatar_url": getattr(u, 'avatar_url', None),
            "user_level": user_level,
            "category": m.category, "category_name": theme_name,
            "category_color": theme_color, "pillar_color": theme_color,
            "score": f"{m.player1_score} - {m.player2_score}",
            "correct": m.player1_correct, "opponent_pseudo": m.player2_pseudo,
            "xp_earned": m.xp_earned or 0, "is_self": is_self, "can_challenge": not is_self,
            "icon": "🏆" if is_perfect else ("⚔️" if exploit_type == "victory" else "💀"),
            "title": "Score Parfait 7/7 !" if is_perfect else (
                f"Victoire en {theme_name}" if exploit_type == "victory" else f"Match en {theme_name}"
            ),
            "created_at": m.created_at.isoformat(),
        })

    streak_res = await db.execute(
        select(User).where(User.current_streak >= 3).order_by(User.current_streak.desc()).limit(5)
    )
    for u in streak_res.scalars().all():
        if u.id == user_id:
            continue
        feed.append({
            "type": "streak", "id": f"streak_{u.id}",
            "user_id": u.id, "user_pseudo": u.pseudo, "user_avatar_seed": u.avatar_seed,
            "user_avatar_url": getattr(u, 'avatar_url', None),
            "user_level": 0,
            "category": "", "category_name": "",
            "category_color": "#FFD700", "pillar_color": "#FFD700",
            "title": f"Série de {u.current_streak} victoires !", "icon": "🔥",
            "can_challenge": True, "is_self": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    feed.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"feed": feed[:30]}


@router.get("/social/tribes")
async def social_tribes(user_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Get top player per theme (tribes)."""
    themes_res = await db.execute(select(Theme).order_by(Theme.super_category, Theme.cluster, Theme.name))
    all_themes = themes_res.scalars().all()

    tribes = []
    for theme in all_themes:
        top_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.theme_id == theme.id)
            .order_by(UserThemeXP.xp.desc()).limit(1)
        )
        top_uxp = top_res.scalar_one_or_none()
        throne = None
        member_count = 0

        if top_uxp:
            u_res = await db.execute(select(User).where(User.id == top_uxp.user_id))
            top_user = u_res.scalar_one_or_none()
            if top_user:
                lvl = get_level(top_uxp.xp)
                throne = {
                    "id": top_user.id, "pseudo": top_user.pseudo, "avatar_seed": top_user.avatar_seed,
                    "avatar_url": getattr(top_user, 'avatar_url', None),
                    "level": lvl, "title": get_theme_title(theme, lvl), "xp": top_uxp.xp,
                }
            count_res = await db.execute(
                select(func.count(UserThemeXP.id)).where(UserThemeXP.theme_id == theme.id, UserThemeXP.xp > 0)
            )
            member_count = count_res.scalar() or 0

        sc_meta = SUPER_CATEGORY_META.get(theme.super_category, {})
        tribes.append({
            "id": theme.id, "name": theme.name, "icon": sc_meta.get("icon", ""),
            "pillar_id": theme.super_category, "pillar_name": theme.super_category,
            "pillar_color": theme.color_hex or sc_meta.get("color", "#8A2BE2"),
            "throne": throne, "member_count": member_count,
        })

    return {"tribes": tribes}


@router.get("/social/coach/{user_id}")
async def social_coach(user_id: str, db: AsyncSession = Depends(get_db)):
    u_res = await db.execute(select(User).where(User.id == user_id))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    suggestions = []

    # Find rivals with similar total XP
    xp_range = max(user.total_xp - 500, 0), user.total_xp + 500
    rivals_res = await db.execute(
        select(User).where(
            User.id != user_id, User.total_xp.between(xp_range[0], xp_range[1])
        ).order_by(func.random()).limit(3)
    )
    rivals = rivals_res.scalars().all()

    # Get user's theme XPs
    user_xps_res = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == user_id))
    user_xps = {uxp.theme_id: uxp.xp for uxp in user_xps_res.scalars().all()}

    for rival in rivals:
        rival_xps_res = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == rival.id))
        for rival_uxp in rival_xps_res.scalars().all():
            my_xp = user_xps.get(rival_uxp.theme_id, 0)
            if rival_uxp.xp > my_xp and rival_uxp.xp > 0:
                theme_name, theme_color = await _get_theme_info(db, rival_uxp.theme_id)
                suggestions.append({
                    "type": "rivalry", "rival_id": rival.id,
                    "rival_pseudo": rival.pseudo, "rival_avatar_seed": rival.avatar_seed,
                    "rival_avatar_url": getattr(rival, 'avatar_url', None),
                    "category": rival_uxp.theme_id, "category_name": theme_name, "category_color": theme_color,
                    "rival_level": get_level(rival_uxp.xp),
                    "my_level": get_level(my_xp),
                    "message": f"@{rival.pseudo} te devance en {theme_name} ! Reprends ton trône !",
                    "icon": "⚡",
                })
                break

    # Suggest weakest theme
    if user_xps:
        weakest_tid = min(user_xps, key=user_xps.get)
        weakest_xp = user_xps[weakest_tid]
        theme_name, theme_color = await _get_theme_info(db, weakest_tid)
        suggestions.append({
            "type": "improve", "category": weakest_tid, "category_name": theme_name,
            "category_color": theme_color,
            "message": f"Tu n'as que {int(weakest_xp)} XP en {theme_name}. Lance un match pour progresser !",
            "icon": "📈",
        })

    return {"suggestions": suggestions[:5]}


# ── Home Feed ──

@router.get("/feed/home/{user_id}")
async def get_home_feed(user_id: str, limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)):
    limit = min(limit, 100)
    u_res = await db.execute(select(User).where(User.id == user_id))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    recent_matches = await db.execute(
        select(Match).where(Match.player1_id == user_id).order_by(Match.created_at.desc()).limit(5)
    )
    matches = recent_matches.scalars().all()

    pending_duels = []
    for m in matches:
        theme_name, theme_color = await _get_theme_info(db, m.category)
        pending_duels.append({
            "id": m.id, "opponent_pseudo": m.player2_pseudo,
            "opponent_avatar_seed": secrets.token_hex(4),
            "category": m.category, "category_name": theme_name, "category_color": theme_color,
            "player_score": m.player1_score, "opponent_score": m.player2_score,
            "won": m.winner_id == user_id, "created_at": m.created_at.isoformat(),
        })

    social_feed = []

    perfect_matches = await db.execute(
        select(Match, User).join(User, User.id == Match.player1_id)
        .where(Match.player1_correct == 7).order_by(Match.created_at.desc()).limit(5)
    )
    for match_row in perfect_matches:
        m = match_row[0]
        u = match_row[1]
        theme_name, theme_color = await _get_theme_info(db, m.category)
        social_feed.append({
            "type": "record", "id": f"record_{m.id}",
            "user_pseudo": u.pseudo, "user_avatar_seed": u.avatar_seed,
            "user_avatar_url": getattr(u, 'avatar_url', None),
            "theme_id": m.category,
            "category": m.category, "category_name": theme_name, "category_color": theme_color,
            "title": "Score parfait !", "body": f"@{u.pseudo} a réalisé un 7/7 en {theme_name} !",
            "score": f"{m.player1_score} - {m.player2_score}", "icon": "🏆",
            "xp_earned": m.xp_earned or 0, "created_at": m.created_at.isoformat(),
        })

    recent_posts = await db.execute(
        select(WallPost).order_by(WallPost.created_at.desc()).limit(8)
    )
    posts = recent_posts.scalars().all()

    if posts:
        post_ids = [p.id for p in posts]
        author_ids = list({p.user_id for p in posts})

        # Batch fetch authors
        authors_res = await db.execute(select(User).where(User.id.in_(author_ids)))
        authors_map = {u.id: u for u in authors_res.scalars().all()}

        # Batch fetch likes counts
        likes_res = await db.execute(
            select(PostLike.post_id, func.count(PostLike.id))
            .where(PostLike.post_id.in_(post_ids))
            .group_by(PostLike.post_id)
        )
        likes_map = {row[0]: row[1] for row in likes_res}

        # Batch fetch comments counts
        comments_res = await db.execute(
            select(PostComment.post_id, func.count(PostComment.id))
            .where(PostComment.post_id.in_(post_ids))
            .group_by(PostComment.post_id)
        )
        comments_map = {row[0]: row[1] for row in comments_res}

        # Batch fetch user's likes
        user_likes_res = await db.execute(
            select(PostLike.post_id).where(PostLike.post_id.in_(post_ids), PostLike.user_id == user_id)
        )
        user_liked_set = {row[0] for row in user_likes_res}

        for p in posts:
            p_user = authors_map.get(p.user_id)
            theme_name, theme_color = await _get_theme_info(db, p.category_id)

            social_feed.append({
                "type": "community", "id": f"post_{p.id}", "post_id": p.id,
                "user_id": p.user_id,
                "user_pseudo": p_user.pseudo if p_user else "Inconnu",
                "user_avatar_seed": p_user.avatar_seed if p_user else "",
                "user_avatar_url": getattr(p_user, 'avatar_url', None) if p_user else None,
                "theme_id": p.category_id,
                "category": p.category_id, "category_name": theme_name, "category_color": theme_color,
                "content": p.content, "has_image": bool(p.image_base64),
                "likes_count": likes_map.get(p.id, 0), "comments_count": comments_map.get(p.id, 0),
                "is_liked": p.id in user_liked_set, "created_at": p.created_at.isoformat(),
            })

    # Random theme events
    themes_res = await db.execute(select(Theme).order_by(func.random()).limit(2))
    event_themes = themes_res.scalars().all()
    for et in event_themes:
        social_feed.append({
            "type": "event", "id": f"event_{et.id}",
            "theme_id": et.id,
            "category": et.id, "category_name": et.name,
            "category_color": et.color_hex or "#8A2BE2",
            "title": f"XP x2 en {et.name}", "body": f"Double XP sur le thème {et.name} pendant 1h !",
            "icon": "⚡", "created_at": datetime.now(timezone.utc).isoformat(),
        })

    social_feed.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    country_flag = COUNTRY_FLAGS.get(user.country or "", "")

    return {
        "user": {
            "pseudo": user.pseudo, "avatar_seed": user.avatar_seed,
            "avatar_url": getattr(user, 'avatar_url', None),
            "total_xp": user.total_xp, "current_streak": user.current_streak,
            "last_played_at": user.last_played_at.isoformat() if user.last_played_at else None,
            "best_streak": user.best_streak,
            "streak_badge": get_streak_badge(user.current_streak),
            "matches_played": user.matches_played, "matches_won": user.matches_won,
            "country_flag": country_flag,
            "selected_title": user.selected_title or "Novice",
        },
        "pending_duels": pending_duels[:5],
        "social_feed": social_feed[offset:offset + limit],
    }

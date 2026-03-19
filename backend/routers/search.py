from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Question, Match, Theme, UserThemeXP, WallPost, PostLike, PostComment
from constants import DIFFICULTY_LEVELS, COUNTRY_FLAGS
from services.xp import get_level, get_theme_title, get_theme_unlocked_titles, get_xp_progress

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/themes")
async def search_themes(
    q: Optional[str] = None, difficulty: Optional[str] = None,
    user_id: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    query_lower = (q or "").strip().lower()

    # Get all themes from DB
    themes_res = await db.execute(select(Theme).order_by(Theme.super_category, Theme.name))
    all_themes = themes_res.scalars().all()

    # Get user's theme XPs if logged in
    user_xps = {}
    if user_id:
        xp_res = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == user_id))
        user_xps = {uxp.theme_id: uxp.xp for uxp in xp_res.scalars().all()}

    results = []
    for theme in all_themes:
        score = 0
        if query_lower:
            if query_lower in theme.name.lower():
                score += 100
            if query_lower in (theme.cluster or "").lower():
                score += 50
            if query_lower in (theme.super_category or "").lower():
                score += 30
            if query_lower in (theme.description or "").lower():
                score += 20
        else:
            score = 50

        if score == 0 and query_lower:
            continue

        user_xp = user_xps.get(theme.id, 0)
        user_level = get_level(user_xp)
        user_title = get_theme_title(theme, user_level)

        if difficulty and difficulty in DIFFICULTY_LEVELS:
            d = DIFFICULTY_LEVELS[difficulty]
            if user_level < d["min"] or user_level > d["max"]:
                continue

        difficulty_label = "Nouveau"
        for d_key, d_val in DIFFICULTY_LEVELS.items():
            if d_val["min"] <= user_level <= d_val["max"]:
                difficulty_label = d_val["label"]
                break

        results.append({
            "id": theme.id, "name": theme.name,
            "description": theme.description or "",
            "total_questions": theme.question_count or 0,
            "color_hex": theme.color_hex or "#8A2BE2",
            "user_level": user_level, "user_title": user_title,
            "difficulty_label": difficulty_label, "relevance_score": score,
        })

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results


@router.get("/players")
async def search_players_enhanced(
    q: Optional[str] = None, title: Optional[str] = None,
    country: Optional[str] = None, min_level: Optional[int] = None,
    limit: int = 20, db: AsyncSession = Depends(get_db)
):
    query = select(User)

    if q and q.strip():
        search_term = q.strip()
        if search_term.startswith("@"):
            query = query.where(User.pseudo == search_term[1:])
        else:
            query = query.where(User.pseudo.ilike(f"%{search_term}%"))

    if country and country.strip():
        query = query.where(User.country.ilike(f"%{country.strip()}%"))

    query = query.order_by(User.total_xp.desc())

    result = await db.execute(query.limit(limit))
    users = result.scalars().all()

    players = []
    for u in users:
        # Get best theme
        best_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == u.id).order_by(UserThemeXP.xp.desc()).limit(1)
        )
        best_uxp = best_res.scalar_one_or_none()
        best_level = get_level(best_uxp.xp) if best_uxp else 0
        best_title = ""
        if best_uxp:
            t_res = await db.execute(select(Theme).where(Theme.id == best_uxp.theme_id))
            best_theme = t_res.scalar_one_or_none()
            if best_theme:
                best_title = get_theme_title(best_theme, best_level)

        player_title = u.selected_title or best_title or "Novice"

        if title and title.strip():
            title_lower = title.strip().lower()
            if title_lower not in player_title.lower():
                continue

        if min_level and min_level > 0 and best_level < min_level:
            continue

        players.append({
            "id": u.id, "pseudo": u.pseudo, "avatar_seed": u.avatar_seed,
            "country": u.country, "country_flag": COUNTRY_FLAGS.get(u.country or "", ""),
            "total_xp": u.total_xp, "matches_played": u.matches_played,
            "selected_title": player_title, "best_level": best_level,
        })

    return players


@router.get("/content")
async def search_content(
    q: str, category: Optional[str] = None,
    user_id: Optional[str] = None, limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    if not q or not q.strip():
        return {"posts": [], "comments": []}

    search_term = q.strip()

    post_query = select(WallPost).where(WallPost.content.ilike(f"%{search_term}%"))
    if category:
        post_query = post_query.where(WallPost.category_id == category)
    post_query = post_query.order_by(WallPost.created_at.desc()).limit(limit)
    post_result = await db.execute(post_query)
    posts = post_result.scalars().all()

    post_data = []
    for p in posts:
        u_res = await db.execute(select(User).where(User.id == p.user_id))
        author = u_res.scalar_one_or_none()

        likes_res = await db.execute(select(func.count(PostLike.id)).where(PostLike.post_id == p.id))
        likes_count = likes_res.scalar() or 0

        comments_res = await db.execute(select(func.count(PostComment.id)).where(PostComment.post_id == p.id))
        comments_count = comments_res.scalar() or 0

        is_liked = False
        if user_id:
            like_check = await db.execute(
                select(PostLike).where(PostLike.user_id == user_id, PostLike.post_id == p.id)
            )
            is_liked = like_check.scalar_one_or_none() is not None

        # Get theme name
        theme_name = p.category_id
        t_res = await db.execute(select(Theme).where(Theme.id == p.category_id))
        theme = t_res.scalar_one_or_none()
        if theme:
            theme_name = theme.name

        post_data.append({
            "id": p.id, "category_id": p.category_id,
            "category_name": theme_name,
            "user": {
                "id": author.id if author else "", "pseudo": author.pseudo if author else "Inconnu",
                "avatar_seed": author.avatar_seed if author else "",
            },
            "content": p.content, "has_image": bool(p.image_base64),
            "likes_count": likes_count, "comments_count": comments_count,
            "is_liked": is_liked, "created_at": p.created_at.isoformat(),
        })

    comment_query = select(PostComment).where(PostComment.content.ilike(f"%{search_term}%"))
    comment_query = comment_query.order_by(PostComment.created_at.desc()).limit(limit)
    comment_result = await db.execute(comment_query)
    comments = comment_result.scalars().all()

    comment_data = []
    for c in comments:
        u_res = await db.execute(select(User).where(User.id == c.user_id))
        author = u_res.scalar_one_or_none()
        p_res = await db.execute(select(WallPost).where(WallPost.id == c.post_id))
        parent_post = p_res.scalar_one_or_none()

        cat_name = ""
        if parent_post:
            t_res = await db.execute(select(Theme).where(Theme.id == parent_post.category_id))
            theme = t_res.scalar_one_or_none()
            cat_name = theme.name if theme else parent_post.category_id

        comment_data.append({
            "id": c.id, "post_id": c.post_id,
            "category_id": parent_post.category_id if parent_post else "",
            "category_name": cat_name,
            "user": {
                "id": author.id if author else "", "pseudo": author.pseudo if author else "Inconnu",
                "avatar_seed": author.avatar_seed if author else "",
            },
            "content": c.content, "created_at": c.created_at.isoformat(),
        })

    return {"posts": post_data, "comments": comment_data}


@router.get("/trending")
async def get_trending(db: AsyncSession = Depends(get_db)):
    # Popular themes by match count
    popular_themes = []
    themes_res = await db.execute(select(Theme).order_by(Theme.name))
    all_themes = themes_res.scalars().all()
    for t in all_themes:
        m_count = await db.execute(select(func.count(Match.id)).where(Match.category == t.id))
        count = m_count.scalar() or 0
        if count > 0:
            popular_themes.append({"id": t.id, "name": t.name, "match_count": count})
    popular_themes.sort(key=lambda x: x["match_count"], reverse=True)

    trending_tags = [
        {"tag": "Squid Game 3", "icon": "🦑", "type": "hot"},
        {"tag": "Champions League", "icon": "⚽", "type": "hot"},
        {"tag": "IA & Robots", "icon": "🤖", "type": "trend"},
        {"tag": "Star Wars", "icon": "⭐", "type": "classic"},
        {"tag": "Gastronomie française", "icon": "🥐", "type": "trend"},
        {"tag": "Histoire de France", "icon": "🏰", "type": "classic"},
        {"tag": "K-Pop", "icon": "🎤", "type": "trend"},
        {"tag": "Astronomie", "icon": "🔭", "type": "hot"},
    ]

    top_players_res = await db.execute(select(User).order_by(User.total_xp.desc()).limit(5))
    top_players = top_players_res.scalars().all()
    top_players_data = [{
        "id": u.id, "pseudo": u.pseudo, "avatar_seed": u.avatar_seed,
        "total_xp": u.total_xp, "country_flag": COUNTRY_FLAGS.get(u.country or "", ""),
    } for u in top_players]

    return {
        "popular_categories": popular_themes[:5],
        "trending_tags": trending_tags,
        "top_players": top_players_data,
    }

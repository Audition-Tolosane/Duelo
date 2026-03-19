from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Match, PlayerFollow, Theme, UserThemeXP
from schemas import SelectTitleRequest
from constants import COUNTRY_FLAGS
from services.xp import (
    get_level, get_xp_progress, get_streak_badge,
    get_theme_title, get_theme_unlocked_titles, get_all_unlocked_titles_v2,
)

router = APIRouter(tags=["profile"])


@router.get("/profile/{user_id}")
async def get_profile(user_id: str, pseudo: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Profile with theme-based XP system."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(id=user_id, pseudo=pseudo or f"Joueur_{user_id[:6]}", is_guest=True)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    xp_result = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == user_id))
    user_xps = xp_result.scalars().all()
    xp_map = {uxp.theme_id: uxp.xp for uxp in user_xps}

    theme_ids = list(xp_map.keys())
    themes_data = []
    all_unlocked_titles = []
    if theme_ids:
        themes_res = await db.execute(select(Theme).where(Theme.id.in_(theme_ids)))
        themes = {t.id: t for t in themes_res.scalars().all()}

        for tid, xp in sorted(xp_map.items(), key=lambda x: -x[1]):
            t = themes.get(tid)
            if not t:
                continue
            lvl = get_level(xp)
            title = get_theme_title(t, lvl)
            themes_data.append({
                "id": t.id, "name": t.name, "super_category": t.super_category,
                "cluster": t.cluster, "color_hex": t.color_hex or "#8A2BE2",
                "icon_url": t.icon_url or "", "xp": xp, "level": lvl,
                "title": title, "xp_progress": get_xp_progress(xp, lvl),
            })
            for ut in get_theme_unlocked_titles(t, lvl):
                all_unlocked_titles.append({**ut, "theme_id": t.id, "theme_name": t.name})

    matches_res = await db.execute(
        select(Match).where(Match.player1_id == user_id).order_by(Match.created_at.desc()).limit(10)
    )
    matches = matches_res.scalars().all()

    followers_count_res = await db.execute(
        select(func.count(PlayerFollow.id)).where(PlayerFollow.followed_id == user_id)
    )
    followers_count = followers_count_res.scalar() or 0
    following_count_res = await db.execute(
        select(func.count(PlayerFollow.id)).where(PlayerFollow.follower_id == user_id)
    )
    following_count = following_count_res.scalar() or 0

    country_flag = COUNTRY_FLAGS.get(user.country or "", "")

    return {
        "user": {
            "id": user.id, "pseudo": user.pseudo, "avatar_seed": user.avatar_seed,
            "is_guest": user.is_guest, "total_xp": user.total_xp,
            "selected_title": user.selected_title,
            "country": user.country, "country_flag": country_flag,
            "matches_played": user.matches_played, "matches_won": user.matches_won,
            "best_streak": user.best_streak, "current_streak": user.current_streak,
            "streak_badge": get_streak_badge(user.current_streak),
            "win_rate": round(user.matches_won / max(user.matches_played, 1) * 100),
            "followers_count": followers_count,
            "following_count": following_count,
        },
        "themes": themes_data,
        "all_unlocked_titles": all_unlocked_titles,
        "match_history": [
            {
                "id": m.id, "category": m.category,
                "player_score": m.player1_score, "opponent_score": m.player2_score,
                "opponent": m.player2_pseudo, "won": m.winner_id == user_id,
                "xp_earned": m.xp_earned or 0, "xp_breakdown": m.xp_breakdown,
                "correct_count": m.player1_correct or 0,
                "created_at": m.created_at.isoformat()
            } for m in matches
        ],
    }


# Keep /profile-v2 as alias for frontend compatibility
@router.get("/profile-v2/{user_id}")
async def get_profile_v2(user_id: str, pseudo: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    return await get_profile(user_id, pseudo, db)


@router.post("/user/select-title")
async def select_title(data: SelectTitleRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # Get all unlocked titles from themes
    xp_result = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == data.user_id))
    user_xps = xp_result.scalars().all()
    theme_ids = [uxp.theme_id for uxp in user_xps]

    if theme_ids:
        themes_res = await db.execute(select(Theme).where(Theme.id.in_(theme_ids)))
        themes_map = {t.id: t for t in themes_res.scalars().all()}
    else:
        themes_map = {}

    all_titles = get_all_unlocked_titles_v2(user_xps, themes_map)
    unlocked_names = [t["title"] for t in all_titles]
    if data.title not in unlocked_names:
        raise HTTPException(status_code=400, detail="Ce titre n'est pas encore débloqué")

    user.selected_title = data.title
    await db.commit()
    return {"success": True, "selected_title": data.title}

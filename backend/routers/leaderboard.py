from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Match, PlayerFollow
from services.xp import get_streak_badge, get_level
from datetime import datetime, timezone, timedelta
from services.geo import pick_area
from auth_middleware import get_optional_user_id, get_current_user_id

router = APIRouter(tags=["leaderboard"])


async def get_optional_user(
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not user_id:
        return None
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


async def _area_meta(db, user, area: dict, lang: str = "fr") -> dict:
    """meta du classement local. Anciennes apps : bandeau « pas assez de joueurs à X » avec le
    nom de la zone retenue (champ country_name), nouvelles : niveau (area_level) + nom.
    Noms affichés dans la langue du joueur (on regroupe avec le nom local : 東京 → « Tokyo »)."""
    from services.geo import display_name
    fallback = not (area["level"] == "city")
    level = {"nearby_city": "city"}.get(area["level"], area["level"])
    shown = area["name"]
    if level in ("city", "department", "region"):
        shown = await display_name(db, user.country, level, area["name"], lang)
    city_shown = await display_name(db, user.country, "city", user.city, lang)
    return {
        "scope_used": "city" if area["level"] in ("city", "nearby_city") else area["level"],
        "area_level": area["level"], "area_name": shown,
        "city_name": city_shown, "country_name": shown or "Monde",
        "too_small": fallback, "fallback": fallback,
    }


def _serialize_users(users, offset=0):
    return [
        {
            "id": u.id,
            "pseudo": u.pseudo,
            "avatar_seed": u.avatar_seed,
            "avatar_url": getattr(u, "avatar_url", None),
            "total_xp": u.total_xp,
            "level": get_level(u.total_xp),
            "title": u.selected_title or "",
            "matches_won": u.matches_won,
            "current_streak": u.current_streak,
            "streak_badge": get_streak_badge(u.current_streak),
            "rank": offset + i + 1,
        }
        for i, u in enumerate(users)
    ]


@router.get("/leaderboard")
async def get_leaderboard(
    scope: str = "world",
    view: str = "alltime",
    category: Optional[str] = None,
    limit: int = 50,
    city_override: Optional[str] = None,
    lang: str = "fr",
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(1, limit), 100)
    # ── World ──────────────────────────────────────────────────────────────────
    if scope == "world":
        result = await db.execute(select(User).where(User.is_bot == False).order_by(User.total_xp.desc()).limit(limit))
        return {"entries": _serialize_users(result.scalars().all()), "meta": {"scope_used": "world"}}

    # ── Continent ──────────────────────────────────────────────────────────────
    if scope == "continent":
        if not current_user or not current_user.continent:
            return {"entries": [], "meta": {"scope_used": "continent", "missing": True}}
        result = await db.execute(
            select(User).where(User.is_bot == False, User.continent == current_user.continent)
            .order_by(User.total_xp.desc()).limit(limit)
        )
        return {"entries": _serialize_users(result.scalars().all()), "meta": {"scope_used": "continent"}}

    # ── Region ─────────────────────────────────────────────────────────────────
    if scope == "region":
        if not current_user or not current_user.region:
            return {"entries": [], "meta": {"scope_used": "region", "missing": True}}
        q = select(User).where(User.is_bot == False, User.region == current_user.region)
        if current_user.country:
            q = q.where(User.country == current_user.country)
        result = await db.execute(q.order_by(User.total_xp.desc()).limit(limit))
        return {"entries": _serialize_users(result.scalars().all()), "meta": {"scope_used": "region"}}

    # ── Country ────────────────────────────────────────────────────────────────
    if scope == "country":
        if not current_user or not current_user.country:
            return {"entries": [], "meta": {"scope_used": "country", "missing": True}}
        result = await db.execute(
            select(User).where(User.is_bot == False, User.country == current_user.country)
            .order_by(User.total_xp.desc()).limit(limit)
        )
        return {"entries": _serialize_users(result.scalars().all()), "meta": {"scope_used": "country"}}

    # ── Ville (classement local en cascade, voir services/geo.py) ─────────────
    if scope == "city":
        if not current_user or not current_user.city:
            return {"entries": [], "meta": {"scope_used": "city", "missing": True}}
        if city_override:
            # Classement d'une autre ville (lien depuis une ancienne suggestion)
            res = await db.execute(
                select(User).where(User.is_bot == False, User.city == city_override,  # noqa: E712
                                   User.country == current_user.country)
                .order_by(User.total_xp.desc()).limit(limit)
            )
            return {"entries": _serialize_users(res.scalars().all()),
                    "meta": {"scope_used": "city", "city_name": city_override}}

        async def count(filters):
            return (await db.execute(
                select(func.count(User.id)).where(User.is_bot == False, *filters)  # noqa: E712
            )).scalar() or 0

        async def cities(filters):
            return (await db.execute(
                select(User.city, func.count(User.id), func.avg(User.lat), func.avg(User.lng))
                .where(User.is_bot == False, User.city.isnot(None), *filters)  # noqa: E712
                .group_by(User.city)
            )).all()

        area = await pick_area(current_user, count, cities)
        res = await db.execute(
            select(User).where(User.is_bot == False, *area["filters"])  # noqa: E712
            .order_by(User.total_xp.desc()).limit(limit)
        )
        return {"entries": _serialize_users(res.scalars().all()), "meta": await _area_meta(db, current_user, area, lang)}

    # ── Friends ────────────────────────────────────────────────────────────────
    if scope == "friends":
        if not current_user:
            return {"entries": [], "meta": {"scope_used": "friends", "missing": True}}
        follows_res = await db.execute(
            select(PlayerFollow.followed_id).where(PlayerFollow.follower_id == current_user.id)
        )
        friend_ids = [r[0] for r in follows_res] + [current_user.id]
        result = await db.execute(
            select(User).where(User.id.in_(friend_ids), User.is_bot == False)
            .order_by(User.total_xp.desc()).limit(limit)
        )
        return {"entries": _serialize_users(result.scalars().all()), "meta": {"scope_used": "friends"}}

    return {"entries": [], "meta": {"scope_used": scope}}


@router.get("/leaderboard/friends-weekly")
async def friends_weekly_leaderboard(
    user_id: str,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    """XP gagné cette semaine (lundi 00h → maintenant) parmi les joueurs suivis."""
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    monday = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Get followed user IDs
    follows_res = await db.execute(
        select(PlayerFollow.followed_id).where(PlayerFollow.follower_id == user_id)
    )
    followed_ids = [r[0] for r in follows_res] + [user_id]  # include self

    # XP this week per user (from matches)
    xp_res = await db.execute(
        select(Match.player1_id, func.sum(Match.xp_earned).label("weekly_xp"))
        .where(Match.player1_id.in_(followed_ids))
        .where(Match.created_at >= monday)
        .group_by(Match.player1_id)
    )
    xp_map = {r.player1_id: r.weekly_xp for r in xp_res}

    # Fetch user info
    users_res = await db.execute(select(User).where(User.id.in_(followed_ids), User.is_bot == False))
    users = users_res.scalars().all()

    entries = sorted([
        {
            "id": u.id,
            "pseudo": u.pseudo,
            "avatar_seed": u.avatar_seed,
            "avatar_url": getattr(u, "avatar_url", None),
            "weekly_xp": xp_map.get(u.id, 0),
            "total_xp": u.total_xp,
            "is_me": u.id == user_id,
        }
        for u in users
    ], key=lambda x: x["weekly_xp"], reverse=True)

    for i, e in enumerate(entries):
        e["rank"] = i + 1

    reset_at = (monday + timedelta(days=7)).isoformat()
    return {"entries": entries, "week_start": monday.isoformat(), "resets_at": reset_at}

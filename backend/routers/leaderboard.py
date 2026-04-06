from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Match, PlayerFollow
from services.xp import get_streak_badge, get_level
from datetime import datetime, timezone, timedelta
from services.geo import haversine, CITY_MIN_PLAYERS
from auth_middleware import get_optional_user_id

router = APIRouter(tags=["leaderboard"])


async def get_optional_user(
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not user_id:
        return None
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


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
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
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

    # ── City ───────────────────────────────────────────────────────────────────
    if scope == "city":
        if not current_user or not current_user.city:
            return {"entries": [], "meta": {"scope_used": "city", "missing": True}}

        # city_override allows viewing another city's leaderboard from suggestions
        target_city = city_override or current_user.city

        city_q = select(User).where(
            User.is_bot == False,
            User.city == target_city,
            User.country == current_user.country,
        ).order_by(User.total_xp.desc()).limit(limit)
        city_result = await db.execute(city_q)
        city_users = city_result.scalars().all()

        # Case 1: enough players in target city (own or override)
        if len(city_users) >= CITY_MIN_PLAYERS or city_override:
            return {
                "entries": _serialize_users(city_users),
                "meta": {"scope_used": "city", "city_name": target_city},
            }

        # Case 2: not enough — find nearby cities with 10+ players
        suggestions = []
        if current_user.lat and current_user.lng:
            # Get all cities in same country with their player count and centroid
            cities_q = (
                select(
                    User.city,
                    func.count(User.id).label("player_count"),
                    func.avg(User.lat).label("avg_lat"),
                    func.avg(User.lng).label("avg_lng"),
                )
                .where(
                    User.is_bot == False,
                    User.country == current_user.country,
                    User.city.isnot(None),
                    User.city != current_user.city,
                    User.lat.isnot(None),
                )
                .group_by(User.city)
                .having(func.count(User.id) >= CITY_MIN_PLAYERS)
            )
            cities_result = await db.execute(cities_q)
            candidate_cities = cities_result.all()

            # Sort by distance from user
            with_distance = [
                {
                    "city": row.city,
                    "player_count": row.player_count,
                    "distance_km": round(haversine(
                        current_user.lat, current_user.lng,
                        row.avg_lat, row.avg_lng,
                    )),
                }
                for row in candidate_cities
                if row.avg_lat and row.avg_lng
            ]
            suggestions = sorted(with_distance, key=lambda x: x["distance_km"])[:5]

        # Case 3: suggestions found → return them (no entries)
        if suggestions:
            return {
                "entries": [],
                "meta": {
                    "scope_used": "city",
                    "city_name": target_city,
                    "too_small": True,
                    "city_player_count": len(city_users),
                    "suggestions": suggestions,
                },
            }

        # Case 4: no suggestions → fallback to country leaderboard
        fallback_result = await db.execute(
            select(User).where(User.is_bot == False, User.country == current_user.country)
            .order_by(User.total_xp.desc()).limit(limit)
        )
        return {
            "entries": _serialize_users(fallback_result.scalars().all()),
            "meta": {
                "scope_used": "country",
                "city_name": target_city,
                "country_name": current_user.country,
                "too_small": True,
                "city_player_count": len(city_users),
                "fallback": True,
            },
        }

    return {"entries": [], "meta": {"scope_used": scope}}


@router.get("/leaderboard/friends-weekly")
async def friends_weekly_leaderboard(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
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

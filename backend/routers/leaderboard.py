from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User
from services.xp import get_streak_badge

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard")
async def get_leaderboard(
    scope: str = "world",
    view: str = "alltime",
    category: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    order_field = User.total_xp

    query = select(User).order_by(order_field.desc()).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    entries = []
    for i, u in enumerate(users):
        xp = u.total_xp
        entries.append({
            "pseudo": u.pseudo,
            "avatar_seed": u.avatar_seed,
            "total_xp": xp,
            "matches_won": u.matches_won,
            "current_streak": u.current_streak,
            "streak_badge": get_streak_badge(u.current_streak),
            "rank": i + 1,
        })
    return entries

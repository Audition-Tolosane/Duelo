from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from services.achievements import get_user_achievements
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("/mine")
async def my_achievements(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    achievements = await get_user_achievements(current_user, db)
    unlocked = [a for a in achievements if a["unlocked"]]
    in_progress = [a for a in achievements if not a["unlocked"]]
    return {
        "unlocked": unlocked,
        "in_progress": in_progress,
        "total_unlocked": len(unlocked),
        "total": len(achievements),
    }


@router.get("/player/{player_id}")
async def player_achievements(player_id: str, db: AsyncSession = Depends(get_db)):
    achievements = await get_user_achievements(player_id, db)
    return {
        "unlocked": [a for a in achievements if a["unlocked"]],
        "total_unlocked": sum(1 for a in achievements if a["unlocked"]),
    }

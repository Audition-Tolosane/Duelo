"""
Ligues & rangs — exposer le MMR comme rang visible.

Paliers :
  Bronze  : MMR < 1100
  Argent  : 1100 – 1299
  Or      : 1300 – 1599
  Diamant : 1600+

Saison mensuelle : reset le 1er de chaque mois (MMR revient à 1000 + 50 % du surplus).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/league", tags=["league"])

TIERS = [
    {"id": "diamond", "label": "Diamant", "min_mmr": 1600, "max_mmr": None,  "color": "#00D4FF"},
    {"id": "gold",    "label": "Or",       "min_mmr": 1300, "max_mmr": 1599,  "color": "#FFD700"},
    {"id": "silver",  "label": "Argent",   "min_mmr": 1100, "max_mmr": 1299,  "color": "#C0C0C0"},
    {"id": "bronze",  "label": "Bronze",   "min_mmr":    0, "max_mmr": 1099,  "color": "#CD7F32"},
]


def _get_tier(mmr: float) -> dict:
    for t in TIERS:
        if mmr >= t["min_mmr"]:
            return t
    return TIERS[-1]  # bronze fallback


def _tier_progress(mmr: float, tier: dict) -> float:
    """0-1 progress within the current tier."""
    if tier["max_mmr"] is None:
        return 1.0
    span = tier["max_mmr"] - tier["min_mmr"] + 1
    within = mmr - tier["min_mmr"]
    return round(min(max(within / span, 0.0), 1.0), 3)


def _current_season() -> dict:
    now = datetime.now(timezone.utc)
    # Season 1 = January 2025
    season_num = (now.year - 2025) * 12 + now.month
    # Next reset = 1st of next month
    if now.month == 12:
        next_reset = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_reset = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return {
        "number": max(season_num, 1),
        "name": f"Saison {max(season_num, 1)}",
        "next_reset": next_reset.isoformat(),
    }


@router.get("/status")
async def get_league_status(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's league tier, MMR, and rank."""
    res = await db.execute(select(User).where(User.id == current_user))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    mmr = float(user.mmr or 1000)
    tier = _get_tier(mmr)

    # Global rank (users with higher mmr + 1)
    rank_res = await db.execute(
        select(func.count(User.id)).where(
            User.mmr > mmr,
            User.is_bot == False,
        )
    )
    rank = (rank_res.scalar() or 0) + 1

    # How many players in same tier
    tier_count_res = await db.execute(
        select(func.count(User.id)).where(
            User.mmr >= tier["min_mmr"],
            User.mmr <= (tier["max_mmr"] or 9999),
            User.is_bot == False,
        )
    )
    tier_count = tier_count_res.scalar() or 1

    next_tier = next((t for t in TIERS if t["min_mmr"] > tier["min_mmr"] and (tier["max_mmr"] is not None)), None)

    return {
        "mmr": round(mmr),
        "tier": tier["id"],
        "tier_label": tier["label"],
        "tier_color": tier["color"],
        "tier_min": tier["min_mmr"],
        "tier_max": tier["max_mmr"],
        "tier_progress": _tier_progress(mmr, tier),
        "tier_count": tier_count,
        "next_tier": next_tier["id"] if next_tier else None,
        "next_tier_label": next_tier["label"] if next_tier else None,
        "next_tier_mmr": next_tier["min_mmr"] if next_tier else None,
        "global_rank": rank,
        "season": _current_season(),
    }

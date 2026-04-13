"""Daily spin wheel — 1 free spin per day."""
import random
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth_middleware import get_current_user_id
from database import get_db
from models import User, BoostActivation, Theme, SpinThemeUnlock

logger = logging.getLogger(__name__)
router = APIRouter(tags=["spin"])

# ── Reward table ──────────────────────────────────────────────────────────────
# Each entry: type, value, label, color, icon, weight (must sum to 100)
REWARDS = [
    {"type": "xp",    "value": 50,  "label": "50 XP",    "color": "#8A2BE2", "icon": "⚡",   "weight": 40},
    {"type": "xp",    "value": 100, "label": "100 XP",   "color": "#00AACC", "icon": "✨",   "weight": 25},
    {"type": "xp",    "value": 200, "label": "200 XP",   "color": "#FF6B35", "icon": "🔥",   "weight": 15},
    {"type": "xp",    "value": 500, "label": "500 XP",   "color": "#B8860B", "icon": "💎",   "weight": 5},
    {"type": "boost", "value": 15,  "label": "Boost ×2", "color": "#006644", "icon": "⚡×2", "weight": 10},
    {"type": "theme", "value": 24,  "label": "Thème 24h","color": "#880033", "icon": "🎭",   "weight": 5},
]

assert sum(r["weight"] for r in REWARDS) == 100, "Weights must sum to 100"


def _weighted_choice() -> tuple[dict, int]:
    """Return (reward, segment_index)."""
    r = random.randint(1, 100)
    cumulative = 0
    for i, reward in enumerate(REWARDS):
        cumulative += reward["weight"]
        if r <= cumulative:
            return reward, i
    return REWARDS[0], 0


def _is_new_day(last_spin: datetime, now: datetime) -> bool:
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if last_spin.tzinfo is None:
        last_spin = last_spin.replace(tzinfo=timezone.utc)
    return last_spin < today_start


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/spin/status")
async def spin_status(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user_res = await db.execute(select(User).where(User.id == current_user))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    last_spin = getattr(user, "last_spin_at", None)

    if not last_spin or _is_new_day(last_spin, now):
        return {"available": True, "next_spin_at": None, "rewards": REWARDS}

    next_spin_at = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return {"available": False, "next_spin_at": next_spin_at.isoformat(), "rewards": REWARDS}


@router.post("/spin/claim")
async def spin_claim(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user_res = await db.execute(select(User).where(User.id == current_user))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    last_spin = getattr(user, "last_spin_at", None)

    if last_spin and not _is_new_day(last_spin, now):
        raise HTTPException(status_code=400, detail="Déjà spinné aujourd'hui")

    reward, seg_index = _weighted_choice()
    applied: dict = {}

    if reward["type"] == "xp":
        user.total_xp = (user.total_xp or 0) + reward["value"]
        applied = {"xp": reward["value"]}

    elif reward["type"] == "boost":
        # Global 2x XP boost using sentinel theme_id "__spin__"
        expires_at = now + timedelta(minutes=reward["value"])
        activation = BoostActivation(
            user_id=current_user,
            theme_id="__spin__",
            activated_at=now,
            expires_at=expires_at,
        )
        db.add(activation)
        applied = {"boost_minutes": reward["value"], "expires_at": expires_at.isoformat()}

    elif reward["type"] == "theme":
        # Give 2x XP on a random theme for 24h
        themes_res = await db.execute(
            select(Theme).where(Theme.playable == True).order_by(func.random()).limit(1)
        )
        theme = themes_res.scalar_one_or_none()
        if theme:
            expires_at = now + timedelta(hours=reward["value"])
            unlock = SpinThemeUnlock(
                user_id=current_user,
                theme_id=theme.id,
                expires_at=expires_at,
            )
            db.add(unlock)
            # Also add a BoostActivation so get_active_boost picks it up
            activation = BoostActivation(
                user_id=current_user,
                theme_id=theme.id,
                activated_at=now,
                expires_at=expires_at,
            )
            db.add(activation)
            applied = {
                "theme_id": theme.id,
                "theme_name": theme.name,
                "expires_at": expires_at.isoformat(),
            }
        else:
            # Fallback — no playable theme found
            user.total_xp = (user.total_xp or 0) + 100
            applied = {"xp": 100}

    user.last_spin_at = now
    await db.commit()
    logger.info(f"[spin] user={current_user} won {reward['label']} (segment {seg_index})")

    return {
        "reward": {
            "type": reward["type"],
            "value": reward["value"],
            "label": reward["label"],
            "icon": reward["icon"],
            "color": reward["color"],
            "segment_index": seg_index,
        },
        "applied": applied,
    }

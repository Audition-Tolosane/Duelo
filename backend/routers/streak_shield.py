"""
Streak Shield  — protège la série de connexion ou de victoires.
Lives          — une vie permet de ne pas casser sa série de victoires après une défaite.
Les deux peuvent être obtenus via pub (rewarded ad) ou achat in-app.
"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import StreakShield, UserLives, User, Match
from auth_middleware import get_current_user_id

router = APIRouter(tags=["streak"])

SHIELD_DURATION_HOURS = 36  # covers missing one day


# ── Shield ────────────────────────────────────────────────────────────────────

async def get_active_shield(user_id: str, shield_type: str, db: AsyncSession) -> StreakShield | None:
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(StreakShield).where(
            StreakShield.user_id == user_id,
            StreakShield.shield_type == shield_type,
            StreakShield.expires_at > now,
            StreakShield.used == False,
        ).order_by(StreakShield.expires_at.desc()).limit(1)
    )
    return res.scalar_one_or_none()


@router.get("/streak-shield/status")
async def shield_status(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    login_shield = await get_active_shield(current_user, "login", db)
    win_shield = await get_active_shield(current_user, "win", db)
    lives_res = await db.execute(select(UserLives).where(UserLives.user_id == current_user))
    lives = lives_res.scalar_one_or_none()
    return {
        "login_shield_active": login_shield is not None,
        "login_shield_expires": login_shield.expires_at.isoformat() if login_shield else None,
        "win_shield_active": win_shield is not None,
        "win_shield_expires": win_shield.expires_at.isoformat() if win_shield else None,
        "lives": lives.lives if lives else 0,
    }


@router.post("/streak-shield/activate")
async def activate_shield(
    data: dict,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Called after rewarded ad or IAP. shield_type: 'login' or 'win'."""
    shield_type = data.get("shield_type", "login")
    if shield_type not in ("login", "win"):
        raise HTTPException(status_code=400, detail="shield_type doit être 'login' ou 'win'")

    existing = await get_active_shield(current_user, shield_type, db)
    if existing:
        raise HTTPException(status_code=400, detail="Un bouclier est déjà actif.")

    now = datetime.now(timezone.utc)
    shield = StreakShield(
        id=str(uuid.uuid4()),
        user_id=current_user,
        shield_type=shield_type,
        activated_at=now,
        expires_at=now + timedelta(hours=SHIELD_DURATION_HOURS),
        used=False,
    )
    db.add(shield)
    await db.commit()
    return {"expires_at": shield.expires_at.isoformat(), "shield_type": shield_type}


# ── Lives ─────────────────────────────────────────────────────────────────────

async def get_lives(user_id: str, db: AsyncSession) -> int:
    res = await db.execute(select(UserLives).where(UserLives.user_id == user_id))
    row = res.scalar_one_or_none()
    return row.lives if row else 0


async def add_lives(user_id: str, count: int, db: AsyncSession) -> int:
    res = await db.execute(select(UserLives).where(UserLives.user_id == user_id))
    row = res.scalar_one_or_none()
    if row:
        row.lives = max(0, row.lives + count)
    else:
        row = UserLives(id=str(uuid.uuid4()), user_id=user_id, lives=max(0, count))
        db.add(row)
    await db.commit()
    return row.lives


@router.post("/lives/earn")
async def earn_life(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Called after rewarded ad — grants 1 life."""
    new_total = await add_lives(current_user, 1, db)
    return {"lives": new_total}


@router.post("/lives/use")
async def use_life(
    data: dict,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Called after a loss to restore win streak.
    Requires match_id of the match just lost (recency check: last 5 min).
    """
    match_id = data.get("match_id")
    if not match_id:
        raise HTTPException(status_code=400, detail="match_id est requis")

    # Verify the match
    m_res = await db.execute(select(Match).where(Match.id == match_id, Match.player1_id == current_user))
    match = m_res.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    if match.winner_id == current_user:
        raise HTTPException(status_code=400, detail="Tu as gagné ce match, pas besoin de vie")

    now = datetime.now(timezone.utc)
    match_age = (now - match.created_at.replace(tzinfo=timezone.utc)).total_seconds()
    if match_age > 300:
        raise HTTPException(status_code=400, detail="Trop tard pour utiliser une vie sur ce match (max 5 min)")

    lives = await get_lives(current_user, db)
    if lives <= 0:
        raise HTTPException(status_code=400, detail="Aucune vie disponible")

    # Deduct life and restore streak
    await add_lives(current_user, -1, db)

    streak_before = match.player1_streak_before or 0
    user_res = await db.execute(select(User).where(User.id == current_user))
    user = user_res.scalar_one_or_none()
    if user:
        user.current_streak = streak_before
        if user.current_streak > (user.best_streak or 0):
            user.best_streak = user.current_streak
        # Undo win count (the loss shouldn't have changed wins, but update matches_won was already +0)
    await db.commit()

    return {"lives_remaining": lives - 1, "streak_restored": streak_before}

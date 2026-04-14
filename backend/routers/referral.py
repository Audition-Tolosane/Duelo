"""
Système de parrainage.
- Chaque utilisateur a un code unique de 8 caractères.
- Quand un nouveau joueur applique un code, le parrain reçoit 200 XP.
- À 3 filleuls confirmés, le parrain débloque un thème exclusif + 500 XP bonus.
"""
import secrets
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from auth_middleware import get_current_user_id
from services.notifications import create_notification

router = APIRouter(prefix="/referral", tags=["referral"])

REFERRAL_XP_PER_FRIEND = 200
REFERRAL_MILESTONE_XP = 500
REFERRAL_MILESTONE_COUNT = 3

ALPHABET = string.ascii_uppercase + string.digits


def _gen_code() -> str:
    return ''.join(secrets.choice(ALPHABET) for _ in range(8))


async def _ensure_code(user: User, db: AsyncSession) -> str:
    if not user.referral_code:
        # Keep generating until unique
        for _ in range(10):
            code = _gen_code()
            existing = await db.execute(select(User).where(User.referral_code == code))
            if not existing.scalar_one_or_none():
                user.referral_code = code
                await db.commit()
                break
    return user.referral_code


@router.get("/my-code")
async def get_my_code(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user_res = await db.execute(select(User).where(User.id == current_user))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    code = await _ensure_code(user, db)

    # Count referred users
    count_res = await db.execute(
        select(func.count(User.id)).where(User.referred_by == current_user)
    )
    referral_count = count_res.scalar() or 0
    milestone_reached = referral_count >= REFERRAL_MILESTONE_COUNT

    return {
        "code": code,
        "referral_count": referral_count,
        "milestone_count": REFERRAL_MILESTONE_COUNT,
        "milestone_reached": milestone_reached,
        "xp_per_friend": REFERRAL_XP_PER_FRIEND,
        "milestone_bonus_xp": REFERRAL_MILESTONE_XP,
    }


@router.post("/apply")
async def apply_referral(
    data: dict,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Apply a referral code. Can only be done once and not on own code."""
    code = (data.get("code") or "").strip().upper()
    if not code or len(code) != 8:
        raise HTTPException(status_code=400, detail="Code invalide")

    user_res = await db.execute(select(User).where(User.id == current_user))
    me = user_res.scalar_one_or_none()
    if not me:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if me.referred_by:
        raise HTTPException(status_code=400, detail="Tu as déjà utilisé un code de parrainage")

    # Find referrer by code
    ref_res = await db.execute(select(User).where(User.referral_code == code))
    referrer = ref_res.scalar_one_or_none()
    if not referrer:
        raise HTTPException(status_code=404, detail="Code introuvable")
    if referrer.id == current_user:
        raise HTTPException(status_code=400, detail="Tu ne peux pas utiliser ton propre code")

    # Apply referral
    me.referred_by = referrer.id

    # Reward referrer
    referrer.total_xp = (referrer.total_xp or 0) + REFERRAL_XP_PER_FRIEND

    # Count referrer's total referrals now
    count_res = await db.execute(
        select(func.count(User.id)).where(User.referred_by == referrer.id)
    )
    referral_count = (count_res.scalar() or 0) + 1  # +1 for me (not committed yet)

    # Milestone bonus
    milestone_bonus = False
    if referral_count == REFERRAL_MILESTONE_COUNT:
        referrer.total_xp = (referrer.total_xp or 0) + REFERRAL_MILESTONE_XP
        milestone_bonus = True

    await db.commit()

    # Notify referrer
    body = f"{me.pseudo} a rejoint Duelo grâce à ton code ! +{REFERRAL_XP_PER_FRIEND} XP"
    if milestone_bonus:
        body += f" · Palier {REFERRAL_MILESTONE_COUNT} filleuls atteint ! +{REFERRAL_MILESTONE_XP} XP bonus"
    await create_notification(
        db, referrer.id, "system", "🎉 Parrainage !",
        body, data={"screen": "profile"},
    )

    return {"success": True, "referrer_pseudo": referrer.pseudo}

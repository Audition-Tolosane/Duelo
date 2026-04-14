"""
Système de parrainage — récompenses Pro.

Paliers (filleuls CONFIRMÉS) :
  1 filleul  → +1 jour Pro
  2 filleuls → +2 jours Pro supplémentaires (total 3 j)
  3 filleuls → +4 jours Pro supplémentaires (total 7 j)

Anti-abus : un filleul n'est confirmé que si :
  1. Son compte est lié (non-guest : email, Google ou Apple)
  2. Il a joué au moins 3 parties
  3. Son compte a au moins 24h d'ancienneté

Ainsi, se déconnecter pour créer de faux comptes ne suffit pas :
chaque compte bidoune doit jouer 3 vraies parties ET attendre 24h
avant de rapporter quoi que ce soit.
"""
import secrets
import string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from auth_middleware import get_current_user_id
from services.notifications import create_notification

router = APIRouter(prefix="/referral", tags=["referral"])

# Jours Pro accordés à chaque palier (delta par palier)
PRO_MILESTONES = [
    {"count": 1, "delta_days": 1},   # 1er filleul → +1 j (total 1 j)
    {"count": 2, "delta_days": 2},   # 2e filleul  → +2 j (total 3 j)
    {"count": 3, "delta_days": 4},   # 3e filleul  → +4 j (total 7 j)
]

# Conditions de qualification d'un filleul
MIN_MATCHES = 3
MIN_ACCOUNT_AGE_HOURS = 24

ALPHABET = string.ascii_uppercase + string.digits


def _gen_code() -> str:
    return ''.join(secrets.choice(ALPHABET) for _ in range(8))


async def _ensure_code(user: User, db: AsyncSession) -> str:
    if not user.referral_code:
        for _ in range(10):
            code = _gen_code()
            existing = await db.execute(select(User).where(User.referral_code == code))
            if not existing.scalar_one_or_none():
                user.referral_code = code
                await db.commit()
                break
    return user.referral_code


def _grant_pro_days(user: User, days: int, now: datetime) -> None:
    """Extend or set pro_expires_at by `days` days from now (or from current expiry)."""
    base = user.pro_expires_at if (user.pro_expires_at and user.pro_expires_at > now) else now
    user.pro_expires_at = base + timedelta(days=days)


def _is_pro_active(user: User, now: datetime) -> bool:
    return bool(user.pro_expires_at and user.pro_expires_at > now)


def _count_confirmed_referrals(referrals: list[User]) -> int:
    return sum(1 for u in referrals if u.referral_confirmed)


async def check_referral_qualification(user_id: str, db: AsyncSession) -> bool:
    """
    Called after each match (from game.py).
    If the user is a filleul (has referred_by) and meets all criteria,
    confirms the referral and grants Pro days to the referrer.
    Returns True if newly confirmed.
    """
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        return False

    # Already confirmed or no referrer
    if user.referral_confirmed or not user.referred_by:
        return False

    # Must not be guest
    if user.is_guest:
        return False

    # Must have played enough matches
    if (user.matches_played or 0) < MIN_MATCHES:
        return False

    # Account must be old enough
    created = user.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age_hours = (datetime.now(timezone.utc) - created).total_seconds() / 3600
    if age_hours < MIN_ACCOUNT_AGE_HOURS:
        return False

    # Qualify!
    user.referral_confirmed = True

    # Fetch referrer
    ref_res = await db.execute(select(User).where(User.id == user.referred_by))
    referrer = ref_res.scalar_one_or_none()
    if not referrer:
        await db.commit()
        return True

    # Count confirmed referrals for referrer (including this one)
    count_res = await db.execute(
        select(func.count(User.id)).where(
            User.referred_by == referrer.id,
            User.referral_confirmed == True,
        )
    )
    confirmed_count = (count_res.scalar() or 0) + 1  # +1 for this user (not committed yet)

    now = datetime.now(timezone.utc)
    days_to_grant = 0
    for m in PRO_MILESTONES:
        if confirmed_count == m["count"]:
            days_to_grant = m["delta_days"]
            break

    if days_to_grant:
        _grant_pro_days(referrer, days_to_grant, now)

    await db.commit()

    # Notify referrer
    milestone = next((m for m in PRO_MILESTONES if m["count"] == confirmed_count), None)
    if milestone:
        total_days = sum(m["delta_days"] for m in PRO_MILESTONES if m["count"] <= confirmed_count)
        body = (
            f"{user.pseudo} est qualifié ! +{days_to_grant} jour{'s' if days_to_grant > 1 else ''} Pro "
            f"· Total : {total_days} j Pro cumulés"
        )
    else:
        body = f"{user.pseudo} a validé son parrainage !"

    await create_notification(
        db, referrer.id, "system", "🎉 Filleul qualifié !",
        body, data={"screen": "profile"},
    )
    return True


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
    now = datetime.now(timezone.utc)

    # All referrals + how many confirmed
    all_refs_res = await db.execute(
        select(User.referral_confirmed).where(User.referred_by == current_user)
    )
    rows = all_refs_res.all()
    total_referrals = len(rows)
    confirmed_referrals = sum(1 for r in rows if r[0])

    total_pro_days = sum(
        m["delta_days"] for m in PRO_MILESTONES if confirmed_referrals >= m["count"]
    )

    return {
        "code": code,
        "total_referrals": total_referrals,       # applied codes (pending)
        "confirmed_referrals": confirmed_referrals,  # qualified filleuls
        "milestones": PRO_MILESTONES,
        "total_pro_days_earned": total_pro_days,
        "pro_active": _is_pro_active(user, now),
        "pro_expires_at": user.pro_expires_at.isoformat() if user.pro_expires_at else None,
        "min_matches_required": MIN_MATCHES,
        "min_age_hours": MIN_ACCOUNT_AGE_HOURS,
    }


@router.post("/apply")
async def apply_referral(
    data: dict,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Apply a referral code.
    No immediate reward — reward is granted when filleul qualifies.
    """
    code = (data.get("code") or "").strip().upper()
    if not code or len(code) != 8:
        raise HTTPException(status_code=400, detail="Code invalide (8 caractères)")

    user_res = await db.execute(select(User).where(User.id == current_user))
    me = user_res.scalar_one_or_none()
    if not me:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if me.referred_by:
        raise HTTPException(status_code=400, detail="Tu as déjà utilisé un code de parrainage")

    ref_res = await db.execute(select(User).where(User.referral_code == code))
    referrer = ref_res.scalar_one_or_none()
    if not referrer:
        raise HTTPException(status_code=404, detail="Code introuvable")
    if referrer.id == current_user:
        raise HTTPException(status_code=400, detail="Tu ne peux pas utiliser ton propre code")

    me.referred_by = referrer.id
    await db.commit()

    return {
        "success": True,
        "referrer_pseudo": referrer.pseudo,
        "message": f"Code appliqué ! Joue {MIN_MATCHES} parties pour valider le parrainage.",
    }

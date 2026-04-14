"""
Système de parrainage — récompenses Pro.

Paliers (filleuls CONFIRMÉS) :
  1 filleul  → +1 jour Pro
  2 filleuls → +2 jours Pro supplémentaires (total 3 j)
  3 filleuls → +4 jours Pro supplémentaires (total 7 j)

Anti-abus (couches cumulées) :
  1. Compte non-guest (email/Google/Apple) + email normalisé (pas de +alias)
  2. Email non jetable (domaine blacklisté)
  3. ≥ 3 parties jouées
  4. Compte ≥ 24h d'ancienneté
  5. Plafond dur : max MAX_REFERRALS_PER_REFERRER filleuls confirmés par parrain
  6. Cooldown IP : un même IP ne peut confirmer qu'1 filleul par parrain sur 30 jours
"""
import secrets
import string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from auth_middleware import get_current_user_id
from services.notifications import create_notification

# ── Domaines email jetables connus ────────────────────────────────────────────
DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "throwaway.email", "yopmail.com", "sharklasers.com", "guerrillamailblock.com",
    "grr.la", "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
    "guerrillamail.net", "guerrillamail.org", "spam4.me", "trashmail.com",
    "trashmail.me", "trashmail.net", "trashmail.org", "trashmail.io",
    "dispostable.com", "mailnull.com", "spamgourmet.com", "maildrop.cc",
    "mailnesia.com", "discard.email", "spamhereplease.com", "fakeinbox.com",
    "tempr.email", "tempinbox.com", "mailtemp.net", "getnada.com",
    "anonaddy.com", "tmail.com", "mailsac.com", "33mail.com",
}

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
MAX_REFERRALS_PER_REFERRER = 3          # plafond dur : jamais plus de 3 filleuls récompensés
IP_COOLDOWN_DAYS = 30                   # un IP ne peut confirmer qu'1 filleul/parrain/30j

# Cache mémoire IP→{referrer_id: last_confirmation_ts}
# (suffisant pour Railway single-instance ; remplacer par Redis si multi-instance)
_ip_referral_log: dict[str, dict[str, datetime]] = {}

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


def _is_disposable_email(email: str | None) -> bool:
    if not email:
        return False
    domain = email.lower().split("@")[-1]
    return domain in DISPOSABLE_EMAIL_DOMAINS


async def check_referral_qualification(user_id: str, db: AsyncSession, client_ip: str = "") -> bool:
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

    # Email must not be from a disposable provider
    if _is_disposable_email(user.email):
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

    # Fetch referrer
    ref_res = await db.execute(select(User).where(User.id == user.referred_by))
    referrer = ref_res.scalar_one_or_none()
    if not referrer:
        user.referral_confirmed = True
        await db.commit()
        return True

    # Hard cap: referrer cannot get rewards beyond MAX_REFERRALS_PER_REFERRER
    count_res = await db.execute(
        select(func.count(User.id)).where(
            User.referred_by == referrer.id,
            User.referral_confirmed == True,
        )
    )
    confirmed_so_far = count_res.scalar() or 0
    if confirmed_so_far >= MAX_REFERRALS_PER_REFERRER:
        # Mark confirmed (user did the work) but grant no more rewards
        user.referral_confirmed = True
        await db.commit()
        return True

    # IP cooldown: one confirmation per IP per referrer per 30 days
    now = datetime.now(timezone.utc)
    if client_ip:
        ip_log = _ip_referral_log.get(client_ip, {})
        last_for_referrer = ip_log.get(referrer.id)
        if last_for_referrer and (now - last_for_referrer).days < IP_COOLDOWN_DAYS:
            return False  # same IP confirmed too recently for this referrer

    # All checks passed — confirm!
    user.referral_confirmed = True

    # Update IP log
    if client_ip:
        if client_ip not in _ip_referral_log:
            _ip_referral_log[client_ip] = {}
        _ip_referral_log[client_ip][referrer.id] = now

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

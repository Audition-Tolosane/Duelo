"""
Gestion des boosts x2 XP par utilisateur.
- Offres personnalisées : 1 thème du joueur + 1 thème populaire (ou 2 populaires si peu de thèmes joueur)
- Stables par créneau de 30 minutes ; changent automatiquement toutes les 30 min
- Pub disponible pour refresh immédiat (incrémente le compteur du créneau)
- Jamais le même thème deux fois dans la même journée
- Activation après pub → 6 minutes de x2 XP
"""
import uuid
from datetime import datetime, timezone, timedelta, date
from random import Random
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

BOOST_DURATION_MINUTES = 6


# ── Slot helpers ──────────────────────────────────────────────────────────────

def get_current_slot() -> str:
    """Retourne la clé du créneau courant : 'YYYY-MM-DD:HH:MM' (tranches de 30 min)."""
    now = datetime.now(timezone.utc)
    slot_min = (now.minute // 30) * 30
    return f"{now.date().isoformat()}:{now.hour:02d}:{slot_min:02d}"


def get_slot_expires_at() -> str:
    """ISO timestamp de fin du créneau courant."""
    now = datetime.now(timezone.utc)
    next_slot_min = ((now.minute // 30) + 1) * 30
    if next_slot_min >= 60:
        if now.hour >= 23:
            expires = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            expires = now.replace(hour=now.hour + 1, minute=0, second=0, microsecond=0)
    else:
        expires = now.replace(minute=next_slot_min, second=0, microsecond=0)
    return expires.isoformat()


# ── Refresh counter ───────────────────────────────────────────────────────────

async def _get_refresh_count(user_id: str, slot: str, db: AsyncSession) -> int:
    from models import BoostOfferRefresh
    res = await db.execute(
        select(BoostOfferRefresh.count)
        .where(BoostOfferRefresh.user_id == user_id)
        .where(BoostOfferRefresh.slot_key == slot)
    )
    return res.scalar_one_or_none() or 0


async def increment_offer_refresh(user_id: str, db: AsyncSession) -> None:
    """Incrémente le compteur de refresh pour le créneau courant."""
    from models import BoostOfferRefresh
    slot = get_current_slot()
    res = await db.execute(
        select(BoostOfferRefresh)
        .where(BoostOfferRefresh.user_id == user_id)
        .where(BoostOfferRefresh.slot_key == slot)
    )
    record = res.scalar_one_or_none()
    if record:
        record.count += 1
    else:
        record = BoostOfferRefresh(
            id=str(uuid.uuid4()),
            user_id=user_id,
            slot_key=slot,
            count=1,
        )
        db.add(record)
    await db.commit()


# ── Boost activations ─────────────────────────────────────────────────────────

async def get_used_theme_ids_today(user_id: str, db: AsyncSession) -> set:
    """Thèmes déjà boostés aujourd'hui par cet utilisateur."""
    from models import BoostActivation
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    res = await db.execute(
        select(BoostActivation.theme_id)
        .where(BoostActivation.user_id == user_id)
        .where(BoostActivation.activated_at >= today_start)
    )
    return {r[0] for r in res}


async def get_active_boost(user_id: str, theme_id: str, db: AsyncSession) -> bool:
    """Vérifie si l'utilisateur a un boost actif sur ce thème."""
    from models import BoostActivation
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(BoostActivation)
        .where(BoostActivation.user_id == user_id)
        .where(BoostActivation.theme_id == theme_id)
        .where(BoostActivation.expires_at > now)
    )
    return res.scalar_one_or_none() is not None


async def get_any_active_boost(user_id: str, db: AsyncSession):
    """Retourne le boost actif courant ou None."""
    from models import BoostActivation
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(BoostActivation)
        .where(BoostActivation.user_id == user_id)
        .where(BoostActivation.expires_at > now)
        .order_by(BoostActivation.expires_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


async def activate_boost(user_id: str, theme_id: str, db: AsyncSession) -> datetime:
    """Enregistre un nouveau boost. Retourne expires_at."""
    from models import BoostActivation
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=BOOST_DURATION_MINUTES)
    activation = BoostActivation(
        user_id=user_id, theme_id=theme_id,
        activated_at=now, expires_at=expires_at,
    )
    db.add(activation)
    await db.commit()
    return expires_at


# ── Smart popular theme picker ────────────────────────────────────────────────

async def _get_smart_popular(
    user_id: str,
    exclude_ids: set,
    rng: Random,
    db: AsyncSession,
):
    """
    Tirage pondéré d'un thème populaire adapté au joueur.
    Délègue le scoring à services.recommendations.
    """
    from services.recommendations import get_trending_themes_scored

    scored = await get_trending_themes_scored(db, user_id=user_id, limit=20, days=7, exclude_ids=exclude_ids)
    if not scored:
        return None

    themes_list = [e["theme"] for e in scored]
    weights = [e["score"] for e in scored]
    return rng.choices(themes_list, weights=weights, k=1)[0]


# ── Daily offers ──────────────────────────────────────────────────────────────

async def get_daily_offers(user_id: str, db: AsyncSession) -> list:
    """
    Retourne 2 thèmes à proposer pour le créneau courant (30 min) :
    - Si le joueur a des thèmes dispo : 1 thème du joueur + 1 thème tendance/affinité
    - Sinon : 2 thèmes tendance/affinité
    - Exclut les thèmes déjà boostés aujourd'hui
    - Seed = user + créneau 30 min + compteur de refreshs
    """
    from models import UserThemeXP, Theme

    used_today = await get_used_theme_ids_today(user_id, db)
    slot = get_current_slot()
    refresh_count = await _get_refresh_count(user_id, slot, db)
    rng = Random(f"{user_id}:{slot}:{refresh_count}")
    offers: list = []
    offered_ids: set = set(used_today)

    # ── Offre 1 : thème du joueur (si disponible) ──
    player_res = await db.execute(
        select(UserThemeXP.theme_id)
        .where(UserThemeXP.user_id == user_id)
        .where(~UserThemeXP.theme_id.in_(offered_ids) if offered_ids else True)
        .order_by(UserThemeXP.xp.desc())
        .limit(10)
    )
    player_candidates = [r[0] for r in player_res]

    if player_candidates:
        chosen_id = rng.choice(player_candidates)
        t_res = await db.execute(select(Theme).where(Theme.id == chosen_id))
        t = t_res.scalar_one_or_none()
        if t:
            offers.append(t)
            offered_ids.add(t.id)

    # ── Offre(s) restante(s) : thème tendance × affinité joueur ──
    for _ in range(2 - len(offers)):
        smart = await _get_smart_popular(user_id, offered_ids, rng, db)
        if smart:
            offers.append(smart)
            offered_ids.add(smart.id)

    return offers

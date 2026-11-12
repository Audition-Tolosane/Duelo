"""Pubs récompensées : la récompense n'est donnée que si Google confirme que la pub a été vue.

Déroulé (vérification côté serveur AdMob, « SSV ») :
  1. Avant la pub, l'app demande un code à usage unique : POST /api/ads/start → {nonce}.
  2. Elle le passe à AdMob (serverSideVerificationOptions.customData).
  3. Quand la pub est vue jusqu'au bout, les serveurs de Google appellent
     GET /api/ads/ssv?...&custom_data=<nonce>&signature=... ; la signature est vérifiée avec
     les clés publiques de Google, puis le code est marqué « vu ».
  4. L'app réclame sa récompense en envoyant le code (en-tête X-Ad-Token) ; verify_ad_reward
     attend la confirmation de Google (quelques secondes au plus) puis consomme le code.

Mise en route sans casser les apps déjà installées :
  - Sans code (anciennes apps) : accepté, avec un délai minimum entre deux récompenses, tant que
    ADS_SSV_REQUIRED ≠ 1.
  - Avec code mais sans confirmation : refusé seulement si Google a déjà envoyé au moins une
    confirmation ces dernières 24 h (preuve que la vérification est activée dans AdMob) ou si
    ADS_SSV_REQUIRED = 1. Sinon accepté (la vérification n'est pas encore branchée côté AdMob).
"""
import asyncio
import contextvars
import logging
import os
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, func

logger = logging.getLogger(__name__)

# Code de pub envoyé par l'app avec la requête en cours (posé par un middleware de server.py)
current_ad_token: contextvars.ContextVar[str] = contextvars.ContextVar("ad_token", default="")

_MIN_INTERVAL_S = 8          # une pub dure 15-30 s : plus rapide = script
_last_claim: dict[str, float] = {}
TOKEN_TTL = timedelta(minutes=15)
WAIT_FOR_GOOGLE_S = 8.0      # la confirmation de Google arrive en général en 1 à 3 s
_ssv_seen_at = 0.0           # dernière confirmation reçue (cache mémoire)


def ssv_required() -> bool:
    return os.environ.get("ADS_SSV_REQUIRED", "").strip() == "1"


def mark_ssv_seen() -> None:
    global _ssv_seen_at
    _ssv_seen_at = time.time()


async def _ssv_active(db) -> bool:
    """Google a-t-il envoyé au moins une confirmation ces dernières 24 h ?"""
    global _ssv_seen_at
    if time.time() - _ssv_seen_at < 86400:
        return True
    from models import AdView
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    n = (await db.execute(select(func.count()).select_from(AdView).where(AdView.verified_at >= since))).scalar() or 0
    if n:
        _ssv_seen_at = time.time()
    return bool(n)


def _throttle(user_id: str, action: str) -> None:
    key = f"{user_id}:{action}"
    now = time.time()
    if now - _last_claim.get(key, 0.0) < _MIN_INTERVAL_S:
        logger.warning(f"[ad_reward] throttled action={action} user={user_id}")
        raise HTTPException(status_code=429, detail="Trop rapide — patiente quelques secondes.")
    _last_claim[key] = now


async def verify_ad_reward(user_id: str, action: str) -> None:
    """Contrôle une récompense « pub vue ». Lève 403 si Google n'a pas confirmé la pub."""
    _throttle(user_id, action)
    token = current_ad_token.get()
    from database import AsyncSessionLocal
    from models import AdView

    if not token:
        if ssv_required():
            raise HTTPException(status_code=403, detail="Pub non confirmée — mets à jour l'application")
        logger.info(f"[ad_reward] granted (sans code) action={action} user={user_id}")
        return

    async with AsyncSessionLocal() as db:
        deadline = time.time() + WAIT_FOR_GOOGLE_S
        active = ssv_required() or await _ssv_active(db)
        while True:
            row = (await db.execute(
                select(AdView).where(AdView.nonce == token, AdView.user_id == user_id).with_for_update()
            )).scalar_one_or_none()
            if not row:
                raise HTTPException(status_code=403, detail="Pub inconnue")
            created = row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc)
            if row.used or datetime.now(timezone.utc) - created > TOKEN_TTL:
                raise HTTPException(status_code=403, detail="Pub déjà utilisée")
            if row.verified_at is not None:
                break
            if not active:
                logger.info(f"[ad_reward] granted (vérification AdMob pas encore active) action={action} user={user_id}")
                break
            if time.time() >= deadline:
                logger.warning(f"[ad_reward] refusé : pas de confirmation Google action={action} user={user_id}")
                raise HTTPException(status_code=403, detail="Pub non confirmée")
            await db.rollback()          # relâche le verrou pendant l'attente
            await asyncio.sleep(0.5)
        row.used = True
        row.action = action[:40]
        await db.commit()
    logger.info(f"[ad_reward] granted action={action} user={user_id}")

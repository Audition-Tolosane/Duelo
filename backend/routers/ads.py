"""Pubs récompensées : code avant la pub et confirmation des serveurs de Google (SSV AdMob).

Dans la console AdMob, bloc d'annonces récompensées → « Validation côté serveur » :
URL de rappel = https://duelo-production.up.railway.app/api/ads/ssv
"""
import base64
import logging
import time
import uuid
from datetime import datetime, timezone

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth_middleware import get_current_user_id
from database import get_db
from models import AdView
from rate_limit import _limiter
from services.ad_rewards import mark_ssv_seen

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ads", tags=["ads"])

KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json"
_keys: dict[str, object] = {}
_keys_at = 0.0


async def _google_keys(force: bool = False) -> dict:
    """Clés publiques de Google (mises en cache 24 h)."""
    global _keys, _keys_at
    if _keys and not force and time.time() - _keys_at < 86400:
        return _keys
    async with httpx.AsyncClient(timeout=10) as client:
        data = (await client.get(KEYS_URL)).json()
    keys = {}
    for k in data.get("keys", []):
        try:
            keys[str(k["keyId"])] = serialization.load_pem_public_key(k["pem"].encode())
        except Exception as e:
            logger.warning(f"[ssv] clé illisible {k.get('keyId')}: {e}")
    if keys:
        _keys, _keys_at = keys, time.time()
    return _keys


def _b64url(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


async def verify_signature(raw_query: str) -> dict:
    """Vérifie la signature de Google sur la requête brute. Renvoie les paramètres."""
    from urllib.parse import parse_qsl
    marker = "&signature="
    i = raw_query.find(marker)
    if i < 0:
        raise HTTPException(status_code=400, detail="signature manquante")
    message = raw_query[:i].encode()
    params = dict(parse_qsl(raw_query, keep_blank_values=True))
    sig, key_id = params.get("signature", ""), params.get("key_id", "")
    keys = await _google_keys()
    if key_id not in keys:
        keys = await _google_keys(force=True)   # Google change ses clés de temps en temps
    key = keys.get(key_id)
    if key is None:
        raise HTTPException(status_code=403, detail="clé inconnue")
    try:
        key.verify(_b64url(sig), message, ec.ECDSA(hashes.SHA256()))
    except (InvalidSignature, ValueError):
        raise HTTPException(status_code=403, detail="signature invalide")
    return params


@router.post("/start")
async def ad_start(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Code à usage unique à passer à AdMob avant d'afficher une pub récompensée."""
    _limiter.check(f"ad-start:{current_user}", 60, 3600)
    nonce = uuid.uuid4().hex
    db.add(AdView(nonce=nonce, user_id=current_user, created_at=datetime.now(timezone.utc)))
    await db.commit()
    return {"nonce": nonce}


@router.get("/ssv")
async def ad_ssv(request: Request, db: AsyncSession = Depends(get_db)):
    """Appelé par les serveurs de Google quand une pub récompensée a été vue jusqu'au bout."""
    params = await verify_signature(request.url.query)
    nonce = params.get("custom_data", "")
    mark_ssv_seen()
    if nonce:
        row = (await db.execute(select(AdView).where(AdView.nonce == nonce).with_for_update())).scalar_one_or_none()
        # L'identifiant joueur transmis à AdMob doit correspondre au code (pas de code « prêté »)
        if row and row.verified_at is None and (not params.get("user_id") or params["user_id"] == row.user_id):
            row.verified_at = datetime.now(timezone.utc)
            row.transaction_id = (params.get("transaction_id") or "")[:100]
            await db.commit()
        elif not row:
            logger.info("[ssv] code inconnu (test AdMob ?)")
    return {"ok": True}

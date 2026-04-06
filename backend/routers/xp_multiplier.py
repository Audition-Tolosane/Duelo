"""
Boosts XP achetables (in-app purchase).
x1.2 pendant 1h — €0,99
x1.5 pendant 1h — €2,99
Pro = x1.2 permanent (source='pro', expires_at=None)

L'intégration paiement (RevenueCat / App Store) appelle POST /xp-multiplier/activate
après validation côté store. En développement, l'endpoint est accessible directement.
"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import XPMultiplierActivation
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/xp-multiplier", tags=["xp-multiplier"])

VALID_MULTIPLIERS = {1.2: 60, 1.5: 60}  # multiplier → duration in minutes


async def get_active_multiplier(user_id: str, db: AsyncSession) -> float:
    """Returns the highest active multiplier for a user (1.0 if none)."""
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(XPMultiplierActivation).where(
            XPMultiplierActivation.user_id == user_id,
        ).where(
            # Permanent (pro) OR not yet expired
            (XPMultiplierActivation.expires_at == None) |  # noqa: E711
            (XPMultiplierActivation.expires_at > now)
        )
    )
    activations = res.scalars().all()
    if not activations:
        return 1.0
    return max(a.multiplier for a in activations)


@router.get("/active")
async def get_active(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(XPMultiplierActivation).where(
            XPMultiplierActivation.user_id == current_user,
        ).where(
            (XPMultiplierActivation.expires_at == None) |  # noqa: E711
            (XPMultiplierActivation.expires_at > now)
        ).order_by(XPMultiplierActivation.multiplier.desc()).limit(1)
    )
    activation = res.scalar_one_or_none()
    if not activation:
        return {"active": False, "multiplier": 1.0}
    return {
        "active": True,
        "multiplier": activation.multiplier,
        "source": activation.source,
        "expires_at": activation.expires_at.isoformat() if activation.expires_at else None,
    }


@router.post("/activate")
async def activate_multiplier(
    data: dict,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the IAP webhook / RevenueCat after purchase confirmation.
    data: { multiplier: 1.2|1.5, source: 'purchase'|'pro' }
    """
    multiplier = float(data.get("multiplier", 1.2))
    source = data.get("source", "purchase")

    if source == "pro":
        # Permanent — check no other pro active
        existing = await db.execute(
            select(XPMultiplierActivation).where(
                XPMultiplierActivation.user_id == current_user,
                XPMultiplierActivation.source == "pro",
                XPMultiplierActivation.expires_at == None,  # noqa: E711
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Abonnement Pro déjà actif")
        activation = XPMultiplierActivation(
            id=str(uuid.uuid4()),
            user_id=current_user,
            multiplier=1.2,
            source="pro",
            expires_at=None,
        )
    else:
        if multiplier not in VALID_MULTIPLIERS:
            raise HTTPException(status_code=400, detail="Multiplicateur invalide")
        duration = VALID_MULTIPLIERS[multiplier]
        now = datetime.now(timezone.utc)
        activation = XPMultiplierActivation(
            id=str(uuid.uuid4()),
            user_id=current_user,
            multiplier=multiplier,
            source="purchase",
            expires_at=now + timedelta(minutes=duration),
        )

    db.add(activation)
    await db.commit()
    return {
        "multiplier": activation.multiplier,
        "source": activation.source,
        "expires_at": activation.expires_at.isoformat() if activation.expires_at else None,
    }


@router.delete("/pro")
async def cancel_pro(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Called by RevenueCat webhook on subscription cancellation."""
    res = await db.execute(
        select(XPMultiplierActivation).where(
            XPMultiplierActivation.user_id == current_user,
            XPMultiplierActivation.source == "pro",
        )
    )
    for row in res.scalars().all():
        await db.delete(row)
    await db.commit()
    return {"cancelled": True}

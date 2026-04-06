from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth_middleware import get_current_user_id
from services.boosts import (
    activate_boost, get_any_active_boost, get_used_theme_ids_today,
    increment_offer_refresh, get_daily_offers, get_slot_expires_at,
)

router = APIRouter(tags=["boosts"])


@router.post("/boosts/activate")
async def activate_boost_route(
    theme_id: str = Body(..., embed=True),
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Appelé après visionnage de pub. Active le x2 XP pendant 6 min."""
    used_today = await get_used_theme_ids_today(current_user, db)
    if theme_id in used_today:
        raise HTTPException(status_code=400, detail="Ce thème a déjà été boosté aujourd'hui.")
    active = await get_any_active_boost(current_user, db)
    if active:
        raise HTTPException(status_code=400, detail="Un boost est déjà actif.")
    expires_at = await activate_boost(current_user, theme_id, db)
    return {"expires_at": expires_at.isoformat(), "theme_id": theme_id}


@router.post("/boosts/refresh-offers")
async def refresh_offers(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Appelé après visionnage de pub. Change les offres x2 XP immédiatement."""
    await increment_offer_refresh(current_user, db)
    new_offers = await get_daily_offers(current_user, db)
    from services.boosts import get_any_active_boost as _gab
    active_boost = await _gab(current_user, db)
    result = []
    for t in new_offers:
        is_active = active_boost and active_boost.theme_id == t.id
        result.append({
            "theme_id": t.id,
            "theme_name": t.name,
            "color": t.color_hex or "#8A2BE2",
            "is_active": is_active,
            "expires_at": active_boost.expires_at.isoformat() if is_active else None,
        })
    return {"offers": result, "slot_expires_at": get_slot_expires_at()}

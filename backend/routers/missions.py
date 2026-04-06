import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import DailyMissions, UserThemeXP, Theme, User
from services.missions import get_or_create_today, generate_missions, get_user_top_themes
from auth_middleware import get_current_user_id
from datetime import date

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("/today")
async def get_today(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    record = await get_or_create_today(current_user, db)
    missions = json.loads(record.missions)
    all_done = all(m["completed"] for m in missions)
    any_done = any(m["completed"] for m in missions)
    user_themes = await get_user_top_themes(current_user, db)
    return {
        "missions": missions,
        "multiplier": record.multiplier,
        "xp_earned": record.xp_earned,
        "reward_claimed": record.reward_claimed,
        "target_theme_id": record.target_theme_id,
        "all_completed": all_done,
        "any_completed": any_done,
        "rerolls_used": record.rerolls_used,
        "user_themes": user_themes,
    }


@router.post("/double")
async def activate_double(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Called after a rewarded ad — doubles all mission rewards."""
    record = await get_or_create_today(current_user, db)
    if record.reward_claimed:
        raise HTTPException(status_code=400, detail="Récompenses déjà réclamées")
    if record.multiplier >= 2:
        raise HTTPException(status_code=400, detail="Double déjà activé")
    record.multiplier = 2
    missions = json.loads(record.missions)
    xp = sum(m["xp"] for m in missions if m["completed"])
    record.xp_earned = xp * 2
    await db.commit()
    return {"multiplier": 2, "xp_earned": record.xp_earned}


@router.post("/reroll/{mission_id}")
async def reroll_mission(mission_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Called after a rewarded ad — replaces one incomplete mission."""
    record = await get_or_create_today(current_user, db)
    if record.reward_claimed:
        raise HTTPException(status_code=400, detail="Récompenses déjà réclamées")
    missions = json.loads(record.missions)
    target = next((m for m in missions if m["id"] == mission_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    if target["completed"]:
        raise HTTPException(status_code=400, detail="Mission déjà complétée")
    if target.get("rerolled"):
        raise HTTPException(status_code=400, detail="Cette mission a déjà été changée")

    today = date.today().isoformat()
    rerolls_used = record.rerolls_used or 0
    # Generate a fresh pool with a different seed
    candidates = generate_missions(f"reroll:{current_user}:{today}:{rerolls_used}")
    current_signatures = {
        (m["type"], m.get("cat", ""))
        for m in missions
        if m["id"] != mission_id
    }
    new_mission = next(
        (c for c in candidates if (c["type"], c.get("cat", "")) not in current_signatures),
        candidates[0],
    )
    new_mission["id"] = mission_id
    new_mission["progress"] = 0
    new_mission["completed"] = False
    new_mission["rerolled"] = True

    missions = [new_mission if m["id"] == mission_id else m for m in missions]
    record.missions = json.dumps(missions, ensure_ascii=False)
    record.rerolls_used = rerolls_used + 1
    xp = sum(m["xp"] for m in missions if m["completed"])
    record.xp_earned = xp * record.multiplier
    await db.commit()
    return {"missions": missions}


@router.post("/claim")
async def claim_rewards(data: dict, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Claim XP for all completed missions into the chosen theme."""
    theme_id = data.get("theme_id")
    if not theme_id:
        raise HTTPException(status_code=400, detail="theme_id requis")

    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Thème introuvable")

    record = await get_or_create_today(current_user, db)
    if record.reward_claimed:
        raise HTTPException(status_code=400, detail="Récompenses déjà réclamées")

    missions = json.loads(record.missions)
    completed = [m for m in missions if m["completed"]]
    if not completed:
        raise HTTPException(status_code=400, detail="Aucune mission complétée")

    xp_total = sum(m["xp"] for m in completed) * record.multiplier

    # Add XP to chosen theme
    uxp_res = await db.execute(
        select(UserThemeXP).where(UserThemeXP.user_id == current_user, UserThemeXP.theme_id == theme_id)
    )
    uxp = uxp_res.scalar_one_or_none()
    if not uxp:
        uxp = UserThemeXP(user_id=current_user, theme_id=theme_id, xp=0)
        db.add(uxp)
        await db.flush()
    uxp.xp += xp_total

    # Update user total_xp
    user_res = await db.execute(select(User).where(User.id == current_user))
    user = user_res.scalar_one_or_none()
    if user:
        all_xp = await db.execute(
            select(func.sum(UserThemeXP.xp)).where(UserThemeXP.user_id == current_user)
        )
        user.total_xp = (all_xp.scalar() or 0)

    record.reward_claimed = True
    record.target_theme_id = theme_id
    record.xp_earned = xp_total
    await db.commit()
    return {"xp_earned": xp_total, "theme_id": theme_id, "theme_name": theme.name}

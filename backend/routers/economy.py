"""Économie de jeu : crédits pour jouer, places de thèmes, coffre quotidien.

Règles (validées avec le produit) :
- Crédits : 1 duel = 1 crédit ; 5 au maximum, +1 toutes les 30 min ; une pub = +3 crédits,
  10 pubs « crédits » par jour au plus. Les pubs peuvent faire dépasser le maximum (la
  recharge s'arrête tant que le stock est au maximum ou au-dessus).
- Gratuits : défis et revanches (le client ne passe pas par /play), et les 3 premiers jours
  du compte.
- Thèmes : un joueur peut jouer 5 thèmes différents ; une pub ouvre 3 places de plus, pour
  toujours. Un thème déjà joué reste toujours jouable.
- Coffre : 1 ouverture gratuite par jour, une 2e avec une pub.

Le contrôle se fait au début de l'écran de recherche d'adversaire (POST /economy/play) ; si le
joueur quitte avant qu'un adversaire soit trouvé, il récupère son crédit (POST /economy/refund).

TICKET : /play laisse un ticket (thème + 5 min) côté serveur. Le serveur l'exige pour entrer
dans la file du direct (WebSocket matchmaking_join) et pour lancer une partie contre un bot
(/game/questions?secure=1), et le consomme quand la partie commence (plus de remboursement
possible ensuite). Sans ticket, une app modifiée ne peut plus jouer sans payer.
"""
import logging
import random
from services import reactions
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth_middleware import get_current_user_id
from database import get_db
from models import User, UserEconomy, UserThemeXP, BoostActivation
from services.ad_rewards import verify_ad_reward

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/economy", tags=["economy"])

CREDITS_MAX = 5
CREDIT_REGEN = timedelta(minutes=30)
CREDITS_PER_AD = 3
CREDIT_ADS_PER_DAY = 10
CREDITS_HARD_CAP = CREDITS_MAX + CREDITS_PER_AD * 3   # stock maximum, même avec des pubs
FREE_DAYS = 3
THEMES_BASE = 5
THEMES_PER_AD = 3
REFUND_WINDOW = timedelta(seconds=90)   # recherche d'adversaire : 30 s max + écran VS
TICKET_WINDOW = timedelta(minutes=5)    # recherche + écran VS + chargement des questions

# Coffre : (type, valeur, poids). L'XP va sur le thème le plus joué (voir grant_bonus_xp).
CHEST_REWARDS = [
    ("credits", 2, 35),
    ("xp", 100, 25),
    ("xp", 250, 10),
    ("boost", 30, 20),     # ×2 XP sur tous les thèmes, en minutes
    ("credits", 5, 10),
    ("reaction", 1, 20),   # une réaction verrouillée (tant qu'il en reste)
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _day(now: datetime) -> str:
    return now.strftime("%Y-%m-%d")


def _aware(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def get_economy(db: AsyncSession, user_id: str) -> UserEconomy:
    """Ligne du joueur, créée pleine au premier accès, recharge et compteurs du jour à jour."""
    # FOR UPDATE : deux requêtes simultanées (coffre, pub, crédit) ne lisent plus le même état
    res = await db.execute(select(UserEconomy).where(UserEconomy.user_id == user_id).with_for_update())
    econ = res.scalar_one_or_none()
    now = _now()
    if not econ:
        econ = UserEconomy(user_id=user_id, credits=CREDITS_MAX, regen_at=now, ads_today=0,
                           theme_bonus=0, chests_opened=0)
        db.add(econ)
        await db.flush()
    # Recharge : +1 par tranche de 30 min écoulée, jusqu'au maximum.
    regen_at = _aware(econ.regen_at) or now
    if econ.credits < CREDITS_MAX:
        steps = int((now - regen_at) / CREDIT_REGEN)
        if steps > 0:
            econ.credits = min(CREDITS_MAX, econ.credits + steps)
            regen_at = regen_at + steps * CREDIT_REGEN
        if econ.credits >= CREDITS_MAX:
            regen_at = now
    else:
        regen_at = now
    econ.regen_at = regen_at
    today = _day(now)
    if econ.ad_day != today:
        econ.ad_day, econ.ads_today = today, 0
    if econ.chest_day != today:
        econ.chest_day, econ.chests_opened = today, 0
    return econ


async def _is_new_player(db: AsyncSession, user_id: str) -> tuple[bool, datetime | None]:
    res = await db.execute(select(User.created_at).where(User.id == user_id))
    created = _aware(res.scalar_one_or_none())
    if not created:
        return False, None
    free_until = created + timedelta(days=FREE_DAYS)
    return _now() < free_until, free_until


async def _played_theme_ids(db: AsyncSession, user_id: str) -> set[str]:
    res = await db.execute(select(UserThemeXP.theme_id).where(UserThemeXP.user_id == user_id))
    return {row[0] for row in res.all()}


async def _status(db: AsyncSession, user_id: str, econ: UserEconomy, theme_id: str | None = None) -> dict:
    new_player, free_until = await _is_new_player(db, user_id)
    played = await _played_theme_ids(db, user_id)
    limit = THEMES_BASE + (econ.theme_bonus or 0)
    next_credit_at = None
    if econ.credits < CREDITS_MAX:
        next_credit_at = (_aware(econ.regen_at) + CREDIT_REGEN).isoformat()
    out = {
        "credits": econ.credits,
        "credits_max": CREDITS_MAX,
        "next_credit_at": next_credit_at,
        "credits_per_ad": CREDITS_PER_AD,
        "credit_ads_left": max(0, CREDIT_ADS_PER_DAY - (econ.ads_today or 0)),
        "free_play": new_player,
        "free_until": free_until.isoformat() if new_player and free_until else None,
        "themes_used": len(played),
        "themes_limit": limit,
        "themes_per_ad": THEMES_PER_AD,
        "chest_free": (econ.chests_opened or 0) == 0,
        "chest_ad": (econ.chests_opened or 0) == 1,
        "reactions_unlocked": reactions.parse_unlocked(econ.reactions_unlocked),
    }
    if theme_id:
        out["theme_allowed"] = theme_id in played or len(played) < limit
    return out


@router.get("/status")
async def economy_status(theme_id: str | None = None, current_user: str = Depends(get_current_user_id),
                         db: AsyncSession = Depends(get_db)):
    econ = await get_economy(db, current_user)
    status = await _status(db, current_user, econ, theme_id)
    await db.commit()
    return status


@router.post("/play")
async def economy_play(body: dict, current_user: str = Depends(get_current_user_id),
                       db: AsyncSession = Depends(get_db)):
    """Avant une recherche d'adversaire « normale » : vérifie le thème puis prend un crédit.

    409 {reason: theme_limit} ou 402 {reason: no_credits}, avec l'état complet pour l'écran."""
    theme_id = str(body.get("theme_id") or "")
    econ = await get_economy(db, current_user)
    status = await _status(db, current_user, econ, theme_id or None)
    if theme_id and not status.get("theme_allowed", True):
        await db.commit()
        return JSONResponse(status_code=409, content={"reason": "theme_limit", **status})
    if not status["free_play"]:
        if econ.credits <= 0:
            await db.commit()
            return JSONResponse(status_code=402, content={"reason": "no_credits", **status})
        if econ.credits >= CREDITS_MAX:
            econ.regen_at = _now()   # la recharge démarre au premier crédit dépensé
        econ.credits -= 1
        econ.refundable_until = _now() + REFUND_WINDOW
    econ.ticket_theme = theme_id[:100] or None
    econ.ticket_until = _now() + TICKET_WINDOW
    status = await _status(db, current_user, econ, theme_id or None)
    await db.commit()
    return {"ok": True, "charged": not status["free_play"], **status}


@router.post("/refund")
async def economy_refund(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Le joueur a quitté la recherche avant de trouver un adversaire : crédit rendu (une fois)."""
    econ = await get_economy(db, current_user)
    until = _aware(econ.refundable_until)
    refunded = bool(until and _now() <= until)
    if refunded:
        econ.credits = min(CREDITS_HARD_CAP, econ.credits + 1)
        econ.refundable_until = None
        econ.ticket_theme = econ.ticket_until = None   # crédit rendu : plus de partie payée
    status = await _status(db, current_user, econ)
    await db.commit()
    return {"refunded": refunded, **status}


@router.post("/credits/ad")
async def economy_credits_ad(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Pub regardée jusqu'au bout : +3 crédits (10 fois par jour au plus)."""
    econ = await get_economy(db, current_user)
    if (econ.ads_today or 0) >= CREDIT_ADS_PER_DAY:
        await db.commit()
        raise HTTPException(status_code=429, detail="ads_cap")
    await verify_ad_reward(current_user, "credits")
    econ.credits = min(CREDITS_HARD_CAP, econ.credits + CREDITS_PER_AD)
    econ.ads_today = (econ.ads_today or 0) + 1
    status = await _status(db, current_user, econ)
    await db.commit()
    return status


@router.post("/themes/ad")
async def economy_themes_ad(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Pub regardée jusqu'au bout : 3 places de thèmes en plus, définitivement."""
    await verify_ad_reward(current_user, "themes")
    econ = await get_economy(db, current_user)
    econ.theme_bonus = (econ.theme_bonus or 0) + THEMES_PER_AD
    status = await _status(db, current_user, econ)
    await db.commit()
    return status


async def grant_bonus_xp(db: AsyncSession, user_id: str, amount: int) -> str | None:
    """XP bonus (coffre, roue) : posée sur le thème le plus joué du joueur.

    L'XP totale est recalculée à chaque fin de partie depuis l'XP des thèmes ; ajoutée
    seulement au total, elle disparaissait au duel suivant. Renvoie l'id du thème crédité
    (None si le joueur n'a encore joué aucun thème : l'XP ne va alors qu'au total)."""
    res = await db.execute(
        select(UserThemeXP).where(UserThemeXP.user_id == user_id).order_by(UserThemeXP.xp.desc()).limit(1)
    )
    top = res.scalar_one_or_none()
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if top:
        top.xp = (top.xp or 0) + amount
        await db.flush()
        total = await db.execute(select(func.sum(UserThemeXP.xp)).where(UserThemeXP.user_id == user_id))
        if user:
            user.total_xp = total.scalar() or 0
        return top.theme_id
    if user:
        user.total_xp = (user.total_xp or 0) + amount
    return None


@router.post("/chest/open")
async def economy_chest_open(body: dict | None = None, current_user: str = Depends(get_current_user_id),
                             db: AsyncSession = Depends(get_db)):
    """Coffre du jour : la 1re ouverture est gratuite, la 2e demande une pub (with_ad=true)."""
    with_ad = bool((body or {}).get("with_ad"))
    econ = await get_economy(db, current_user)
    opened = econ.chests_opened or 0
    if opened >= 2 or (opened == 1 and not with_ad):
        await db.commit()
        raise HTTPException(status_code=400, detail="chest_unavailable")
    if opened == 1:
        await verify_ad_reward(current_user, "chest")

    unlocked = reactions.parse_unlocked(econ.reactions_unlocked)
    locked_left = [k for k in reactions.LOCKED if k not in unlocked]
    pool = [r for r in CHEST_REWARDS if r[0] != "reaction" or locked_left]
    kind, value, _ = random.choices(pool, weights=[w for *_, w in pool])[0]
    reward: dict = {"type": kind, "value": value}
    if kind == "reaction":
        key = random.choice(locked_left)
        econ.reactions_unlocked = ",".join(unlocked + [key])
        reward["key"] = key
    if kind == "credits":
        econ.credits = min(CREDITS_HARD_CAP, econ.credits + value)
    elif kind == "xp":
        reward["theme_id"] = await grant_bonus_xp(db, current_user, value)
    elif kind == "boost":
        now = _now()
        # Même boost global que la roue (thème sentinelle « __spin__ »)
        db.add(BoostActivation(user_id=current_user, theme_id="__spin__", activated_at=now,
                               expires_at=now + timedelta(minutes=value)))
    econ.chests_opened = opened + 1
    status = await _status(db, current_user, econ)
    await db.commit()
    logger.info(f"[chest] user={current_user} open#{opened + 1} -> {kind} {value}")
    return {"reward": reward, **status}


async def take_ticket(db: AsyncSession, user_id: str, theme_id: str, consume: bool = True) -> bool:
    """Partie payée pour ce thème (POST /play il y a moins de 5 min) ? Si consume : le ticket est
    utilisé et le crédit n'est plus remboursable. L'appelant fait le commit."""
    res = await db.execute(select(UserEconomy).where(UserEconomy.user_id == user_id).with_for_update())
    econ = res.scalar_one_or_none()
    if not econ or not theme_id or econ.ticket_theme != theme_id:
        return False
    until = _aware(econ.ticket_until)
    if not until or _now() > until:
        return False
    if consume:
        econ.ticket_theme = None
        econ.ticket_until = None
        econ.refundable_until = None
    return True


async def close_refund(db: AsyncSession, user_id: str):
    """Partie enregistrée : le crédit pris pour elle n'est plus remboursable."""
    res = await db.execute(select(UserEconomy).where(UserEconomy.user_id == user_id))
    econ = res.scalar_one_or_none()
    if econ and econ.refundable_until:
        econ.refundable_until = None

"""
services/bots.py — Fonctions d'intégration des bots DUELO.

- find_bot_opponent()    : sélectionne un bot dont le skill_level est proche du joueur
- simulate_bot_answer()  : simule la réponse d'un bot à une question (probabiliste)

Note : preferred_hours est stocké en UTC (ex: ["20:00-23:00", "12:00-13:00"]).
"""

import random
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, BotTheme
from services.xp import MAX_LEVEL


# ── Level → skill_level mapping ───────────────────────────────────────────────

def level_to_skill(player_level: int) -> float:
    """Convert a 0–MAX_LEVEL player level to a 0.10–0.95 skill range."""
    ratio = max(0.0, min(1.0, player_level / MAX_LEVEL))
    return round(0.10 + ratio * 0.85, 3)


# ── preferred_hours helper ────────────────────────────────────────────────────

def _is_active_now(preferred_hours: list, utc_hour: int) -> bool:
    """
    Vérifie si utc_hour tombe dans l'une des plages preferred_hours (UTC).
    Format plage : "HH:MM-HH:MM" (ex: "20:00-23:00", "00:00-02:00").
    """
    for window in (preferred_hours or []):
        try:
            start_str, end_str = window.split("-")
            start_h = int(start_str.split(":")[0])
            end_h   = int(end_str.split(":")[0])
            if start_h <= end_h:
                if start_h <= utc_hour < end_h:
                    return True
            else:
                # Chevauchement minuit ex: "23:00-01:00"
                if utc_hour >= start_h or utc_hour < end_h:
                    return True
        except Exception:
            continue
    return False


def _prefer_active(bots: list[User], utc_hour: int) -> User:
    """Retourne un bot actif si disponible, sinon choisit aléatoirement."""
    active = [b for b in bots if b.preferred_hours and _is_active_now(b.preferred_hours, utc_hour)]
    pool = active if active else bots
    return random.choice(pool)


# ── find_bot_opponent ─────────────────────────────────────────────────────────

async def find_bot_opponent(
    player_level: int,
    theme_id: Optional[str],
    db: AsyncSession,
) -> Optional[dict]:
    """
    Sélectionne un bot dont le skill_level est proche du joueur (±0.20).
    Préfère les bots dont les preferred_hours (UTC) incluent l'heure actuelle.
    Si theme_id est fourni, préfère les bots ayant ce thème dans bot_themes.
    Retourne un dict avec les infos d'affichage, ou None si aucun bot en DB.
    """
    player_skill = level_to_skill(player_level)
    lo = max(0.10, player_skill - 0.20)
    hi = min(0.95, player_skill + 0.20)
    utc_hour = datetime.now(timezone.utc).hour

    # 1. Bots jouant ce thème précis, dans la plage de skill
    if theme_id:
        res = await db.execute(
            select(User)
            .join(BotTheme, BotTheme.bot_pseudo == User.pseudo)
            .where(
                User.is_bot == True,
                User.skill_level.between(lo, hi),
                BotTheme.theme_id == theme_id,
            )
            .order_by(func.random())
            .limit(20)
        )
        bots = res.scalars().all()
        if bots:
            return _bot_to_dict(_prefer_active(bots, utc_hour), player_level)

    # 2. N'importe quel bot dans la plage de skill
    res = await db.execute(
        select(User)
        .where(User.is_bot == True, User.skill_level.between(lo, hi))
        .order_by(func.random())
        .limit(20)
    )
    bots = res.scalars().all()
    if bots:
        return _bot_to_dict(_prefer_active(bots, utc_hour), player_level)

    # 3. Fallback ultime
    res = await db.execute(
        select(User).where(User.is_bot == True).order_by(func.random()).limit(10)
    )
    bots = res.scalars().all()
    if bots:
        return _bot_to_dict(_prefer_active(bots, utc_hour), player_level)

    return None


def _bot_to_dict(bot: User, player_level: int) -> dict:
    """Sérialise un bot User en dict d'affichage (sans exposer is_bot)."""
    bot_level = max(0, min(MAX_LEVEL, player_level + random.randint(-5, 5)))
    return {
        "id":           bot.id,
        "pseudo":       bot.pseudo,
        "avatar_seed":  bot.avatar_seed or secrets.token_hex(4),
        "avatar_url":   bot.avatar_url,
        "country":      bot.country or "",
        "skill_level":  bot.skill_level or 0.5,
        "avg_speed":    bot.avg_speed or 5.0,
        "bot_level":    bot_level,
        "is_bot":       True,
    }


# ── simulate_bot_answer ───────────────────────────────────────────────────────

def simulate_bot_answer(
    skill_level: float,
    avg_speed: float,
    question_difficulty: Optional[str] = None,
    time_limit_ms: int = 15_000,
) -> dict:
    """
    Simule la réponse d'un bot à une question.

    Retourne :
        {
            "is_correct": bool,
            "answer_index": int,   # 0–3 (peut être aléatoire si incorrect)
            "time_ms": int,        # temps de réponse simulé en ms
        }
    """
    # Ajuste la probabilité selon la difficulté
    difficulty_modifier = {
        "Facile":    0.0,
        "Moyen":    -0.10,
        "Difficile": -0.20,
    }.get(question_difficulty or "Moyen", -0.10)

    p_correct = max(0.05, min(0.99, skill_level + difficulty_modifier))
    is_correct = random.random() < p_correct

    # Temps de réponse : centré sur avg_speed avec variance ±30%, clamped
    raw_speed_s = avg_speed * random.uniform(0.70, 1.30)
    time_ms = int(max(800, min(time_limit_ms - 200, raw_speed_s * 1000)))

    # Si incorrect, choisir un mauvais index aléatoire parmi 0–3
    answer_index = 0 if is_correct else random.randint(1, 3)

    return {
        "is_correct":   is_correct,
        "answer_index": answer_index,
        "time_ms":      time_ms,
    }

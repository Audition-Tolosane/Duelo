"""
Système de succès (achievements).
Les définitions sont statiques. La progression est stockée dans user_achievements.
"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

ACHIEVEMENTS: list[dict] = [
    # ── Premières parties ──────────────────────────────────────────────────────
    {"id": "first_game",      "name": "Premier pas",      "icon": "🎮", "desc": "Jouer sa première partie",         "type": "games_played",    "target": 1,   "xp": 50},
    {"id": "games_10",        "name": "Habitué",          "icon": "🎯", "desc": "Jouer 10 parties",                 "type": "games_played",    "target": 10,  "xp": 100},
    {"id": "games_50",        "name": "Vétéran",          "icon": "⚔️", "desc": "Jouer 50 parties",                 "type": "games_played",    "target": 50,  "xp": 250},
    {"id": "games_100",       "name": "Centurion",        "icon": "💯", "desc": "Jouer 100 parties",                "type": "games_played",    "target": 100, "xp": 500},
    # ── Victoires ─────────────────────────────────────────────────────────────
    {"id": "win_first",       "name": "Première victoire","icon": "🏆", "desc": "Gagner sa première partie",        "type": "wins",            "target": 1,   "xp": 50},
    {"id": "wins_10",         "name": "Redoutable",       "icon": "💪", "desc": "Gagner 10 parties",                "type": "wins",            "target": 10,  "xp": 150},
    {"id": "wins_50",         "name": "Dominateur",       "icon": "👑", "desc": "Gagner 50 parties",                "type": "wins",            "target": 50,  "xp": 500},
    # ── Win streak ────────────────────────────────────────────────────────────
    {"id": "streak_3",        "name": "En feu",           "icon": "🔥", "desc": "Série de 3 victoires",             "type": "win_streak",      "target": 3,   "xp": 100},
    {"id": "streak_7",        "name": "Inarrêtable",      "icon": "⚡", "desc": "Série de 7 victoires",             "type": "win_streak",      "target": 7,   "xp": 250},
    {"id": "streak_15",       "name": "Légendaire",       "icon": "🌟", "desc": "Série de 15 victoires",            "type": "win_streak",      "target": 15,  "xp": 500},
    # ── Scores parfaits ───────────────────────────────────────────────────────
    {"id": "perfect_1",       "name": "Parfait",          "icon": "⭐", "desc": "Faire un 7/7",                    "type": "perfect_scores",  "target": 1,   "xp": 100},
    {"id": "perfect_5",       "name": "Flawless",         "icon": "💎", "desc": "5 scores parfaits",               "type": "perfect_scores",  "target": 5,   "xp": 300},
    {"id": "perfect_20",      "name": "Sans faille",      "icon": "✨", "desc": "20 scores parfaits",              "type": "perfect_scores",  "target": 20,  "xp": 750},
    # ── Login streak ──────────────────────────────────────────────────────────
    {"id": "login_7",         "name": "Assidu",           "icon": "📅", "desc": "7 jours de connexion consécutifs","type": "login_streak",    "target": 7,   "xp": 100},
    {"id": "login_30",        "name": "Dévoué",           "icon": "🗓️", "desc": "30 jours consécutifs",            "type": "login_streak",    "target": 30,  "xp": 500},
    # ── Défis ─────────────────────────────────────────────────────────────────
    {"id": "challenge_first", "name": "Challenger",       "icon": "🤺", "desc": "Envoyer son premier défi",        "type": "challenges_sent", "target": 1,   "xp": 50},
    {"id": "challenges_10",   "name": "Duelliste",        "icon": "⚔️", "desc": "Envoyer 10 défis",               "type": "challenges_sent", "target": 10,  "xp": 200},
    # ── Exploration ───────────────────────────────────────────────────────────
    {"id": "themes_3",        "name": "Explorateur",      "icon": "🗺️", "desc": "Jouer dans 3 thèmes différents", "type": "themes_played",   "target": 3,   "xp": 100},
    {"id": "themes_10",       "name": "Polyvalent",       "icon": "🌍", "desc": "Jouer dans 10 thèmes différents","type": "themes_played",   "target": 10,  "xp": 300},
    # ── Questions du jour ────────────────────────────────────────────────────
    {"id": "daily_q_7",       "name": "Curieux",          "icon": "❓", "desc": "7 questions du jour répondues",  "type": "daily_questions", "target": 7,   "xp": 100},
    {"id": "daily_q_30",      "name": "Encyclopédiste",   "icon": "📚", "desc": "30 questions du jour",           "type": "daily_questions", "target": 30,  "xp": 400},
    # ── Missions ──────────────────────────────────────────────────────────────
    {"id": "missions_7",      "name": "Discipliné",       "icon": "📋", "desc": "Compléter 7 séries de missions", "type": "mission_days",    "target": 7,   "xp": 150},
    {"id": "missions_30",     "name": "Inébranlable",     "icon": "🏅", "desc": "Compléter 30 séries de missions","type": "mission_days",    "target": 30,  "xp": 600},
    # ── Cosmétiques ───────────────────────────────────────────────────────────
    {"id": "wins_100",        "name": "Centenaire",       "icon": "👑", "desc": "Gagner 100 parties",              "type": "wins",            "target": 100, "xp": 1000, "frame": "gold_frame"},
    {"id": "streak_30",       "name": "Invincible",       "icon": "🔥", "desc": "Série de 30 victoires",           "type": "win_streak",      "target": 30,  "xp": 1000, "frame": "fire_frame"},
    {"id": "login_60",        "name": "Fidèle",           "icon": "🗓️", "desc": "60 jours de connexion consécutifs","type": "login_streak",   "target": 60,  "xp": 1000, "frame": "diamond_frame"},
    {"id": "perfect_50",      "name": "Légende",          "icon": "✨", "desc": "50 scores parfaits",              "type": "perfect_scores",  "target": 50,  "xp": 1500, "frame": "champion_frame"},
]

ACHIEVEMENT_MAP = {a["id"]: a for a in ACHIEVEMENTS}


async def _get_or_create(user_id: str, ach_id: str, db: AsyncSession):
    from models import UserAchievement
    res = await db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == ach_id,
        )
    )
    row = res.scalar_one_or_none()
    if not row:
        row = UserAchievement(user_id=user_id, achievement_id=ach_id, progress=0, unlocked=False)
        db.add(row)
        await db.flush()
    return row


async def _unlock(row, definition: dict, user_id: str, db: AsyncSession) -> dict | None:
    """Marks an achievement as unlocked and grants XP. Returns the achievement dict if newly unlocked."""
    if row.unlocked:
        return None
    row.unlocked = True
    row.unlocked_at = datetime.now(timezone.utc)
    row.progress = definition["target"]
    # Grant XP bonus
    from models import User
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if user:
        user.total_xp = (user.total_xp or 0) + definition["xp"]
        # Grant cosmetic frame if this achievement has one
        frame = definition.get("frame")
        if frame and not user.avatar_frame:
            user.avatar_frame = frame
    await db.flush()
    return {**definition, "unlocked_at": row.unlocked_at.isoformat()}


async def check_achievements(user_id: str, event: dict, db: AsyncSession) -> list[dict]:
    """
    Called after game/challenge/daily question events.
    event keys: type, games_played, wins, win_streak, perfect_scores,
                login_streak, challenges_sent, themes_played,
                daily_questions, mission_days
    Returns list of newly unlocked achievements.
    """
    newly_unlocked = []

    for ach in ACHIEVEMENTS:
        ach_type = ach["type"]
        value = event.get(ach_type)
        if value is None:
            continue

        row = await _get_or_create(user_id, ach["id"], db)
        if row.unlocked:
            continue

        new_progress = max(row.progress, value)
        row.progress = new_progress

        if new_progress >= ach["target"]:
            unlocked = await _unlock(row, ach, user_id, db)
            if unlocked:
                newly_unlocked.append(unlocked)

    if newly_unlocked or True:  # always commit progress
        await db.commit()

    return newly_unlocked


async def get_user_achievements(user_id: str, db: AsyncSession) -> list[dict]:
    """Returns all achievements with user progress (unlocked + in-progress)."""
    from models import UserAchievement
    res = await db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user_id)
    )
    user_rows = {r.achievement_id: r for r in res.scalars().all()}

    result = []
    for ach in ACHIEVEMENTS:
        row = user_rows.get(ach["id"])
        result.append({
            **ach,
            "progress": row.progress if row else 0,
            "unlocked": row.unlocked if row else False,
            "unlocked_at": row.unlocked_at.isoformat() if (row and row.unlocked_at) else None,
        })
    return result

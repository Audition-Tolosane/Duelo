import json
import random
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

MISSION_POOL = [
    {"type": "play_N",            "target": 3,  "xp": 50,  "label": "Jouer 3 parties"},
    {"type": "play_N",            "target": 5,  "xp": 75,  "label": "Jouer 5 parties"},
    {"type": "win_N",             "target": 2,  "xp": 75,  "label": "Gagner 2 parties"},
    {"type": "win_N",             "target": 3,  "xp": 100, "label": "Gagner 3 parties"},
    {"type": "perfect_score",     "target": 1,  "xp": 100, "label": "Faire un 7/7"},
    {"type": "send_challenge",    "target": 1,  "xp": 50,  "label": "Envoyer un défi"},
    {"type": "complete_challenge","target": 1,  "xp": 75,  "label": "Terminer un défi"},
    {"type": "play_category", "target": 2, "xp": 75,  "cat": "STV", "label": "2 parties en Séries TV"},
    {"type": "play_category", "target": 2, "xp": 75,  "cat": "CIN", "label": "2 parties en Cinéma"},
    {"type": "play_category", "target": 2, "xp": 75,  "cat": "SPO", "label": "2 parties en Sport"},
    {"type": "play_category", "target": 2, "xp": 75,  "cat": "GEO", "label": "2 parties en Géographie"},
    {"type": "play_category", "target": 2, "xp": 75,  "cat": "HIS", "label": "2 parties en Histoire"},
    {"type": "play_category", "target": 2, "xp": 75,  "cat": "SCI", "label": "2 parties en Sciences"},
    {"type": "play_category", "target": 3, "xp": 100, "cat": "STV", "label": "3 parties en Séries TV"},
    {"type": "play_category", "target": 3, "xp": 100, "cat": "CIN", "label": "3 parties en Cinéma"},
    {"type": "play_category", "target": 3, "xp": 100, "cat": "SPO", "label": "3 parties en Sport"},
]


def generate_missions(seed_key: str) -> list:
    rng = random.Random(seed_key)
    pool = [m.copy() for m in MISSION_POOL]
    rng.shuffle(pool)
    missions = []
    used_base_types: list[str] = []
    used_cats: set[str] = set()
    for template in pool:
        if len(missions) >= 3:
            break
        t = template["type"]
        cat = template.get("cat", "")
        if t != "play_category" and t in used_base_types:
            continue
        if t == "play_category" and cat in used_cats:
            continue
        m = template.copy()
        m["id"] = f"m{len(missions) + 1}"
        m["progress"] = 0
        m["completed"] = False
        m["rerolled"] = False
        missions.append(m)
        used_base_types.append(t)
        if cat:
            used_cats.add(cat)
    return missions


async def get_or_create_today(user_id: str, db: AsyncSession):
    from models import DailyMissions
    today = date.today().isoformat()
    res = await db.execute(
        select(DailyMissions).where(
            DailyMissions.user_id == user_id,
            DailyMissions.date == today,
        )
    )
    record = res.scalar_one_or_none()
    if not record:
        missions = generate_missions(f"missions:{user_id}:{today}")
        record = DailyMissions(
            id=str(uuid.uuid4()),
            user_id=user_id,
            date=today,
            missions=json.dumps(missions, ensure_ascii=False),
            multiplier=1,
            xp_earned=0,
            reward_claimed=False,
            target_theme_id=None,
            rerolls_used=0,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
    return record


async def update_progress(user_id: str, event: dict, db: AsyncSession) -> None:
    """Called after a game/challenge to update mission progress."""
    record = await get_or_create_today(user_id, db)
    if record.reward_claimed:
        return
    missions = json.loads(record.missions)
    event_type = event.get("type", "game_played")
    theme_id = event.get("theme_id", "")
    won = event.get("won", False)
    correct = event.get("correct", 0)
    # Super-category = prefix before first "_" (e.g. "STV" from "STV_BBAD")
    super_cat = theme_id.split("_")[0] if theme_id and "_" in theme_id else ""

    changed = False
    for m in missions:
        if m["completed"]:
            continue
        t = m["type"]
        prev = m["progress"]
        if t == "play_N" and event_type == "game_played":
            m["progress"] = min(m["progress"] + 1, m["target"])
        elif t == "win_N" and event_type == "game_played" and won:
            m["progress"] = min(m["progress"] + 1, m["target"])
        elif t == "perfect_score" and event_type == "game_played" and correct >= 7:
            m["progress"] = min(m["progress"] + 1, m["target"])
        elif t == "play_category" and event_type == "game_played" and super_cat == m.get("cat", ""):
            m["progress"] = min(m["progress"] + 1, m["target"])
        elif t == "send_challenge" and event_type == "challenge_sent":
            m["progress"] = min(m["progress"] + 1, m["target"])
        elif t == "complete_challenge" and event_type == "challenge_completed":
            m["progress"] = min(m["progress"] + 1, m["target"])
        if m["progress"] > prev:
            changed = True
        if m["progress"] >= m["target"]:
            m["completed"] = True

    if changed:
        xp = sum(m["xp"] for m in missions if m["completed"])
        record.missions = json.dumps(missions, ensure_ascii=False)
        record.xp_earned = xp * record.multiplier
        await db.commit()


async def get_user_top_themes(user_id: str, db: AsyncSession, limit: int = 8) -> list:
    from models import UserThemeXP, Theme
    res = await db.execute(
        select(UserThemeXP, Theme)
        .join(Theme, Theme.id == UserThemeXP.theme_id)
        .where(UserThemeXP.user_id == user_id)
        .order_by(UserThemeXP.xp.desc())
        .limit(limit)
    )
    rows = res.all()
    return [
        {"id": t.id, "name": t.name, "color": t.color_hex or "#8B5CF6"}
        for (uxp, t) in rows
    ]

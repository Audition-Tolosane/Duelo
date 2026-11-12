"""Parties solo (contre un bot) et défis différés NOTÉS PAR LE SERVEUR.

Avant : /game/questions envoyait la bonne réponse avec chaque question et l'app calculait
elle-même le score (et celui du bot) avant de l'envoyer à /game/submit. Une app modifiée
pouvait donc gagner à tous les coups.

Maintenant (mode « secure ») :
  1. /game/questions?secure=1 crée une session : les questions partent SANS la bonne réponse ;
     le serveur garde les bonnes réponses et tire à l'avance les réponses du bot.
  2. /game/answer : une réponse à la fois, dans l'ordre ; le serveur dit juste/faux, donne la
     bonne réponse et les points, et tient le score.
  3. /game/submit (ou /challenges/{id}/save-async-score) avec session_id : le score vient de la
     session, plus de l'app.

Temps de réponse : le bonus de vitesse utilise le temps annoncé par l'app, mais jamais moins
que le temps réellement écoulé côté serveur (moins la pause d'affichage entre deux questions).
Une réponse arrivée bien après la fin du chrono compte comme « pas de réponse ».
"""
import json
import math
import random
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models import SoloSession, User

TIMER_DURATION = 10
MAX_PTS_PER_Q = 20
MIN_PTS_PER_Q = 10
LAST_Q_MULT = 2
# Entre la réponse à une question et l'affichage de la suivante, l'app laisse au plus ~3 s
# (vert/rouge + case du bot) ; on ajoute de la marge pour le réseau.
PAUSE_SLACK_MS = 5000
# Première question : elle s'affiche dès que les questions sont reçues.
FIRST_SLACK_MS = 4000
# Au-delà du chrono (+ cette marge), la réponse compte comme « pas de réponse ».
LATE_GRACE_MS = 1500
SESSION_TTL = timedelta(hours=6)


def question_duration(text: str, options: list) -> int:
    """Même règle que getQuestionDuration (frontend/app/game.tsx) : 10 / 13 / 15 s."""
    total = len(text or "") + sum(len(o or "") for o in (options or []))
    return 15 if total > 300 else 13 if total > 180 else TIMER_DURATION


def _hash01(s: str) -> float:
    """FNV-1a 32 bits sur les unités UTF-16, comme botHash01 côté app."""
    h = 0x811C9DC5
    raw = s.encode("utf-16-le")
    for i in range(0, len(raw), 2):
        h ^= raw[i] | (raw[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h / 4294967296


def _last_mult(pts: int, index: int, last_index: int) -> int:
    return round(pts * LAST_Q_MULT) if index == last_index else pts


def _bot_answer(q: dict, index: int, last_index: int, skill: float, speed: float,
                pseudo: str, theme_id: str) -> dict:
    """Portage de resolveBotAnswer (game.tsx) : réponse, temps et points du bot pour une question."""
    affinity = (_hash01(f"{pseudo}|{theme_id}") - 0.5) * 0.24
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_form = (_hash01(f"{pseudo}|{day}") - 0.5) * 0.08
    diff = q.get("difficulty")
    diff_mod = 0.10 if diff == "Facile" else -0.05 if diff == "Difficile" else 0
    p_correct = max(0.05, min(0.97, skill + affinity + day_form + diff_mod))

    duration = q["duration"]
    read_scale = duration / TIMER_DURATION

    if random.random() < 0.06 * (1 - p_correct):
        return {"pick": -1, "pts": 0, "time_ms": duration * 1000}

    correct = random.random() < p_correct
    gauss = math.sqrt(-2 * math.log(1 - random.random())) * math.cos(2 * math.pi * random.random())
    t = speed * math.exp(0.38 * gauss - 0.07)
    if not correct:
        t *= 1.25
    if diff == "Facile":
        t *= 0.85
    t *= read_scale
    t = max(1.1 * read_scale, min(duration - 0.4, t))
    time_ms = round(t * 1000)

    if correct:
        speed_bonus = max(0, round(10 * (1 - time_ms / 10000)))
        return {"pick": q["correct"], "pts": _last_mult(max(10 + speed_bonus, 10), index, last_index),
                "time_ms": time_ms}

    # Erreur « humaine » : les mauvaises réponses de longueur proche de la bonne sont plus probables
    opts = q["options"]
    correct_len = len(opts[q["correct"]] or "") or 1
    wrong = [i for i in range(len(opts)) if i != q["correct"]]
    weights = [1 / (1 + abs(math.log((len(opts[i] or "") or 1) / correct_len)) * 2) for i in wrong]
    pick = random.choices(wrong, weights=weights)[0] if wrong else -1
    return {"pick": pick, "pts": 0, "time_ms": time_ms}


async def create(db: AsyncSession, user_id: str, theme_id: str, questions: list,
                 opponent: str = "", challenge_id: str = "", tutorial: bool = False) -> tuple[str, list]:
    """questions : [{id, question_text, options (déjà mélangées), correct, difficulty}].
    Renvoie (session_id, plan du bot à envoyer à l'app : temps + points, sans la case choisie)."""
    now = datetime.now(timezone.utc)
    # Ménage : sessions de plus de 6 h
    if random.random() < 0.05:
        await db.execute(delete(SoloSession).where(SoloSession.created_at < now - SESSION_TTL))

    qs = [{
        "id": str(q["id"]), "correct": int(q["correct"]), "difficulty": q.get("difficulty"),
        "duration": question_duration(q["question_text"], q["options"]), "options": q["options"],
    } for q in questions]

    bot = []
    if not challenge_id:
        skill, speed = 0.55, 5.0
        if tutorial:
            skill, speed = 0.35, 7.0
        elif opponent:
            b = (await db.execute(
                select(User.skill_level, User.avg_speed).where(User.pseudo == opponent, User.is_bot == True)  # noqa: E712
            )).first()
            if b:
                skill = float(b[0]) if b[0] is not None else skill
                speed = float(b[1]) if b[1] is not None else speed
        last = len(qs) - 1
        bot = [_bot_answer(q, i, last, skill, speed, opponent, theme_id) for i, q in enumerate(qs)]

    sid = str(uuid.uuid4())
    db.add(SoloSession(
        id=sid, user_id=user_id, theme_id=theme_id, opponent=(opponent or "")[:100],
        challenge_id=challenge_id or None,
        data=json.dumps({"q": qs, "bot": bot, "answers": [], "served": now.timestamp()}),
        player_score=0, bot_score=0, correct=0, used=False, created_at=now,
    ))
    await db.commit()
    public_bot = [{"time_ms": b["time_ms"], "pts": b["pts"], "answers": b["pick"] != -1} for b in bot]
    return sid, public_bot


async def load(db: AsyncSession, session_id: str, user_id: str, lock: bool = False):
    q = select(SoloSession).where(SoloSession.id == session_id, SoloSession.user_id == user_id)
    if lock:
        q = q.with_for_update()
    s = (await db.execute(q)).scalar_one_or_none()
    if s and s.created_at:
        created = s.created_at if s.created_at.tzinfo else s.created_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - created > SESSION_TTL:
            return None
    return s


def _result(data: dict, s: SoloSession, i: int) -> dict:
    a = data["answers"][i]
    bot = data["bot"][i] if i < len(data["bot"]) else None
    return {
        "question_index": i, "is_correct": a["is_correct"], "points": a["points"],
        "correct_option": data["q"][i]["correct"],
        "bot_pick": bot["pick"] if bot else None,
        "your_score": s.player_score, "bot_score": s.bot_score, "correct_count": s.correct,
        "done": len(data["answers"]) >= len(data["q"]),
    }


async def answer(db: AsyncSession, s: SoloSession, index: int, option: int, time_ms: int) -> dict:
    data = json.loads(s.data)
    n = len(data["answers"])
    if index < n:            # nouvel essai réseau : même résultat, rien n'est recompté
        return _result(data, s, index)
    if s.used or index != n or index >= len(data["q"]):
        raise ValueError("ordre")

    q = data["q"][index]
    now = datetime.now(timezone.utc).timestamp()
    elapsed_ms = int((now - float(data.get("served", now))) * 1000)
    slack = FIRST_SLACK_MS if index == 0 else PAUSE_SLACK_MS
    duration_ms = q["duration"] * 1000
    # Jamais plus rapide que ce que le serveur a vu passer (moins la pause d'affichage)
    t = max(0, min(int(time_ms or 0), duration_ms), elapsed_ms - slack)
    late = t > duration_ms + LATE_GRACE_MS

    is_correct = (not late) and option is not None and int(option) == q["correct"]
    pts = 0
    if is_correct:
        pts = _last_mult(max(MAX_PTS_PER_Q - t // 1000, MIN_PTS_PER_Q), index, len(data["q"]) - 1)

    data["answers"].append({"answer": int(option) if option is not None else -1, "is_correct": is_correct,
                            "points": pts, "time_ms": min(t, duration_ms)})
    data["served"] = now
    s.player_score += pts
    s.correct += 1 if is_correct else 0
    if index < len(data["bot"]):
        s.bot_score += data["bot"][index]["pts"]
    s.data = json.dumps(data)
    await db.commit()
    return _result(data, s, index)


def final(s: SoloSession) -> dict:
    """Score officiel. Partie pas finie (abandon, app en fond) = défaite : le bot finit ses
    questions et a au moins 10 points d'avance."""
    data = json.loads(s.data)
    finished = len(data["answers"]) >= len(data["q"])
    bot_total = sum(b["pts"] for b in data["bot"])
    opp = bot_total if finished else max(bot_total, s.player_score + 10)
    return {
        "player_score": s.player_score, "opponent_score": opp, "correct_count": s.correct,
        "answers": data["answers"], "finished": finished,
    }

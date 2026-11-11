"""Questions « jamais vues d'abord », sans stocker la liste des questions vues.

Chaque joueur a son propre ordre des questions d'un thème : la position d'une question est
tirée d'un hachage (joueur, question), donc recalculée à la demande et jamais enregistrée.
On ne garde qu'un curseur par niveau de difficulté (un nombre entre 0 et 1) pour chaque
couple joueur/thème : on sert les questions qui suivent le curseur sur ce cercle, puis on
avance le curseur au-delà de la dernière servie. Le joueur parcourt ainsi tout le thème avant
de revoir une question, puis le tour recommence.

Coût : une ligne d'environ 100 octets par joueur et par thème joué (table question_cursors).
"""
import hashlib
import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import QuestionCursor

logger = logging.getLogger(__name__)


def position(user_id: str, question_id: str) -> float:
    h = hashlib.md5(f"{user_id}:{question_id}".encode()).digest()
    return int.from_bytes(h[:4], "big") / 2 ** 32


def arc(user_id: str, question_id: str, cursor: float) -> float:
    """Distance (0 → 1) entre le curseur et la question, en avançant sur le cercle."""
    return (position(user_id, question_id) - cursor) % 1.0


def order(user_id: str, cursors: dict, difficulty: str, candidates: list) -> list:
    c = float(cursors.get(difficulty or "", 0.0))
    return sorted(candidates, key=lambda q: arc(user_id, q.id, c))


def advance(user_id: str, cursors: dict, served: list) -> dict:
    """Curseur de chaque difficulté placé juste après la plus lointaine question servie."""
    out = dict(cursors)
    far: dict[str, float] = {}
    for q in served:
        key = q.difficulty or ""
        d = arc(user_id, q.id, float(cursors.get(key, 0.0)))
        far[key] = max(far.get(key, 0.0), d)
    for key, d in far.items():
        out[key] = round((float(cursors.get(key, 0.0)) + d + 1e-7) % 1.0, 7)
    return out


async def load(db: AsyncSession, user_id: str, theme_id: str) -> dict:
    try:
        res = await db.execute(select(QuestionCursor.cursors).where(
            QuestionCursor.user_id == user_id, QuestionCursor.theme_id == theme_id))
        raw = res.scalar_one_or_none()
        data = json.loads(raw) if raw else {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        logger.warning(f"[qorder] lecture curseur impossible: {e}")
        return {}


async def save(db: AsyncSession, user_id: str, theme_id: str, cursors: dict):
    """Best-effort : une erreur ici ne doit jamais empêcher une partie."""
    try:
        res = await db.execute(select(QuestionCursor).where(
            QuestionCursor.user_id == user_id, QuestionCursor.theme_id == theme_id))
        row = res.scalar_one_or_none()
        if row:
            row.cursors = json.dumps(cursors)
        else:
            db.add(QuestionCursor(user_id=user_id, theme_id=theme_id, cursors=json.dumps(cursors)))
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.warning(f"[qorder] enregistrement curseur impossible: {e}")

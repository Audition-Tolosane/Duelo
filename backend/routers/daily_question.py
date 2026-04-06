"""
Question du jour — un thème parmi ceux que le joueur joue, tiré déterministement.
Récompense : +25 XP fixe.
"""
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import UserThemeXP, Theme, Question, DailyQuestionAnswer, User
from auth_middleware import get_current_user_id
from helpers import shuffle_question_options

router = APIRouter(prefix="/daily-question", tags=["daily-question"])

DAILY_XP = 25


async def _get_today_theme(user_id: str, db: AsyncSession) -> Theme | None:
    """Picks today's theme deterministically from the user's top-5 played themes."""
    today = datetime.now(timezone.utc).date().isoformat()
    res = await db.execute(
        select(UserThemeXP.theme_id)
        .where(UserThemeXP.user_id == user_id)
        .order_by(UserThemeXP.xp.desc())
        .limit(5)
    )
    theme_ids = [r[0] for r in res]
    if not theme_ids:
        return None
    rng = random.Random(f"daily_q:{user_id}:{today}")
    chosen_id = rng.choice(theme_ids)
    t_res = await db.execute(select(Theme).where(Theme.id == chosen_id))
    return t_res.scalar_one_or_none()


async def _get_today_question(theme_id: str, db: AsyncSession) -> Question | None:
    today = datetime.now(timezone.utc).date().isoformat()
    res = await db.execute(
        select(Question).where(Question.category == theme_id).limit(100)
    )
    questions = res.scalars().all()
    if not questions:
        return None
    rng = random.Random(f"daily_q_pick:{theme_id}:{today}")
    return rng.choice(questions)


@router.get("/today")
async def get_today_question(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.now(timezone.utc).date().isoformat()

    # Already answered today?
    ans_res = await db.execute(
        select(DailyQuestionAnswer).where(
            DailyQuestionAnswer.user_id == current_user,
            DailyQuestionAnswer.date == today,
        )
    )
    existing = ans_res.scalar_one_or_none()
    if existing:
        return {
            "already_answered": True,
            "correct": existing.correct,
            "xp_earned": existing.xp_earned,
            "theme_id": existing.theme_id,
        }

    theme = await _get_today_theme(current_user, db)
    if not theme:
        raise HTTPException(status_code=404, detail="Joue quelques parties d'abord pour débloquer la question du jour !")

    question = await _get_today_question(theme.id, db)
    if not question:
        raise HTTPException(status_code=404, detail="Aucune question disponible pour ce thème.")

    q = shuffle_question_options(question)
    return {
        "already_answered": False,
        "question_id": question.id,
        "theme_id": theme.id,
        "theme_name": theme.name,
        "theme_color": theme.color_hex or "#8A2BE2",
        "question_text": question.question_text,
        "options": q["options"],
        "xp_reward": DAILY_XP,
    }


@router.post("/answer")
async def answer_today(
    data: dict,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.now(timezone.utc).date().isoformat()

    # Already answered?
    ans_res = await db.execute(
        select(DailyQuestionAnswer).where(
            DailyQuestionAnswer.user_id == current_user,
            DailyQuestionAnswer.date == today,
        )
    )
    if ans_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Déjà répondu aujourd'hui.")

    question_id = data.get("question_id")
    theme_id = data.get("theme_id")
    answer_index = data.get("answer_index")

    if question_id is None or answer_index is None or not theme_id:
        raise HTTPException(status_code=400, detail="Paramètres manquants.")

    q_res = await db.execute(select(Question).where(Question.id == question_id))
    question = q_res.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question introuvable.")

    correct = (answer_index == question.correct_option)

    # Save answer
    record = DailyQuestionAnswer(
        user_id=current_user, date=today,
        question_id=question_id, theme_id=theme_id,
        correct=correct, xp_earned=DAILY_XP,
    )
    db.add(record)

    # Always grant XP (win or lose — reward for showing up)
    user_res = await db.execute(select(User).where(User.id == current_user))
    user = user_res.scalar_one_or_none()
    if user:
        user.total_xp = (user.total_xp or 0) + DAILY_XP

    await db.commit()

    # Check achievements
    ans_count_res = await db.execute(
        select(func.count(DailyQuestionAnswer.id)).where(DailyQuestionAnswer.user_id == current_user)
    )
    daily_questions_total = ans_count_res.scalar() or 0

    from services.achievements import check_achievements
    new_achievements = await check_achievements(current_user, {
        "daily_questions": daily_questions_total,
    }, db)

    return {
        "correct": correct,
        "correct_option": question.correct_option,
        "xp_earned": DAILY_XP,
        "new_achievements": new_achievements,
    }

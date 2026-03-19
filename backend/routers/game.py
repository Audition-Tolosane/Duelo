import random
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User, Question, Match, Theme, UserThemeXP
from constants import BOT_NAMES, TOTAL_QUESTIONS
from helpers import shuffle_question_options
from services.xp import (
    get_level, get_streak_bonus, get_streak_badge,
    get_theme_title, check_new_title_theme, MAX_LEVEL, TITLE_THRESHOLDS,
)
from services.notifications import create_notification

router = APIRouter(prefix="/game", tags=["game"])


@router.get("/questions")
async def get_game_questions(theme: str, db: AsyncSession = Depends(get_db)):
    """Get 7 questions: 2 Facile + 3 Moyen + 2 Difficile, all from different angles."""
    selected = []
    used_angles = set()

    for difficulty, count in [("Facile", 2), ("Moyen", 3), ("Difficile", 2)]:
        result = await db.execute(
            select(Question).where(Question.category == theme, Question.difficulty == difficulty)
            .order_by(func.random())
        )
        candidates = result.scalars().all()

        added = 0
        for q in candidates:
            angle_res = await db.execute(
                text("SELECT angle_num FROM questions WHERE id = :qid"), {"qid": q.id}
            )
            angle_row = angle_res.first()
            q_angle = angle_row[0] if angle_row and angle_row[0] else 0

            if q_angle not in used_angles or q_angle == 0:
                selected.append(q)
                if q_angle and q_angle > 0:
                    used_angles.add(q_angle)
                added += 1
                if added >= count:
                    break

        if added < count:
            for q in candidates:
                if q not in selected:
                    selected.append(q)
                    added += 1
                    if added >= count:
                        break

    if len(selected) < 7:
        result = await db.execute(
            select(Question).where(Question.category == theme).order_by(func.random()).limit(7)
        )
        fallback = result.scalars().all()
        for q in fallback:
            if q not in selected and len(selected) < 7:
                selected.append(q)

    random.shuffle(selected)

    result_list = []
    for q in selected:
        shuffled_opts, new_correct = shuffle_question_options(q.options, q.correct_option)
        result_list.append({
            "id": q.id, "category": q.category, "question_text": q.question_text,
            "options": shuffled_opts, "correct_option": new_correct, "difficulty": q.difficulty,
        })
    return result_list


# Keep /questions-v2 as alias for frontend compatibility
@router.get("/questions-v2")
async def get_game_questions_v2(theme: str, db: AsyncSession = Depends(get_db)):
    return await get_game_questions(theme, db)


@router.post("/matchmaking")
async def start_matchmaking(request: Request, db: AsyncSession = Depends(get_db)):
    """Matchmaking using theme_id."""
    body = await request.json()
    theme_id = body.get("theme_id", "")
    player_id = body.get("player_id")

    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Thème introuvable")

    player_level = 0
    player_title = ""

    if player_id:
        xp_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == player_id, UserThemeXP.theme_id == theme_id)
        )
        uxp = xp_res.scalar_one_or_none()
        if uxp:
            player_level = get_level(uxp.xp)
            player_title = get_theme_title(theme, player_level)

    bot_level = max(0, min(MAX_LEVEL, player_level + random.randint(-5, 5)))
    bot_name = random.choice(BOT_NAMES)
    bot_seed = secrets.token_hex(4)
    bot_title = get_theme_title(theme, bot_level)
    bot_streak = random.choice([0, 0, 0, 1, 2, 3, 4, 5])

    return {
        "theme": {
            "id": theme.id, "name": theme.name,
            "color_hex": theme.color_hex or "#8A2BE2", "icon_url": theme.icon_url or "",
        },
        "player": {"level": player_level, "title": player_title},
        "opponent": {
            "pseudo": bot_name, "avatar_seed": bot_seed, "is_bot": True,
            "level": bot_level, "title": bot_title,
            "streak": bot_streak, "streak_badge": get_streak_badge(bot_streak),
        },
    }


# Keep /matchmaking-v2 as alias for frontend compatibility
@router.post("/matchmaking-v2")
async def start_matchmaking_v2(request: Request, db: AsyncSession = Depends(get_db)):
    return await start_matchmaking(request, db)


@router.post("/submit")
async def submit_match(request: Request, db: AsyncSession = Depends(get_db)):
    """Submit match result using theme_id. XP tracked in UserThemeXP."""
    body = await request.json()
    player_id = body.get("player_id")
    theme_id = body.get("theme_id")
    player_score = body.get("player_score", 0)
    opponent_score = body.get("opponent_score", 0)
    opponent_pseudo = body.get("opponent_pseudo", "Bot")
    opponent_is_bot = body.get("opponent_is_bot", True)
    correct_count = body.get("correct_count", 0)
    opponent_level = body.get("opponent_level", 1)
    questions_data = body.get("questions_data")

    if not player_id or not theme_id:
        raise HTTPException(status_code=400, detail="player_id and theme_id required")

    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Thème introuvable")

    result = await db.execute(select(User).where(User.id == player_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    won = player_score > opponent_score
    perfect = correct_count == TOTAL_QUESTIONS

    xp_res = await db.execute(
        select(UserThemeXP).where(UserThemeXP.user_id == player_id, UserThemeXP.theme_id == theme_id)
    )
    uxp = xp_res.scalar_one_or_none()
    if not uxp:
        uxp = UserThemeXP(user_id=player_id, theme_id=theme_id, xp=0)
        db.add(uxp)
        await db.flush()

    level_before = get_level(uxp.xp)

    base_xp = player_score * 2
    victory_bonus = 50 if won else 0
    perfection_bonus = 50 if perfect else 0
    giant_slayer_bonus = 100 if (won and opponent_level - level_before >= 15) else 0
    new_streak = (user.current_streak + 1) if won else 0
    streak_bonus = get_streak_bonus(new_streak) if won else 0
    total_xp = base_xp + victory_bonus + perfection_bonus + giant_slayer_bonus + streak_bonus

    xp_breakdown = {
        "base": base_xp, "victory": victory_bonus, "perfection": perfection_bonus,
        "giant_slayer": giant_slayer_bonus, "streak": streak_bonus, "total": total_xp,
    }

    match = Match(
        player1_id=player_id, player2_pseudo=opponent_pseudo,
        player2_is_bot=opponent_is_bot, category=theme_id,
        player1_score=player_score, player2_score=opponent_score,
        player1_correct=correct_count,
        winner_id=player_id if won else None,
        xp_earned=total_xp, xp_breakdown=xp_breakdown,
        questions_data=questions_data,
    )
    db.add(match)

    uxp.xp += total_xp
    level_after = get_level(uxp.xp)

    new_title_info = check_new_title_theme(theme, level_before, level_after)
    new_level = level_after if level_after > level_before else None

    user.matches_played += 1
    if won:
        user.matches_won += 1
        user.current_streak += 1
        if user.current_streak > user.best_streak:
            user.best_streak = user.current_streak
    else:
        user.current_streak = 0

    all_xp_res = await db.execute(
        select(func.sum(UserThemeXP.xp)).where(UserThemeXP.user_id == player_id)
    )
    user.total_xp = all_xp_res.scalar() or 0

    if won:
        notif_body = f"Victoire en {theme.name} ! +{total_xp} XP"
    else:
        notif_body = f"Défaite en {theme.name}. +{total_xp} XP"
    await create_notification(
        db, player_id, "match_result", "Résultat du match", notif_body,
        data={"screen": "results", "params": {"matchId": match.id}},
    )

    await db.commit()
    await db.refresh(match)

    return {
        "id": match.id, "player1_id": match.player1_id,
        "player2_pseudo": match.player2_pseudo, "player2_is_bot": match.player2_is_bot,
        "category": match.category, "theme_name": theme.name,
        "player1_score": match.player1_score, "player2_score": match.player2_score,
        "player1_correct": match.player1_correct, "winner_id": match.winner_id,
        "xp_earned": match.xp_earned, "xp_breakdown": match.xp_breakdown,
        "new_title": new_title_info, "new_level": new_level,
        "created_at": match.created_at.isoformat(),
    }


# Keep /submit-v2 as alias for frontend compatibility
@router.post("/submit-v2")
async def submit_match_v2(request: Request, db: AsyncSession = Depends(get_db)):
    return await submit_match(request, db)

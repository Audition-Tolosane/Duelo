import random
import secrets
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User, Question, Match, Theme, UserThemeXP
from constants import TOTAL_QUESTIONS
from services.bots import find_bot_opponent

# Per-(player_id, theme_id) lock to prevent race-condition double-submit
_submit_locks: dict[str, asyncio.Lock] = {}
from helpers import shuffle_question_options
from services.xp import (
    get_level, get_streak_bonus, get_streak_badge,
    get_theme_title, check_new_title_theme, MAX_LEVEL, TITLE_THRESHOLDS,
    get_daily_streak_bonus, update_login_streak,
)
from services.notifications import create_notification
from auth_middleware import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/game", tags=["game"])


async def _resolve_theme_category(theme: str, db: AsyncSession) -> str:
    """Resolve a theme parameter to the actual Question.category value.
    The frontend sends theme_id (e.g. 'STV_BBAD'), but Question.category
    might store either the theme_id or the theme name (e.g. 'Breaking Bad').
    Try both and return whichever matches questions in the DB."""
    # First: check if questions exist with this exact value
    count_res = await db.execute(
        select(func.count()).select_from(Question).where(Question.category == theme)
    )
    if (count_res.scalar() or 0) > 0:
        return theme

    # Second: look up Theme by id and try with theme.name
    theme_res = await db.execute(select(Theme).where(Theme.id == theme))
    theme_obj = theme_res.scalar_one_or_none()
    if theme_obj:
        count_res2 = await db.execute(
            select(func.count()).select_from(Question).where(Question.category == theme_obj.name)
        )
        if (count_res2.scalar() or 0) > 0:
            logger.info(f"[questions] Resolved theme_id '{theme}' -> name '{theme_obj.name}'")
            return theme_obj.name

    # Third: try matching by Theme.name directly (if frontend sent a name)
    theme_by_name = await db.execute(select(Theme).where(Theme.name == theme))
    t = theme_by_name.scalar_one_or_none()
    if t:
        count_res3 = await db.execute(
            select(func.count()).select_from(Question).where(Question.category == t.id)
        )
        if (count_res3.scalar() or 0) > 0:
            logger.info(f"[questions] Resolved theme name '{theme}' -> id '{t.id}'")
            return t.id

    logger.warning(f"[questions] No questions found for theme='{theme}'")
    return theme


@router.get("/questions")
async def get_game_questions(theme: str, lang: str = 'fr', db: AsyncSession = Depends(get_db)):
    """Get 7 questions: 2 Facile + 3 Moyen + 2 Difficile, all from different angles.
    If lang='en', return English VO questions when available, fall back to 'fr'."""
    # Resolve theme to the correct Question.category value
    category = await _resolve_theme_category(theme, db)
    logger.info(f"[questions] theme='{theme}' -> category='{category}', lang='{lang}'")

    # If VO requested, check if EN questions exist; otherwise fall back to FR
    effective_lang = 'fr'
    if lang == 'en':
        en_count = await db.execute(
            select(func.count()).select_from(Question).where(
                Question.category == category, Question.language == 'en'
            )
        )
        if (en_count.scalar() or 0) > 0:
            effective_lang = 'en'
        else:
            logger.info(f"[questions] No EN questions for '{category}', falling back to FR")

    lang_filter = Question.language == effective_lang if effective_lang == 'en' else or_(
        Question.language == 'fr', Question.language.is_(None)
    )

    selected = []
    used_angles = set()

    for difficulty, count in [("Facile", 2), ("Moyen", 3), ("Difficile", 2)]:
        result = await db.execute(
            select(Question).where(Question.category == category, Question.difficulty == difficulty, lang_filter)
            .order_by(func.random())
        )
        candidates = result.scalars().all()

        added = 0
        for q in candidates:
            q_angle = getattr(q, 'angle_num', None) or 0

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
            select(Question).where(Question.category == category, lang_filter).order_by(func.random()).limit(7)
        )
        fallback = result.scalars().all()
        for q in fallback:
            if q not in selected and len(selected) < 7:
                selected.append(q)

    logger.info(f"[questions] Found {len(selected)} questions for category='{category}' (lang={effective_lang})")
    random.shuffle(selected)

    result_list = []
    for q in selected:
        shuffled_opts, new_correct = shuffle_question_options(q.options, q.correct_option)
        result_list.append({
            "id": q.id, "category": q.category, "question_text": q.question_text,
            "options": shuffled_opts, "correct_option": new_correct, "difficulty": q.difficulty,
        })
    return result_list


# Deprecated alias — use /questions directly
@router.get("/questions-v2", deprecated=True)
async def get_game_questions_v2(theme: str, lang: str = 'fr', db: AsyncSession = Depends(get_db)):
    return await get_game_questions(theme, lang, db)


@router.post("/matchmaking")
async def start_matchmaking(request: Request, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Matchmaking using theme_id."""
    body = await request.json()
    theme_id = body.get("theme_id", "")
    player_id = body.get("player_id")

    logger.info(f"[matchmaking] theme_id='{theme_id}', player_id='{player_id}'")

    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()
    if not theme:
        # Try by name as fallback
        theme_res2 = await db.execute(select(Theme).where(Theme.name == theme_id))
        theme = theme_res2.scalar_one_or_none()
    if not theme:
        logger.error(f"[matchmaking] Theme not found: '{theme_id}'")
        raise HTTPException(status_code=404, detail=f"Thème introuvable: {theme_id}")

    player_level = 0
    player_title = ""

    if player_id:
        xp_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == player_id, UserThemeXP.theme_id == theme.id)
        )
        uxp = xp_res.scalar_one_or_none()
        if uxp:
            player_level = get_level(uxp.xp)
            player_title = get_theme_title(theme, player_level)

    # Try to find a real bot profile matched to the player's skill level
    bot_data = await find_bot_opponent(player_level, theme.id, db)

    if bot_data:
        bot_name  = bot_data["pseudo"]
        bot_seed  = bot_data["avatar_seed"]
        bot_level = bot_data["bot_level"]
    else:
        # Fallback si aucun bot en DB (ne devrait pas arriver en prod)
        bot_name  = f"Bot_{secrets.token_hex(3)}"
        bot_seed  = secrets.token_hex(4)
        _spread = random.choices(
            [random.randint(-3, 3), random.randint(-8, 8)],
            weights=[70, 30],
        )[0]
        bot_level = max(0, min(MAX_LEVEL, player_level + _spread))

    bot_title  = get_theme_title(theme, bot_level)
    bot_streak = random.choice([0, 0, 0, 1, 2, 3, 4, 5])

    return {
        "theme": {
            "id": theme.id, "name": theme.name,
            "color_hex": theme.color_hex or "#8A2BE2", "icon_url": theme.icon_url or "",
        },
        "player": {"level": player_level, "title": player_title},
        "opponent": {
            "id": bot_data["id"] if bot_data else None,
            "pseudo": bot_name, "avatar_seed": bot_seed, "is_bot": True,
            "level": bot_level, "title": bot_title,
            "streak": bot_streak, "streak_badge": get_streak_badge(bot_streak),
            "avatar_url": bot_data["avatar_url"] if bot_data else None,
            "country": bot_data["country"] if bot_data else "",
            "skill_level": bot_data["skill_level"] if bot_data else 0.5,
            "avg_speed": bot_data["avg_speed"] if bot_data else 5.0,
        },
    }


# Keep /matchmaking-v2 as alias for frontend compatibility
@router.post("/matchmaking-v2")
async def start_matchmaking_v2(request: Request, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    return await start_matchmaking(request, current_user, db)


@router.post("/submit")
async def submit_match(request: Request, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Submit match result using theme_id. XP tracked in UserThemeXP."""
    body = await request.json()
    player_id = body.get("player_id")
    theme_id = body.get("theme_id")
    player_score = body.get("player_score", 0)
    opponent_score = body.get("opponent_score", 0)
    opponent_pseudo = body.get("opponent_pseudo", "Bot")
    opponent_is_bot = body.get("opponent_is_bot", True)
    correct_count = body.get("correct_count", 0)
    questions_data = body.get("questions_data")

    # #14/#15 — Validate and sanitise all client-supplied values
    MAX_SCORE = 140       # 20 pts max × 7 questions
    MAX_PTS_Q = 20        # max points per correct question
    MIN_PTS_Q = 10        # min points per correct question (time bonus floor)
    player_score = max(0, min(int(player_score), MAX_SCORE))
    opponent_score = max(0, min(int(opponent_score), MAX_SCORE))
    correct_count = max(0, min(int(correct_count), TOTAL_QUESTIONS))
    # Cross-validate: score must be consistent with correct_count
    if correct_count > 0:
        player_score = min(player_score, correct_count * MAX_PTS_Q)
    elif correct_count == 0:
        player_score = 0  # no correct answers → no score
    # questions_data: only store if it's a plain list (reject arbitrary objects)
    if questions_data is not None and not isinstance(questions_data, list):
        questions_data = None

    logger.info(f"[submit] theme_id='{theme_id}', player_id='{player_id}', score={player_score}-{opponent_score}")

    if not player_id or not theme_id:
        raise HTTPException(status_code=400, detail="player_id et theme_id requis")
    if player_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")

    # ── Atomic duplicate-submission guard with per-player lock ──
    lock_key = f"{player_id}:{theme_id}"
    if lock_key not in _submit_locks:
        _submit_locks[lock_key] = asyncio.Lock()
    async with _submit_locks[lock_key]:
        recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
        existing = await db.execute(
            select(Match).where(
                Match.created_at >= recent_cutoff,
                Match.player1_id == player_id,
                Match.category == theme_id,
            )
        )
        if existing.scalar_one_or_none():
            logger.info(f"[submit] Duplicate blocked for player={player_id}, theme={theme_id}")
            return {"status": "already_submitted", "message": "Match déjà enregistré"}

        theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
        theme = theme_res.scalar_one_or_none()
        if not theme:
            theme_res2 = await db.execute(select(Theme).where(Theme.name == theme_id))
            theme = theme_res2.scalar_one_or_none()
        if not theme:
            logger.error(f"[submit] Theme not found: '{theme_id}'")
            raise HTTPException(status_code=404, detail=f"Thème introuvable: {theme_id}")

        result = await db.execute(select(User).where(User.id == player_id))
        user = result.scalar_one_or_none()
        if not user:
            logger.error(f"[submit] User not found: '{player_id}'")
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

        won = player_score > opponent_score
        perfect = correct_count == TOTAL_QUESTIONS

        xp_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == player_id, UserThemeXP.theme_id == theme.id)
        )
        uxp = xp_res.scalar_one_or_none()
        if not uxp:
            uxp = UserThemeXP(user_id=player_id, theme_id=theme.id, xp=0)
            db.add(uxp)
            await db.flush()

        level_before = get_level(uxp.xp)

        # Fetch opponent level server-side — never trust client value (#11)
        if opponent_is_bot:
            opponent_level = 0
        else:
            opp_res = await db.execute(select(User).where(User.pseudo == opponent_pseudo))
            opp = opp_res.scalar_one_or_none()
            if opp:
                opp_xp_res = await db.execute(
                    select(UserThemeXP).where(UserThemeXP.user_id == opp.id, UserThemeXP.theme_id == theme.id)
                )
                opp_uxp = opp_xp_res.scalar_one_or_none()
                opponent_level = get_level(opp_uxp.xp) if opp_uxp else 0
            else:
                opponent_level = 0

        now = datetime.now(timezone.utc)
        streak_before = user.current_streak
        new_streak = (user.current_streak + 1) if won else 0
        streak_bonus = get_streak_bonus(new_streak) if won else 0
        base_xp = player_score * 2
        victory_bonus = 50 if won else 0
        perfection_bonus = 50 if perfect else 0
        giant_slayer_bonus = 100 if (won and opponent_level - level_before >= 15) else 0

        # Bonus journalier (login streak)
        new_login_streak = update_login_streak(user, now)
        daily_bonus = get_daily_streak_bonus(new_login_streak)

        # Boost x2 XP (rewarded ad, 6 min)
        from services.boosts import get_active_boost
        game_xp = base_xp + victory_bonus + perfection_bonus + giant_slayer_bonus + streak_bonus
        x2_bonus = game_xp if await get_active_boost(player_id, theme.id, db) else 0

        # Multiplicateur XP achetable (x1.2 / x1.5 / Pro)
        from routers.xp_multiplier import get_active_multiplier
        xp_mult = await get_active_multiplier(player_id, db)
        mult_bonus = round(game_xp * (xp_mult - 1.0)) if xp_mult > 1.0 else 0

        total_xp = game_xp + x2_bonus + mult_bonus + daily_bonus

        xp_breakdown = {
            "base": base_xp, "victory": victory_bonus, "perfection": perfection_bonus,
            "giant_slayer": giant_slayer_bonus, "streak": streak_bonus,
            "daily": daily_bonus, "x2": x2_bonus, "mult": mult_bonus, "total": total_xp,
        }

        match = Match(
            player1_id=player_id, player2_pseudo=opponent_pseudo,
            player2_is_bot=opponent_is_bot, category=theme.id,
            player1_score=player_score, player2_score=opponent_score,
            player1_correct=correct_count,
            player1_streak_before=streak_before,
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
        user.last_played_at = now
        if won:
            user.matches_won += 1
            user.current_streak += 1
            if user.current_streak > user.best_streak:
                user.best_streak = user.current_streak
        else:
            user.current_streak = 0

        # Update daily missions progress
        from services.missions import update_progress as _update_missions
        await _update_missions(player_id, {
            "type": "game_played",
            "theme_id": theme.id,
            "won": won,
            "correct": correct_count,
        }, db)

        all_xp_res = await db.execute(
            select(func.sum(UserThemeXP.xp)).where(UserThemeXP.user_id == player_id)
        )
        user.total_xp = all_xp_res.scalar() or 0

        # Update bot stats so their profile looks alive
        if opponent_is_bot and opponent_pseudo:
            bot_res = await db.execute(select(User).where(User.pseudo == opponent_pseudo, User.is_bot == True))
            bot = bot_res.scalar_one_or_none()
            if bot:
                bot_won = opponent_score > player_score
                bot.matches_played = (bot.matches_played or 0) + 1
                if bot_won:
                    bot.matches_won = (bot.matches_won or 0) + 1
                    bot.current_streak = (bot.current_streak or 0) + 1
                    if bot.current_streak > (bot.best_streak or 0):
                        bot.best_streak = bot.current_streak
                else:
                    bot.current_streak = 0
                bot_xp = opponent_score * 2 + (50 if bot_won else 0)
                bot_uxp_res = await db.execute(
                    select(UserThemeXP).where(UserThemeXP.user_id == bot.id, UserThemeXP.theme_id == theme.id)
                )
                bot_uxp = bot_uxp_res.scalar_one_or_none()
                if not bot_uxp:
                    bot_uxp = UserThemeXP(user_id=bot.id, theme_id=theme.id, xp=0)
                    db.add(bot_uxp)
                    await db.flush()
                bot_uxp.xp += bot_xp
                bot_all_xp_res = await db.execute(
                    select(func.sum(UserThemeXP.xp)).where(UserThemeXP.user_id == bot.id)
                )
                bot.total_xp = bot_all_xp_res.scalar() or 0

        # Achievements
        from services.achievements import check_achievements as _check_ach
        from sqlalchemy import func as _func
        themes_count_res = await db.execute(
            select(_func.count(_func.distinct(Match.category))).where(Match.player1_id == player_id)
        )
        perfect_res = await db.execute(
            select(_func.count(Match.id)).where(Match.player1_id == player_id, Match.player1_correct == TOTAL_QUESTIONS)
        )
        try:  # #30 — achievements must not block match submission if they fail
            new_achievements = await _check_ach(player_id, {
                "games_played": user.matches_played,
                "wins": user.matches_won,
                "win_streak": user.current_streak,
                "perfect_scores": perfect_res.scalar() or 0,
                "login_streak": user.login_streak or 0,
                "themes_played": themes_count_res.scalar() or 0,
            }, db)
        except Exception as _ach_err:
            logger.warning(f"[submit] Achievement check failed (non-blocking): {_ach_err}")
            new_achievements = []

        # Lives count for response (lets frontend show "use a life?" after loss)
        from routers.streak_shield import get_lives
        lives_remaining = await get_lives(player_id, db)

        # Tournament submission if active theme matches
        tournament_result = None
        try:
            from routers.tournaments import _get_or_create_current
            active_t = await _get_or_create_current(db)
            if active_t and active_t.theme_id == theme.id:
                from models import TournamentEntry
                t_entry_res = await db.execute(
                    select(TournamentEntry).where(
                        TournamentEntry.tournament_id == active_t.id,
                        TournamentEntry.user_id == player_id,
                    )
                )
                t_entry = t_entry_res.scalar_one_or_none()
                from constants import TOTAL_QUESTIONS
                if not t_entry or t_entry.games_played < 3:
                    if t_entry:
                        t_entry.score += player_score
                        t_entry.games_played += 1
                    else:
                        t_entry = TournamentEntry(
                            id=str(__import__('uuid').uuid4()),
                            tournament_id=active_t.id,
                            user_id=player_id,
                            score=player_score,
                            games_played=1,
                        )
                        db.add(t_entry)
                    tournament_result = {"tournament_id": active_t.id, "theme_name": active_t.theme_name}
        except Exception as _tournament_err:
            logger.warning(f"Tournament update failed (non-critical): {_tournament_err}")

        if won:
            notif_body = f"Victoire en {theme.name} ! +{total_xp} XP"
        else:
            notif_body = f"Défaite en {theme.name}. +{total_xp} XP"
        await create_notification(
            db, player_id, "match_result", "notif.match_result", notif_body,
            data={"screen": "results", "params": {"matchId": match.id}},
        )

        # ── Rival push : notify the player just above us that we are catching up ──
        try:
            rival_res = await db.execute(
                select(User)
                .where(User.total_xp > user.total_xp, User.is_bot == False, User.id != player_id)
                .order_by(User.total_xp.asc())
                .limit(1)
            )
            rival = rival_res.scalar_one_or_none()
            if rival and rival.push_token:
                xp_gap = (rival.total_xp or 0) - (user.total_xp or 0)
                from services.notifications import _send_expo_push
                await _send_expo_push(
                    rival.push_token,
                    "⚔️ Ton rival se rapproche !",
                    f"{user.pseudo} n'est plus qu'à {xp_gap} XP derrière toi !",
                    {"type": "rival_alert", "rival_id": player_id},
                )
        except Exception as _rival_err:
            logger.warning(f"Rival push failed (non-critical): {_rival_err}")

        try:
            await db.commit()
        except Exception:
            await db.rollback()
            raise HTTPException(status_code=500, detail="Erreur lors de l'enregistrement du match")

        await db.refresh(match)

        return {
            "id": match.id, "player1_id": match.player1_id,
            "player2_pseudo": match.player2_pseudo, "player2_is_bot": match.player2_is_bot,
            "category": match.category, "theme_name": theme.name,
            "player1_score": match.player1_score, "player2_score": match.player2_score,
            "player1_correct": match.player1_correct, "winner_id": match.winner_id,
            "xp_earned": match.xp_earned, "xp_breakdown": match.xp_breakdown,
            "new_title": new_title_info, "new_level": new_level,
            "new_achievements": new_achievements,
            "lives_remaining": lives_remaining,
            "streak_before": streak_before,
            "streak_broken": not won and streak_before > 0,
            "tournament": tournament_result,
            "created_at": match.created_at.isoformat(),
        }


# Keep /submit-v2 as alias for frontend compatibility
@router.post("/submit-v2")
async def submit_match_v2(request: Request, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    return await submit_match(request, current_user, db)


@router.post("/restore-streak")
async def restore_streak(request: Request, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Restore a win streak broken on the last match (ad shield — no real ad check for now)."""
    body = await request.json()
    match_id = body.get("match_id")
    if not match_id:
        raise HTTPException(status_code=400, detail="match_id requis")

    match_res = await db.execute(select(Match).where(Match.id == match_id))
    match = match_res.scalar_one_or_none()
    if not match or match.player1_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")

    # Only within 10 minutes of match creation
    created = match.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if (datetime.now(timezone.utc) - created).total_seconds() > 600:
        raise HTTPException(status_code=400, detail="Délai dépassé (>10 min)")

    # Must have lost this match
    if match.winner_id == current_user:
        raise HTTPException(status_code=400, detail="Le streak n'a pas été interrompu")

    streak_before = match.player1_streak_before or 0
    if streak_before == 0:
        raise HTTPException(status_code=400, detail="Aucun streak à restaurer")

    user_res = await db.execute(select(User).where(User.id == current_user))
    user = user_res.scalar_one_or_none()
    user.current_streak = streak_before
    if user.current_streak > (user.best_streak or 0):
        user.best_streak = user.current_streak
    await db.commit()
    logger.info(f"[restore-streak] user={current_user} streak restored to {streak_before}")
    return {"success": True, "current_streak": user.current_streak}


@router.get("/weekly-summary")
async def get_weekly_summary(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's game stats for the past 7 days."""
    from collections import Counter

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    matches_res = await db.execute(
        select(Match).where(
            Match.player1_id == user_id,
            Match.created_at > seven_days_ago,
        )
    )
    matches = matches_res.scalars().all()

    games_played = len(matches)
    games_won = sum(1 for m in matches if m.winner_id == user_id)
    xp_earned = sum(m.xp_earned or 0 for m in matches)
    perfect_scores = sum(1 for m in matches if m.player1_correct == TOTAL_QUESTIONS)

    theme_counter: Counter = Counter(m.category for m in matches)
    best_theme_id = theme_counter.most_common(1)[0][0] if theme_counter else None
    best_theme_name = ""
    if best_theme_id:
        theme_res = await db.execute(select(Theme).where(Theme.id == best_theme_id))
        th = theme_res.scalar_one_or_none()
        if th:
            best_theme_name = th.name

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()

    return {
        "games_played": games_played,
        "games_won": games_won,
        "xp_earned": xp_earned,
        "win_rate": round(games_won / games_played * 100) if games_played > 0 else 0,
        "perfect_scores": perfect_scores,
        "best_theme_id": best_theme_id,
        "best_theme_name": best_theme_name,
        "current_streak": user.current_streak if user else 0,
        "total_xp": user.total_xp if user else 0,
    }


VO_GENERATION_PROMPT = """Generate exactly 21 quiz questions in ENGLISH about "{theme_name}".
Rules:
- 7 questions difficulty: "Facile" (easy, well-known facts)
- 7 questions difficulty: "Moyen" (medium, requires some knowledge)
- 7 questions difficulty: "Difficile" (hard, for true fans)
- Each question has exactly 4 answer options
- Exactly 1 correct answer per question
- Questions must be factual and accurate
- Vary question types: characters, plot, actors, release dates, trivia, quotes, etc.

Return ONLY a valid JSON array with exactly 21 objects, no extra text:
[
  {{
    "question_text": "...",
    "options": ["A", "B", "C", "D"],
    "correct_option": 0,
    "difficulty": "Facile"
  }},
  ...
]
correct_option is the 0-based index of the correct answer in options."""


@router.post("/generate-vo/{theme_id}")
async def generate_vo_questions(
    theme_id: str,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate English (VO) questions for a SCREEN theme via Claude AI. Idempotent — skips if already generated."""
    import os
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Service IA non disponible")

    # Verify theme exists and is a SCREEN theme
    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Thème introuvable")
    if theme.super_category != "SCREEN":
        raise HTTPException(status_code=400, detail="Mode VO disponible uniquement pour les thèmes SCREEN")

    # Resolve the category used for questions
    category = await _resolve_theme_category(theme_id, db)

    # Idempotent: if EN questions already exist, return count
    existing = await db.execute(
        select(func.count()).select_from(Question).where(
            Question.category == category, Question.language == 'en'
        )
    )
    existing_count = existing.scalar() or 0
    if existing_count > 0:
        logger.info(f"[generate-vo] EN questions already exist for '{category}': {existing_count}")
        return {"theme_id": theme_id, "question_count": existing_count, "status": "already_exists"}

    # Generate via Claude
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    prompt = VO_GENERATION_PROMPT.format(theme_name=theme.name)
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
    except Exception as e:
        logger.error(f"[generate-vo] Claude API error: {e}")
        raise HTTPException(status_code=503, detail="Erreur lors de la génération IA")

    # Parse JSON
    import json, re
    try:
        json_match = re.search(r'\[.*\]', raw, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON array found")
        questions_data = json.loads(json_match.group())
    except Exception as e:
        logger.error(f"[generate-vo] JSON parse error: {e}\nRaw: {raw[:500]}")
        raise HTTPException(status_code=500, detail="Erreur de parsing des questions générées")

    # Save EN questions
    saved = 0
    for q_data in questions_data:
        try:
            q = Question(
                category=category,
                question_text=q_data["question_text"].strip(),
                options=q_data["options"],
                correct_option=int(q_data["correct_option"]),
                difficulty=q_data.get("difficulty", "Moyen"),
                language='en',
            )
            db.add(q)
            saved += 1
        except Exception as e:
            logger.warning(f"[generate-vo] Skip question: {e}")

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"[generate-vo] DB commit error: {e}")
        raise HTTPException(status_code=500, detail="Erreur d'enregistrement")

    logger.info(f"[generate-vo] Saved {saved} EN questions for '{category}'")
    return {"theme_id": theme_id, "question_count": saved, "status": "generated"}

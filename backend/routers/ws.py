import json
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import jwt as pyjwt
from sqlalchemy import select, func, or_, and_, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from models import User, Question, Match, ChatMessage, UserThemeXP, Theme
from constants import TOTAL_QUESTIONS
from helpers import shuffle_question_options, resolve_theme_category
from i18n import LANGUE_REFERENCE, filtre_langue_questions
from services.ws_manager import manager
from services.xp import (
    get_level, get_streak_bonus, get_streak_badge,
    get_theme_title, check_new_title_theme, MAX_LEVEL, TITLE_THRESHOLDS,
    get_daily_streak_bonus, update_login_streak, difficulty_mix,
)
from services.notifications import push_message
from services import reactions, question_order
from config import JWT_SECRET, JWT_ALGORITHM

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# In-memory rate limiter for WS chat (per sender): max 30 messages/minute
_ws_chat_timestamps: dict = defaultdict(list)
_WS_CHAT_LIMIT = 30
_WS_CHAT_WINDOW = 60  # seconds


def _ws_chat_allowed(sender_id: str) -> bool:
    now = time.time()
    ts = _ws_chat_timestamps[sender_id]
    _ws_chat_timestamps[sender_id] = [t for t in ts if now - t < _WS_CHAT_WINDOW]
    if len(_ws_chat_timestamps[sender_id]) >= _WS_CHAT_LIMIT:
        return False
    _ws_chat_timestamps[sender_id].append(now)
    return True


async def get_session():
    """Create a standalone async session for WebSocket handlers."""
    async with AsyncSessionLocal() as session:
        yield session


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(default=""),
):
    """
    Main WebSocket endpoint. All real-time features go through one connection.

    Client sends JSON messages with "action" field:

    Chat:
      {"action": "chat_send", "receiver_id": "...", "content": "...", "message_type": "text"}
      {"action": "chat_typing", "receiver_id": "..."}

    Matchmaking:
      {"action": "matchmaking_join", "theme_id": "..."}
      {"action": "matchmaking_leave"}

    Game:
      {"action": "game_answer", "room_id": "...", "question_index": 0, "answer": 2, "time_ms": 3500}

    Ping:
      {"action": "ping"}
    """
    # Validate JWT token and verify identity
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        token_user_id = payload.get("sub")
        if token_user_id != user_id:
            await websocket.close(code=1008, reason="Identity mismatch")
            return
    except Exception:
        await websocket.close(code=1008, reason="Invalid or missing token")
        return

    # Reject revoked tokens (logout / deleted account)
    async with AsyncSessionLocal() as _db:
        _res = await _db.execute(select(User.token_version).where(User.id == user_id))
        _current_tv = _res.scalar_one_or_none()
    if _current_tv is None or payload.get("tv", 0) != _current_tv:
        await websocket.close(code=1008, reason="Token revoked")
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "data": {"message": "Invalid JSON"}})
                continue

            action = data.get("action", "")
            manager.touch(user_id)

            try:
                if action == "ping":
                    await websocket.send_json({"type": "pong"})

                elif action == "app_state":
                    manager.set_app_state(user_id, str(data.get("state", "")))

                elif action == "chat_send":
                    await handle_chat_send(user_id, data)

                elif action == "chat_typing":
                    await handle_chat_typing(user_id, data)

                elif action == "matchmaking_join":
                    await handle_matchmaking_join(user_id, data)

                elif action == "matchmaking_leave":
                    manager.leave_matchmaking(user_id)
                    await websocket.send_json({"type": "matchmaking_left"})

                elif action == "challenge_join":
                    await handle_challenge_join(user_id, data)

                elif action == "game_answer":
                    await handle_game_answer(user_id, data)

                elif action == "game_reaction":
                    await manager.send_game_reaction(user_id, data.get("room_id"), data.get("key"))

                elif action == "match_reaction":
                    await handle_match_reaction(user_id, data)

                elif action == "rematch_propose":
                    await handle_rematch_propose(user_id, data)

                elif action == "rematch_accept":
                    await handle_rematch_accept(user_id, data)

                elif action == "rematch_decline":
                    await handle_rematch_decline(user_id)

                else:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": f"Unknown action: {action}"},
                    })

            except Exception as e:
                logger.error(f"WS action error ({action}): {e}")
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": "Une erreur est survenue"},
                })

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WS error for {user_id}: {e}")
        manager.disconnect(user_id)


# ── Chat Handlers ──

async def handle_chat_send(sender_id: str, data: dict, internal_type: str | None = None):
    """Save message to DB and deliver in real-time."""
    receiver_id = data.get("receiver_id", "")
    content = data.get("content", "")
    content = content.strip() if isinstance(content, str) else ""
    message_type = internal_type or data.get("message_type", "text")
    extra_data = None if internal_type else data.get("extra_data")

    if not receiver_id or not isinstance(receiver_id, str):
        return
    # Same rules as REST /chat/send (le type « reaction » n'est posé que par le serveur).
    if not internal_type and message_type not in ("text", "image", "game_card"):
        return
    if len(content) > 500:
        await manager.send_to_user(sender_id, {"type": "error", "data": {"message": "Message trop long (max 500 caractères)"}})
        return
    if extra_data is not None and len(json.dumps(extra_data)) > 200_000:
        await manager.send_to_user(sender_id, {"type": "error", "data": {"message": "Pièce jointe trop lourde"}})
        return
    if message_type == "text" and not content:
        return
    if sender_id == receiver_id:
        return
    if not _ws_chat_allowed(sender_id):
        await manager.send_to_user(sender_id, {"type": "error", "data": {"message": "Trop de messages, ralentis !"}})
        return

    async with AsyncSessionLocal() as db:
        from routers.moderation import is_blocked_between
        if await is_blocked_between(db, sender_id, receiver_id):
            await manager.send_to_user(sender_id, {"type": "error", "data": {"message": "Impossible d'envoyer un message à ce joueur"}})
            return
        msg = ChatMessage(
            sender_id=sender_id, receiver_id=receiver_id,
            content=content, message_type=message_type, extra_data=extra_data,
        )
        db.add(msg)

        s_res = await db.execute(select(User).where(User.id == sender_id))
        sender = s_res.scalar_one_or_none()
        sender_pseudo = sender.pseudo if sender else "Inconnu"

        await db.commit()
        await db.refresh(msg)

        message_data = {
            "id": msg.id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "sender_pseudo": sender_pseudo,
            "sender_avatar_seed": sender.avatar_seed if sender else None,
            "sender_avatar_url": getattr(sender, "avatar_url", None) if sender else None,
            "content": msg.content,
            "message_type": msg.message_type,
            "extra_data": msg.extra_data,
            "read": False,
            "created_at": msg.created_at.isoformat(),
        }

    await manager.send_chat_message(sender_id, receiver_id, message_data)
    await manager.send_to_user(sender_id, {
        "type": "chat_sent",
        "data": message_data,
    })

    # Destinataire hors ligne : push seulement — un message ne va pas dans la cloche.
    async with AsyncSessionLocal() as db:
        await push_message(db, receiver_id, sender_id, sender_pseudo)


async def handle_match_reaction(sender_id: str, data: dict):
    """Réaction d'après-match : clé du catalogue (gratuite ou débloquée au coffre), 3 max par
    adversaire / 10 min. Rangée dans la conversation comme message « reaction » : l'adversaire la
    voit en bulle s'il est sur ses résultats, sinon dans ses messages (bandeau / push)."""
    from models import UserEconomy
    key = data.get("key")
    receiver_id = data.get("receiver_id")
    if not isinstance(key, str) or key not in reactions.ALL:
        return
    if not isinstance(receiver_id, str) or not receiver_id or receiver_id == sender_id:
        return
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(UserEconomy.reactions_unlocked).where(UserEconomy.user_id == sender_id))
        if not reactions.can_use(key, res.scalar_one_or_none()):
            return
    if not reactions.match_allowed(sender_id, receiver_id):
        await manager.send_to_user(sender_id, {"type": "reaction_limited", "data": {}})
        return
    await handle_chat_send(sender_id, {"receiver_id": receiver_id, "content": key}, internal_type="reaction")


async def handle_chat_typing(sender_id: str, data: dict):
    """Notify receiver that sender is typing."""
    receiver_id = data.get("receiver_id", "")
    if receiver_id and receiver_id != sender_id:
        await manager.send_to_user(receiver_id, {
            "type": "chat_typing",
            "data": {"sender_id": sender_id},
        })


# ── Matchmaking Handlers ──

async def handle_matchmaking_join(user_id: str, data: dict):
    """Join matchmaking queue for a theme."""
    theme_id = data.get("theme_id", "")
    if not theme_id:
        return

    async with AsyncSessionLocal() as db:
        u_res = await db.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            await manager.send_to_user(user_id, {
                "type": "error", "data": {"message": "User not found"},
            })
            return

        # Get user's level in this theme
        xp_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == user_id, UserThemeXP.theme_id == theme_id)
        )
        uxp = xp_res.scalar_one_or_none()
        player_level = get_level(uxp.xp) if uxp else 0

        user_data = {
            "id": user.id,
            "pseudo": user.pseudo,
            "avatar_seed": user.avatar_seed,
            "avatar_url": getattr(user, "avatar_url", None),
            "level": player_level,
            "streak": user.current_streak,
            "streak_badge": get_streak_badge(user.current_streak),
            "selected_title": user.selected_title or "",
        }

    await manager.join_matchmaking(user_id, theme_id, user.mmr or 1000, user_data)

    for room_id, room in manager.game_rooms.items():
        if user_id in (room.player1_id, room.player2_id) and not room.questions:
            await load_and_start_game(room_id, theme_id)
            break


async def load_and_start_game(room_id: str, theme_id: str):
    """Load questions from DB and start the game in a room."""
    room = manager.game_rooms.get(room_id)
    if not room or room.questions:
        return

    async with AsyncSessionLocal() as db:
        selected = []

        # questions.category stocke tantôt le theme_id, tantôt le nom du thème selon le
        # script d'import : on résout comme le fait le mode solo (game.py), sinon aucune
        # question n'est trouvée pour les thèmes stockés par nom.
        category = await resolve_theme_category(theme_id, db)

        # Difficulté adaptative : moyenne des niveaux des 2 joueurs sur le thème (duel équitable).
        avg_level = None
        # Ordre des questions : celui du joueur qui a le moins d'XP sur le thème (il a vu le
        # moins de questions) — ses questions jamais vues passent en premier.
        order_pid = room.player1_id
        try:
            levels = []
            least_xp = None
            for pid in (room.player1_id, room.player2_id):
                if not pid:
                    continue
                r = await db.execute(
                    select(UserThemeXP.xp).where(
                        UserThemeXP.user_id == pid, UserThemeXP.theme_id == theme_id
                    )
                )
                x = r.scalar_one_or_none()
                levels.append(get_level(x) if x is not None else 0)
                if least_xp is None or (x or 0) < least_xp:
                    least_xp, order_pid = (x or 0), pid
            if levels:
                avg_level = sum(levels) // len(levels)
        except Exception as e:
            logger.warning(f"[ws] niveau indisponible, mix par défaut: {e}")
        mix = difficulty_mix(avg_level)
        logger.info(f"[ws] room={room_id} theme={theme_id} category={category} avg_level={avg_level} mix={mix}")

        # LANGUE DE LA PARTIE. Les deux joueurs partagent un seul jeu de questions, mais
        # rien ne dit qu'ils parlent la même langue : le multijoueur reste donc en
        # français, la langue de référence du catalogue. Sans ce filtre, une partie
        # piocherait indifféremment parmi les lignes FR, EN et ES d'un même thème et
        # afficherait un mélange des trois — ce que personne ne verrait avant la mise en
        # production. Servir une langue par salon suppose de décider quoi faire quand les
        # deux joueurs diffèrent : c'est un choix produit, pas une correction technique.
        # Exception : un thème NATIF n'existe que dans sa langue (en français, il serait vide).
        langue_unique = (await db.execute(
            select(Theme.langue_unique).where(Theme.id.in_([theme_id, category]))
        )).scalars().first()
        filtre_langue = filtre_langue_questions(Question.language,
                                                langue_unique or LANGUE_REFERENCE)

        cursors = await question_order.load(db, order_pid, theme_id) if order_pid else {}
        for difficulty, count in mix:
            if count <= 0:
                continue
            result = await db.execute(
                select(Question).where(Question.category == category,
                                       Question.difficulty == difficulty, filtre_langue)
            )
            candidates = result.scalars().all()
            if order_pid:
                candidates = question_order.order(order_pid, cursors, difficulty, candidates)
            selected.extend(candidates[:count])

        if len(selected) < 7:
            result = await db.execute(
                select(Question).where(Question.category == category, filtre_langue)
                .order_by(func.random()).limit(7)
            )
            fallback = result.scalars().all()
            for q in fallback:
                if q not in selected and len(selected) < 7:
                    selected.append(q)

        if order_pid and selected:
            await question_order.save(db, order_pid, theme_id, question_order.advance(order_pid, cursors, selected))

        import random
        random.shuffle(selected)

        questions = []
        for q in selected:
            shuffled_opts, new_correct = shuffle_question_options(q.options, q.correct_option)
            questions.append({
                "id": q.id,
                "question_text": q.question_text,
                "options": shuffled_opts,
                "correct_option": new_correct,
                "difficulty": q.difficulty,
            })

    if questions:
        await manager.start_game(room_id, questions)
    else:
        await manager.send_to_user(room.player1_id, {
            "type": "error", "data": {"message": "Pas assez de questions pour ce thème"},
        })
        await manager.send_to_user(room.player2_id, {
            "type": "error", "data": {"message": "Pas assez de questions pour ce thème"},
        })
        manager.cleanup_room(room_id)


async def handle_challenge_join(user_id: str, data: dict):
    """Join a pending challenge room by room_id."""
    room_id = data.get("room_id", "")
    if not room_id:
        return

    theme_id = manager.get_challenge_room_theme(room_id)
    if not theme_id:
        await manager.send_to_user(user_id, {
            "type": "challenge_room_expired",
            "data": {"message": "Salle introuvable ou expirée"},
        })
        return

    async with AsyncSessionLocal() as db:
        u_res = await db.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            return

        xp_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == user_id, UserThemeXP.theme_id == theme_id)
        )
        uxp = xp_res.scalar_one_or_none()

        user_data = {
            "id": user.id,
            "pseudo": user.pseudo,
            "avatar_seed": user.avatar_seed,
            "avatar_url": getattr(user, "avatar_url", None),
            "level": get_level(uxp.xp) if uxp else 0,
            "streak": user.current_streak,
            "streak_badge": get_streak_badge(user.current_streak),
            "selected_title": user.selected_title or "",
        }

    await manager.join_challenge_room(user_id, room_id, user_data)

    # Quand les deux joueurs sont entrés, join_challenge_room crée la salle de jeu sous le même
    # room_id : il faut alors charger les questions, comme pour le matchmaking classique.
    # Sans ça, les deux joueurs attendaient indéfiniment game_start.
    room = manager.game_rooms.get(room_id)
    if room and not room.questions:
        await load_and_start_game(room_id, theme_id)


# ── Game Handlers ──

async def handle_game_answer(user_id: str, data: dict):
    """Process a player's answer during a live game."""
    room_id = data.get("room_id", "")
    question_index = data.get("question_index", 0)
    answer = data.get("answer", -1)
    time_ms = data.get("time_ms", 10000)

    if not room_id:
        return

    room = manager.game_rooms.get(room_id)
    if not room:
        await manager.send_to_user(user_id, {
            "type": "error", "data": {"message": "Room not found"},
        })
        return

    await manager.submit_answer(user_id, room_id, question_index, answer, time_ms)

    if room_id not in manager.game_rooms:
        await save_game_results(room)


async def _post_match_progress(db, player_id: str, user, theme_id: str, won: bool, correct: int, score: int):
    """Missions, achievements and tournament — what solo matches already do in game.py.

    Each part is best-effort, as in game.py (these services commit the session themselves).
    """
    try:
        from services.missions import update_progress
        await update_progress(player_id, {"type": "game_played", "theme_id": theme_id, "won": won, "correct": correct}, db)
    except Exception as e:
        logger.warning(f"[ws post-match] missions failed: {e}")

    try:
        from services.achievements import check_achievements
        from constants import TOTAL_QUESTIONS
        themes_count = (await db.execute(
            select(func.count(func.distinct(Match.category))).where(Match.player1_id == player_id)
        )).scalar() or 0
        perfect = (await db.execute(
            select(func.count(Match.id)).where(Match.player1_id == player_id, Match.player1_correct == TOTAL_QUESTIONS)
        )).scalar() or 0
        await check_achievements(player_id, {
            "games_played": user.matches_played, "wins": user.matches_won,
            "win_streak": user.current_streak, "perfect_scores": perfect,
            "login_streak": user.login_streak or 0, "themes_played": themes_count,
        }, db)
    except Exception as e:
        logger.warning(f"[ws post-match] achievements failed: {e}")

    try:
        from routers.tournaments import _get_or_create_current
        from models import TournamentEntry
        active_t = await _get_or_create_current(db)
        if active_t and active_t.theme_id == theme_id:
            entry = (await db.execute(select(TournamentEntry).where(
                TournamentEntry.tournament_id == active_t.id, TournamentEntry.user_id == player_id,
            ))).scalar_one_or_none()
            if not entry:
                db.add(TournamentEntry(tournament_id=active_t.id, user_id=player_id, score=score, games_played=1))
            elif entry.games_played < 3:
                entry.score += score
                entry.games_played += 1
    except Exception as e:
        logger.warning(f"[ws post-match] tournament failed: {e}")


async def save_game_results(room):
    """Save match results to database for both players."""
    results = room.get_final_results()

    async with AsyncSessionLocal() as db:
        # Get theme info
        theme_res = await db.execute(select(Theme).where(Theme.id == room.theme_id))
        theme = theme_res.scalar_one_or_none()

        for player_id in (room.player1_id, room.player2_id):
            opponent_id = room.get_opponent_id(player_id)

            # ── Duplicate submission guard ──
            recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
            dup_check = await db.execute(
                select(Match).where(
                    Match.created_at >= recent_cutoff,
                    Match.category == room.theme_id,
                    or_(
                        and_(Match.player1_id == player_id, Match.player2_id == opponent_id),
                        and_(Match.player1_id == opponent_id, Match.player2_id == player_id),
                    ),
                )
            )
            if dup_check.scalar_one_or_none():
                logger.info(f"[save_game_results] Duplicate blocked for player={player_id}, theme={room.theme_id}")
                continue

            player_score = room.get_score(player_id)
            opponent_score = room.get_score(opponent_id)
            correct_count = room.get_correct_count(player_id)
            won = player_score > opponent_score

            u_res = await db.execute(select(User).where(User.id == player_id))
            user = u_res.scalar_one_or_none()
            if not user:
                continue

            opp_res = await db.execute(select(User).where(User.id == opponent_id))
            opponent = opp_res.scalar_one_or_none()
            opponent_pseudo = opponent.pseudo if opponent else "Joueur"

            # Get opponent level from theme XP
            opponent_level = 0
            if opponent:
                opp_xp_res = await db.execute(
                    select(UserThemeXP).where(UserThemeXP.user_id == opponent_id, UserThemeXP.theme_id == room.theme_id)
                )
                opp_uxp = opp_xp_res.scalar_one_or_none()
                if opp_uxp:
                    opponent_level = get_level(opp_uxp.xp)

            # Get/create user's theme XP
            uxp_res = await db.execute(
                select(UserThemeXP).where(UserThemeXP.user_id == player_id, UserThemeXP.theme_id == room.theme_id)
            )
            uxp = uxp_res.scalar_one_or_none()
            if not uxp:
                uxp = UserThemeXP(user_id=player_id, theme_id=room.theme_id, xp=0)
                db.add(uxp)
                await db.flush()

            level_before = get_level(uxp.xp)

            base_xp = player_score * 2
            victory_bonus = 50 if won else 0
            perfection_bonus = 50 if correct_count == room.total_questions else 0
            giant_slayer_bonus = 100 if (won and opponent_level - level_before >= 15) else 0
            new_streak = (user.current_streak + 1) if won else 0
            streak_bonus = get_streak_bonus(new_streak) if won else 0
            now_utc = datetime.now(timezone.utc)
            new_login_streak = update_login_streak(user, now_utc)
            daily_bonus = get_daily_streak_bonus(new_login_streak)

            from services.boosts import get_active_boost
            game_xp = base_xp + victory_bonus + perfection_bonus + giant_slayer_bonus + streak_bonus
            theme_id_for_boost = room.theme_id if room else None
            x2_bonus = game_xp if (theme_id_for_boost and await get_active_boost(player_id, theme_id_for_boost, db)) else 0
            # Same purchasable multiplier as solo matches (game.py)
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
                player1_id=player_id, player2_id=opponent_id,
                player2_pseudo=opponent_pseudo, player2_is_bot=False,
                category=room.theme_id,
                player1_score=player_score, player2_score=opponent_score,
                player1_correct=correct_count,
                winner_id=player_id if won else None,
                xp_earned=total_xp, xp_breakdown=xp_breakdown,
                questions_data=results["questions_data"],
            )
            db.add(match)

            user.matches_played += 1
            user.last_played_at = now_utc
            if won:
                user.matches_won += 1
                # Atomic increment to avoid race condition with concurrent matches
                await db.execute(
                    sql_update(User).where(User.id == player_id).values(
                        current_streak=User.current_streak + 1,
                        best_streak=func.greatest(User.best_streak, User.current_streak + 1),
                    )
                )
                await db.refresh(user)
            else:
                user.current_streak = 0

            # Update theme XP
            uxp.xp += total_xp

            # Recalculate total XP
            all_xp_res = await db.execute(
                select(func.sum(UserThemeXP.xp)).where(UserThemeXP.user_id == player_id)
            )
            user.total_xp = all_xp_res.scalar() or 0

            # MMR update
            expected = 1.0 / (1.0 + 10 ** ((1000 - user.mmr) / 400))
            k = 32
            if won:
                user.mmr += k * (1 - expected)
            else:
                user.mmr -= k * expected
            user.mmr = max(100, min(3000, user.mmr))

            level_after = get_level(uxp.xp)
            new_title_info = check_new_title_theme(theme, level_before, level_after) if theme else None

            await _post_match_progress(db, player_id, user, room.theme_id, won, correct_count, player_score)

            await manager.send_to_user(player_id, {
                "type": "match_xp",
                "data": {
                    "xp_earned": total_xp,
                    "xp_breakdown": xp_breakdown,
                    "new_level": level_after if level_after > level_before else None,
                    "new_title": new_title_info,
                },
            })

        try:
            await db.commit()
        except Exception:
            await db.rollback()
            logger.error("Failed to save game results, rolled back transaction")
            for player_id in (room.player1_id, room.player2_id):
                await manager.send_to_user(player_id, {
                    "type": "error",
                    "data": {"message": "Erreur lors de l'enregistrement du match"},
                })


# ── Rematch Handlers ──

async def handle_rematch_propose(user_id: str, data: dict):
    """Player proposes a rematch to their last opponent."""
    opponent_id = data.get("opponent_id", "")
    theme_id = data.get("theme_id", "")
    if not opponent_id or not theme_id:
        return

    async with AsyncSessionLocal() as db:
        u_res = await db.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            return

        xp_res = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == user_id, UserThemeXP.theme_id == theme_id)
        )
        uxp = xp_res.scalar_one_or_none()
        player_level = get_level(uxp.xp) if uxp else 0

        proposer_data = {
            "id": user.id,
            "pseudo": user.pseudo,
            "avatar_seed": user.avatar_seed,
            "avatar_url": getattr(user, "avatar_url", None),
            "level": player_level,
            "streak": user.current_streak,
            "streak_badge": get_streak_badge(user.current_streak),
            "selected_title": user.selected_title or "",
        }

    await manager.propose_rematch(user_id, opponent_id, theme_id, proposer_data)


async def handle_rematch_accept(user_id: str, data: dict):
    """Opponent accepts the rematch. Both navigate to matchmaking."""
    result = await manager.accept_rematch(user_id)
    if not result:
        return


async def handle_rematch_decline(user_id: str):
    """Opponent declines the rematch."""
    await manager.decline_rematch(user_id)

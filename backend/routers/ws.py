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
from helpers import shuffle_question_options
from services.ws_manager import manager
from services.xp import (
    get_level, get_streak_bonus, get_streak_badge,
    get_theme_title, check_new_title_theme, MAX_LEVEL, TITLE_THRESHOLDS,
    get_daily_streak_bonus, update_login_streak,
)
from services.notifications import create_notification
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

            try:
                if action == "ping":
                    await websocket.send_json({"type": "pong"})

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

async def handle_chat_send(sender_id: str, data: dict):
    """Save message to DB and deliver in real-time."""
    receiver_id = data.get("receiver_id", "")
    content = data.get("content", "").strip()
    message_type = data.get("message_type", "text")
    extra_data = data.get("extra_data")

    if not receiver_id:
        return
    if message_type == "text" and not content:
        return
    if sender_id == receiver_id:
        return
    if not _ws_chat_allowed(sender_id):
        await manager.send_to_user(sender_id, {"type": "error", "data": {"message": "Trop de messages, ralentis !"}})
        return

    async with AsyncSessionLocal() as db:
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

    if not manager.is_online(receiver_id):
        async with AsyncSessionLocal() as db:
            if message_type == "text":
                notif_body = f"{sender_pseudo}: {content[:100]}{'...' if len(content) > 100 else ''}"
            elif message_type == "image":
                notif_body = f"{sender_pseudo} t'a envoyé une image"
            else:
                notif_body = f"{sender_pseudo} t'a envoyé un message"

            await create_notification(
                db, receiver_id, "message", "notif.new_message", f"notif.message_body:{sender_pseudo}",
                actor_id=sender_id,
                data={"screen": "chat", "params": {"userId": sender_id, "pseudo": sender_pseudo}},
            )
            await db.commit()


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

        for difficulty, count in [("Facile", 2), ("Moyen", 3), ("Difficile", 2)]:
            result = await db.execute(
                select(Question).where(Question.category == theme_id, Question.difficulty == difficulty)
                .order_by(func.random()).limit(count)
            )
            selected.extend(result.scalars().all())

        if len(selected) < 7:
            result = await db.execute(
                select(Question).where(Question.category == theme_id)
                .order_by(func.random()).limit(7)
            )
            fallback = result.scalars().all()
            for q in fallback:
                if q not in selected and len(selected) < 7:
                    selected.append(q)

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
            "level": get_level(uxp.xp) if uxp else 0,
            "streak": user.current_streak,
            "streak_badge": get_streak_badge(user.current_streak),
            "selected_title": user.selected_title or "",
        }

    await manager.join_challenge_room(user_id, room_id, user_data)


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
            total_xp = game_xp + x2_bonus + daily_bonus

            xp_breakdown = {
                "base": base_xp, "victory": victory_bonus, "perfection": perfection_bonus,
                "giant_slayer": giant_slayer_bonus, "streak": streak_bonus,
                "daily": daily_bonus, "x2": x2_bonus, "total": total_xp,
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

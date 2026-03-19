import asyncio
import json
import random
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages all WebSocket connections: chat, notifications, game."""

    MATCHMAKING_TIMEOUT = 15  # seconds before falling back to bot

    def __init__(self):
        # user_id → WebSocket (one connection per user)
        self.active_connections: dict[str, WebSocket] = {}
        # Matchmaking queue: list of {user_id, theme_id, mmr, ws}
        self.matchmaking_queue: list[dict] = []
        # Active game rooms: room_id → GameRoom
        self.game_rooms: dict[str, "GameRoom"] = {}
        # Matchmaking timeout tasks: user_id → asyncio.Task
        self._matchmaking_timers: dict[str, asyncio.Task] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        # Close previous connection if exists
        old = self.active_connections.get(user_id)
        if old:
            try:
                await old.close(code=4001, reason="new_connection")
            except Exception:
                pass
        self.active_connections[user_id] = ws
        logger.info(f"WS connected: {user_id} (total: {len(self.active_connections)})")

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)
        # Cancel matchmaking timer
        timer = self._matchmaking_timers.pop(user_id, None)
        if timer:
            timer.cancel()
        # Remove from matchmaking queue
        self.matchmaking_queue = [e for e in self.matchmaking_queue if e["user_id"] != user_id]
        # Handle game room disconnect
        for room_id, room in list(self.game_rooms.items()):
            if user_id in (room.player1_id, room.player2_id):
                room.handle_disconnect(user_id)
        logger.info(f"WS disconnected: {user_id} (total: {len(self.active_connections)})")

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections

    async def send_to_user(self, user_id: str, data: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(user_id)

    async def send_chat_message(self, sender_id: str, receiver_id: str, message: dict):
        """Send a chat message in real-time to the receiver."""
        await self.send_to_user(receiver_id, {
            "type": "chat_message",
            "data": message,
        })

    async def send_notification(self, user_id: str, notification: dict):
        """Push a notification in real-time."""
        await self.send_to_user(user_id, {
            "type": "notification",
            "data": notification,
        })

    # ── Matchmaking ──

    async def join_matchmaking(self, user_id: str, theme_id: str, mmr: float, user_data: dict):
        """Add a player to the matchmaking queue and try to find a match."""
        # Remove if already in queue
        self.matchmaking_queue = [e for e in self.matchmaking_queue if e["user_id"] != user_id]

        entry = {
            "user_id": user_id,
            "theme_id": theme_id,
            "mmr": mmr,
            "user_data": user_data,
            "joined_at": datetime.now(timezone.utc),
        }
        self.matchmaking_queue.append(entry)

        # Try to find a match
        match = self._find_match(entry)
        if match:
            self.matchmaking_queue = [
                e for e in self.matchmaking_queue
                if e["user_id"] not in (entry["user_id"], match["user_id"])
            ]
            # Cancel timers for both players
            for uid in (entry["user_id"], match["user_id"]):
                timer = self._matchmaking_timers.pop(uid, None)
                if timer:
                    timer.cancel()
            await self._create_game_room(entry, match, theme_id)
        else:
            # Notify player they're waiting
            await self.send_to_user(user_id, {
                "type": "matchmaking_waiting",
                "data": {"queue_size": len(self.matchmaking_queue)},
            })
            # Start timeout → bot fallback
            old_timer = self._matchmaking_timers.pop(user_id, None)
            if old_timer:
                old_timer.cancel()
            self._matchmaking_timers[user_id] = asyncio.create_task(
                self._matchmaking_timeout(entry)
            )

    async def _matchmaking_timeout(self, entry: dict):
        """After MATCHMAKING_TIMEOUT seconds, create a bot match if still waiting."""
        try:
            await asyncio.sleep(self.MATCHMAKING_TIMEOUT)
        except asyncio.CancelledError:
            return

        user_id = entry["user_id"]
        self._matchmaking_timers.pop(user_id, None)

        # Check if still in queue
        still_waiting = any(e["user_id"] == user_id for e in self.matchmaking_queue)
        if not still_waiting:
            return

        # Remove from queue
        self.matchmaking_queue = [e for e in self.matchmaking_queue if e["user_id"] != user_id]

        # Notify client to fall back to bot match
        await self.send_to_user(user_id, {
            "type": "matchmaking_timeout",
            "data": {
                "message": "Aucun adversaire trouvé, lancement contre un bot...",
                "theme_id": entry["theme_id"],
            },
        })

    def leave_matchmaking(self, user_id: str):
        self.matchmaking_queue = [e for e in self.matchmaking_queue if e["user_id"] != user_id]
        timer = self._matchmaking_timers.pop(user_id, None)
        if timer:
            timer.cancel()

    def _find_match(self, entry: dict) -> Optional[dict]:
        """Find a compatible opponent in the queue (same theme, close MMR)."""
        best_match = None
        best_diff = float("inf")

        for candidate in self.matchmaking_queue:
            if candidate["user_id"] == entry["user_id"]:
                continue
            if candidate["theme_id"] != entry["theme_id"]:
                continue

            mmr_diff = abs(candidate["mmr"] - entry["mmr"])
            # Accept within 300 MMR range
            if mmr_diff < 300 and mmr_diff < best_diff:
                best_diff = mmr_diff
                best_match = candidate

        return best_match

    async def _create_game_room(self, player1: dict, player2: dict, theme_id: str):
        """Create a game room and notify both players."""
        room_id = secrets.token_hex(8)
        room = GameRoom(
            room_id=room_id,
            player1_id=player1["user_id"],
            player2_id=player2["user_id"],
            player1_data=player1["user_data"],
            player2_data=player2["user_data"],
            theme_id=theme_id,
        )
        self.game_rooms[room_id] = room

        # Notify both players
        for player, opponent in [(player1, player2), (player2, player1)]:
            await self.send_to_user(player["user_id"], {
                "type": "match_found",
                "data": {
                    "room_id": room_id,
                    "opponent": opponent["user_data"],
                    "theme_id": theme_id,
                },
            })

        logger.info(f"Game room created: {room_id} ({player1['user_id']} vs {player2['user_id']})")

    # ── Game Actions ──

    async def submit_answer(self, user_id: str, room_id: str, question_index: int, answer: int, time_ms: int):
        """Process a player's answer and broadcast to opponent."""
        room = self.game_rooms.get(room_id)
        if not room:
            return

        opponent_id = room.get_opponent_id(user_id)
        is_correct, points = room.record_answer(user_id, question_index, answer, time_ms)

        # Tell the player their result
        await self.send_to_user(user_id, {
            "type": "answer_result",
            "data": {
                "question_index": question_index,
                "is_correct": is_correct,
                "points": points,
                "your_score": room.get_score(user_id),
                "opponent_score": room.get_score(opponent_id),
            },
        })

        # Tell the opponent this player answered
        await self.send_to_user(opponent_id, {
            "type": "opponent_answered",
            "data": {
                "question_index": question_index,
                "opponent_score": room.get_score(user_id),
                "your_score": room.get_score(opponent_id),
            },
        })

        # Check if both players answered this question
        if room.both_answered(question_index):
            if question_index < room.total_questions - 1:
                # Move to next question
                await self._broadcast_room(room, {
                    "type": "next_question",
                    "data": {
                        "question_index": question_index + 1,
                        "question": room.get_question(question_index + 1),
                        "scores": room.get_scores(),
                    },
                })
            else:
                # Game over
                await self._finish_game(room)

    async def _broadcast_room(self, room: "GameRoom", data: dict):
        await self.send_to_user(room.player1_id, data)
        await self.send_to_user(room.player2_id, data)

    async def _finish_game(self, room: "GameRoom"):
        """End the game and send results to both players."""
        results = room.get_final_results()

        for player_id in (room.player1_id, room.player2_id):
            opponent_id = room.get_opponent_id(player_id)
            await self.send_to_user(player_id, {
                "type": "game_over",
                "data": {
                    "room_id": room.room_id,
                    "your_score": room.get_score(player_id),
                    "opponent_score": room.get_score(opponent_id),
                    "your_correct": room.get_correct_count(player_id),
                    "opponent_correct": room.get_correct_count(opponent_id),
                    "won": room.get_score(player_id) > room.get_score(opponent_id),
                    "questions_data": results["questions_data"],
                },
            })

        # Clean up room after a delay
        self.game_rooms.pop(room.room_id, None)
        logger.info(f"Game room finished: {room.room_id}")

    async def start_game(self, room_id: str, questions: list):
        """Load questions into a room and send the first question to both players."""
        room = self.game_rooms.get(room_id)
        if not room:
            return

        room.set_questions(questions)

        await self._broadcast_room(room, {
            "type": "game_start",
            "data": {
                "room_id": room_id,
                "total_questions": room.total_questions,
                "question": room.get_question(0),
                "scores": room.get_scores(),
            },
        })

    def cleanup_room(self, room_id: str):
        self.game_rooms.pop(room_id, None)


class GameRoom:
    """Represents a live game session between two players."""

    def __init__(self, room_id: str, player1_id: str, player2_id: str,
                 player1_data: dict, player2_data: dict, theme_id: str):
        self.room_id = room_id
        self.player1_id = player1_id
        self.player2_id = player2_id
        self.player1_data = player1_data
        self.player2_data = player2_data
        self.theme_id = theme_id
        self.total_questions = 7
        self.questions: list[dict] = []

        # Scores and answers: player_id → {question_index: {answer, is_correct, points, time_ms}}
        self.answers: dict[str, dict[int, dict]] = {player1_id: {}, player2_id: {}}
        self.scores: dict[str, int] = {player1_id: 0, player2_id: 0}
        self.correct_counts: dict[str, int] = {player1_id: 0, player2_id: 0}
        self.disconnected: set[str] = set()
        self.created_at = datetime.now(timezone.utc)

    def set_questions(self, questions: list[dict]):
        self.questions = questions
        self.total_questions = len(questions)

    def get_question(self, index: int) -> dict:
        if index < len(self.questions):
            q = self.questions[index]
            # Don't send correct answer to clients
            return {
                "id": q["id"],
                "question_text": q["question_text"],
                "options": q["options"],
                "difficulty": q.get("difficulty", "medium"),
                "index": index,
                "total": self.total_questions,
            }
        return {}

    def record_answer(self, user_id: str, question_index: int, answer: int, time_ms: int) -> tuple[bool, int]:
        """Record an answer. Returns (is_correct, points_earned)."""
        if question_index in self.answers.get(user_id, {}):
            # Already answered
            existing = self.answers[user_id][question_index]
            return existing["is_correct"], existing["points"]

        q = self.questions[question_index] if question_index < len(self.questions) else None
        if not q:
            return False, 0

        is_correct = answer == q["correct_option"]

        # Points: base 10 for correct, bonus up to 10 for speed (10s = 10000ms timer)
        if is_correct:
            speed_bonus = max(0, round(10 * (1 - time_ms / 10000)))
            points = 10 + speed_bonus  # 10-20 points per correct answer
        else:
            points = 0

        self.answers[user_id][question_index] = {
            "answer": answer,
            "is_correct": is_correct,
            "points": points,
            "time_ms": time_ms,
        }
        self.scores[user_id] += points
        if is_correct:
            self.correct_counts[user_id] += 1

        return is_correct, points

    def both_answered(self, question_index: int) -> bool:
        p1_answered = question_index in self.answers.get(self.player1_id, {})
        p2_answered = question_index in self.answers.get(self.player2_id, {})
        # Also consider disconnected players as having answered
        if self.player1_id in self.disconnected:
            p1_answered = True
        if self.player2_id in self.disconnected:
            p2_answered = True
        return p1_answered and p2_answered

    def get_score(self, user_id: str) -> int:
        return self.scores.get(user_id, 0)

    def get_correct_count(self, user_id: str) -> int:
        return self.correct_counts.get(user_id, 0)

    def get_scores(self) -> dict:
        return {
            self.player1_id: self.scores[self.player1_id],
            self.player2_id: self.scores[self.player2_id],
        }

    def get_opponent_id(self, user_id: str) -> str:
        return self.player2_id if user_id == self.player1_id else self.player1_id

    def handle_disconnect(self, user_id: str):
        self.disconnected.add(user_id)

    def get_final_results(self) -> dict:
        questions_data = []
        for i, q in enumerate(self.questions):
            p1_answer = self.answers.get(self.player1_id, {}).get(i, {})
            p2_answer = self.answers.get(self.player2_id, {}).get(i, {})
            questions_data.append({
                "question_text": q["question_text"],
                "correct_option": q["correct_option"],
                "options": q["options"],
                "player1_answer": p1_answer.get("answer"),
                "player1_correct": p1_answer.get("is_correct", False),
                "player1_time": p1_answer.get("time_ms", 0),
                "player2_answer": p2_answer.get("answer"),
                "player2_correct": p2_answer.get("is_correct", False),
                "player2_time": p2_answer.get("time_ms", 0),
            })
        return {
            "player1_score": self.scores[self.player1_id],
            "player2_score": self.scores[self.player2_id],
            "player1_correct": self.correct_counts[self.player1_id],
            "player2_correct": self.correct_counts[self.player2_id],
            "questions_data": questions_data,
        }


# Singleton
manager = ConnectionManager()

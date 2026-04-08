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
    CHALLENGE_ROOM_TIMEOUT = 30  # seconds for challenger to join after accept

    def __init__(self):
        # user_id → WebSocket (one connection per user)
        self.active_connections: dict[str, WebSocket] = {}
        # Matchmaking queue: list of {user_id, theme_id, mmr, ws}
        self.matchmaking_queue: list[dict] = []
        # Active game rooms: room_id → GameRoom
        self.game_rooms: dict[str, "GameRoom"] = {}
        # Matchmaking timeout tasks: user_id → asyncio.Task
        self._matchmaking_timers: dict[str, asyncio.Task] = {}
        # Pending rematch proposals: rematch_id → {proposer_id, opponent_id, theme_id, proposer_data, timer}
        self.pending_rematches: dict[str, dict] = {}
        # Quick lookup: opponent_id → rematch_id (so opponent can find their pending rematch)
        self._rematch_by_opponent: dict[str, str] = {}
        # Quick lookup: proposer_id → rematch_id
        self._rematch_by_proposer: dict[str, str] = {}
        # Pending challenge rooms: room_id → {acceptor_id, challenger_id, theme_id, players_data, timer}
        self.pending_challenge_rooms: dict[str, dict] = {}

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
        # #26 — Clean up pending challenge rooms the user was part of
        for room_id in [rid for rid, r in list(self.pending_challenge_rooms.items())
                        if user_id in (r.get("acceptor_id"), r.get("challenger_id"))]:
            room = self.pending_challenge_rooms.pop(room_id, None)
            if room:
                t = room.get("timer")
                if t:
                    t.cancel()
        # Handle game room disconnect — schedule async cleanup
        for room_id, room in list(self.game_rooms.items()):
            if user_id in (room.player1_id, room.player2_id):
                room.handle_disconnect(user_id)
                # Schedule async notification to opponent
                asyncio.create_task(self._handle_game_disconnect(room, user_id))
        logger.info(f"WS disconnected: {user_id} (total: {len(self.active_connections)})")

    async def _handle_game_disconnect(self, room: "GameRoom", disconnected_id: str):
        """Handle a player disconnecting mid-game. Give opponent auto-win with score compensation."""
        if room.finished:
            return  # Both players disconnected simultaneously — only handle once
        room.finished = True
        opponent_id = room.get_opponent_id(disconnected_id)

        # Calculate score compensation for remaining questions
        opponent_score = room.get_score(opponent_id)
        opponent_correct = room.get_correct_count(opponent_id)
        answered_count = len(room.answers.get(opponent_id, {}))
        remaining = room.total_questions - answered_count

        # Average points per question for the opponent (if they answered at least 1)
        MAX_PTS_PER_Q = 20
        if answered_count > 0:
            avg_pts = min(opponent_score / answered_count, MAX_PTS_PER_Q)  # #27 — cap to prevent over-compensation
        else:
            avg_pts = 10  # Default: base points for a correct answer

        # Add compensation: average * remaining questions (points only, not is_correct)
        compensation = round(avg_pts * remaining)
        room.scores[opponent_id] += compensation
        # Do NOT increment correct_counts — compensation is not real correct answers

        # Mark all remaining questions for both players (score 0 for disconnected)
        for i in range(room.total_questions):
            if i not in room.answers.get(disconnected_id, {}):
                if disconnected_id not in room.answers:
                    room.answers[disconnected_id] = {}
                room.answers[disconnected_id][i] = {
                    "answer": -1,
                    "is_correct": False,
                    "points": 0,
                    "time_ms": 0,
                }
            if i not in room.answers.get(opponent_id, {}):
                if opponent_id not in room.answers:
                    room.answers[opponent_id] = {}
                room.answers[opponent_id][i] = {
                    "answer": -1,
                    "is_correct": False,   # compensation ≠ correct answer
                    "points": round(avg_pts),
                    "time_ms": 5000,
                }

        # Store compensation on room so _finish_game can include it in xp_breakdown
        room.disconnect_compensation = {opponent_id: compensation}

        # Notify opponent of disconnect + auto victory
        await self.send_to_user(opponent_id, {
            "type": "opponent_disconnected",
            "data": {
                "message": "Votre adversaire s'est déconnecté",
                "auto_victory": True,
                "compensation_points": compensation,
                "your_score": room.get_score(opponent_id),
                "opponent_score": room.get_score(disconnected_id),
                "your_correct": room.get_correct_count(opponent_id),
            },
        })

        # Finish the game properly (save results)
        await self._finish_game(room)

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

    # ── Rematch ──

    REMATCH_TIMEOUT = 15  # seconds to wait for opponent response

    async def propose_rematch(self, proposer_id: str, opponent_id: str, theme_id: str, proposer_data: dict):
        """Send a rematch proposal to the opponent."""
        # Cancel any existing rematch from this proposer
        old_rid = self._rematch_by_proposer.get(proposer_id)
        if old_rid:
            self._cleanup_rematch(old_rid)

        # If opponent is offline, immediately decline
        if not self.is_online(opponent_id):
            await self.send_to_user(proposer_id, {
                "type": "rematch_declined",
                "data": {"reason": "opponent_offline"},
            })
            return

        rematch_id = secrets.token_hex(8)
        self.pending_rematches[rematch_id] = {
            "proposer_id": proposer_id,
            "opponent_id": opponent_id,
            "theme_id": theme_id,
            "proposer_data": proposer_data,
        }
        self._rematch_by_opponent[opponent_id] = rematch_id
        self._rematch_by_proposer[proposer_id] = rematch_id

        # Notify opponent
        await self.send_to_user(opponent_id, {
            "type": "rematch_proposal",
            "data": {
                "rematch_id": rematch_id,
                "proposer_id": proposer_id,
                "proposer_pseudo": proposer_data.get("pseudo", "Joueur"),
                "theme_id": theme_id,
            },
        })

        # Confirm to proposer that proposal was sent
        await self.send_to_user(proposer_id, {
            "type": "rematch_sent",
            "data": {"rematch_id": rematch_id},
        })

        # Start timeout
        self.pending_rematches[rematch_id]["timer"] = asyncio.create_task(
            self._rematch_timeout(rematch_id)
        )
        logger.info(f"Rematch proposed: {proposer_id} → {opponent_id} (theme={theme_id})")

    async def _rematch_timeout(self, rematch_id: str):
        """Auto-decline rematch after timeout."""
        try:
            await asyncio.sleep(self.REMATCH_TIMEOUT)
        except asyncio.CancelledError:
            return

        rematch = self.pending_rematches.get(rematch_id)
        if not rematch:
            return

        proposer_id = rematch["proposer_id"]
        opponent_id = rematch["opponent_id"]
        self._cleanup_rematch(rematch_id)

        # Notify proposer that opponent didn't respond
        await self.send_to_user(proposer_id, {
            "type": "rematch_expired",
            "data": {"reason": "timeout"},
        })
        # Notify opponent too (dismiss modal if still showing)
        await self.send_to_user(opponent_id, {
            "type": "rematch_expired",
            "data": {"reason": "timeout"},
        })
        logger.info(f"Rematch expired: {rematch_id}")

    async def accept_rematch(self, opponent_id: str):
        """Opponent accepts the rematch. Create a game room directly."""
        rematch_id = self._rematch_by_opponent.get(opponent_id)
        if not rematch_id:
            return None

        rematch = self.pending_rematches.get(rematch_id)
        if not rematch:
            return None

        proposer_id = rematch["proposer_id"]
        theme_id = rematch["theme_id"]
        self._cleanup_rematch(rematch_id)

        # Notify both players
        await self.send_to_user(proposer_id, {
            "type": "rematch_accepted",
            "data": {"theme_id": theme_id},
        })
        await self.send_to_user(opponent_id, {
            "type": "rematch_accepted",
            "data": {"theme_id": theme_id},
        })
        logger.info(f"Rematch accepted: {proposer_id} vs {opponent_id}")
        return {"proposer_id": proposer_id, "opponent_id": opponent_id, "theme_id": theme_id}

    async def decline_rematch(self, opponent_id: str):
        """Opponent declines the rematch."""
        rematch_id = self._rematch_by_opponent.get(opponent_id)
        if not rematch_id:
            return

        rematch = self.pending_rematches.get(rematch_id)
        if not rematch:
            return

        proposer_id = rematch["proposer_id"]
        self._cleanup_rematch(rematch_id)

        # Notify proposer
        await self.send_to_user(proposer_id, {
            "type": "rematch_declined",
            "data": {"reason": "declined"},
        })
        logger.info(f"Rematch declined by {opponent_id}")

    def _cleanup_rematch(self, rematch_id: str):
        """Remove a rematch proposal and cancel its timer."""
        rematch = self.pending_rematches.pop(rematch_id, None)
        if not rematch:
            return
        timer = rematch.get("timer")
        if timer and not timer.done():
            timer.cancel()
        self._rematch_by_opponent.pop(rematch.get("opponent_id", ""), None)
        self._rematch_by_proposer.pop(rematch.get("proposer_id", ""), None)

    # ── Challenge Rooms ──

    async def create_challenge_room(self, room_id: str, acceptor_id: str, challenger_id: str,
                                     theme_id: str, opponent_pseudo: str, theme_name: str):
        """Create a pending challenge room and notify the challenger to join."""
        self.pending_challenge_rooms[room_id] = {
            "acceptor_id": acceptor_id,
            "challenger_id": challenger_id,
            "theme_id": theme_id,
            "players_data": {},
        }

        # Notify challenger
        await self.send_to_user(challenger_id, {
            "type": "challenge_ready",
            "data": {
                "room_id": room_id,
                "theme_id": theme_id,
                "theme_name": theme_name,
                "opponent_pseudo": opponent_pseudo,
            },
        })

        # Start timeout — notify acceptor if challenger never joins
        task = asyncio.create_task(self._challenge_room_timeout(room_id, acceptor_id))
        self.pending_challenge_rooms[room_id]["timer"] = task
        logger.info(f"Challenge room pending: {room_id} ({acceptor_id} vs {challenger_id})")

    async def join_challenge_room(self, user_id: str, room_id: str, user_data: dict):
        """A player joins a pending challenge room. When both are in → start game."""
        room = self.pending_challenge_rooms.get(room_id)
        if not room:
            await self.send_to_user(user_id, {
                "type": "challenge_room_expired",
                "data": {"message": "Salle introuvable ou expirée"},
            })
            return

        if user_id not in (room["acceptor_id"], room["challenger_id"]):
            return

        room["players_data"][user_id] = user_data

        # Both players joined → cancel timeout and start game
        if room["acceptor_id"] in room["players_data"] and room["challenger_id"] in room["players_data"]:
            timer = room.get("timer")
            if timer:
                timer.cancel()

            acceptor_entry = {"user_id": room["acceptor_id"], "user_data": room["players_data"][room["acceptor_id"]]}
            challenger_entry = {"user_id": room["challenger_id"], "user_data": room["players_data"][room["challenger_id"]]}
            theme_id = room["theme_id"]

            self.pending_challenge_rooms.pop(room_id, None)
            await self._create_challenge_game_room(room_id, acceptor_entry, challenger_entry, theme_id)

    async def _create_challenge_game_room(self, room_id: str, player1: dict, player2: dict, theme_id: str):
        """Create a game room for a challenge match (pre-assigned room_id)."""
        room = GameRoom(
            room_id=room_id,
            player1_id=player1["user_id"],
            player2_id=player2["user_id"],
            player1_data=player1["user_data"],
            player2_data=player2["user_data"],
            theme_id=theme_id,
        )
        self.game_rooms[room_id] = room

        for player, opponent in [(player1, player2), (player2, player1)]:
            await self.send_to_user(player["user_id"], {
                "type": "match_found",
                "data": {
                    "room_id": room_id,
                    "opponent": opponent["user_data"],
                    "theme_id": theme_id,
                },
            })
        logger.info(f"Challenge game room started: {room_id}")

    async def _challenge_room_timeout(self, room_id: str, acceptor_id: str):
        """After CHALLENGE_ROOM_TIMEOUT seconds, notify acceptor that challenger didn't join."""
        try:
            await asyncio.sleep(self.CHALLENGE_ROOM_TIMEOUT)
        except asyncio.CancelledError:
            return

        room = self.pending_challenge_rooms.pop(room_id, None)
        if not room:
            return

        await self.send_to_user(acceptor_id, {
            "type": "challenge_timeout",
            "data": {},
        })
        logger.info(f"Challenge room timed out: {room_id}")

    def get_challenge_room_theme(self, room_id: str) -> str:
        room = self.pending_challenge_rooms.get(room_id)
        return room["theme_id"] if room else ""

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
        compensations = room.disconnect_compensation

        for player_id in (room.player1_id, room.player2_id):
            opponent_id = room.get_opponent_id(player_id)
            payload: dict = {
                "room_id": room.room_id,
                "your_score": room.get_score(player_id),
                "opponent_score": room.get_score(opponent_id),
                "your_correct": room.get_correct_count(player_id),
                "opponent_correct": room.get_correct_count(opponent_id),
                "won": room.get_score(player_id) > room.get_score(opponent_id),
                "questions_data": results["questions_data"],
            }
            if player_id in compensations:
                payload["disconnect_compensation"] = compensations[player_id]
            await self.send_to_user(player_id, {
                "type": "game_over",
                "data": payload,
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
        self.finished: bool = False
        self.disconnect_compensation: dict[str, int] = {}
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

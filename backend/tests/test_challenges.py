"""
Integration tests for the challenge system.

Requires a running backend (EXPO_PUBLIC_BACKEND_URL in frontend/.env).

Tests:
  - send challenge (success, duplicate, self-challenge)
  - accept / decline
  - save-async-score: first player, second player, completed state
  - p1-answers: access control, data integrity
  - vs-stats: counts victories correctly
  - history: lists completed challenges in order
"""
import pytest
import requests
import uuid
import os
from pathlib import Path
from dotenv import load_dotenv

frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")

API = f"{BASE_URL}/api"


# ── Helpers ──────────────────────────────────────────────────────────────

def register(pseudo_suffix: str) -> dict:
    """Register a test guest user and return {id, pseudo, token}."""
    pseudo = f"T_{pseudo_suffix}_{uuid.uuid4().hex[:6]}"
    res = requests.post(f"{API}/auth/register-guest", json={"pseudo": pseudo})
    assert res.status_code == 200, res.text
    data = res.json()
    return {"id": data["id"], "pseudo": data["pseudo"], "token": data.get("token", "")}


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def send_challenge(challenger: dict, challenged: dict, theme_id: str = "") -> dict:
    res = requests.post(
        f"{API}/challenges/send",
        json={
            "challenger_id": challenger["id"],
            "challenged_id": challenged["id"],
            "theme_id": theme_id,
            "theme_name": "",
        },
        headers=auth_headers(challenger["token"]),
    )
    return res


SAMPLE_ANSWERS = [
    {"answer": 2, "is_correct": True,  "points": 18, "time_ms": 2000},
    {"answer": 0, "is_correct": False, "points": 0,  "time_ms": 8000},
    {"answer": 1, "is_correct": True,  "points": 15, "time_ms": 5000},
    {"answer": 3, "is_correct": True,  "points": 20, "time_ms": 0},
    {"answer": 2, "is_correct": False, "points": 0,  "time_ms": 9000},
    {"answer": 0, "is_correct": True,  "points": 14, "time_ms": 6000},
    {"answer": 1, "is_correct": True,  "points": 12, "time_ms": 8000},
]
P1_SCORE = sum(a["points"] for a in SAMPLE_ANSWERS)  # 79
P1_CORRECT = sum(1 for a in SAMPLE_ANSWERS if a["is_correct"])  # 5


# ── Tests ─────────────────────────────────────────────────────────────────

class TestChallengeSend:

    def test_send_challenge_success(self):
        p1 = register("CHA_send_p1")
        p2 = register("CHA_send_p2")
        res = send_challenge(p1, p2)
        assert res.status_code == 200
        data = res.json()
        assert "challenge_id" in data
        assert data["status"] == "pending"

    def test_send_duplicate_returns_409(self):
        p1 = register("CHA_dup_p1")
        p2 = register("CHA_dup_p2")
        first = send_challenge(p1, p2)
        assert first.status_code == 200
        second = send_challenge(p1, p2)
        assert second.status_code == 409

    def test_cannot_challenge_self(self):
        p1 = register("CHA_self")
        res = requests.post(
            f"{API}/challenges/send",
            json={"challenger_id": p1["id"], "challenged_id": p1["id"]},
            headers=auth_headers(p1["token"]),
        )
        assert res.status_code == 400

    def test_send_requires_both_ids(self):
        p1 = register("CHA_miss")
        res = requests.post(
            f"{API}/challenges/send",
            json={"challenger_id": p1["id"]},
            headers=auth_headers(p1["token"]),
        )
        assert res.status_code == 400


class TestChallengeAcceptDecline:

    def test_accept_returns_room_id(self):
        p1 = register("CHA_acc_p1")
        p2 = register("CHA_acc_p2")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        res = requests.post(
            f"{API}/challenges/{challenge_id}/accept",
            json={"user_id": p2["id"]},
            headers=auth_headers(p2["token"]),
        )
        assert res.status_code == 200
        data = res.json()
        assert "room_id" in data
        assert data["status"] == "accepted"

    def test_only_challenged_can_accept(self):
        p1 = register("CHA_acc_wrong_p1")
        p2 = register("CHA_acc_wrong_p2")
        p3 = register("CHA_acc_wrong_p3")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        # p3 trying to accept should fail
        res = requests.post(
            f"{API}/challenges/{challenge_id}/accept",
            json={"user_id": p3["id"]},
            headers=auth_headers(p3["token"]),
        )
        assert res.status_code == 403

    def test_decline_changes_status(self):
        p1 = register("CHA_dec_p1")
        p2 = register("CHA_dec_p2")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        res = requests.post(
            f"{API}/challenges/{challenge_id}/decline",
            json={"user_id": p2["id"]},
            headers=auth_headers(p2["token"]),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "declined"

    def test_cannot_accept_declined_challenge(self):
        p1 = register("CHA_decacc_p1")
        p2 = register("CHA_decacc_p2")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        requests.post(
            f"{API}/challenges/{challenge_id}/decline",
            json={"user_id": p2["id"]},
            headers=auth_headers(p2["token"]),
        )
        res = requests.post(
            f"{API}/challenges/{challenge_id}/accept",
            json={"user_id": p2["id"]},
            headers=auth_headers(p2["token"]),
        )
        assert res.status_code == 400


class TestAsyncScore:

    def _create_challenge(self):
        p1 = register("CHA_async_p1")
        p2 = register("CHA_async_p2")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]
        return p1, p2, challenge_id

    def test_first_player_save_returns_waiting(self):
        p1, p2, cid = self._create_challenge()
        res = requests.post(
            f"{API}/challenges/{cid}/save-async-score",
            json={
                "user_id": p1["id"],
                "score": P1_SCORE,
                "correct": P1_CORRECT,
                "answers": SAMPLE_ANSWERS,
            },
            headers=auth_headers(p1["token"]),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "waiting_for_opponent"

    def test_both_play_returns_completed(self):
        p1, p2, cid = self._create_challenge()

        # P1 plays
        requests.post(
            f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p1["id"], "score": 80, "correct": 5, "answers": SAMPLE_ANSWERS},
            headers=auth_headers(p1["token"]),
        )

        # P2 plays
        res = requests.post(
            f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p2["id"], "score": 60, "correct": 3, "answers": SAMPLE_ANSWERS[:7]},
            headers=auth_headers(p2["token"]),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert "p1_score" in data
        assert "p2_score" in data
        assert data["p1_score"] == 80
        assert data["p2_score"] == 60
        assert data["p1_won"] is True

    def test_p1_wins_when_scores_equal(self):
        p1, p2, cid = self._create_challenge()
        score = 70

        requests.post(
            f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p1["id"], "score": score, "correct": 4, "answers": []},
            headers=auth_headers(p1["token"]),
        )
        res = requests.post(
            f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p2["id"], "score": score, "correct": 4, "answers": []},
            headers=auth_headers(p2["token"]),
        )
        data = res.json()
        assert data["status"] == "completed"
        assert data["p1_won"] is True  # p1 wins on tie

    def test_cannot_save_twice_after_completed(self):
        p1, p2, cid = self._create_challenge()

        for user in [p1, p2]:
            requests.post(
                f"{API}/challenges/{cid}/save-async-score",
                json={"user_id": user["id"], "score": 50, "correct": 3, "answers": []},
                headers=auth_headers(user["token"]),
            )

        # Try saving again after completed
        res = requests.post(
            f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p1["id"], "score": 999, "correct": 7, "answers": []},
            headers=auth_headers(p1["token"]),
        )
        assert res.status_code == 400

    def test_stranger_cannot_save_score(self):
        p1, p2, cid = self._create_challenge()
        p3 = register("CHA_stranger")

        res = requests.post(
            f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p3["id"], "score": 50, "correct": 3, "answers": []},
            headers=auth_headers(p3["token"]),
        )
        assert res.status_code == 403


class TestP1Answers:

    def test_p2_can_fetch_p1_answers(self):
        p1 = register("CHA_ans_p1")
        p2 = register("CHA_ans_p2")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        # P1 saves answers
        requests.post(
            f"{API}/challenges/{challenge_id}/save-async-score",
            json={"user_id": p1["id"], "score": P1_SCORE, "correct": P1_CORRECT, "answers": SAMPLE_ANSWERS},
            headers=auth_headers(p1["token"]),
        )

        # P2 fetches them
        res = requests.get(
            f"{API}/challenges/{challenge_id}/p1-answers",
            params={"user_id": p2["id"]},
        )
        assert res.status_code == 200
        data = res.json()
        assert "answers" in data
        assert len(data["answers"]) == len(SAMPLE_ANSWERS)
        assert data["answers"][0]["answer"] == SAMPLE_ANSWERS[0]["answer"]
        assert data["answers"][0]["is_correct"] == SAMPLE_ANSWERS[0]["is_correct"]
        assert data["answers"][0]["points"] == SAMPLE_ANSWERS[0]["points"]

    def test_p1_cannot_fetch_own_answers_via_this_endpoint(self):
        p1 = register("CHA_ans_self_p1")
        p2 = register("CHA_ans_self_p2")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        res = requests.get(
            f"{API}/challenges/{challenge_id}/p1-answers",
            params={"user_id": p1["id"]},
        )
        assert res.status_code == 403

    def test_answers_empty_before_p1_plays(self):
        p1 = register("CHA_empty_p1")
        p2 = register("CHA_empty_p2")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        res = requests.get(
            f"{API}/challenges/{challenge_id}/p1-answers",
            params={"user_id": p2["id"]},
        )
        assert res.status_code == 200
        assert res.json()["answers"] == []

    def test_stranger_cannot_fetch_p1_answers(self):
        p1 = register("CHA_str_p1")
        p2 = register("CHA_str_p2")
        p3 = register("CHA_str_p3")
        challenge_id = send_challenge(p1, p2).json()["challenge_id"]

        res = requests.get(
            f"{API}/challenges/{challenge_id}/p1-answers",
            params={"user_id": p3["id"]},
        )
        assert res.status_code == 403


class TestVsStats:

    def test_no_shared_challenges_returns_zero(self):
        p1 = register("VS_zero_p1")
        p2 = register("VS_zero_p2")

        res = requests.get(
            f"{API}/challenges/vs-stats",
            params={"user_id": p1["id"], "opponent_id": p2["id"]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 0
        assert data["user_wins"] == 0
        assert data["opponent_wins"] == 0

    def test_counts_p1_victory(self):
        p1 = register("VS_p1win_p1")
        p2 = register("VS_p1win_p2")
        cid = send_challenge(p1, p2).json()["challenge_id"]

        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p1["id"], "score": 100, "correct": 7, "answers": []},
            headers=auth_headers(p1["token"]))
        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p2["id"], "score": 40,  "correct": 2, "answers": []},
            headers=auth_headers(p2["token"]))

        # From p1's perspective
        res = requests.get(f"{API}/challenges/vs-stats",
            params={"user_id": p1["id"], "opponent_id": p2["id"]})
        data = res.json()
        assert data["total"] == 1
        assert data["user_wins"] == 1
        assert data["opponent_wins"] == 0

        # From p2's perspective it's reversed
        res2 = requests.get(f"{API}/challenges/vs-stats",
            params={"user_id": p2["id"], "opponent_id": p1["id"]})
        data2 = res2.json()
        assert data2["user_wins"] == 0
        assert data2["opponent_wins"] == 1

    def test_counts_p2_victory(self):
        p1 = register("VS_p2win_p1")
        p2 = register("VS_p2win_p2")
        cid = send_challenge(p1, p2).json()["challenge_id"]

        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p1["id"], "score": 30, "correct": 2, "answers": []},
            headers=auth_headers(p1["token"]))
        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p2["id"], "score": 90, "correct": 6, "answers": []},
            headers=auth_headers(p2["token"]))

        res = requests.get(f"{API}/challenges/vs-stats",
            params={"user_id": p2["id"], "opponent_id": p1["id"]})
        data = res.json()
        assert data["user_wins"] == 1
        assert data["opponent_wins"] == 0


class TestChallengeHistory:

    def test_empty_history_for_new_user(self):
        p = register("HIST_new")
        res = requests.get(f"{API}/challenges/history", params={"user_id": p["id"]})
        assert res.status_code == 200
        assert res.json()["challenges"] == []

    def test_completed_challenge_appears_in_history(self):
        p1 = register("HIST_p1")
        p2 = register("HIST_p2")
        cid = send_challenge(p1, p2).json()["challenge_id"]

        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p1["id"], "score": 80, "correct": 5, "answers": []},
            headers=auth_headers(p1["token"]))
        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p2["id"], "score": 50, "correct": 3, "answers": []},
            headers=auth_headers(p2["token"]))

        res = requests.get(f"{API}/challenges/history", params={"user_id": p1["id"]})
        assert res.status_code == 200
        history = res.json()["challenges"]
        assert len(history) >= 1

        entry = next((h for h in history if h["challenge_id"] == cid), None)
        assert entry is not None
        assert entry["my_score"] == 80
        assert entry["opponent_score"] == 50
        assert entry["won"] is True
        assert entry["opponent_pseudo"] == p2["pseudo"]

    def test_history_shows_correct_winner_for_p2(self):
        p1 = register("HIST_win_p1")
        p2 = register("HIST_win_p2")
        cid = send_challenge(p1, p2).json()["challenge_id"]

        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p1["id"], "score": 40, "correct": 2, "answers": []},
            headers=auth_headers(p1["token"]))
        requests.post(f"{API}/challenges/{cid}/save-async-score",
            json={"user_id": p2["id"], "score": 90, "correct": 6, "answers": []},
            headers=auth_headers(p2["token"]))

        # p2 should see won=True
        res = requests.get(f"{API}/challenges/history", params={"user_id": p2["id"]})
        history = res.json()["challenges"]
        entry = next((h for h in history if h["challenge_id"] == cid), None)
        assert entry is not None
        assert entry["won"] is True
        assert entry["my_score"] == 90

    def test_pending_challenge_not_in_history(self):
        p1 = register("HIST_pend_p1")
        p2 = register("HIST_pend_p2")
        cid = send_challenge(p1, p2).json()["challenge_id"]

        # Nobody played — challenge is still pending
        res = requests.get(f"{API}/challenges/history", params={"user_id": p1["id"]})
        history = res.json()["challenges"]
        ids = [h["challenge_id"] for h in history]
        assert cid not in ids

    def test_history_respects_limit(self):
        p1 = register("HIST_lim_p1")
        # Send 3 challenges to the same opponent and complete them
        for i in range(3):
            p2 = register(f"HIST_lim_p2_{i}")
            cid = send_challenge(p1, p2).json()["challenge_id"]
            requests.post(f"{API}/challenges/{cid}/save-async-score",
                json={"user_id": p1["id"], "score": 50, "correct": 3, "answers": []},
                headers=auth_headers(p1["token"]))
            requests.post(f"{API}/challenges/{cid}/save-async-score",
                json={"user_id": p2["id"], "score": 30, "correct": 2, "answers": []},
                headers=auth_headers(p2["token"]))

        res = requests.get(f"{API}/challenges/history",
            params={"user_id": p1["id"], "limit": 2})
        assert res.status_code == 200
        assert len(res.json()["challenges"]) <= 2

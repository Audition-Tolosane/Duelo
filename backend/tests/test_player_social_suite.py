"""
Backend API Tests for Player Social Suite
Tests: Player Search, Player Profile, Player Follow, Chat System (send, messages, conversations, unread count)
This tests the new social features for the Duelo Quiz App
"""
import pytest
import requests
import os
import random
import string
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found")


def unique_pseudo(prefix="TEST"):
    """Generate a unique pseudo with random suffix"""
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{prefix}_{suffix}"


# ===== Player Search Tests =====
class TestPlayerSearch:
    """Player search endpoint tests"""

    def test_search_players_no_filters(self, api_client):
        """GET /api/players/search - returns players list"""
        response = api_client.get(f"{BASE_URL}/api/players/search?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify player structure if results exist
        if len(data) > 0:
            player = data[0]
            assert "id" in player
            assert "pseudo" in player
            assert "avatar_seed" in player
            assert "total_xp" in player
            assert "country_flag" in player
            assert "selected_title" in player
        print(f"[PASS] Search returned {len(data)} players")

    def test_search_players_with_query(self, api_client):
        """GET /api/players/search?q=X - search by pseudo"""
        # First create a test user
        pseudo = unique_pseudo("SRCH")
        res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": pseudo}
        )
        assert res.status_code == 200, f"Registration failed: {res.text}"
        
        # Search for user
        search_q = pseudo[:8]  # Use first 8 chars
        response = api_client.get(f"{BASE_URL}/api/players/search?q={search_q}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should find the user
        found = any(p["pseudo"] == pseudo for p in data)
        assert found is True, f"User {pseudo} not found in search results for query '{search_q}'"
        print(f"[PASS] Found user {pseudo} via search")

    def test_search_players_with_category_filter(self, api_client):
        """GET /api/players/search?category=X - filter by category"""
        response = api_client.get(f"{BASE_URL}/api/players/search?category=series_tv&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"[PASS] Category filter returned {len(data)} players")


# ===== Player Profile Tests =====
class TestPlayerProfile:
    """Player profile endpoint tests"""

    def test_get_player_profile_success(self, api_client):
        """GET /api/player/{user_id}/profile - get full public profile"""
        # Create test user
        pseudo = unique_pseudo("PROF")
        reg_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": pseudo}
        )
        assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
        user = reg_res.json()
        user_id = user["id"]
        
        # Get profile
        response = api_client.get(f"{BASE_URL}/api/player/{user_id}/profile")
        assert response.status_code == 200
        
        data = response.json()
        # Verify profile structure
        assert data["id"] == user_id
        assert "pseudo" in data
        assert "avatar_seed" in data
        assert "selected_title" in data
        assert "country_flag" in data
        assert "matches_played" in data
        assert "matches_won" in data
        assert "win_rate" in data
        assert "total_xp" in data
        assert "categories" in data
        assert "champion_titles" in data
        assert "followers_count" in data
        assert "following_count" in data
        assert "is_following" in data
        assert "posts" in data
        print(f"[PASS] Player profile retrieved for {pseudo}")

    def test_get_player_profile_with_viewer(self, api_client):
        """GET /api/player/{user_id}/profile?viewer_id=X - is_following status"""
        # Create profile owner
        owner_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("OWN")}
        )
        assert owner_res.status_code == 200, f"Owner registration failed: {owner_res.text}"
        owner = owner_res.json()
        
        # Create viewer
        viewer_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("VIW")}
        )
        assert viewer_res.status_code == 200, f"Viewer registration failed: {viewer_res.text}"
        viewer = viewer_res.json()
        
        # Initially not following
        response = api_client.get(
            f"{BASE_URL}/api/player/{owner['id']}/profile?viewer_id={viewer['id']}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] is False
        print(f"[PASS] Viewer is not following (as expected)")

    def test_get_player_profile_not_found(self, api_client):
        """GET /api/player/{user_id}/profile - 404 for non-existent user"""
        response = api_client.get(f"{BASE_URL}/api/player/nonexistent-user-id-xyz/profile")
        assert response.status_code == 404
        print("[PASS] 404 returned for non-existent user")


# ===== Player Follow Tests =====
class TestPlayerFollow:
    """Player follow/unfollow endpoint tests"""

    def test_follow_player_success(self, api_client):
        """POST /api/player/{user_id}/follow - follow a player"""
        # Create two users
        user1_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("FLW")}
        )
        assert user1_res.status_code == 200, f"User1 registration failed: {user1_res.text}"
        user1 = user1_res.json()
        
        user2_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("FLD")}
        )
        assert user2_res.status_code == 200, f"User2 registration failed: {user2_res.text}"
        user2 = user2_res.json()
        
        # Follow user2
        response = api_client.post(
            f"{BASE_URL}/api/player/{user2['id']}/follow",
            json={"follower_id": user1["id"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["following"] is True
        
        # Verify via profile
        profile_res = api_client.get(
            f"{BASE_URL}/api/player/{user2['id']}/profile?viewer_id={user1['id']}"
        )
        profile_data = profile_res.json()
        assert profile_data["is_following"] is True
        assert profile_data["followers_count"] >= 1
        print(f"[PASS] Follow action successful, followers_count={profile_data['followers_count']}")

    def test_unfollow_player(self, api_client):
        """POST /api/player/{user_id}/follow twice - toggle unfollow"""
        # Create two users
        user1_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("TG1")}
        )
        assert user1_res.status_code == 200
        user1 = user1_res.json()
        
        user2_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("TG2")}
        )
        assert user2_res.status_code == 200
        user2 = user2_res.json()
        
        # First follow
        follow_res1 = api_client.post(
            f"{BASE_URL}/api/player/{user2['id']}/follow",
            json={"follower_id": user1["id"]}
        )
        assert follow_res1.json()["following"] is True
        
        # Second call should unfollow
        follow_res2 = api_client.post(
            f"{BASE_URL}/api/player/{user2['id']}/follow",
            json={"follower_id": user1["id"]}
        )
        assert follow_res2.status_code == 200
        assert follow_res2.json()["following"] is False
        
        # Verify via profile
        profile_res = api_client.get(
            f"{BASE_URL}/api/player/{user2['id']}/profile?viewer_id={user1['id']}"
        )
        assert profile_res.json()["is_following"] is False
        print("[PASS] Unfollow toggle works correctly")

    def test_self_follow_fails(self, api_client):
        """POST /api/player/{user_id}/follow - cannot follow self"""
        # Create user
        user_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("SLF")}
        )
        assert user_res.status_code == 200
        user = user_res.json()
        
        # Try to follow self
        response = api_client.post(
            f"{BASE_URL}/api/player/{user['id']}/follow",
            json={"follower_id": user["id"]}
        )
        assert response.status_code == 400
        print(f"[PASS] Self-follow correctly rejected with 400")


# ===== Chat System Tests =====
class TestChatSend:
    """Chat send message endpoint tests"""

    def test_send_message_success(self, api_client):
        """POST /api/chat/send - send a message"""
        # Create two users
        sender_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("SND")}
        )
        assert sender_res.status_code == 200
        sender = sender_res.json()
        
        receiver_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("RCV")}
        )
        assert receiver_res.status_code == 200
        receiver = receiver_res.json()
        
        # Send message
        message_content = "Hello! This is a test message."
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "sender_id": sender["id"],
                "receiver_id": receiver["id"],
                "content": message_content
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["sender_id"] == sender["id"]
        assert data["receiver_id"] == receiver["id"]
        assert data["content"] == message_content
        assert data["read"] is False
        assert "created_at" in data
        print(f"[PASS] Message sent successfully: {data['id']}")

    def test_send_empty_message_fails(self, api_client):
        """POST /api/chat/send - empty message fails"""
        # Create two users
        sender_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("ES1")}
        )
        assert sender_res.status_code == 200
        sender = sender_res.json()
        
        receiver_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("ER1")}
        )
        assert receiver_res.status_code == 200
        receiver = receiver_res.json()
        
        # Send empty message
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "sender_id": sender["id"],
                "receiver_id": receiver["id"],
                "content": "   "  # whitespace only
            }
        )
        assert response.status_code == 400
        print("[PASS] Empty message correctly rejected with 400")

    def test_send_too_long_message_fails(self, api_client):
        """POST /api/chat/send - message >500 chars fails"""
        # Create users
        sender_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("LS1")}
        )
        assert sender_res.status_code == 200
        sender = sender_res.json()
        
        receiver_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("LR1")}
        )
        assert receiver_res.status_code == 200
        receiver = receiver_res.json()
        
        # Send too long message
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "sender_id": sender["id"],
                "receiver_id": receiver["id"],
                "content": "A" * 501  # 501 characters
            }
        )
        assert response.status_code == 400
        print("[PASS] Long message correctly rejected with 400")

    def test_send_self_message_fails(self, api_client):
        """POST /api/chat/send - cannot message self"""
        # Create user
        user_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("SM1")}
        )
        assert user_res.status_code == 200
        user = user_res.json()
        
        # Send to self
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "sender_id": user["id"],
                "receiver_id": user["id"],
                "content": "Hello myself!"
            }
        )
        assert response.status_code == 400
        print("[PASS] Self-message correctly rejected with 400")


class TestChatMessages:
    """Chat messages between users endpoint tests"""

    def test_get_messages_between_users(self, api_client):
        """GET /api/chat/{user_id}/messages?with_user=X - get chat history"""
        # Create two users
        user1_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("MU1")}
        )
        assert user1_res.status_code == 200
        user1 = user1_res.json()
        
        user2_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("MU2")}
        )
        assert user2_res.status_code == 200
        user2 = user2_res.json()
        
        # Send some messages
        api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"sender_id": user1["id"], "receiver_id": user2["id"], "content": "Message 1"}
        )
        api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"sender_id": user2["id"], "receiver_id": user1["id"], "content": "Message 2"}
        )
        api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"sender_id": user1["id"], "receiver_id": user2["id"], "content": "Message 3"}
        )
        
        # Get messages
        response = api_client.get(
            f"{BASE_URL}/api/chat/{user1['id']}/messages?with_user={user2['id']}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3
        
        # Verify message structure
        msg = data[0]
        assert "id" in msg
        assert "sender_id" in msg
        assert "receiver_id" in msg
        assert "content" in msg
        assert "read" in msg
        assert "created_at" in msg
        print(f"[PASS] Retrieved {len(data)} messages between users")

    def test_messages_marked_as_read(self, api_client):
        """GET /api/chat/{user_id}/messages marks received messages as read"""
        # Create users
        sender_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("RS1")}
        )
        assert sender_res.status_code == 200
        sender = sender_res.json()
        
        receiver_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("RR1")}
        )
        assert receiver_res.status_code == 200
        receiver = receiver_res.json()
        
        # Send message
        api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"sender_id": sender["id"], "receiver_id": receiver["id"], "content": "Unread message"}
        )
        
        # Check unread count before
        unread_res = api_client.get(f"{BASE_URL}/api/chat/unread-count/{receiver['id']}")
        unread_before = unread_res.json()["unread_count"]
        assert unread_before >= 1
        
        # Receiver fetches messages (should mark as read)
        api_client.get(
            f"{BASE_URL}/api/chat/{receiver['id']}/messages?with_user={sender['id']}"
        )
        
        # Check unread count after
        unread_res2 = api_client.get(f"{BASE_URL}/api/chat/unread-count/{receiver['id']}")
        unread_after = unread_res2.json()["unread_count"]
        
        # Unread count should decrease
        assert unread_after < unread_before
        print(f"[PASS] Messages marked as read: unread {unread_before} -> {unread_after}")


class TestChatConversations:
    """Chat conversations list endpoint tests"""

    def test_get_conversations_list(self, api_client):
        """GET /api/chat/conversations/{user_id} - get conversation list"""
        # Create main user
        main_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("CM1")}
        )
        assert main_res.status_code == 200
        main_user = main_res.json()
        
        # Create conversation partner 1
        partner1_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("CP1")}
        )
        assert partner1_res.status_code == 200
        partner1 = partner1_res.json()
        
        # Create conversation partner 2
        partner2_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("CP2")}
        )
        assert partner2_res.status_code == 200
        partner2 = partner2_res.json()
        
        # Send messages to create conversations
        api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"sender_id": main_user["id"], "receiver_id": partner1["id"], "content": "Hi Partner1!"}
        )
        api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"sender_id": partner2["id"], "receiver_id": main_user["id"], "content": "Hi Main User!"}
        )
        
        # Get conversations
        response = api_client.get(f"{BASE_URL}/api/chat/conversations/{main_user['id']}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        
        # Verify conversation structure
        convo = data[0]
        assert "partner_id" in convo
        assert "partner_pseudo" in convo
        assert "partner_avatar_seed" in convo
        assert "last_message" in convo
        assert "last_message_time" in convo
        assert "is_sender" in convo
        assert "unread_count" in convo
        print(f"[PASS] Retrieved {len(data)} conversations")

    def test_conversations_show_unread_count(self, api_client):
        """GET /api/chat/conversations/{user_id} - shows unread count per conversation"""
        # Create users
        receiver_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("UR1")}
        )
        assert receiver_res.status_code == 200
        receiver = receiver_res.json()
        
        sender_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("US1")}
        )
        assert sender_res.status_code == 200
        sender = sender_res.json()
        
        # Send multiple unread messages
        for i in range(3):
            api_client.post(
                f"{BASE_URL}/api/chat/send",
                json={"sender_id": sender["id"], "receiver_id": receiver["id"], "content": f"Unread {i}"}
            )
        
        # Get receiver's conversations
        response = api_client.get(f"{BASE_URL}/api/chat/conversations/{receiver['id']}")
        data = response.json()
        
        # Find conversation with sender
        convo = next((c for c in data if c["partner_id"] == sender["id"]), None)
        assert convo is not None
        assert convo["unread_count"] == 3
        print(f"[PASS] Unread count in conversation: {convo['unread_count']}")


class TestChatUnreadCount:
    """Unread message count endpoint tests"""

    def test_get_unread_count(self, api_client):
        """GET /api/chat/unread-count/{user_id} - get total unread count"""
        # Create receiver
        receiver_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("TU1")}
        )
        assert receiver_res.status_code == 200
        receiver = receiver_res.json()
        
        # Create senders and send messages
        total_messages = 0
        for i in range(2):
            sender_res = api_client.post(
                f"{BASE_URL}/api/auth/register-guest",
                json={"pseudo": unique_pseudo(f"TS{i}")}
            )
            assert sender_res.status_code == 200
            sender = sender_res.json()
            
            # Send 2 messages from each sender
            for j in range(2):
                api_client.post(
                    f"{BASE_URL}/api/chat/send",
                    json={"sender_id": sender["id"], "receiver_id": receiver["id"], "content": f"Msg {i}-{j}"}
                )
                total_messages += 1
        
        # Get unread count
        response = api_client.get(f"{BASE_URL}/api/chat/unread-count/{receiver['id']}")
        assert response.status_code == 200
        
        data = response.json()
        assert "unread_count" in data
        assert data["unread_count"] >= total_messages
        print(f"[PASS] Total unread count: {data['unread_count']}")

    def test_unread_count_empty(self, api_client):
        """GET /api/chat/unread-count/{user_id} - 0 for new user"""
        # Create new user with no messages
        user_res = api_client.post(
            f"{BASE_URL}/api/auth/register-guest",
            json={"pseudo": unique_pseudo("NU1")}
        )
        assert user_res.status_code == 200
        user = user_res.json()
        
        # Get unread count
        response = api_client.get(f"{BASE_URL}/api/chat/unread-count/{user['id']}")
        assert response.status_code == 200
        assert response.json()["unread_count"] == 0
        print("[PASS] New user has 0 unread messages")

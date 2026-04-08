import logging
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, Notification, NotificationSettings
from constants import NOTIFICATION_TYPE_MAP

logger = logging.getLogger(__name__)


async def _send_expo_push(token: str, title: str, body: str, data: dict = None):
    """Send a push notification via Expo Push Service. Retries once on failure."""
    if not token or not token.startswith("ExponentPushToken["):
        return
    payload = {
        "to": token, "title": title, "body": body,
        "data": data or {}, "sound": "default", "priority": "high",
    }
    headers = {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }
    for attempt in range(2):  # #33 — retry once on failure
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post("https://exp.host/--/api/v2/push/send",
                                         json=payload, headers=headers)
            if resp.status_code < 500:
                return  # success or client error (no retry)
            logger.warning(f"[push] Expo returned {resp.status_code} (attempt {attempt+1})")
        except Exception as e:
            logger.warning(f"[push] Failed to send Expo push (attempt {attempt+1}): {e}")
    logger.error(f"[push] All attempts failed for token {token[:30]}...")


async def create_notification(
    db: AsyncSession,
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    actor_id: str = None,
    data: dict = None,
):
    """Create a notification for a user, respecting their settings."""
    settings_res = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == user_id)
    )
    settings = settings_res.scalar_one_or_none()

    if settings:
        type_to_field = {
            "challenge": "challenges",
            "match_result": "match_results",
            "follow": "follows",
            "message": "messages",
            "like": "likes",
            "comment": "comments",
            "system": "system",
        }
        field = type_to_field.get(notif_type)
        if field and not getattr(settings, field, True):
            return None

    actor_pseudo = None
    actor_avatar_seed = None
    actor_avatar_url = None
    if actor_id:
        actor_res = await db.execute(select(User).where(User.id == actor_id))
        actor = actor_res.scalar_one_or_none()
        if actor:
            actor_pseudo = actor.pseudo
            actor_avatar_seed = actor.avatar_seed
            actor_avatar_url = getattr(actor, 'avatar_url', None)

    icon = NOTIFICATION_TYPE_MAP.get(notif_type, {}).get("icon", "🔔")

    notif = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        body=body,
        icon=icon,
        data=data,
        actor_id=actor_id,
        actor_pseudo=actor_pseudo,
        actor_avatar_seed=actor_avatar_seed,
        actor_avatar_url=actor_avatar_url,
    )
    db.add(notif)

    # Push via WebSocket if online, or Expo push if offline
    from services.ws_manager import manager
    if manager.is_online(user_id):
        await db.flush()  # Get the notif ID
        await manager.send_notification(user_id, {
            "id": notif.id,
            "type": notif_type,
            "title": title,
            "body": body,
            "icon": icon,
            "data": data,
            "actor_id": actor_id,
            "actor_pseudo": actor_pseudo,
            "actor_avatar_seed": actor_avatar_seed,
            "actor_avatar_url": actor_avatar_url,
            "read": False,
            "created_at": notif.created_at.isoformat() if notif.created_at else None,
        })
    else:
        # User is offline — send Expo push notification
        user_res = await db.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()
        if user and getattr(user, 'push_token', None):
            await _send_expo_push(user.push_token, title, body, data)

    return notif

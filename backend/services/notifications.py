from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, Notification, NotificationSettings
from constants import NOTIFICATION_TYPE_MAP


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

    # Push via WebSocket if user is online
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

    return notif

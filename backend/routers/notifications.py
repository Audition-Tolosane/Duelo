from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Notification, NotificationSettings
from schemas import NotifReadRequest, NotifSettingsUpdate
from auth_middleware import get_current_user_id

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/{user_id}")
async def get_notifications(user_id: str, limit: int = 50, offset: int = 0, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    limit = min(max(1, limit), 200)
    result = await db.execute(
        select(Notification).where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    )
    notifications = result.scalars().all()

    return [{
        "id": n.id, "type": n.type, "title": n.title, "body": n.body,
        "icon": n.icon, "data": n.data, "actor_id": n.actor_id,
        "actor_pseudo": n.actor_pseudo, "actor_avatar_seed": n.actor_avatar_seed,
        "actor_avatar_url": getattr(n, 'actor_avatar_url', None),
        "read": n.read, "created_at": n.created_at.isoformat(),
    } for n in notifications]


@router.get("/{user_id}/unread-count")
async def get_notification_unread_count(user_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.read == False,
        )
    )
    return {"unread_count": result.scalar() or 0}


@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: str, data: NotifReadRequest, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if data.user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == data.user_id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification non trouvée")

    notif.read = True
    await db.commit()
    return {"success": True}


@router.post("/read-all")
async def mark_all_notifications_read(data: NotifReadRequest, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if data.user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    await db.execute(
        text("UPDATE notifications SET read = true WHERE user_id = :user_id AND read = false"),
        {"user_id": data.user_id}
    )
    await db.commit()
    return {"success": True}


@router.get("/{user_id}/settings")
async def get_notification_settings(user_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        return {
            "challenges": True, "match_results": True, "follows": True,
            "messages": True, "likes": True, "comments": True, "system": True,
        }

    return {
        "challenges": settings.challenges, "match_results": settings.match_results,
        "follows": settings.follows, "messages": settings.messages,
        "likes": settings.likes, "comments": settings.comments, "system": settings.system,
    }


@router.post("/{user_id}/settings")
async def update_notification_settings(user_id: str, data: NotifSettingsUpdate, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    # Enforce that the URL param matches the authenticated user — ignore any user_id in the body
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = NotificationSettings(user_id=user_id)
        db.add(settings)

    if data.challenges is not None: settings.challenges = data.challenges
    if data.match_results is not None: settings.match_results = data.match_results
    if data.follows is not None: settings.follows = data.follows
    if data.messages is not None: settings.messages = data.messages
    if data.likes is not None: settings.likes = data.likes
    if data.comments is not None: settings.comments = data.comments
    if data.system is not None: settings.system = data.system

    await db.commit()
    return {
        "challenges": settings.challenges, "match_results": settings.match_results,
        "follows": settings.follows, "messages": settings.messages,
        "likes": settings.likes, "comments": settings.comments, "system": settings.system,
    }

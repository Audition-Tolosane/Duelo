from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User, ChatMessage
from schemas import ChatSend
from services.notifications import create_notification

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/send")
async def send_message(data: ChatSend, db: AsyncSession = Depends(get_db)):
    if data.message_type == "text":
        if not data.content.strip():
            raise HTTPException(status_code=400, detail="Le message ne peut pas être vide")
        if len(data.content) > 500:
            raise HTTPException(status_code=400, detail="Message trop long (max 500 caractères)")
    if data.sender_id == data.receiver_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous envoyer un message")
    if data.message_type not in ("text", "image", "game_card"):
        raise HTTPException(status_code=400, detail="Type de message invalide")

    msg = ChatMessage(
        sender_id=data.sender_id, receiver_id=data.receiver_id,
        content=data.content.strip() if data.content else "",
        message_type=data.message_type, extra_data=data.extra_data,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    s_res = await db.execute(select(User).where(User.id == data.sender_id))
    sender = s_res.scalar_one_or_none()

    sender_name = sender.pseudo if sender else "Quelqu'un"
    if data.message_type == "text":
        notif_body = f"{sender_name}: {data.content[:80]}{'...' if len(data.content) > 80 else ''}"
    elif data.message_type == "image":
        notif_body = f"{sender_name} t'a envoyé une image"
    elif data.message_type == "game_card":
        notif_body = f"{sender_name} t'a envoyé un résultat de match"
    else:
        notif_body = f"{sender_name} t'a envoyé un message"

    await create_notification(
        db, data.receiver_id, "message", "Nouveau message", notif_body,
        actor_id=data.sender_id,
        data={"screen": "chat", "params": {"userId": data.sender_id, "pseudo": sender_name}},
    )
    await db.commit()

    return {
        "id": msg.id, "sender_id": msg.sender_id, "receiver_id": msg.receiver_id,
        "sender_pseudo": sender.pseudo if sender else "Inconnu",
        "content": msg.content, "message_type": msg.message_type,
        "extra_data": msg.extra_data, "read": msg.read,
        "created_at": msg.created_at.isoformat(),
    }


@router.get("/conversations/{user_id}")
async def get_conversations(user_id: str, db: AsyncSession = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    await db.execute(
        text("DELETE FROM chat_messages WHERE created_at < :cutoff"), {"cutoff": cutoff}
    )
    await db.commit()

    sent_result = await db.execute(
        select(ChatMessage.receiver_id).where(ChatMessage.sender_id == user_id).distinct()
    )
    received_result = await db.execute(
        select(ChatMessage.sender_id).where(ChatMessage.receiver_id == user_id).distinct()
    )

    partner_ids = set()
    for row in sent_result:
        partner_ids.add(row[0])
    for row in received_result:
        partner_ids.add(row[0])

    conversations = []
    for pid in partner_ids:
        last_msg_res = await db.execute(
            select(ChatMessage).where(
                or_(
                    and_(ChatMessage.sender_id == user_id, ChatMessage.receiver_id == pid),
                    and_(ChatMessage.sender_id == pid, ChatMessage.receiver_id == user_id),
                )
            ).order_by(ChatMessage.created_at.desc()).limit(1)
        )
        last_msg = last_msg_res.scalar_one_or_none()
        if not last_msg:
            continue

        unread_res = await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.sender_id == pid, ChatMessage.receiver_id == user_id,
                ChatMessage.read == False,
            )
        )
        unread = unread_res.scalar() or 0

        p_res = await db.execute(select(User).where(User.id == pid))
        partner = p_res.scalar_one_or_none()
        if not partner:
            continue

        last_msg_preview = last_msg.content[:100]
        if last_msg.message_type == "image":
            last_msg_preview = "📷 Image"
        elif last_msg.message_type == "game_card":
            last_msg_preview = "🎮 Résultat de match"

        conversations.append({
            "partner_id": pid, "partner_pseudo": partner.pseudo,
            "partner_avatar_seed": partner.avatar_seed,
            "last_message": last_msg_preview,
            "last_message_type": last_msg.message_type or "text",
            "last_message_time": last_msg.created_at.isoformat(),
            "is_sender": last_msg.sender_id == user_id, "unread_count": unread,
        })

    conversations.sort(key=lambda x: x["last_message_time"], reverse=True)
    return conversations


@router.get("/{user_id}/messages")
async def get_chat_messages(user_id: str, with_user: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage).where(
            or_(
                and_(ChatMessage.sender_id == user_id, ChatMessage.receiver_id == with_user),
                and_(ChatMessage.sender_id == with_user, ChatMessage.receiver_id == user_id),
            )
        ).order_by(ChatMessage.created_at.asc()).limit(limit)
    )
    messages = result.scalars().all()

    for m in messages:
        if m.receiver_id == user_id and not m.read:
            m.read = True
    await db.commit()

    return [{
        "id": m.id, "sender_id": m.sender_id, "receiver_id": m.receiver_id,
        "content": m.content, "message_type": m.message_type or "text",
        "extra_data": m.extra_data, "read": m.read,
        "created_at": m.created_at.isoformat(),
    } for m in messages]


@router.get("/unread-count/{user_id}")
async def get_unread_count(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.receiver_id == user_id, ChatMessage.read == False,
        )
    )
    return {"unread_count": result.scalar() or 0}

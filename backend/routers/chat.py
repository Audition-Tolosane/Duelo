import json
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User, ChatMessage
from schemas import ChatSend
from services.notifications import push_message
from services.ws_manager import manager
from auth_middleware import get_current_user_id
from rate_limit import rate_limit
from routers.moderation import blocked_user_ids, is_blocked_between
from services.chat_status import mark_delivered, mark_read

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/send")
async def send_message(data: ChatSend, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db), _rl=Depends(rate_limit(limit=30, window=60))):
    if data.sender_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if data.message_type == "text":
        if not data.content.strip():
            raise HTTPException(status_code=400, detail="Le message ne peut pas être vide")
        if len(data.content) > 500:
            raise HTTPException(status_code=400, detail="Message trop long (max 500 caractères)")
    if data.sender_id == data.receiver_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous envoyer un message")
    if data.message_type not in ("text", "image", "game_card"):
        raise HTTPException(status_code=400, detail="Type de message invalide")
    if data.content and len(data.content) > 500:
        raise HTTPException(status_code=400, detail="Message trop long (max 500 caractères)")
    if data.extra_data is not None and len(json.dumps(data.extra_data)) > 200_000:
        raise HTTPException(status_code=400, detail="Pièce jointe trop lourde")
    if await is_blocked_between(db, data.sender_id, data.receiver_id):
        raise HTTPException(status_code=403, detail="Impossible d'envoyer un message à ce joueur")

    msg = ChatMessage(
        sender_id=data.sender_id, receiver_id=data.receiver_id,
        content=data.content.strip() if data.content else "",
        message_type=data.message_type, extra_data=data.extra_data,
        # Destinataire connecté en temps réel : le message arrive tout de suite sur son app
        delivered=manager.is_online(data.receiver_id),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    s_res = await db.execute(select(User).where(User.id == data.sender_id))
    sender = s_res.scalar_one_or_none()

    sender_name = sender.pseudo if sender else "Quelqu'un"
    payload = {
        "id": msg.id, "sender_id": msg.sender_id, "receiver_id": msg.receiver_id,
        "sender_pseudo": sender_name,
        "sender_avatar_seed": sender.avatar_seed if sender else None,
        "sender_avatar_url": getattr(sender, "avatar_url", None) if sender else None,
        "content": msg.content, "message_type": msg.message_type,
        "extra_data": msg.extra_data, "read": msg.read, "delivered": bool(msg.delivered),
        "created_at": msg.created_at.isoformat(),
    }
    # Même chemin que l'envoi par WebSocket : temps réel si connecté (icône Messages + bandeau),
    # push sinon. Pas de notification : un message ne va pas dans la cloche.
    await manager.send_chat_message(data.sender_id, data.receiver_id, payload)
    await push_message(db, data.receiver_id, data.sender_id, sender_name)

    return {
        "id": msg.id, "sender_id": msg.sender_id, "receiver_id": msg.receiver_id,
        "sender_pseudo": sender.pseudo if sender else "Inconnu",
        "content": msg.content, "message_type": msg.message_type,
        "extra_data": msg.extra_data, "read": msg.read, "delivered": bool(msg.delivered),
        "created_at": msg.created_at.isoformat(),
    }


@router.get("/conversations/{user_id}")
async def get_conversations(user_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    # Only purge old messages ~10% of the time to avoid overhead on every request
    if random.random() < 0.1:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        await db.execute(delete(ChatMessage).where(ChatMessage.created_at < cutoff))
        await db.commit()

    # L'app a récupéré ses conversations : les messages en attente sont « reçus »
    await mark_delivered(db, user_id)

    # Collect distinct partner IDs in one query using UNION
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

    partner_ids -= await blocked_user_ids(db, user_id)
    if not partner_ids:
        return []

    # Batch-load all partners in one query
    partners_result = await db.execute(select(User).where(User.id.in_(partner_ids)))
    partners_by_id = {u.id: u for u in partners_result.scalars().all()}

    # Batch-load last message per conversation using a subquery (one query for all)
    # For each pair, find the most recent message
    last_msgs_result = await db.execute(
        select(ChatMessage).where(
            or_(
                and_(ChatMessage.sender_id == user_id, ChatMessage.receiver_id.in_(partner_ids)),
                and_(ChatMessage.sender_id.in_(partner_ids), ChatMessage.receiver_id == user_id),
            )
        ).order_by(ChatMessage.created_at.desc())
    )
    all_msgs = last_msgs_result.scalars().all()

    # Group messages by partner and keep only the last one per partner
    last_msg_by_partner: dict = {}
    for msg in all_msgs:
        pid = msg.receiver_id if msg.sender_id == user_id else msg.sender_id
        if pid not in last_msg_by_partner:
            last_msg_by_partner[pid] = msg

    # Batch-load unread counts in one query per direction
    unread_result = await db.execute(
        select(ChatMessage.sender_id, func.count(ChatMessage.id)).where(
            ChatMessage.receiver_id == user_id,
            ChatMessage.sender_id.in_(partner_ids),
            ChatMessage.read == False,
        ).group_by(ChatMessage.sender_id)
    )
    unread_by_sender = {row[0]: row[1] for row in unread_result}

    conversations = []
    for pid, partner in partners_by_id.items():
        last_msg = last_msg_by_partner.get(pid)
        if not last_msg:
            continue

        last_msg_preview = last_msg.content[:100]
        if last_msg.message_type == "image":
            last_msg_preview = "📷 Image"
        elif last_msg.message_type == "game_card":
            last_msg_preview = "🎮 Résultat de match"

        conversations.append({
            "partner_id": pid, "partner_pseudo": partner.pseudo,
            "partner_avatar_seed": partner.avatar_seed,
            "partner_avatar_url": getattr(partner, 'avatar_url', None),
            "last_message": last_msg_preview,
            "last_message_type": last_msg.message_type or "text",
            "last_message_time": last_msg.created_at.isoformat(),
            "is_sender": last_msg.sender_id == user_id,
            "unread_count": unread_by_sender.get(pid, 0),
        })

    conversations.sort(key=lambda x: x["last_message_time"], reverse=True)
    return conversations


@router.get("/{user_id}/messages")
async def get_chat_messages(user_id: str, with_user: str, limit: int = 50, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    limit = min(max(1, limit), 200)
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if await is_blocked_between(db, user_id, with_user):
        return []
    # Les `limit` messages les PLUS RÉCENTS, remis dans l'ordre chronologique (avant : les plus
    # anciens — au-delà de 50 messages, les nouveaux n'apparaissaient plus).
    result = await db.execute(
        select(ChatMessage).where(
            or_(
                and_(ChatMessage.sender_id == user_id, ChatMessage.receiver_id == with_user),
                and_(ChatMessage.sender_id == with_user, ChatMessage.receiver_id == user_id),
            )
        ).order_by(ChatMessage.created_at.desc()).limit(limit)
    )
    messages = list(reversed(result.scalars().all()))

    # Ouvrir la conversation = tout lire, y compris hors de la page chargée.
    await mark_read(db, user_id, with_user)
    await mark_delivered(db, user_id)
    for m in messages:
        if m.receiver_id == user_id:
            m.read = True
            m.delivered = True

    return [{
        "id": m.id, "sender_id": m.sender_id, "receiver_id": m.receiver_id,
        "content": m.content, "message_type": m.message_type or "text",
        "extra_data": m.extra_data, "read": m.read, "delivered": bool(m.delivered or m.read),
        "created_at": m.created_at.isoformat(),
    } for m in messages]


@router.post("/{user_id}/read")
async def mark_conversation_read(user_id: str, with_user: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Message reçu pendant que la conversation est ouverte : il est lu, côté serveur aussi
    (sinon le point rouge de l'icône Messages revient au prochain recalcul)."""
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    await mark_read(db, user_id, with_user)
    return {"success": True}


@router.get("/unread-count/{user_id}")
async def get_unread_count(user_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    # Appelé dès que l'app s'ouvre : les messages en attente sont arrivés sur le téléphone
    await mark_delivered(db, user_id)
    result = await db.execute(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.receiver_id == user_id, ChatMessage.read == False,
        )
    )
    return {"unread_count": result.scalar() or 0}

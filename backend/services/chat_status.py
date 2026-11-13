"""Accusés de réception du chat, comme WhatsApp : ✓ envoyé, ✓✓ gris reçu, ✓✓ jaune lu.
« Reçu » = le message est arrivé sur l'app du destinataire (connexion temps réel ouverte, ou
l'app a récupéré ses messages / son compteur de non-lus). L'expéditeur est prévenu en direct."""
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from models import ChatMessage
from services.ws_manager import manager


async def _notify(sender_ids, receiver_id: str, status: str):
    for sid in set(sender_ids):
        await manager.send_to_user(sid, {"type": "chat_status",
                                         "data": {"with_user": receiver_id, "status": status}})


async def mark_delivered(db: AsyncSession, receiver_id: str):
    """Tout ce qui attendait ce joueur est arrivé sur son app."""
    res = await db.execute(
        update(ChatMessage)
        .where(ChatMessage.receiver_id == receiver_id, ChatMessage.delivered.isnot(True))
        .values(delivered=True)
        .returning(ChatMessage.sender_id)
    )
    senders = [r[0] for r in res]
    await db.commit()
    await _notify(senders, receiver_id, "delivered")


async def mark_read(db: AsyncSession, receiver_id: str, sender_id: str):
    """Conversation ouverte : les messages de sender_id sont lus (donc reçus aussi)."""
    res = await db.execute(
        update(ChatMessage)
        .where(ChatMessage.sender_id == sender_id, ChatMessage.receiver_id == receiver_id,
               ChatMessage.read == False)  # noqa: E712
        .values(read=True, delivered=True)
        .returning(ChatMessage.sender_id)
    )
    senders = [r[0] for r in res]
    await db.commit()
    await _notify(senders, receiver_id, "read")

import logging
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, Notification, NotificationSettings
from constants import NOTIFICATION_TYPE_MAP

logger = logging.getLogger(__name__)


# Textes des push, dans la langue du joueur. Les notifications sont stockées sous forme de clé
# (« notif.new_message », « notif.message_body:Pseudo ») que l'app traduit à l'affichage ; un
# push, lui, est affiché tel quel par iOS/Android : il faut le traduire avant l'envoi, sinon
# le bandeau montre « notif.new_message ». Copie des entrées de frontend/utils/i18n.ts.
PUSH_TEXTES = {
    "notif.new_message": {"fr":"Nouveau message","en":"New message","es":"Nuevo mensaje","de":"Neue Nachricht","pt":"Nova mensagem","it":"Nuovo messaggio","ar":"رسالة جديدة","ja":"新しいメッセージ","ko":"새 메시지","zh":"新消息","pl":"Nowa wiadomość"},
    "notif.message_body": {"fr":"{name} t'a envoyé un message","en":"{name} sent you a message","es":"{name} te envió un mensaje","de":"{name} hat dir eine Nachricht gesendet","pt":"{name} te enviou uma mensagem","it":"{name} ti ha inviato un messaggio","ar":"أرسل لك {name} رسالة","ja":"{name}がメッセージを送信しました","ko":"{name}님이 메시지를 보냈습니다","zh":"{name}给你发了消息","pl":"{name} wysyła ci wiadomość"},
    "notif.match_result": {"fr":"Résultat du duel","en":"Duel result","es":"Resultado del partido","de":"Spielergebnis","pt":"Resultado da partida","it":"Risultato della partita","ar":"نتيجة المباراة","ja":"試合結果","ko":"경기 결과","zh":"比赛结果","pl":"Wynik pojedynku"},
    "notif.new_like": {"fr":"Nouveau like","en":"New like","es":"Nuevo me gusta","de":"Neues Like","pt":"Novo curtir","it":"Nuovo like","ar":"إعجاب جديد","ja":"新しいいいね","ko":"새 좋아요","zh":"新点赞","pl":"Nowe polubienie"},
    "notif.like_body": {"fr":"{name} a aimé ta publication","en":"{name} liked your post","es":"{name} le gustó tu publicación","de":"{name} hat deinen Beitrag geliked","pt":"{name} curtiu sua publicação","it":"{name} ha messo like al tuo post","ar":"أعجب {name} بمنشورك","ja":"{name}があなたの投稿にいいねしました","ko":"{name}님이 게시물을 좋아합니다","zh":"{name}赞了你的帖子","pl":"{name} lubi twój post"},
    "notif.new_comment": {"fr":"Nouveau commentaire","en":"New comment","es":"Nuevo comentario","de":"Neuer Kommentar","pt":"Novo comentário","it":"Nuovo commento","ar":"تعليق جديد","ja":"新しいコメント","ko":"새 댓글","zh":"新评论","pl":"Nowy komentarz"},
    "notif.comment_body": {"fr":"{name} a commenté ta publication","en":"{name} commented on your post","es":"{name} comentó en tu publicación","de":"{name} hat deinen Beitrag kommentiert","pt":"{name} comentou sua publicação","it":"{name} ha commentato il tuo post","ar":"علّق {name} على منشورك","ja":"{name}があなたの投稿にコメントしました","ko":"{name}님이 게시물에 댓글을 달았습니다","zh":"{name}评论了你的帖子","pl":"{name} komentuje twój post"},
    "notif.new_follower": {"fr":"Nouvel abonné","en":"New follower","es":"Nuevo seguidor","de":"Neuer Follower","pt":"Novo seguidor","it":"Nuovo follower","ar":"متابع جديد","ja":"新しいフォロワー","ko":"새 팔로워","zh":"新关注者","pl":"Nowy obserwujący"},
    "notif.follow_body": {"fr":"{name} a commencé à te suivre","en":"{name} started following you","es":"{name} comenzó a seguirte","de":"{name} folgt dir jetzt","pt":"{name} começou a te seguir","it":"{name} ha iniziato a seguirti","ar":"بدأ {name} بمتابعتك","ja":"{name}があなたをフォローしました","ko":"{name}님이 팔로우하기 시작했습니다","zh":"{name}开始关注你","pl":"{name} zaczyna cię obserwować"},
}


def texte_push(texte: str, lang) -> str:
    """« notif.cle » ou « notif.cle:Pseudo » -> phrase dans `lang` (français en repli).
    Tout texte qui n'est pas une clé connue (anciens messages en clair) passe tel quel."""
    if not texte or not texte.startswith("notif."):
        return texte or ""
    cle, _, acteur = texte.partition(":")
    traductions = PUSH_TEXTES.get(cle)
    if not traductions:
        return texte
    langue = (lang or "fr").strip().lower()[:2]
    return (traductions.get(langue) or traductions["fr"]).replace("{name}", acteur)


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
            lang = getattr(user, 'language', None)
            await _send_expo_push(user.push_token, texte_push(title, lang), texte_push(body, lang), data)

    return notif


async def push_message(db: AsyncSession, receiver_id: str, sender_id: str, sender_pseudo: str):
    """Nouveau message privé : push si le destinataire n'a pas l'app ouverte, et c'est tout.

    Un message n'est PAS une notification : il n'entre ni dans la liste ni dans le compteur
    de la cloche — seule l'icône Messages le signale. App ouverte, le message arrive déjà par
    WebSocket (`chat_message`) et l'app affiche son propre bandeau. Respecte le réglage
    « Messages » des notifications."""
    from services.ws_manager import manager
    if manager.is_online(receiver_id):
        return
    settings_res = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == receiver_id)
    )
    settings = settings_res.scalar_one_or_none()
    if settings and not getattr(settings, "messages", True):
        return
    user_res = await db.execute(select(User).where(User.id == receiver_id))
    user = user_res.scalar_one_or_none()
    if not user or not getattr(user, "push_token", None):
        return
    lang = getattr(user, "language", None)
    await _send_expo_push(
        user.push_token,
        texte_push("notif.new_message", lang),
        texte_push(f"notif.message_body:{sender_pseudo}", lang),
        {"screen": "chat", "params": {"userId": sender_id, "pseudo": sender_pseudo}},
    )

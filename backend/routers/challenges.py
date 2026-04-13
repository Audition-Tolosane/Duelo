import uuid
import secrets
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from database import get_db
from models import Challenge, User, Theme
from constants import TOTAL_QUESTIONS
from services.notifications import create_notification
from services.ws_manager import manager
from auth_middleware import get_current_user_id
from rate_limit import rate_limit

router = APIRouter(prefix="/challenges", tags=["challenges"])

async def _get_theme_name(db: AsyncSession, theme_id: str) -> str:
    if not theme_id:
        return ""
    res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = res.scalar_one_or_none()
    return theme.name if theme else theme_id

@router.post("/send")
async def send_challenge(request: Request, data: dict, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db), _rate=Depends(rate_limit(limit=5, window=60))):
    challenger_id = current_user  # always use authenticated user, ignore body field
    challenged_id = data.get("challenged_id")
    theme_id = data.get("theme_id", "")
    theme_name = data.get("theme_name", "")

    if not challenged_id:
        raise HTTPException(status_code=400, detail="Paramètres manquants")
    if challenger_id == challenged_id:
        raise HTTPException(status_code=400, detail="Impossible de se défier soi-même")

    # #18 — Validate theme exists when provided
    if theme_id:
        theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
        if not theme_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Thème introuvable")

    # Check no pending challenge already exists between these two players
    existing = await db.execute(
        select(Challenge).where(
            and_(
                Challenge.challenger_id == challenger_id,
                Challenge.challenged_id == challenged_id,
                Challenge.status == "pending",
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Un défi est déjà en attente")

    # Get challenger info
    challenger_res = await db.execute(select(User).where(User.id == challenger_id))
    challenger = challenger_res.scalar_one_or_none()
    if not challenger:
        raise HTTPException(status_code=404, detail="Joueur introuvable")

    if not theme_name and theme_id:
        theme_name = await _get_theme_name(db, theme_id)

    challenge = Challenge(
        id=str(uuid.uuid4()),
        challenger_id=challenger_id,
        challenged_id=challenged_id,
        theme_id=theme_id or None,
        theme_name=theme_name,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(challenge)
    await db.commit()

    # Send push notification to challenged player
    notif_body = f"{challenger.pseudo} vous défie{' sur ' + theme_name if theme_name else ''} !"
    await create_notification(
        db=db,
        user_id=challenged_id,
        notif_type="challenge",
        title="Nouveau défi !",
        body=notif_body,
        actor_id=challenger_id,
        data={"challenge_id": challenge.id, "theme_id": theme_id, "screen": "home"},
    )

    # If challenged player is online → send real-time WS notification
    await manager.send_to_user(challenged_id, {
        "type": "challenge_incoming",
        "data": {
            "challenge_id": challenge.id,
            "challenger_pseudo": challenger.pseudo,
            "challenger_seed": challenger.avatar_seed or "",
            "theme_id": theme_id or "",
            "theme_name": theme_name or "",
        },
    })

    # Update daily mission: "envoyer un défi"
    from services.missions import update_progress as _update_missions
    await _update_missions(challenger_id, {"type": "challenge_sent"}, db)

    return {"challenge_id": challenge.id, "status": "pending"}


@router.post("/{challenge_id}/accept")
async def accept_challenge(challenge_id: str, data: dict, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user_id = current_user
    res = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = res.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Défi introuvable")
    if challenge.challenged_id != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if challenge.status != "pending":
        raise HTTPException(status_code=400, detail="Défi non disponible")
    if challenge.expires_at < datetime.utcnow():
        challenge.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Défi expiré")

    challenge.status = "accepted"
    await db.commit()

    # Notify challenger
    challenged_res = await db.execute(select(User).where(User.id == user_id))
    challenged = challenged_res.scalar_one_or_none()
    if challenged:
        notif_body = f"{challenged.pseudo} a accepté votre défi{' sur ' + challenge.theme_name if challenge.theme_name else ''} !"
        await create_notification(
            db=db,
            user_id=challenge.challenger_id,
            notif_type="challenge",
            title="Défi accepté !",
            body=notif_body,
            actor_id=user_id,
            data={"challenge_id": challenge.id, "theme_id": challenge.theme_id, "screen": "matchmaking"},
        )

    # Create a private challenge room and notify challenger via WebSocket
    room_id = secrets.token_hex(8)
    await manager.create_challenge_room(
        room_id=room_id,
        acceptor_id=user_id,
        challenger_id=challenge.challenger_id,
        theme_id=challenge.theme_id or "",
        opponent_pseudo=challenged.pseudo if challenged else "Joueur",
        theme_name=challenge.theme_name or "",
    )

    return {
        "status": "accepted",
        "theme_id": challenge.theme_id,
        "theme_name": challenge.theme_name,
        "room_id": room_id,
    }


@router.post("/{challenge_id}/decline")
async def decline_challenge(challenge_id: str, data: dict, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user_id = current_user
    res = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = res.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Défi introuvable")
    if challenge.challenged_id != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if challenge.status != "pending":
        raise HTTPException(status_code=400, detail="Défi non disponible")

    challenge.status = "declined"
    await db.commit()

    # Notify challenger
    challenged_res = await db.execute(select(User).where(User.id == user_id))
    challenged = challenged_res.scalar_one_or_none()
    if challenged:
        await create_notification(
            db=db,
            user_id=challenge.challenger_id,
            notif_type="challenge",
            title="Défi refusé",
            body=f"{challenged.pseudo} a refusé votre défi.",
            actor_id=user_id,
            data={"screen": "home"},
        )
        # Real-time WS notification to challenger (may be on challenge-waiting screen)
        await manager.send_to_user(challenge.challenger_id, {
            "type": "challenge_declined",
            "data": {"pseudo": challenged.pseudo},
        })

    return {"status": "declined"}


@router.get("/vs-stats")
async def vs_stats(user_id: str, opponent_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    """Head-to-head challenge stats between two players."""
    res = await db.execute(
        select(Challenge).where(
            and_(
                Challenge.status == "completed",
                or_(
                    and_(Challenge.challenger_id == user_id, Challenge.challenged_id == opponent_id),
                    and_(Challenge.challenger_id == opponent_id, Challenge.challenged_id == user_id),
                )
            )
        )
    )
    challenges = res.scalars().all()
    user_wins = 0
    opponent_wins = 0
    for c in challenges:
        if c.p1_score is None or c.p2_score is None:
            continue
        if c.challenger_id == user_id:
            if c.p1_score >= c.p2_score:
                user_wins += 1
            else:
                opponent_wins += 1
        else:
            if c.p2_score >= c.p1_score:
                user_wins += 1
            else:
                opponent_wins += 1
    return {"total": len(challenges), "user_wins": user_wins, "opponent_wins": opponent_wins}


@router.get("/history")
async def challenge_history(user_id: str, limit: int = 20, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """List completed challenges for a user, most recent first."""
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    limit = min(max(1, limit), 100)
    res = await db.execute(
        select(Challenge).where(
            and_(
                Challenge.status == "completed",
                or_(Challenge.challenger_id == user_id, Challenge.challenged_id == user_id)
            )
        ).order_by(Challenge.created_at.desc()).limit(limit)
    )
    challenges = res.scalars().all()

    # Batch-load all opponent users to avoid N+1
    opponent_ids = {
        (c.challenged_id if c.challenger_id == user_id else c.challenger_id)
        for c in challenges
    }
    opp_map: dict[str, User] = {}
    if opponent_ids:
        opp_res = await db.execute(select(User).where(User.id.in_(opponent_ids)))
        for u in opp_res.scalars().all():
            opp_map[u.id] = u

    items = []
    for c in challenges:
        is_p1 = c.challenger_id == user_id
        opponent_id_val = c.challenged_id if is_p1 else c.challenger_id
        my_score = c.p1_score if is_p1 else c.p2_score
        opp_score = c.p2_score if is_p1 else c.p1_score
        opp = opp_map.get(opponent_id_val)
        played_at = (c.p1_played_at if is_p1 else c.p2_played_at) or c.created_at
        items.append({
            "challenge_id": c.id,
            "opponent_id": opponent_id_val,
            "opponent_pseudo": opp.pseudo if opp else "?",
            "opponent_avatar_seed": opp.avatar_seed if opp else "",
            "theme_id": c.theme_id or "",
            "theme_name": c.theme_name or "",
            "my_score": my_score or 0,
            "opponent_score": opp_score or 0,
            "won": (my_score or 0) >= (opp_score or 0),
            "played_at": played_at.isoformat() if played_at else "",
        })
    return {"challenges": items}


@router.get("/{challenge_id}/p1-answers")
async def get_p1_answers(challenge_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Return challenger (p1) per-question answers so the challenged player can see them during reveal mode."""
    res = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = res.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Défi introuvable")
    if challenge.challenged_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    answers = []
    if challenge.p1_answers:
        try:
            answers = json.loads(challenge.p1_answers)
        except Exception:
            pass
    return {"answers": answers}


@router.post("/{challenge_id}/save-async-score")
async def save_async_score(challenge_id: str, data: dict, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Save a player's score + per-question answers. When both have played, send result notifications."""
    user_id = current_user  # always use authenticated user
    score = max(0, min(140, int(data.get("score", 0))))    # clamp to valid range
    correct = max(0, min(TOTAL_QUESTIONS, int(data.get("correct", 0))))  # clamp to valid range
    answers = data.get("answers", [])

    # #13 — Validate answers structure and cross-check score vs correct count
    MAX_PTS_PER_Q = 20
    MIN_PTS_PER_Q = 10
    if not isinstance(answers, list):
        answers = []
    # Strip to only safe fields, reject fabricated data
    answers = [
        {"answer": int(a.get("answer", -1)), "is_correct": bool(a.get("is_correct")),
         "points": max(0, min(MAX_PTS_PER_Q, int(a.get("points", 0)))),
         "time_ms": max(0, int(a.get("time_ms", 0)))}
        for a in answers if isinstance(a, dict)
    ][:TOTAL_QUESTIONS]  # at most TOTAL_QUESTIONS questions
    # Sanity-check: score must be consistent with correct count
    if correct > 0 and not (correct * MIN_PTS_PER_Q <= score <= correct * MAX_PTS_PER_Q):
        score = min(score, correct * MAX_PTS_PER_Q)  # clamp silently rather than reject

    res = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = res.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Défi introuvable")
    if challenge.status == "completed":
        raise HTTPException(status_code=400, detail="Défi déjà terminé")
    if challenge.status not in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail="Défi non disponible")

    now = datetime.utcnow()
    is_p1 = user_id == challenge.challenger_id
    is_p2 = user_id == challenge.challenged_id

    if not is_p1 and not is_p2:
        raise HTTPException(status_code=403, detail="Non autorisé")

    answers_json = json.dumps(answers) if answers else None
    if is_p1:
        challenge.p1_score = score
        challenge.p1_correct = correct
        challenge.p1_played_at = now
        challenge.p1_answers = answers_json
    else:
        challenge.p2_score = score
        challenge.p2_correct = correct
        challenge.p2_played_at = now
        challenge.p2_answers = answers_json

    # Ensure status is at least "accepted"
    if challenge.status == "pending":
        challenge.status = "accepted"

    await db.commit()

    # Both players have played → determine winner and notify
    if challenge.p1_score is not None and challenge.p2_score is not None:
        challenge.status = "completed"
        await db.commit()

        p1_won = challenge.p1_score >= challenge.p2_score
        p1_score, p2_score = challenge.p1_score, challenge.p2_score

        p1_res = await db.execute(select(User).where(User.id == challenge.challenger_id))
        p1 = p1_res.scalar_one_or_none()
        p2_res = await db.execute(select(User).where(User.id == challenge.challenged_id))
        p2 = p2_res.scalar_one_or_none()

        if p1 and p2:
            theme_label = challenge.theme_name or ""
            suffix = f" sur {theme_label}" if theme_label else ""

            # Notification + WS to challenger (p1)
            if p1_won:
                await create_notification(db, challenge.challenger_id, "challenge_result",
                    "Victoire ! 🏆",
                    f"Tu as battu {p2.pseudo}{suffix} ({p1_score} – {p2_score})",
                    challenge.challenged_id, {"screen": "home"})
            else:
                await create_notification(db, challenge.challenger_id, "challenge_result",
                    "Défaite",
                    f"{p2.pseudo} t'a battu{suffix} ({p2_score} – {p1_score})",
                    challenge.challenged_id, {"screen": "home"})

            # Notification + WS to challenged (p2)
            if not p1_won:
                await create_notification(db, challenge.challenged_id, "challenge_result",
                    "Victoire ! 🏆",
                    f"Tu as battu {p1.pseudo}{suffix} ({p2_score} – {p1_score})",
                    challenge.challenger_id, {"screen": "home"})
            else:
                await create_notification(db, challenge.challenged_id, "challenge_result",
                    "Défaite",
                    f"{p1.pseudo} t'a battu{suffix} ({p1_score} – {p2_score})",
                    challenge.challenger_id, {"screen": "home"})

            # Real-time WS if online
            await manager.send_to_user(challenge.challenger_id, {
                "type": "challenge_result",
                "data": {
                    "won": p1_won,
                    "your_score": p1_score,
                    "opponent_score": p2_score,
                    "opponent_pseudo": p2.pseudo,
                    "theme_name": theme_label,
                },
            })
            await manager.send_to_user(challenge.challenged_id, {
                "type": "challenge_result",
                "data": {
                    "won": not p1_won,
                    "your_score": p2_score,
                    "opponent_score": p1_score,
                    "opponent_pseudo": p1.pseudo,
                    "theme_name": theme_label,
                },
            })

        # Update daily mission: "terminer un défi"
        from services.missions import update_progress as _update_missions
        await _update_missions(user_id, {"type": "challenge_completed"}, db)

        return {"status": "completed", "p1_score": p1_score, "p2_score": p2_score, "p1_won": p1_won}

    return {"status": "waiting_for_opponent"}

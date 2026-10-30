"""Report & block (App Store guideline 1.2 / Google Play UGC policy).

Players can report any user-generated content (profile, wall post, comment,
chat message, community theme) and block another player. Blocking is mutual in
effect: neither side can message, challenge or see the other's posts/comments.
Reports land in the admin dashboard, to be reviewed within 24h.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, or_, and_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User, UserBlock, ContentReport, WallPost, PostComment, ChatMessage, Theme, Question
from auth_middleware import get_current_user_id
from rate_limit import rate_limit
from routers.admin import verify_admin_key

router = APIRouter(tags=["moderation"])

TARGET_TYPES = ("user", "post", "comment", "message", "theme")
REASONS = ("spam", "harassment", "hate", "sexual", "violence", "other")


# ── Helpers used by other routers ─────────────────────────────────────────────

async def blocked_user_ids(db: AsyncSession, user_id: Optional[str]) -> set[str]:
    """Everyone `user_id` blocked or was blocked by (both directions hide content)."""
    if not user_id:
        return set()
    res = await db.execute(
        select(UserBlock.blocker_id, UserBlock.blocked_id).where(
            or_(UserBlock.blocker_id == user_id, UserBlock.blocked_id == user_id)
        )
    )
    ids: set[str] = set()
    for blocker, blocked in res.all():
        ids.add(blocked if blocker == user_id else blocker)
    return ids


async def is_blocked_between(db: AsyncSession, a: str, b: str) -> bool:
    res = await db.execute(
        select(func.count(UserBlock.id)).where(
            or_(
                and_(UserBlock.blocker_id == a, UserBlock.blocked_id == b),
                and_(UserBlock.blocker_id == b, UserBlock.blocked_id == a),
            )
        )
    )
    return (res.scalar() or 0) > 0


# ── Player endpoints ──────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    target_type: str = Field(max_length=20)
    target_id: str = Field(max_length=64)
    reason: str = Field(max_length=30)
    details: Optional[str] = Field(default=None, max_length=1000)


async def _resolve_target(db: AsyncSession, target_type: str, target_id: str) -> tuple[Optional[str], str]:
    """Return (author_id, snapshot of the content) — 404 if it doesn't exist."""
    if target_type == "user":
        u = (await db.execute(select(User).where(User.id == target_id))).scalar_one_or_none()
        if u:
            return u.id, f"pseudo: {u.pseudo}"
    elif target_type == "post":
        p = (await db.execute(select(WallPost).where(WallPost.id == target_id))).scalar_one_or_none()
        if p:
            return p.user_id, (p.content or "") + (" [+ image]" if p.image_base64 else "")
    elif target_type == "comment":
        c = (await db.execute(select(PostComment).where(PostComment.id == target_id))).scalar_one_or_none()
        if c:
            return c.user_id, c.content or ""
    elif target_type == "message":
        m = (await db.execute(select(ChatMessage).where(ChatMessage.id == target_id))).scalar_one_or_none()
        if m:
            return m.sender_id, (m.content or "") + (f" [{m.message_type}]" if m.message_type != "text" else "")
    elif target_type == "theme":
        t = (await db.execute(select(Theme).where(Theme.id == target_id))).scalar_one_or_none()
        if t:
            return None, f"{t.name} — {t.description or ''}"
    raise HTTPException(status_code=404, detail="Contenu introuvable")


@router.post("/moderation/report")
async def report_content(
    data: ReportCreate,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit(limit=20, window=3600)),
):
    if data.target_type not in TARGET_TYPES:
        raise HTTPException(status_code=400, detail="Type de contenu invalide")
    if data.reason not in REASONS:
        raise HTTPException(status_code=400, detail="Motif invalide")

    author_id, snapshot = await _resolve_target(db, data.target_type, data.target_id)
    if author_id == current_user:
        raise HTTPException(status_code=400, detail="Tu ne peux pas te signaler toi-même")

    db.add(ContentReport(
        reporter_id=current_user,
        target_type=data.target_type,
        target_id=data.target_id,
        target_user_id=author_id,
        reason=data.reason,
        details=(data.details or "").strip() or None,
        snapshot=snapshot[:2000],
    ))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # already reported by this player — idempotent
    return {"reported": True}


@router.post("/moderation/block/{user_id}")
async def block_user(user_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    if user_id == current_user:
        raise HTTPException(status_code=400, detail="Tu ne peux pas te bloquer toi-même")
    target = (await db.execute(select(User.id).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    db.add(UserBlock(blocker_id=current_user, blocked_id=user_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
    return {"blocked": True}


@router.delete("/moderation/block/{user_id}")
async def unblock_user(user_id: str, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(UserBlock).where(UserBlock.blocker_id == current_user, UserBlock.blocked_id == user_id))
    await db.commit()
    return {"blocked": False}


@router.get("/moderation/blocks")
async def list_blocks(current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(User.id, User.pseudo, User.avatar_seed)
        .join(UserBlock, UserBlock.blocked_id == User.id)
        .where(UserBlock.blocker_id == current_user)
        .order_by(UserBlock.created_at.desc())
    )
    return [{"id": i, "pseudo": p, "avatar_seed": s} for i, p, s in res.all()]


# ── Admin queue ───────────────────────────────────────────────────────────────

@router.get("/admin/content-reports")
async def admin_list_reports(status: str = "pending", _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    q = select(ContentReport).order_by(ContentReport.created_at.desc()).limit(200)
    if status != "all":
        q = q.where(ContentReport.status == status)
    reports = (await db.execute(q)).scalars().all()

    ids = {r.reporter_id for r in reports} | {r.target_user_id for r in reports if r.target_user_id}
    pseudos = {}
    if ids:
        rows = await db.execute(select(User.id, User.pseudo).where(User.id.in_(ids)))
        pseudos = dict(rows.all())
    return [{
        "id": r.id,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "target_user_id": r.target_user_id,
        "target_pseudo": pseudos.get(r.target_user_id),
        "reporter_pseudo": pseudos.get(r.reporter_id),
        "reason": r.reason,
        "details": r.details,
        "snapshot": r.snapshot,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in reports]


class ReportAction(BaseModel):
    action: str  # dismiss | remove_content


@router.post("/admin/content-reports/{report_id}")
async def admin_handle_report(report_id: str, data: ReportAction, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    report = (await db.execute(select(ContentReport).where(ContentReport.id == report_id))).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Signalement introuvable")

    if data.action == "dismiss":
        report.status = "dismissed"
    elif data.action == "remove_content":
        t, tid = report.target_type, report.target_id
        if t == "post":
            await db.execute(delete(PostComment).where(PostComment.post_id == tid))
            await db.execute(delete(WallPost).where(WallPost.id == tid))
        elif t == "comment":
            await db.execute(delete(PostComment).where(PostComment.id == tid))
        elif t == "message":
            await db.execute(delete(ChatMessage).where(ChatMessage.id == tid))
        elif t == "theme":
            await db.execute(delete(Question).where(Question.category == tid))
            await db.execute(delete(Theme).where(Theme.id == tid))
        elif t == "user":
            # Offensive pseudo: reset it to a neutral one the player can change.
            user = (await db.execute(select(User).where(User.id == tid))).scalar_one_or_none()
            if user:
                user.pseudo = f"Joueur{tid[:6]}"
        # Every pending report on the same content is settled at once.
        others = await db.execute(select(ContentReport).where(
            ContentReport.target_type == t, ContentReport.target_id == tid, ContentReport.status == "pending"))
        for r in others.scalars().all():
            r.status = "resolved"
        report.status = "resolved"
    else:
        raise HTTPException(status_code=400, detail="Action invalide")

    await db.commit()
    return {"status": report.status}

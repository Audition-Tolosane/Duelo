import logging
from fastapi import FastAPI, APIRouter
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from config import ALLOWED_ORIGINS, ROOT_DIR
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from database import get_db

from routers import auth, game, leaderboard, profile, social, chat, notifications, search, themes, admin, ws
from schemas import QuestionReportRequest
from models import QuestionReport
from sqlalchemy import select

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ── Static ──
@api_router.get("/static/fond_duelo.webp")
async def serve_bg():
    return FileResponse(ROOT_DIR / "static" / "fond_duelo.webp", media_type="image/webp")

# ── Health ──
@api_router.get("/")
async def root():
    return {"message": "Duelo API v1.0", "status": "running"}

@api_router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}

# ── Question Report ──
@api_router.post("/questions/report")
async def report_question(req: QuestionReportRequest, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    valid_reasons = ["wrong_answer", "unclear_question", "typo", "outdated", "other"]
    if req.reason_type not in valid_reasons:
        raise HTTPException(status_code=400, detail=f"reason_type must be one of: {', '.join(valid_reasons)}")
    if not req.user_id or not req.question_id:
        raise HTTPException(status_code=400, detail="user_id and question_id are required")

    existing = await db.execute(
        select(QuestionReport).where(
            QuestionReport.user_id == req.user_id, QuestionReport.question_id == req.question_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Vous avez déjà signalé cette question")

    report = QuestionReport(
        user_id=req.user_id, question_id=req.question_id,
        question_text=req.question_text, category=req.category,
        reason_type=req.reason_type,
        description=req.description[:500] if req.description else None,
        status="pending",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return {"success": True, "report_id": report.id}

# ── Include all routers ──
api_router.include_router(auth.router)
api_router.include_router(game.router)
api_router.include_router(leaderboard.router)
api_router.include_router(profile.router)
api_router.include_router(social.router)
api_router.include_router(chat.router)
api_router.include_router(notifications.router)
api_router.include_router(search.router)
api_router.include_router(themes.router)
api_router.include_router(admin.router)

app.include_router(api_router)

# WebSocket routes (no /api prefix)
app.include_router(ws.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

import logging
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
from config import ALLOWED_ORIGINS, ROOT_DIR
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from database import get_db

from routers import auth, game, leaderboard, profile, social, chat, notifications, search, themes, admin, ws
from schemas import QuestionReportRequest
from models import QuestionReport
from sqlalchemy import select
from auth_middleware import get_current_user_id
from rate_limit import _limiter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.middleware("http")
async def global_rate_limit(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    # Skip rate limit for WebSocket upgrades
    if request.url.path.startswith("/ws"):
        return await call_next(request)
    try:
        _limiter.check(f"global:{client_ip}", 120, 60)  # 120 req/min global
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"detail": "Trop de requêtes"})
    return await call_next(request)

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
async def report_question(req: QuestionReportRequest, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    valid_reasons = ["wrong_answer", "unclear_question", "typo", "outdated", "other"]
    if req.reason_type not in valid_reasons:
        raise HTTPException(status_code=400, detail=f"reason_type must be one of: {', '.join(valid_reasons)}")
    if not req.user_id or not req.question_id:
        raise HTTPException(status_code=400, detail="user_id and question_id are required")
    if req.user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")

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

# Serve avatar static files
avatars_dir = ROOT_DIR / "static" / "avatars"
os.makedirs(avatars_dir, exist_ok=True)
os.makedirs(avatars_dir / "users", exist_ok=True)
app.mount("/static/avatars", StaticFiles(directory=str(avatars_dir)), name="avatars")

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


@app.on_event("startup")
async def _ensure_columns():
    """Add missing columns that fast_import.py expects but create_tables.py may not have created."""
    from database import engine
    async with engine.begin() as conn:
        for stmt in [
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS angle_num INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(36)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_avatar_url TEXT",
            "CREATE TABLE IF NOT EXISTS avatars (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100), image_url TEXT NOT NULL, category VARCHAR(50) DEFAULT 'default', created_at TIMESTAMPTZ DEFAULT NOW())",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lat FLOAT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lng FLOAT",
            """CREATE TABLE IF NOT EXISTS theme_follows (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                theme_id VARCHAR(20) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, theme_id)
            )""",
        ]:
            try:
                await conn.execute(text(stmt))
                logger.info(f"[startup] OK: {stmt}")
            except Exception as e:
                logger.warning(f"[startup] skip: {e}")

        # ── Add updated_at column to main tables ──
        for table_name in ['users', 'matches', 'wall_posts', 'themes']:
            try:
                await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"))
                logger.info(f"[startup] OK: added updated_at to {table_name}")
            except Exception as e:
                logger.warning(f"[startup] skip updated_at for {table_name}: {e}")

        # ── Create indexes on frequently queried columns ──
        index_statements = [
            "CREATE INDEX IF NOT EXISTS ix_matches_created_at ON matches(created_at)",
            "CREATE INDEX IF NOT EXISTS ix_matches_player2_id ON matches(player2_id)",
            "CREATE INDEX IF NOT EXISTS ix_wall_posts_created_at ON wall_posts(created_at)",
            "CREATE INDEX IF NOT EXISTS ix_users_current_streak ON users(current_streak DESC)",
        ]
        for idx_stmt in index_statements:
            try:
                await conn.execute(text(idx_stmt))
                logger.info(f"[startup] OK: {idx_stmt}")
            except Exception as e:
                logger.warning(f"[startup] skip index: {e}")

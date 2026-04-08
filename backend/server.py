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

from routers import auth, game, leaderboard, profile, social, chat, notifications, search, themes, admin, ws, forge, challenges, boosts, missions, daily_question, achievements, streak_shield, xp_multiplier, tournaments
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
    # HSTS — instructs browsers to always use HTTPS (1 year, subdomains)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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
api_router.include_router(forge.router)
api_router.include_router(challenges.router)
api_router.include_router(boosts.router)
api_router.include_router(missions.router)
api_router.include_router(daily_question.router)
api_router.include_router(achievements.router)
api_router.include_router(streak_shield.router)
api_router.include_router(xp_multiplier.router)
api_router.include_router(tournaments.router)

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
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_a TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_b TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_c TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_d TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS angle TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS angle_num INTEGER DEFAULT 0",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS batch TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'fr'",
            # Widen id column to support long quiz_generator IDs
            "ALTER TABLE questions ALTER COLUMN id TYPE VARCHAR(100)",
            "ALTER TABLE question_reports ALTER COLUMN question_id TYPE VARCHAR(100)",
            # Widen columns that may have been created as VARCHAR(36) by an older migration
            "ALTER TABLE questions ALTER COLUMN option_a TYPE TEXT",
            "ALTER TABLE questions ALTER COLUMN option_b TYPE TEXT",
            "ALTER TABLE questions ALTER COLUMN option_c TYPE TEXT",
            "ALTER TABLE questions ALTER COLUMN option_d TYPE TEXT",
            "ALTER TABLE questions ALTER COLUMN angle TYPE TEXT",
            "ALTER TABLE questions ALTER COLUMN batch TYPE TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(36)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_avatar_url TEXT",
            "CREATE TABLE IF NOT EXISTS avatars (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100), image_url TEXT NOT NULL, category VARCHAR(50) DEFAULT 'default', created_at TIMESTAMPTZ DEFAULT NOW())",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS best_login_streak INTEGER DEFAULT 0",
            "CREATE TABLE IF NOT EXISTS boost_activations (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, theme_id VARCHAR(20) NOT NULL, activated_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL)",
            "CREATE INDEX IF NOT EXISTS ix_boost_activations_user_id ON boost_activations(user_id)",
            """CREATE TABLE IF NOT EXISTS boost_offer_refreshes (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                slot_key VARCHAR(20) NOT NULL,
                count INTEGER DEFAULT 1,
                UNIQUE(user_id, slot_key)
            )""",
            "CREATE INDEX IF NOT EXISTS ix_boost_offer_refreshes_user ON boost_offer_refreshes(user_id)",
            # Daily question
            """CREATE TABLE IF NOT EXISTS daily_question_answers (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
                date VARCHAR(10) NOT NULL, question_id VARCHAR(100) NOT NULL,
                theme_id VARCHAR(20) NOT NULL, correct BOOLEAN NOT NULL,
                xp_earned INTEGER DEFAULT 25, answered_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, date)
            )""",
            "CREATE INDEX IF NOT EXISTS ix_daily_q_user ON daily_question_answers(user_id)",
            # Achievements
            """CREATE TABLE IF NOT EXISTS user_achievements (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
                achievement_id VARCHAR(50) NOT NULL, progress INTEGER DEFAULT 0,
                unlocked BOOLEAN DEFAULT FALSE, unlocked_at TIMESTAMPTZ,
                UNIQUE(user_id, achievement_id)
            )""",
            "CREATE INDEX IF NOT EXISTS ix_achievements_user ON user_achievements(user_id)",
            # Streak shields
            """CREATE TABLE IF NOT EXISTS streak_shields (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
                shield_type VARCHAR(10) NOT NULL, activated_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL, used BOOLEAN DEFAULT FALSE
            )""",
            "CREATE INDEX IF NOT EXISTS ix_shields_user ON streak_shields(user_id)",
            # Lives
            """CREATE TABLE IF NOT EXISTS user_lives (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL UNIQUE,
                lives INTEGER DEFAULT 0
            )""",
            # Tournaments
            """CREATE TABLE IF NOT EXISTS tournaments (
                id VARCHAR(36) PRIMARY KEY, theme_id VARCHAR(20) NOT NULL,
                theme_name VARCHAR(200) DEFAULT '', start_at TIMESTAMPTZ NOT NULL,
                end_at TIMESTAMPTZ NOT NULL, status VARCHAR(20) DEFAULT 'upcoming',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )""",
            """CREATE TABLE IF NOT EXISTS tournament_entries (
                id VARCHAR(36) PRIMARY KEY, tournament_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL, score INTEGER DEFAULT 0,
                games_played INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(tournament_id, user_id)
            )""",
            "CREATE INDEX IF NOT EXISTS ix_t_entries_tournament ON tournament_entries(tournament_id)",
            # XP multiplier
            """CREATE TABLE IF NOT EXISTS xp_multiplier_activations (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
                multiplier FLOAT NOT NULL, source VARCHAR(20) DEFAULT 'purchase',
                activated_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ
            )""",
            "CREATE INDEX IF NOT EXISTS ix_xp_mult_user ON xp_multiplier_activations(user_id)",
            # player1_streak_before on matches
            "ALTER TABLE matches ADD COLUMN IF NOT EXISTS player1_streak_before INTEGER",
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
            """CREATE TABLE IF NOT EXISTS challenges (
                id VARCHAR(36) PRIMARY KEY,
                challenger_id VARCHAR(36) NOT NULL,
                challenged_id VARCHAR(36) NOT NULL,
                theme_id VARCHAR(100),
                theme_name VARCHAR(200) DEFAULT '',
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL
            )""",
            "CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON challenges(challenged_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id, status)",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p1_score INTEGER",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p1_correct INTEGER",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p1_played_at TIMESTAMP",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p2_score INTEGER",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p2_correct INTEGER",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p2_played_at TIMESTAMP",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p1_answers TEXT",
            "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS p2_answers TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token VARCHAR(200)",
            """CREATE TABLE IF NOT EXISTS daily_missions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                date VARCHAR(10) NOT NULL,
                missions TEXT NOT NULL,
                multiplier INTEGER DEFAULT 1,
                xp_earned INTEGER DEFAULT 0,
                reward_claimed BOOLEAN DEFAULT FALSE,
                target_theme_id VARCHAR(20),
                rerolls_used INTEGER DEFAULT 0,
                UNIQUE(user_id, date)
            )""",
            "CREATE INDEX IF NOT EXISTS ix_daily_missions_user_id ON daily_missions(user_id)",
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

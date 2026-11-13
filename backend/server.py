import logging
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
from config import ALLOWED_ORIGINS, ROOT_DIR, USER_AVATARS_DIR
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from database import get_db

from routers import auth, game, leaderboard, profile, social, chat, notifications, search, themes, admin, ws, forge, challenges, boosts, missions, daily_question, achievements, streak_shield, xp_multiplier, tournaments, spin, referral, league, moderation, economy, ads
from services.ad_rewards import current_ad_token
from schemas import QuestionReportRequest
from models import QuestionReport
from sqlalchemy import select
from auth_middleware import get_current_user_id
from rate_limit import _limiter, _get_client_ip

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# API docs map every route (admin included) — only exposed when explicitly enabled.
_DOCS = os.environ.get("ENABLE_API_DOCS") == "1"
app = FastAPI(
    docs_url="/docs" if _DOCS else None,
    redoc_url="/redoc" if _DOCS else None,
    openapi_url="/openapi.json" if _DOCS else None,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    # Corps de requête > 8 Mo refusé d'emblée (avant : aucune limite, quelques envois géants
    # suffisaient à saturer la mémoire du serveur)
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > 8 * 1024 * 1024:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Requête trop volumineuse"}, status_code=413)
    # Code de la pub récompensée qui vient d'être vue (lu par services/ad_rewards.verify_ad_reward)
    current_ad_token.set((request.headers.get("x-ad-token") or "")[:64])
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
    client_ip = _get_client_ip(request)
    # Skip rate limit for WebSocket upgrades
    if request.url.path.startswith("/ws"):
        return await call_next(request)
    try:
        # 300 req/min par IP : plusieurs joueurs partagent souvent la même IP publique
        # (même wifi, NAT opérateur), et un écran comme l'Accueil lance une rafale d'appels.
        _limiter.check(f"global:{client_ip}", 300, 60)
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
        logger.error(f"[health] database check failed: {e}")
        return {"status": "unhealthy", "database": "error"}

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
api_router.include_router(spin.router)
api_router.include_router(referral.router)
api_router.include_router(league.router)
api_router.include_router(moderation.router)
api_router.include_router(economy.router)
api_router.include_router(ads.router)

# Serve avatar static files
avatars_dir = ROOT_DIR / "static" / "avatars"
os.makedirs(avatars_dir, exist_ok=True)
os.makedirs(USER_AVATARS_DIR, exist_ok=True)
# Photos des joueurs (volume Railway) — monté AVANT /static/avatars, qui sert les avatars du jeu
app.mount("/static/avatars/users", StaticFiles(directory=str(USER_AVATARS_DIR)), name="user_avatars")
app.mount("/static/avatars", StaticFiles(directory=str(avatars_dir)), name="avatars")

# Public legal pages (store listings link here).
@app.get("/privacy", include_in_schema=False)
async def privacy_policy():
    return FileResponse(ROOT_DIR / "static" / "privacy.html", media_type="text/html")


@app.get("/delete-account", include_in_schema=False)
async def delete_account_page():
    return FileResponse(ROOT_DIR / "static" / "delete-account.html", media_type="text/html")

app.include_router(api_router)

# WebSocket routes (no /api prefix)
app.include_router(ws.router)

# Auth is carried by the Authorization Bearer header (no cookies), so CORS
# credentials are not needed. Keeping allow_credentials=False avoids the
# wildcard-origin + credentials footgun if ALLOWED_ORIGINS is ever set to "*".
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
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
            "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT FALSE",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_a TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_b TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_c TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_d TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS angle TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS angle_num INTEGER DEFAULT 0",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS batch TEXT",
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'fr'",
            # Libellés de thème traduits (nom, description, 5 titres de niveau).
            # Une colonne JSON plutôt qu'une table jointe : 7 champs courts sur
            # 917 thèmes, la jointure aurait alourdi une dizaine d'endpoints.
            "ALTER TABLE themes ADD COLUMN IF NOT EXISTS translations JSON",
            # Thèmes propres à une langue (« English Traps »…) : visibles par tous, mais
            # jamais proposés d'office à un joueur d'une autre langue (voir i18n).
            "ALTER TABLE themes ADD COLUMN IF NOT EXISTS langue_unique VARCHAR(5)",
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
            # Tribus : top joueur + comptage par thème (DISTINCT ON / GROUP BY)
            "CREATE INDEX IF NOT EXISTS ix_utx_theme_xp ON user_theme_xp (theme_id, xp DESC)",
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
            # Moderation (report / block)
            """CREATE TABLE IF NOT EXISTS user_blocks (
                id VARCHAR(36) PRIMARY KEY, blocker_id VARCHAR(36) NOT NULL,
                blocked_id VARCHAR(36) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT uq_user_block UNIQUE (blocker_id, blocked_id)
            )""",
            "CREATE INDEX IF NOT EXISTS ix_user_blocks_blocker ON user_blocks(blocker_id)",
            "CREATE INDEX IF NOT EXISTS ix_user_blocks_blocked ON user_blocks(blocked_id)",
            """CREATE TABLE IF NOT EXISTS content_reports (
                id VARCHAR(36) PRIMARY KEY, reporter_id VARCHAR(36) NOT NULL,
                target_type VARCHAR(20) NOT NULL, target_id VARCHAR(36) NOT NULL,
                target_user_id VARCHAR(36), reason VARCHAR(30) NOT NULL, details TEXT,
                snapshot TEXT, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT uq_content_report UNIQUE (reporter_id, target_type, target_id)
            )""",
            "CREATE INDEX IF NOT EXISTS ix_content_reports_status ON content_reports(status)",
            # player1_streak_before on matches
            "ALTER TABLE matches ADD COLUMN IF NOT EXISTS player1_streak_before INTEGER",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER",
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
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS mmr FLOAT DEFAULT 1000.0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_spin_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame VARCHAR(30)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(36)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_confirmed BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL",
            """CREATE TABLE IF NOT EXISTS spin_theme_unlocks (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
                theme_id VARCHAR(20) NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )""",
            "CREATE INDEX IF NOT EXISTS ix_spin_theme_unlocks_user ON spin_theme_unlocks(user_id)",
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
            # Économie de jeu : crédits, places de thèmes, coffre, tour de roue en plus
            """CREATE TABLE IF NOT EXISTS user_economy (
                user_id VARCHAR(36) PRIMARY KEY,
                credits INTEGER DEFAULT 5,
                regen_at TIMESTAMPTZ DEFAULT NOW(),
                ad_day VARCHAR(10),
                ads_today INTEGER DEFAULT 0,
                refundable_until TIMESTAMPTZ,
                theme_bonus INTEGER DEFAULT 0,
                chest_day VARCHAR(10),
                chests_opened INTEGER DEFAULT 0,
                spin_ad_day VARCHAR(10)
            )""",
            # ×2 XP après un duel (pub) : une seule fois par match
            "ALTER TABLE matches ADD COLUMN IF NOT EXISTS xp_doubled BOOLEAN DEFAULT FALSE",
            # Réactions débloquées au coffre du jour
            "ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS reactions_unlocked TEXT",
            # Ticket de partie : preuve, côté serveur, que le crédit a été pris avant de jouer
            "ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS ticket_theme VARCHAR(100)",
            "ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS ticket_until TIMESTAMPTZ",
            # Questions jamais vues d'abord : un curseur par joueur et par thème
            """CREATE TABLE IF NOT EXISTS question_cursors (
                user_id VARCHAR(36) NOT NULL,
                theme_id VARCHAR(100) NOT NULL,
                cursors TEXT,
                PRIMARY KEY (user_id, theme_id)
            )""",
            # Parties solo / défis différés notés par le serveur
            """CREATE TABLE IF NOT EXISTS solo_sessions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                theme_id VARCHAR(100) NOT NULL,
                opponent VARCHAR(100),
                challenge_id VARCHAR(36),
                data TEXT NOT NULL,
                player_score INTEGER DEFAULT 0,
                bot_score INTEGER DEFAULT 0,
                correct INTEGER DEFAULT 0,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )""",
            "CREATE INDEX IF NOT EXISTS ix_solo_sessions_user_id ON solo_sessions(user_id)",
            # Pubs récompensées confirmées par Google (SSV AdMob)
            """CREATE TABLE IF NOT EXISTS ad_views (
                nonce VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                action VARCHAR(40),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                verified_at TIMESTAMPTZ,
                transaction_id VARCHAR(100),
                used BOOLEAN DEFAULT FALSE
            )""",
            "CREATE INDEX IF NOT EXISTS ix_ad_views_user_id ON ad_views(user_id)",
            # Classement local en cascade : département + date du dernier changement de ville
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS city_changed_at TIMESTAMPTZ",
            "CREATE TABLE IF NOT EXISTS place_names (key VARCHAR(250) PRIMARY KEY, names TEXT NOT NULL)",
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
            "CREATE INDEX IF NOT EXISTS ix_challenges_expires_at ON challenges(expires_at)",
            "CREATE INDEX IF NOT EXISTS ix_daily_missions_date ON daily_missions(date)",
        ]
        for idx_stmt in index_statements:
            try:
                await conn.execute(text(idx_stmt))
                logger.info(f"[startup] OK: {idx_stmt}")
            except Exception as e:
                logger.warning(f"[startup] skip index: {e}")

    # Catalogue des avatars proposés (services/avatar_catalog.py)
    from database import AsyncSessionLocal
    from services.avatar_catalog import sync_avatars
    await sync_avatars(AsyncSessionLocal)

    # Start background crons
    import asyncio as _asyncio
    _asyncio.create_task(_weekly_summary_cron())
    _asyncio.create_task(_streak_danger_cron())
    _asyncio.create_task(_challenge_expiry_cron())
    _asyncio.create_task(_backfill_places())
    _asyncio.create_task(_tournament_end_cron())


async def _weekly_summary_cron():
    """Send weekly summary push notifications every Monday at 08:00 UTC."""
    import asyncio
    from datetime import datetime, timezone, timedelta
    from database import AsyncSessionLocal
    from sqlalchemy import select as _select
    from models import User as _User, Match as _Match
    from services.notifications import _send_expo_push
    from constants import TOTAL_QUESTIONS as _TQ

    while True:
        now = datetime.now(timezone.utc)
        # Calculate next Monday 08:00 UTC
        days_until_monday = (7 - now.weekday()) % 7
        if days_until_monday == 0 and now.hour >= 8:
            days_until_monday = 7
        next_run = now.replace(hour=8, minute=0, second=0, microsecond=0) + timedelta(days=days_until_monday)
        sleep_secs = (next_run - now).total_seconds()
        logger.info(f"[cron] weekly summary in {sleep_secs:.0f}s at {next_run.isoformat()}")
        await asyncio.sleep(sleep_secs)

        try:
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            async with AsyncSessionLocal() as db:
                # Fetch users with push tokens
                users_res = await db.execute(
                    _select(_User).where(_User.push_token.isnot(None))
                )
                users = users_res.scalars().all()

                for u in users:
                    try:
                        matches_res = await db.execute(
                            _select(_Match).where(
                                _Match.player1_id == u.id,
                                _Match.created_at > seven_days_ago,
                            )
                        )
                        matches = matches_res.scalars().all()
                        if not matches:
                            continue
                        games = len(matches)
                        wins = sum(1 for m in matches if m.winner_id == u.id)
                        xp = sum(m.xp_earned or 0 for m in matches)
                        win_pct = round(wins / games * 100)
                        title = "📊 Ton résumé de la semaine"
                        body = f"{games} duels · {wins} victoires ({win_pct}%) · +{xp} XP"
                        await _send_expo_push(u.push_token, title, body, {"type": "weekly_summary"})
                    except Exception as e:
                        logger.warning(f"[cron] weekly push failed for {u.id}: {e}")
        except Exception as e:
            logger.error(f"[cron] weekly summary cron error: {e}")


async def _streak_danger_cron():
    """Daily at 18:00 UTC — push users whose win streak is about to reset (no game today)."""
    import asyncio
    from datetime import datetime, timezone, timedelta
    from database import AsyncSessionLocal
    from sqlalchemy import select as _sel, or_
    from models import User as _U
    from services.notifications import _send_expo_push

    while True:
        now = datetime.now(timezone.utc)
        target = now.replace(hour=18, minute=0, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        await asyncio.sleep((target - now).total_seconds())

        try:
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            async with AsyncSessionLocal() as db:
                res = await db.execute(
                    _sel(_U).where(
                        _U.push_token.isnot(None),
                        _U.current_streak > 0,
                        or_(_U.last_played_at.is_(None), _U.last_played_at < today_start),
                    )
                )
                users = res.scalars().all()
                for u in users:
                    try:
                        s = u.current_streak
                        await _send_expo_push(
                            u.push_token,
                            "⚡ Ton streak est en danger !",
                            f"Ton streak de {s} {'jour' if s == 1 else 'jours'} se réinitialise à minuit. Joue une partie !",
                            {"type": "streak_danger"},
                        )
                    except Exception as e:
                        logger.warning(f"[cron] streak_danger push failed for {u.id}: {e}")
        except Exception as e:
            logger.error(f"[cron] streak_danger cron error: {e}")


async def _backfill_places():
    """Villes déjà saisies (avant le 13/11/2026) : nom officiel, département, continent, position.
    Une par seconde (règle d'OpenStreetMap), 500 joueurs au plus par démarrage ; une ville
    introuvable est laissée telle quelle."""
    import asyncio
    from database import AsyncSessionLocal
    from sqlalchemy import select as _sel, or_
    from models import User as _U
    from services.geo import resolve_place
    await asyncio.sleep(30)
    try:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                _sel(_U.id, _U.city, _U.country).where(
                    _U.is_bot == False, _U.city.isnot(None),  # noqa: E712
                    or_(_U.department.is_(None), _U.department == _U.region),
                ).limit(500)
            )).all()
        done = 0
        for uid, city, country in rows:
            try:
                place = await resolve_place(city, country or "")
            except Exception:
                continue
            async with AsyncSessionLocal() as db:
                u = (await db.execute(_sel(_U).where(_U.id == uid))).scalar_one_or_none()
                if not u:
                    continue
                if place:
                    names = place.pop("names", None)
                    for k, v in place.items():
                        setattr(u, k, v)
                    from services.geo import save_place_names
                    await save_place_names(db, place, names)
                    done += 1
                else:
                    u.department = ""   # introuvable : on ne réessaie pas à chaque démarrage
                await db.commit()
        logger.info(f"[geo] villes mises au propre : {done}/{len(rows)}")
    except Exception as e:
        logger.warning(f"[geo] backfill: {e}")


async def _challenge_expiry_cron():
    """Every 30 min — push challenged user if challenge expires in ~1h."""
    import asyncio
    from datetime import datetime, timezone, timedelta
    from database import AsyncSessionLocal
    from sqlalchemy import select as _sel
    from models import User as _U, Challenge as _C
    from services.notifications import _send_expo_push

    while True:
        await asyncio.sleep(1800)  # every 30 min
        try:
            # challenges.expires_at est stocké SANS fuseau (UTC) : comparer avec une date sans
            # fuseau, sinon asyncpg refuse la requête (le rappel « défi qui expire » ne partait jamais)
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            window_start = now + timedelta(minutes=55)
            window_end = now + timedelta(minutes=65)
            async with AsyncSessionLocal() as db:
                res = await db.execute(
                    _sel(_C).where(
                        _C.status == "pending",
                        _C.expires_at >= window_start,
                        _C.expires_at <= window_end,
                    )
                )
                challenges = res.scalars().all()
                for c in challenges:
                    try:
                        user_res = await db.execute(_sel(_U).where(_U.id == c.challenged_id))
                        user = user_res.scalar_one_or_none()
                        if not user or not user.push_token:
                            continue
                        challenger_res = await db.execute(_sel(_U).where(_U.id == c.challenger_id))
                        challenger = challenger_res.scalar_one_or_none()
                        name = challenger.pseudo if challenger else "Quelqu'un"
                        theme = c.theme_name or "un thème"
                        await _send_expo_push(
                            user.push_token,
                            "⏰ Défi qui expire bientôt !",
                            f"{name} t'a défié en {theme}. Il reste 1h pour jouer !",
                            {"type": "challenge_expiry", "challenge_id": c.id},
                        )
                    except Exception as e:
                        logger.warning(f"[cron] challenge_expiry push failed for {c.id}: {e}")
        except Exception as e:
            logger.error(f"[cron] challenge_expiry cron error: {e}")


async def _tournament_end_cron():
    """Every 30 min: push final rank to tournament participants when tournament ends."""
    import asyncio
    from datetime import datetime, timezone, timedelta
    from database import AsyncSessionLocal
    from sqlalchemy import select as _sel
    from models import User as _U, Tournament as _T, TournamentEntry as _TE
    from services.notifications import _send_expo_push

    notified_tournaments: set[str] = set()

    while True:
        await asyncio.sleep(1800)  # 30 min
        try:
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(minutes=35)
            async with AsyncSessionLocal() as db:
                # Tournaments that ended in the last 30-35 min window
                res = await db.execute(
                    _sel(_T).where(
                        _T.end_at >= window_start,
                        _T.end_at < now,
                        _T.status == "active",
                    )
                )
                ended = res.scalars().all()
                for t in ended:
                    if t.id in notified_tournaments:
                        continue
                    notified_tournaments.add(t.id)
                    t.status = "finished"
                    await db.commit()

                    # Fetch all entries sorted by score
                    entries_res = await db.execute(
                        _sel(_TE).where(_TE.tournament_id == t.id)
                        .order_by(_TE.score.desc())
                    )
                    entries = entries_res.scalars().all()
                    total = len(entries)
                    for rank, entry in enumerate(entries, 1):
                        user_res = await db.execute(_sel(_U).where(_U.id == entry.user_id))
                        user = user_res.scalar_one_or_none()
                        if not user or not user.push_token:
                            continue
                        medal = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else f"#{rank}"
                        await _send_expo_push(
                            user.push_token,
                            f"🏆 Tournoi terminé — {t.theme_name}",
                            f"{medal} sur {total} joueurs · {entry.score} pts",
                            {"type": "tournament_end", "tournament_id": t.id},
                        )
        except Exception as e:
            logger.error(f"[cron] tournament_end cron error: {e}")

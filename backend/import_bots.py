"""
import_bots.py — Importe les bots dans PostgreSQL via asyncpg direct (sans SQLAlchemy).

Usage :
    python import_bots.py

Variables d'environnement requises (ou fichier .env) :
    DATABASE_URL  — ex: postgresql+asyncpg://user:pass@host:6543/postgres?prepared_statement_cache_size=0

Fichier d'entrée :
    output_bots/bots.json
"""

import asyncio
import json
import os
import random
import re
import uuid
from pathlib import Path

import asyncpg
from datetime import date
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
CHUNK_SIZE   = 200
INPUT_FILE   = Path("output_bots/bots.json")


def _to_asyncpg_dsn(url: str) -> str:
    """Convertit postgresql+asyncpg://... en postgresql://... pour asyncpg direct."""
    dsn = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    # Supprimer les query params incompatibles avec asyncpg (prepared_statement_cache_size etc.)
    dsn = dsn.split("?")[0]
    return dsn


async def setup_schema(conn: asyncpg.Connection):
    """Ajoute les colonnes bot et crée bot_themes si nécessaire."""
    print("Vérification du schéma...")
    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot          BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_level      FLOAT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_speed        FLOAT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS win_rate         FLOAT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS language         VARCHAR(5)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone         VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_hours  JSONB",
    ]
    for sql in migrations:
        await conn.execute(sql)

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS bot_themes (
            id                    SERIAL PRIMARY KEY,
            bot_pseudo            VARCHAR(50) NOT NULL REFERENCES users(pseudo) ON DELETE CASCADE,
            theme_id              VARCHAR(30) NOT NULL,
            games_played_on_theme INTEGER DEFAULT 0,
            win_rate_on_theme     FLOAT DEFAULT 0.5,
            CONSTRAINT uq_bot_theme UNIQUE (bot_pseudo, theme_id)
        )
    """)
    await conn.execute("CREATE INDEX IF NOT EXISTS ix_bot_themes_bot_pseudo ON bot_themes(bot_pseudo)")
    await conn.execute("CREATE INDEX IF NOT EXISTS ix_bot_themes_theme_id   ON bot_themes(theme_id)")
    await conn.execute("CREATE INDEX IF NOT EXISTS ix_users_is_bot          ON users(is_bot)")
    print("Schéma OK.")


async def import_users(conn: asyncpg.Connection, bots: list[dict]) -> set[str]:
    """Insère les bots dans users. Retourne l'ensemble des pseudos insérés avec succès."""
    print(f"Import des bots ({len(bots)})...")
    inserted = 0
    skipped  = 0
    inserted_pseudos: set[str] = set()

    for chunk_start in range(0, len(bots), CHUNK_SIZE):
        chunk = bots[chunk_start:chunk_start + CHUNK_SIZE]
        rows = []
        for bot in chunk:
            pseudo = str(bot.get("pseudo", "")).strip()[:50]
            if not pseudo:
                skipped += 1
                continue
            rows.append((
                str(uuid.uuid4()),
                pseudo,
                float(bot.get("skill_level", 0.5)),
                float(bot.get("avg_speed", 5.0)),
                float(bot.get("win_rate", 0.5)),
                bot.get("country", "") or "",
                bot.get("language", "fr") or "fr",
                bot.get("timezone", "UTC") or "UTC",
                json.dumps(bot.get("preferred_hours") or []),
                int(bot.get("games_played", 0)),
                bot.get("avatar_id") or None,
                date.fromisoformat(str(bot.get("join_date", "2026-01-01"))),
            ))

        if not rows:
            continue

        try:
            result = await conn.executemany("""
                INSERT INTO users (
                    id, pseudo, is_guest, is_bot,
                    skill_level, avg_speed, win_rate,
                    country, language, timezone, preferred_hours,
                    matches_played, total_xp,
                    avatar_id,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, false, true,
                    $3, $4, $5,
                    $6, $7, $8, $9::jsonb,
                    $10, 0,
                    $11,
                    $12, NOW()
                )
                ON CONFLICT (pseudo) DO UPDATE SET
                    is_bot       = true,
                    skill_level  = EXCLUDED.skill_level,
                    avg_speed    = EXCLUDED.avg_speed,
                    win_rate     = EXCLUDED.win_rate,
                    language     = EXCLUDED.language,
                    timezone     = EXCLUDED.timezone,
                    preferred_hours = EXCLUDED.preferred_hours,
                    avatar_id    = EXCLUDED.avatar_id
            """, rows)
            # Récupérer les pseudos effectivement insérés
            for row in rows:
                inserted_pseudos.add(row[1])
            inserted += len(rows)
        except Exception as e:
            print(f"  Erreur chunk {chunk_start}: {e}")
            skipped += len(rows)

        done = min(chunk_start + CHUNK_SIZE, len(bots))
        pct  = round(done / len(bots) * 100)
        if done % 1000 == 0 or done == len(bots):
            print(f"  Bots : {done}/{len(bots)} ({pct}%) — insérés≈{inserted}")

    # Compte réel depuis la DB
    real_count = await conn.fetchval("SELECT COUNT(*) FROM users WHERE is_bot = true")
    print(f"Bots dans la DB (is_bot=true) : {real_count}")

    # Récupérer tous les pseudos bots existants pour les FK bot_themes
    rows_db = await conn.fetch("SELECT pseudo FROM users WHERE is_bot = true")
    return {r["pseudo"] for r in rows_db}


async def import_bot_themes(conn: asyncpg.Connection, bots: list[dict], valid_pseudos: set[str]):
    """Insère les entrées bot_themes depuis le champ _themes de chaque profil."""
    print("Construction des bot_themes...")
    bt_rows = []
    for bot in bots:
        pseudo = str(bot.get("pseudo", "")).strip()[:50]
        if pseudo not in valid_pseudos:
            continue
        themes   = bot.get("_themes") or []
        gp_total = int(bot.get("games_played", 0))
        wr_base  = float(bot.get("win_rate", 0.5))
        n        = max(1, len(themes))
        for theme_id in themes:
            if not theme_id:
                continue
            gp = max(0, round(gp_total / n * random.uniform(0.8, 1.2)))
            wr = round(max(0.15, min(0.90, wr_base + random.uniform(-0.08, 0.08))), 3)
            bt_rows.append((pseudo, str(theme_id)[:30], gp, wr))

    print(f"Entrées bot_themes à insérer : {len(bt_rows)}")
    inserted = 0

    for chunk_start in range(0, len(bt_rows), CHUNK_SIZE):
        chunk = bt_rows[chunk_start:chunk_start + CHUNK_SIZE]
        try:
            await conn.executemany("""
                INSERT INTO bot_themes (bot_pseudo, theme_id, games_played_on_theme, win_rate_on_theme)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (bot_pseudo, theme_id) DO NOTHING
            """, chunk)
            inserted += len(chunk)
        except Exception as e:
            print(f"  Erreur bot_themes chunk {chunk_start}: {e}")

        done = min(chunk_start + CHUNK_SIZE, len(bt_rows))
        pct  = round(done / len(bt_rows) * 100)
        if done % 5000 == 0 or done == len(bt_rows):
            print(f"  bot_themes : {done}/{len(bt_rows)} ({pct}%)")

    print(f"bot_themes insérés : ≈{inserted}")


async def import_bots():
    dsn = _to_asyncpg_dsn(DATABASE_URL)

    print(f"Connexion à la DB...")
    conn = await asyncpg.connect(dsn, statement_cache_size=0)

    try:
        await setup_schema(conn)

        with open(INPUT_FILE, encoding="utf-8") as f:
            bots: list[dict] = json.load(f)
        print(f"Profils chargés : {len(bots)}")

        valid_pseudos = await import_users(conn, bots)
        await import_bot_themes(conn, bots, valid_pseudos)

        # Vérification finale
        r1 = await conn.fetchval("SELECT COUNT(*) FROM users WHERE is_bot = true")
        r2 = await conn.fetchval("SELECT COUNT(*) FROM bot_themes")
        r3 = await conn.fetchval("SELECT COUNT(DISTINCT theme_id) FROM bot_themes")
        print(f"\nVérification :")
        print(f"  users (is_bot=true)    : {r1}")
        print(f"  bot_themes (total)     : {r2}")
        print(f"  thèmes distincts       : {r3}")

    finally:
        await conn.close()

    print("\nImport terminé.")


if __name__ == "__main__":
    asyncio.run(import_bots())

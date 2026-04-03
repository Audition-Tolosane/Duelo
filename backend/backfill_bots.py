"""
backfill_bots.py — Met à jour les stats des bots déjà importés.

Pour chaque bot :
  - Calcule matches_won = round(matches_played * win_rate)
  - Crée/met à jour les UserThemeXP depuis bot_themes
    (XP estimé : games_played_on_theme × (skill_level×140×2 + win_rate_on_theme×50))

Usage :
    python backfill_bots.py
"""

import asyncio
import os
import re
import uuid
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]


def _to_asyncpg_dsn(url: str) -> str:
    dsn = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    return dsn.split("?")[0]


async def backfill():
    dsn = _to_asyncpg_dsn(DATABASE_URL)
    conn = await asyncpg.connect(dsn, statement_cache_size=0)

    try:
        # 1. Mettre à jour matches_won pour les bots où il est NULL
        print("Mise à jour de matches_won...")
        updated = await conn.execute("""
            UPDATE users
            SET matches_won = ROUND(matches_played * win_rate)
            WHERE is_bot = true
              AND matches_won IS NULL
              AND matches_played IS NOT NULL
              AND win_rate IS NOT NULL
        """)
        print(f"  {updated}")

        # 2. Créer les UserThemeXP depuis bot_themes
        print("Récupération des bots et leurs thèmes...")
        bots = await conn.fetch("""
            SELECT u.id, u.pseudo, u.skill_level, u.win_rate
            FROM users u
            WHERE u.is_bot = true
        """)
        print(f"  {len(bots)} bots trouvés")

        rows = []
        for bot in bots:
            bot_id     = bot["id"]
            pseudo     = bot["pseudo"]
            skill      = float(bot["skill_level"] or 0.5)
            wr_global  = float(bot["win_rate"] or 0.5)

            themes = await conn.fetch("""
                SELECT theme_id, games_played_on_theme, win_rate_on_theme
                FROM bot_themes
                WHERE bot_pseudo = $1
            """, pseudo)

            for t in themes:
                gp = int(t["games_played_on_theme"] or 0)
                wr = float(t["win_rate_on_theme"] or wr_global)
                if gp == 0:
                    continue
                # XP estimé : score moyen × 2 + victoires × 50
                avg_score = skill * 140
                xp = round(gp * (avg_score * 2 + wr * 50))
                rows.append((str(uuid.uuid4()), bot_id, t["theme_id"], xp))

        print(f"  {len(rows)} entrées UserThemeXP à créer...")

        inserted = 0
        CHUNK = 500
        for i in range(0, len(rows), CHUNK):
            chunk = rows[i:i + CHUNK]
            await conn.executemany("""
                INSERT INTO user_theme_xp (id, user_id, theme_id, xp)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, theme_id) DO UPDATE
                    SET xp = GREATEST(user_theme_xp.xp, EXCLUDED.xp)
            """, chunk)
            inserted += len(chunk)

        # 3. Recalculer win_rate depuis matches_won/matches_played (entiers cohérents)
        print("Recalcul du win_rate...")
        await conn.execute("""
            UPDATE users
            SET win_rate = ROUND(matches_won::numeric / NULLIF(matches_played, 0), 2)
            WHERE is_bot = true
              AND matches_won IS NOT NULL
              AND matches_played > 0
        """)

        # 4. Recalculer total_xp pour chaque bot
        print("Recalcul du total_xp...")
        await conn.execute("""
            UPDATE users u
            SET total_xp = (
                SELECT COALESCE(SUM(xp), 0)
                FROM user_theme_xp
                WHERE user_id = u.id
            )
            WHERE u.is_bot = true
        """)

        print(f"Backfill terminé : {inserted} UserThemeXP créés/mis à jour.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(backfill())

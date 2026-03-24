"""
Migration: add lat/lng columns to users table.
Run once: python migrate_lat_lng.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]


async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lat FLOAT;"
        ))
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lng FLOAT;"
        ))
    await engine.dispose()
    print("Migration OK : colonnes lat et lng ajoutées.")


if __name__ == "__main__":
    asyncio.run(migrate())

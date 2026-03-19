"""
Create all database tables from SQLAlchemy models.
Run once after setting up your DATABASE_URL in .env:

    python create_tables.py
"""
import asyncio
from database import engine, Base
from models import (
    User, Question, Match, WallPost, PostLike,
    PostComment, PlayerFollow, ChatMessage, Notification,
    NotificationSettings, Theme, UserThemeXP, QuestionReport,
)


async def create_all():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("All tables created successfully!")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_all())

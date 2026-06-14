from datetime import datetime, timezone, timedelta
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from database import get_db


def create_access_token(user_id: str, token_version: int = 0) -> str:
    """Create a JWT access token with user_id as subject.

    `token_version` is embedded as the `tv` claim; bumping a user's
    token_version in the DB invalidates every token issued before the bump.
    """
    payload = {
        "sub": user_id,
        "tv": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_optional_user_id(request: Request) -> str | None:
    """Extract user_id from JWT if present, without raising on missing/invalid token."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None


async def get_current_user_id(request: Request, db: AsyncSession = Depends(get_db)) -> str:
    """Extract and validate JWT from Authorization Bearer header.

    Also checks the token's `tv` claim against the user's current
    token_version so revoked tokens (logout / deleted account) are rejected.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalide")

    # Verify the token has not been revoked. A missing row (deleted account)
    # invalidates the token as well.
    from models import User
    res = await db.execute(select(User.token_version).where(User.id == user_id))
    current_version = res.scalar_one_or_none()
    if current_version is None or (payload.get("tv", 0) != current_version):
        raise HTTPException(status_code=401, detail="Token révoqué")

    return user_id

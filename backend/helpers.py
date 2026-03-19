import bcrypt
import random
import httpx
from typing import Optional
from fastapi import Request


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, stored: str) -> bool:
    # Support legacy SHA256 format (salt:hash) for existing users
    if ':' in stored and len(stored.split(':')) == 2:
        import hashlib
        salt, hashed = stored.split(':')
        if hashlib.sha256((password + salt).encode()).hexdigest() == hashed:
            return True
        return False
    return bcrypt.checkpw(password.encode(), stored.encode())

def shuffle_question_options(options: list, correct_option: int) -> tuple:
    """Shuffle 4 options uniformly (25% each position) and return (new_options, new_correct_index)."""
    indices = list(range(len(options)))
    random.shuffle(indices)
    new_options = [options[i] for i in indices]
    new_correct = indices.index(correct_option)
    return new_options, new_correct

async def detect_country_from_ip(request: Request) -> Optional[str]:
    """Detect country from IP using ip-api.com."""
    try:
        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
        if not client_ip or client_ip in ("127.0.0.1", "::1", "localhost"):
            return None
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"http://ip-api.com/json/{client_ip}?fields=status,country,countryCode,city,regionName")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    return data.get("country")
    except Exception:
        pass
    return None

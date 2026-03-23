import base64
import bcrypt
import random
import httpx
from typing import Optional
from fastapi import Request


ALLOWED_IMAGE_SIGNATURES = {
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'\xff\xd8\xff': 'image/jpeg',
    b'RIFF': 'image/webp',  # WebP starts with RIFF....WEBP
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
}


def validate_image_base64(data_uri: str) -> bytes:
    """Validate that a base64 data URI contains a real image. Returns decoded bytes."""
    # Strip data URI prefix if present
    if ',' in data_uri:
        data_uri = data_uri.split(',', 1)[1]

    try:
        raw = base64.b64decode(data_uri)
    except Exception:
        raise ValueError("Données base64 invalides")

    # Check magic bytes
    is_valid = False
    for signature in ALLOWED_IMAGE_SIGNATURES:
        if raw[:len(signature)] == signature:
            is_valid = True
            break

    # Special check for WebP (RIFF....WEBP)
    if raw[:4] == b'RIFF' and len(raw) > 11 and raw[8:12] != b'WEBP':
        is_valid = False

    if not is_valid:
        raise ValueError("Le fichier n'est pas une image valide (PNG, JPG, WebP ou GIF)")

    return raw


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

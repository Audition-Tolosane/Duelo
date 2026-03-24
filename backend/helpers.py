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

    # Check dimensions from raw bytes without external dependencies
    _check_image_dimensions(raw)

    return raw


def _check_image_dimensions(raw: bytes, max_pixels: int = 4096 * 4096):
    """Reject absurdly large images by parsing dimensions from magic bytes."""
    import struct
    width = height = 0
    try:
        if raw[:8] == b'\x89PNG\r\n\x1a\n' and len(raw) > 24:
            width, height = struct.unpack('>II', raw[16:24])
        elif raw[:3] == b'\xff\xd8\xff':
            # Scan JPEG SOF markers
            i = 2
            while i < len(raw) - 8:
                if raw[i] != 0xFF:
                    break
                marker = raw[i + 1]
                seg_len = struct.unpack('>H', raw[i + 2:i + 4])[0]
                if marker in (0xC0, 0xC1, 0xC2):
                    height, width = struct.unpack('>HH', raw[i + 5:i + 9])
                    break
                i += 2 + seg_len
        elif raw[:4] == b'RIFF' and raw[8:12] == b'WEBP' and len(raw) > 30:
            if raw[12:16] == b'VP8 ':
                width = (struct.unpack('<H', raw[26:28])[0]) & 0x3FFF
                height = (struct.unpack('<H', raw[28:30])[0]) & 0x3FFF
    except Exception:
        return  # Can't parse → allow through

    if width > 0 and height > 0 and width * height > max_pixels:
        raise ValueError(f"Image trop grande ({width}×{height}px, max 4096×4096)")


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

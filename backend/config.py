import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable is required")

JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 43200  # 30 days

ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:8081,http://localhost:19006').split(',')

# Social auth (optional — leave blank to disable the provider)
GOOGLE_CLIENT_IDS = [s.strip() for s in os.environ.get('GOOGLE_CLIENT_IDS', '').split(',') if s.strip()]
APPLE_BUNDLE_ID = os.environ.get('APPLE_BUNDLE_ID', '')

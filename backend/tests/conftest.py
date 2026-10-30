import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

# Never the app's EXPO_PUBLIC_BACKEND_URL: these tests create users/challenges and
# used to run against the production database.
BASE_URL = os.environ.get('TEST_BACKEND_URL', 'http://localhost:8080')
if 'railway.app' in BASE_URL or 'duelo-production' in BASE_URL:
    raise RuntimeError('Refusing to run the test suite against production')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def base_url():
    """Base URL for API"""
    return BASE_URL

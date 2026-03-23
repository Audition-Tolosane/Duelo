from fastapi import Request, HTTPException
from collections import defaultdict
import time


class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)

    def _cleanup(self, key: str, window: int):
        now = time.time()
        self.requests[key] = [t for t in self.requests[key] if now - t < window]

    def check(self, key: str, limit: int, window: int):
        self._cleanup(key, window)
        if len(self.requests[key]) >= limit:
            raise HTTPException(status_code=429, detail="Trop de requêtes, réessayez plus tard")
        self.requests[key].append(time.time())


_limiter = RateLimiter()


def rate_limit(limit: int = 60, window: int = 60):
    """Returns a dependency that rate-limits by IP. Default: 60 req/min."""
    async def dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        _limiter.check(f"global:{client_ip}", limit, window)
    return dependency


async def rate_limit_auth(request: Request):
    """Stricter rate limit for auth endpoints: 10 req/min."""
    client_ip = request.client.host if request.client else "unknown"
    _limiter.check(f"auth:{client_ip}", 10, 60)

from fastapi import Request, HTTPException
from collections import defaultdict
import ipaddress
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


def _is_trusted_proxy(ip: str) -> bool:
    """Return True only for loopback/private IPs (i.e. our own reverse proxy)."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_loopback or addr.is_private
    except ValueError:
        return False


def _get_client_ip(request: Request) -> str:
    """Return the real client IP.
    X-Forwarded-For is only trusted when the direct connection comes from a
    known internal proxy, preventing header-spoofing from external clients.
    """
    client_host = request.client.host if request.client else None
    if client_host and _is_trusted_proxy(client_host):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return client_host or "unknown"


def rate_limit(limit: int = 60, window: int = 60):
    """Returns a dependency that rate-limits by IP. Default: 60 req/min."""
    async def dependency(request: Request):
        _limiter.check(f"global:{_get_client_ip(request)}", limit, window)
    return dependency


async def rate_limit_auth(request: Request):
    """Stricter rate limit for auth endpoints: 10 req/min."""
    _limiter.check(f"auth:{_get_client_ip(request)}", 10, 60)

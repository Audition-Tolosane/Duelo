from fastapi import Request, HTTPException
from collections import defaultdict
import ipaddress
import time


class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)

    def _cleanup(self, key: str, window: int):
        now = time.time()
        recent = [t for t in self.requests.get(key, []) if now - t < window]
        if recent:
            self.requests[key] = recent
        else:
            self.requests.pop(key, None)   # libère la mémoire des adresses inactives

    def count(self, key: str, window: int) -> int:
        """Nombre d'évènements récents, SANS en ajouter un (compteurs d'échecs)."""
        self._cleanup(key, window)
        n = len(self.requests[key])
        if not n:
            self.requests.pop(key, None)   # pas de clés vides qui s'accumulent
        return n

    def check(self, key: str, limit: int, window: int):
        self._cleanup(key, window)
        if len(self.requests[key]) >= limit:
            raise HTTPException(status_code=429, detail="Trop de requêtes, réessayez plus tard")
        self.requests[key].append(time.time())


_limiter = RateLimiter()


# Proxys de Railway : adresses 100.64.0.0/10 (« shared address space »), que Python ne classe
# PAS comme privées. Sans elles, chaque requête était comptée sous l'adresse du proxy (une
# vingtaine, partagées par tous les joueurs) : les limites ne freinaient pas un attaquant et
# pouvaient bloquer des joueurs honnêtes passés par le même proxy.
_RAILWAY_PROXY_NET = ipaddress.ip_network("100.64.0.0/10")


def _is_trusted_proxy(ip: str) -> bool:
    """Return True only for our own reverse proxy (loopback, private, Railway edge)."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_loopback or addr.is_private or addr in _RAILWAY_PROXY_NET
    except ValueError:
        return False


def _get_client_ip(request: Request) -> str:
    """Return the real client IP.

    Les en-têtes ne sont lus que si la connexion vient de notre proxy. On prend X-Real-IP :
    Railway le pose lui-même avec l'adresse réelle et écrase toute valeur envoyée par le client
    (vérifié en production le 11/11/2026). Railway réécrit aussi X-Forwarded-For
    (« client, proxy ») : à défaut de X-Real-IP, on prend sa PREMIÈRE adresse.
    """
    client_host = request.client.host if request.client else None
    if client_host and _is_trusted_proxy(client_host):
        real_ip = (request.headers.get("X-Real-IP") or "").strip()
        if real_ip:
            return real_ip
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return client_host or "unknown"


def rate_limit(limit: int = 60, window: int = 60):
    """Returns a dependency that rate-limits by IP, per route. Default: 60 req/min.

    Chaque route a son propre compteur : partager la clé « global:{ip} » du middleware
    faisait compter TOUTES les requêtes de l'app dans la limite de la route (ex. 5/min
    pour l'envoi de défi) → 429 quasi systématique dès qu'on naviguait un peu.
    """
    async def dependency(request: Request):
        route = request.scope.get("route")
        scope = getattr(route, "path", None) or request.url.path
        _limiter.check(f"route:{scope}:{_get_client_ip(request)}", limit, window)
    return dependency


async def rate_limit_auth(request: Request):
    """Stricter rate limit for auth endpoints: 10 req/min."""
    _limiter.check(f"auth:{_get_client_ip(request)}", 10, 60)

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from schemas import GuestRegister, EmailRegister, LoginRequest, UserResponse, SocialAuthRequest
from helpers import hash_password, verify_password, detect_country_from_ip
from auth_middleware import create_access_token, get_current_user_id
from rate_limit import rate_limit_auth, _limiter
from config import GOOGLE_CLIENT_IDS, APPLE_BUNDLE_ID

import re
import json
import logging
import httpx
import jwt as pyjwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

RESERVED_NAMES = {"admin", "root", "system", "duelo", "bot", "moderator", "mod", "support"}
PSEUDO_REGEX = re.compile(r'^[a-zA-Z0-9_\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]+$')

# Providers qui ignorent les points dans la partie locale (a.b@gmail.com == ab@gmail.com)
_DOT_INSENSITIVE_DOMAINS = {"gmail.com", "googlemail.com"}


def normalize_email(raw: str) -> str:
    """
    Canonicalise an email address to block +alias tricks and dot tricks.
    - Lowercase + strip
    - Remove +alias from local part  (user+foo@x.com → user@x.com)
    - Remove dots from local part for Gmail/Googlemail  (a.b@gmail.com → ab@gmail.com)
    """
    email = raw.lower().strip()
    if "@" not in email:
        return email
    local, domain = email.rsplit("@", 1)
    # Strip +alias
    local = local.split("+")[0]
    # Strip dots for dot-insensitive providers
    if domain in _DOT_INSENSITIVE_DOMAINS:
        local = local.replace(".", "")
    return f"{local}@{domain}"


def _validate_pseudo(pseudo: str):
    if len(pseudo) < 3 or len(pseudo) > 20:
        raise HTTPException(status_code=400, detail="Le pseudo doit contenir entre 3 et 20 caractères")
    if not PSEUDO_REGEX.match(pseudo):
        raise HTTPException(status_code=400, detail="Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores")
    if pseudo.lower() in RESERVED_NAMES:
        raise HTTPException(status_code=400, detail="Ce pseudo est réservé")


@router.post("/register-guest", response_model=UserResponse)
async def register_guest(data: GuestRegister, request: Request, db: AsyncSession = Depends(get_db), _rate=Depends(rate_limit_auth)):
    pseudo = data.pseudo.strip()
    _validate_pseudo(pseudo)

    result = await db.execute(select(User).where(User.pseudo == pseudo))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ce pseudo est déjà pris")

    country = await detect_country_from_ip(request)
    user = User(pseudo=pseudo, is_guest=True, country=country)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _user_response(user)


@router.post("/register", response_model=UserResponse)
async def register_email(data: EmailRegister, request: Request, db: AsyncSession = Depends(get_db), _rate=Depends(rate_limit_auth)):
    pseudo = data.pseudo.strip()
    _validate_pseudo(pseudo)

    result = await db.execute(select(User).where(User.pseudo == pseudo))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ce pseudo est déjà pris")

    normalized_email = normalize_email(data.email)
    # Block disposable/temporary email providers
    from routers.referral import _is_disposable_email
    if _is_disposable_email(normalized_email):
        raise HTTPException(status_code=400, detail="Les adresses email temporaires ne sont pas acceptées")
    result = await db.execute(select(User).where(User.email == normalized_email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")

    # #17 — Password complexity: ≥8 chars + at least one digit or special char
    import re as _re
    pw = data.password
    if len(pw) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères")
    if not _re.search(r'[0-9]', pw) and not _re.search(r'[^a-zA-Z0-9]', pw):
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins un chiffre ou un caractère spécial")

    user = User(
        pseudo=pseudo, email=normalized_email,
        password_hash=hash_password(data.password), is_guest=False
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Ce pseudo ou cet email est déjà utilisé")

    return _user_response(user)


@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db), _rate=Depends(rate_limit_auth)):
    # Per-IP lockout: 20 failed attempts per 15 min (brute-force across accounts)
    client_ip = request.client.host if request.client else "unknown"
    ip_key = f"login_fail_ip:{client_ip}"
    try:
        _limiter.check(ip_key, 20, 900)
    except HTTPException:
        raise HTTPException(status_code=429, detail="Trop de tentatives, réessayez dans 15 minutes")

    # Per-email lockout: 5 failed attempts per 15 min
    normalized_email = normalize_email(data.email)
    email_key = f"login_fail:{normalized_email}"
    try:
        _limiter.check(email_key, 5, 900)
    except HTTPException:
        raise HTTPException(status_code=429, detail="Trop de tentatives, réessayez dans 15 minutes")

    # Normalise email (strips +alias, dots for gmail)
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        # Record failed attempt against both buckets
        import time as _time
        _now = _time.time()
        _limiter.requests[email_key].append(_now)
        _limiter.requests[ip_key].append(_now)
        logger.warning(f"[login] Failed attempt for '{normalized_email}' from {client_ip}")
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    # Migrate legacy SHA256 hash to bcrypt on successful login
    if ':' in user.password_hash and len(user.password_hash.split(':')) == 2:
        user.password_hash = hash_password(data.password)
        await db.commit()

    return _user_response(user)


@router.delete("/delete-account")
async def delete_account(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """RGPD — permanently delete account and anonymise related data."""
    from sqlalchemy import delete as sql_delete, update as sql_update
    from models import (
        Match, WallPost, PostLike, PostComment, PlayerFollow,
        ChatMessage, Notification, NotificationSettings, UserThemeXP,
    )

    result = await db.execute(select(User).where(User.id == current_user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # Anonymise matches instead of deleting (preserve game history integrity)
    await db.execute(
        sql_update(Match)
        .where(Match.player1_id == current_user_id)
        .values(player1_id="deleted")
    )
    await db.execute(
        sql_update(Match)
        .where(Match.player2_id == current_user_id)
        .values(player2_id="deleted")
    )

    # Delete personal data
    for model, col in [
        (WallPost, WallPost.user_id), (PostLike, PostLike.user_id),
        (PostComment, PostComment.user_id), (PlayerFollow, PlayerFollow.follower_id),
        (PlayerFollow, PlayerFollow.followed_id), (ChatMessage, ChatMessage.sender_id),
        (ChatMessage, ChatMessage.receiver_id), (Notification, Notification.user_id),
        (NotificationSettings, NotificationSettings.user_id),
        (UserThemeXP, UserThemeXP.user_id),
    ]:
        await db.execute(sql_delete(model).where(col == current_user_id))

    await db.delete(user)
    await db.commit()
    return {"success": True, "message": "Compte supprimé définitivement"}


@router.get("/user/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    return _user_response(user)


@router.post("/check-pseudo")
async def check_pseudo(data: GuestRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.pseudo == data.pseudo.strip()))
    exists = result.scalar_one_or_none() is not None
    return {"available": not exists}


@router.post("/onboarding-done")
async def mark_onboarding_done(request: Request, current_user: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    user_id = body.get("user_id", "")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id requis")
    if user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    xp_bonus = 0
    if not user.onboarding_done:
        # Grant 50 XP welcome bonus (only once)
        user.onboarding_done = True
        user.total_xp = (user.total_xp or 0) + 50
        xp_bonus = 50
    else:
        user.onboarding_done = True
    await db.commit()
    return {"success": True, "xp_bonus": xp_bonus}


async def _verify_google_token(id_token: str) -> dict:
    """Verify a Google ID token via Google's tokeninfo endpoint."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Token Google invalide")
    data = resp.json()
    if GOOGLE_CLIENT_IDS and data.get("aud") not in GOOGLE_CLIENT_IDS:
        raise HTTPException(status_code=401, detail="Token Google: audience incorrecte")
    # #24 — Reject tokens with unverified email
    if data.get("email_verified") not in (True, "true"):
        raise HTTPException(status_code=401, detail="Email Google non vérifié")
    return data  # contains: sub, email, name, picture, …


async def _verify_apple_token(identity_token: str) -> dict:
    """Verify an Apple identityToken JWT using Apple's public JWKS."""
    if not APPLE_BUNDLE_ID:
        raise HTTPException(status_code=501, detail="Apple Sign In non configuré")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get("https://appleid.apple.com/auth/keys")
    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Impossible de récupérer les clés Apple")

    keys = resp.json().get("keys", [])
    try:
        header = pyjwt.get_unverified_header(identity_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Jeton Apple malformé")

    key_data = next((k for k in keys if k["kid"] == header.get("kid")), None)
    if not key_data:
        raise HTTPException(status_code=401, detail="Clé Apple introuvable")

    from jwt.algorithms import RSAAlgorithm
    public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))

    try:
        payload = pyjwt.decode(
            identity_token,
            public_key,
            algorithms=["RS256"],
            audience=APPLE_BUNDLE_ID,
            issuer="https://appleid.apple.com",
        )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Jeton Apple expiré")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Jeton Apple invalide : {e}")

    return payload  # contains: sub (stable apple user ID), email (may be nil after first login)


def _auto_pseudo(name: str | None, email: str | None) -> str:
    """Generate a pseudo from name or email prefix."""
    base = ""
    if name:
        base = name.split()[0]
    elif email:
        base = email.split("@")[0]
    base = re.sub(r"[^a-zA-Z0-9_]", "", base)[:15] or "Player"
    return base


async def _unique_pseudo(base: str, db: AsyncSession) -> str:
    """Return base pseudo, appending digits until unique."""
    candidate = base
    suffix = 1
    while True:
        result = await db.execute(select(User).where(User.pseudo == candidate))
        if not result.scalar_one_or_none():
            return candidate
        candidate = f"{base}{suffix}"
        suffix += 1


@router.post("/social", response_model=UserResponse)
async def social_login(
    data: SocialAuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _rate=Depends(rate_limit_auth),
):
    """Unified Google + Apple Sign-In endpoint."""
    if data.provider == "google":
        claims = await _verify_google_token(data.token)
        provider_id = claims["sub"]
        email = claims.get("email")
        name = claims.get("name") or data.full_name
        id_field = "google_id"
    elif data.provider == "apple":
        claims = await _verify_apple_token(data.token)
        provider_id = claims["sub"]
        email = data.email or claims.get("email")  # Apple only sends email on 1st login
        name = data.full_name
        id_field = "apple_id"
    else:
        raise HTTPException(status_code=400, detail="Provider inconnu")

    # 1. Existing user with this social ID?
    result = await db.execute(
        select(User).where(getattr(User, id_field) == provider_id)
    )
    user = result.scalar_one_or_none()
    if user:
        return _user_response(user)

    # 2. Existing account with same email → link
    if email:
        email = normalize_email(email)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            setattr(user, id_field, provider_id)
            user.is_guest = False
            await db.commit()
            await db.refresh(user)
            return _user_response(user)

    # 3. New user — create account
    if data.pseudo:
        pseudo = data.pseudo.strip()
        _validate_pseudo(pseudo)
        result = await db.execute(select(User).where(User.pseudo == pseudo))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Ce pseudo est déjà pris")
    else:
        base = _auto_pseudo(name, email)
        pseudo = await _unique_pseudo(base, db)

    country = await detect_country_from_ip(request)
    user = User(
        pseudo=pseudo,
        email=normalize_email(email) if email else None,
        is_guest=False,
        country=country,
        **{id_field: provider_id},
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _user_response(user)


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id, pseudo=user.pseudo, email=user.email,
        is_guest=user.is_guest, avatar_seed=user.avatar_seed,
        avatar_url=getattr(user, 'avatar_url', None),
        city=user.city, region=user.region, country=user.country,
        continent=user.continent, total_xp=user.total_xp,
        matches_played=user.matches_played, matches_won=user.matches_won,
        best_streak=user.best_streak, current_streak=user.current_streak,
        onboarding_done=getattr(user, 'onboarding_done', False),
        token=create_access_token(user.id),
    )

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from schemas import GuestRegister, EmailRegister, LoginRequest, UserResponse
from helpers import hash_password, verify_password, detect_country_from_ip

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register-guest", response_model=UserResponse)
async def register_guest(data: GuestRegister, request: Request, db: AsyncSession = Depends(get_db)):
    pseudo = data.pseudo.strip()
    if len(pseudo) < 3 or len(pseudo) > 20:
        raise HTTPException(status_code=400, detail="Le pseudo doit contenir entre 3 et 20 caractères")

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
async def register_email(data: EmailRegister, db: AsyncSession = Depends(get_db)):
    pseudo = data.pseudo.strip()
    if len(pseudo) < 3:
        raise HTTPException(status_code=400, detail="Pseudo trop court")

    result = await db.execute(select(User).where(User.pseudo == pseudo))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ce pseudo est déjà pris")

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")

    user = User(
        pseudo=pseudo, email=data.email,
        password_hash=hash_password(data.password), is_guest=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _user_response(user)


@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    # Migrate legacy SHA256 hash to bcrypt on successful login
    if ':' in user.password_hash and len(user.password_hash.split(':')) == 2:
        user.password_hash = hash_password(data.password)
        await db.commit()

    return _user_response(user)


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


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id, pseudo=user.pseudo, email=user.email,
        is_guest=user.is_guest, avatar_seed=user.avatar_seed,
        city=user.city, region=user.region, country=user.country,
        continent=user.continent, total_xp=user.total_xp,
        matches_played=user.matches_played, matches_won=user.matches_won,
        best_streak=user.best_streak, current_streak=user.current_streak,
    )

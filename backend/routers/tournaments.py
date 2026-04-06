"""
Tournoi weekend — Open Leaderboard.
Vendredi 18h → Dimanche 23h59 UTC.
Chaque joueur joue jusqu'à 3 parties sur le thème du tournoi.
Score = somme des 3 meilleures parties.
"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Tournament, TournamentEntry, User, Theme
from auth_middleware import get_current_user_id
from services.recommendations import get_trending_themes_scored

router = APIRouter(prefix="/tournaments", tags=["tournaments"])

MAX_GAMES = 3


def _next_friday_18h() -> datetime:
    now = datetime.now(timezone.utc)
    days_until_friday = (4 - now.weekday()) % 7  # 4 = Friday
    if days_until_friday == 0 and now.hour >= 18:
        days_until_friday = 7
    start = (now + timedelta(days=days_until_friday)).replace(hour=18, minute=0, second=0, microsecond=0)
    end = (start + timedelta(days=2, hours=5, minutes=59))  # Sunday 23:59
    return start, end


async def _get_or_create_current(db: AsyncSession) -> Tournament | None:
    now = datetime.now(timezone.utc)
    # Active tournament
    res = await db.execute(
        select(Tournament).where(
            Tournament.start_at <= now,
            Tournament.end_at >= now,
        ).limit(1)
    )
    t = res.scalar_one_or_none()
    if t:
        return t

    # Auto-create if we're in the Friday-Sunday window
    weekday = now.weekday()
    in_window = (
        (weekday == 4 and now.hour >= 18) or  # Friday 18h+
        (weekday == 5) or                      # Saturday
        (weekday == 6 and now.hour <= 23)      # Sunday
    )
    if not in_window:
        return None

    # Pick theme: most trending
    scored = await get_trending_themes_scored(db, user_id=None, limit=1, days=7)
    if not scored:
        return None
    theme = scored[0]["theme"]

    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if weekday == 4:
        start = start.replace(hour=18)
    end = start
    # End: Sunday 23:59
    days_to_sunday = (6 - weekday) % 7
    end = (now + timedelta(days=days_to_sunday)).replace(hour=23, minute=59, second=59, microsecond=0)

    t = Tournament(
        id=str(uuid.uuid4()),
        theme_id=theme.id,
        theme_name=theme.name,
        start_at=start,
        end_at=end,
        status="active",
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


@router.get("/current")
async def get_current_tournament(
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    t = await _get_or_create_current(db)
    if not t:
        return {"active": False}

    # User entry
    entry_res = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.tournament_id == t.id,
            TournamentEntry.user_id == current_user,
        )
    )
    entry = entry_res.scalar_one_or_none()

    # User rank
    rank = None
    if entry:
        above_res = await db.execute(
            select(func.count(TournamentEntry.id)).where(
                TournamentEntry.tournament_id == t.id,
                TournamentEntry.score > entry.score,
            )
        )
        rank = (above_res.scalar() or 0) + 1

    total_res = await db.execute(
        select(func.count(TournamentEntry.id)).where(TournamentEntry.tournament_id == t.id)
    )
    total_players = total_res.scalar() or 0

    return {
        "active": True,
        "id": t.id,
        "theme_id": t.theme_id,
        "theme_name": t.theme_name,
        "end_at": t.end_at.isoformat(),
        "games_played": entry.games_played if entry else 0,
        "score": entry.score if entry else 0,
        "games_remaining": MAX_GAMES - (entry.games_played if entry else 0),
        "rank": rank,
        "total_players": total_players,
        "max_games": MAX_GAMES,
    }


@router.post("/{tournament_id}/submit")
async def submit_tournament_score(
    tournament_id: str,
    data: dict,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Called by game.py after a match on the tournament theme."""
    score = max(0, int(data.get("score", 0)))

    t_res = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    t = t_res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tournoi introuvable")

    now = datetime.now(timezone.utc)
    if not (t.start_at <= now <= t.end_at):
        raise HTTPException(status_code=400, detail="Tournoi non actif")

    entry_res = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.user_id == current_user,
        )
    )
    entry = entry_res.scalar_one_or_none()

    if entry and entry.games_played >= MAX_GAMES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_GAMES} parties par tournoi atteint")

    if entry:
        entry.score += score
        entry.games_played += 1
    else:
        entry = TournamentEntry(
            id=str(uuid.uuid4()),
            tournament_id=tournament_id,
            user_id=current_user,
            score=score,
            games_played=1,
        )
        db.add(entry)

    await db.commit()

    # Rank
    above_res = await db.execute(
        select(func.count(TournamentEntry.id)).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.score > entry.score,
        )
    )
    rank = (above_res.scalar() or 0) + 1
    return {"score": entry.score, "games_played": entry.games_played, "rank": rank}


@router.get("/{tournament_id}/leaderboard")
async def tournament_leaderboard(
    tournament_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    entries_res = await db.execute(
        select(TournamentEntry).where(TournamentEntry.tournament_id == tournament_id)
        .order_by(TournamentEntry.score.desc()).limit(limit)
    )
    entries = entries_res.scalars().all()
    result = []
    for rank, e in enumerate(entries, 1):
        u_res = await db.execute(select(User).where(User.id == e.user_id))
        u = u_res.scalar_one_or_none()
        result.append({
            "rank": rank,
            "user_id": e.user_id,
            "pseudo": u.pseudo if u else "?",
            "avatar_seed": u.avatar_seed if u else "",
            "avatar_url": getattr(u, "avatar_url", None) if u else None,
            "score": e.score,
            "games_played": e.games_played,
        })
    return {"leaderboard": result}

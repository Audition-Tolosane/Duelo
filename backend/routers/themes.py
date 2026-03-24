from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Question, Theme, UserThemeXP, Match, ThemeFollow
from constants import SUPER_CATEGORY_META, CLUSTER_ICONS
from services.xp import (
    get_level, get_xp_progress, get_theme_title, get_theme_unlocked_titles,
)
from services.geo import haversine, CITY_MIN_PLAYERS
from auth_middleware import get_optional_user_id

router = APIRouter(tags=["themes"])


@router.get("/themes/trending")
async def get_trending_themes(db: AsyncSession = Depends(get_db)):
    """Return top 6 most played themes in the last 7 days."""
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    result = await db.execute(
        select(Match.category, func.count(Match.id).label("match_count"))
        .where(Match.created_at >= cutoff)
        .group_by(Match.category)
        .order_by(func.count(Match.id).desc())
        .limit(6)
    )
    rows = result.all()

    trending = []
    for cat_id, count in rows:
        theme_res = await db.execute(select(Theme).where(Theme.id == cat_id))
        theme = theme_res.scalar_one_or_none()
        if theme:
            trending.append({
                "id": theme.id,
                "name": theme.name,
                "color_hex": theme.color_hex or "#8A2BE2",
                "description": theme.description or "",
                "match_count": count,
                "icon_url": theme.icon_url or "",
            })

    # If fewer than 6, fill with random themes
    if len(trending) < 6:
        existing_ids = [t["id"] for t in trending]
        filler_res = await db.execute(
            select(Theme).where(Theme.id.notin_(existing_ids)).order_by(func.random()).limit(6 - len(trending))
        )
        for theme in filler_res.scalars().all():
            trending.append({
                "id": theme.id,
                "name": theme.name,
                "color_hex": theme.color_hex or "#8A2BE2",
                "description": theme.description or "",
                "match_count": 0,
                "icon_url": theme.icon_url or "",
            })

    return {"trending": trending}


@router.get("/themes/explore")
async def themes_explore(user_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Return pillar structure from Theme table."""
    result = await db.execute(select(Theme).order_by(Theme.super_category, Theme.cluster, Theme.name))
    all_themes = result.scalars().all()

    if not all_themes:
        return {"pillars": []}

    user_xp_map = {}
    if user_id:
        xp_res = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == user_id))
        for uxp in xp_res.scalars().all():
            user_xp_map[uxp.theme_id] = uxp.xp

    sc_map = {}
    for t in all_themes:
        if t.super_category not in sc_map:
            sc_map[t.super_category] = {}
        if t.cluster not in sc_map[t.super_category]:
            sc_map[t.super_category][t.cluster] = []
        sc_map[t.super_category][t.cluster].append(t)

    pillars = []
    for sc_name, clusters in sc_map.items():
        meta = SUPER_CATEGORY_META.get(sc_name, {"icon": "❓", "color": "#8A2BE2", "label": sc_name})

        cluster_themes = []
        for cluster_name, theme_list in clusters.items():
            cluster_icon = CLUSTER_ICONS.get(cluster_name, "📁")
            total_q = sum(t.question_count or 0 for t in theme_list)
            cluster_xp = sum(user_xp_map.get(t.id, 0) for t in theme_list)
            cluster_level = get_level(cluster_xp)

            topics = []
            for t in theme_list:
                t_xp = user_xp_map.get(t.id, 0)
                t_level = get_level(t_xp)
                topics.append({
                    "id": t.id, "name": t.name,
                    "icon": t.name[0].upper() if t.name else "?",
                    "icon_url": t.icon_url or "", "category_id": t.id,
                    "level": t_level, "description": t.description or "",
                })

            cluster_themes.append({
                "id": f"cluster_{sc_name}_{cluster_name}".replace(" ", "_"),
                "name": cluster_name, "icon": cluster_icon, "playable": True,
                "level": cluster_level, "xp": cluster_xp,
                "title": "", "title_lvl50": "",
                "xp_progress": get_xp_progress(cluster_xp, cluster_level),
                "total_questions": total_q, "topics": topics,
            })

        pillars.append({
            "id": sc_name.lower(), "name": meta["label"].upper(),
            "label": ", ".join(clusters.keys()),
            "color": meta["color"], "icon": meta["icon"], "themes": cluster_themes,
        })

    return {"pillars": pillars}


@router.get("/explore/super-categories")
async def get_super_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Theme.super_category, Theme.cluster, func.count(Theme.id).label("theme_count"))
        .group_by(Theme.super_category, Theme.cluster)
        .order_by(Theme.super_category, Theme.cluster)
    )
    rows = result.all()

    super_cats = {}
    for sc, cluster, count in rows:
        if sc not in super_cats:
            meta = SUPER_CATEGORY_META.get(sc, {"icon": "❓", "color": "#8A2BE2", "label": sc})
            super_cats[sc] = {
                "id": sc, "label": meta["label"], "icon": meta["icon"],
                "color": meta["color"], "clusters": [], "total_themes": 0,
            }
        cluster_icon = CLUSTER_ICONS.get(cluster, "📁")
        super_cats[sc]["clusters"].append({"name": cluster, "icon": cluster_icon, "theme_count": count})
        super_cats[sc]["total_themes"] += count

    return list(super_cats.values())


@router.get("/explore/{super_category}/clusters")
async def get_clusters(super_category: str, user_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Theme).where(Theme.super_category == super_category.upper())
        .order_by(Theme.cluster, Theme.name)
    )
    themes = result.scalars().all()

    if not themes:
        raise HTTPException(status_code=404, detail="Super catégorie introuvable")

    user_xp_map = {}
    if user_id:
        xp_result = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == user_id))
        for uxp in xp_result.scalars().all():
            user_xp_map[uxp.theme_id] = uxp.xp

    clusters = {}
    for t in themes:
        if t.cluster not in clusters:
            clusters[t.cluster] = {
                "name": t.cluster, "icon": CLUSTER_ICONS.get(t.cluster, "📁"), "themes": [],
            }

        theme_xp = user_xp_map.get(t.id, 0)
        theme_level = get_level(theme_xp)

        clusters[t.cluster]["themes"].append({
            "id": t.id, "name": t.name, "description": t.description or "",
            "icon_url": t.icon_url or "", "color_hex": t.color_hex or "#8A2BE2",
            "question_count": t.question_count or 0, "user_level": theme_level,
            "user_title": get_theme_title(t, theme_level) if theme_level > 0 else "",
        })

    meta = SUPER_CATEGORY_META.get(super_category.upper(), {"icon": "❓", "color": "#8A2BE2", "label": super_category})
    return {
        "super_category": super_category.upper(),
        "label": meta["label"], "icon": meta["icon"], "color": meta["color"],
        "clusters": list(clusters.values()),
    }


@router.get("/theme/{theme_id}/detail")
async def get_theme_detail(theme_id: str, user_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Thème introuvable")

    user_xp = 0
    user_level = 0
    user_title = ""
    is_following = False
    followers_count = 0

    # Count followers
    fc_res = await db.execute(select(func.count(ThemeFollow.id)).where(ThemeFollow.theme_id == theme_id))
    followers_count = fc_res.scalar() or 0

    if user_id:
        xp_result = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == user_id, UserThemeXP.theme_id == theme_id)
        )
        uxp = xp_result.scalar_one_or_none()
        if uxp:
            user_xp = uxp.xp
            user_level = get_level(user_xp)
            user_title = get_theme_title(theme, user_level)

        follow_res = await db.execute(
            select(ThemeFollow).where(ThemeFollow.user_id == user_id, ThemeFollow.theme_id == theme_id)
        )
        is_following = follow_res.scalar_one_or_none() is not None

    xp_progress = get_xp_progress(user_xp, user_level)
    unlocked_titles = get_theme_unlocked_titles(theme, user_level)

    return {
        "id": theme.id, "name": theme.name, "description": theme.description or "",
        "super_category": theme.super_category, "cluster": theme.cluster,
        "color_hex": theme.color_hex or "#8A2BE2", "icon_url": theme.icon_url or "",
        "question_count": theme.question_count or 0,
        "followers_count": followers_count,
        "user_level": user_level, "user_title": user_title, "user_xp": user_xp,
        "xp_progress": xp_progress, "is_following": is_following,
        "unlocked_titles": unlocked_titles,
        "all_titles": {
            1: theme.title_lv1 or "", 10: theme.title_lv10 or "",
            20: theme.title_lv20 or "", 35: theme.title_lv35 or "",
            50: theme.title_lv50 or "",
        },
    }


@router.post("/theme/{theme_id}/follow")
async def toggle_theme_follow(
    theme_id: str,
    request: Request,
    current_user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    body = await request.json()
    user_id = body.get("user_id") or current_user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Non authentifié")

    existing = await db.execute(
        select(ThemeFollow).where(ThemeFollow.user_id == user_id, ThemeFollow.theme_id == theme_id)
    )
    follow = existing.scalar_one_or_none()

    if follow:
        await db.delete(follow)
        await db.commit()
        return {"following": False}
    else:
        db.add(ThemeFollow(user_id=user_id, theme_id=theme_id))
        await db.commit()
        return {"following": True}


@router.get("/theme/{theme_id}/leaderboard")
async def theme_leaderboard(
    theme_id: str,
    scope: str = "world",
    city_override: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 100)

    # Fetch current user for location filtering
    current_user = None
    if user_id and scope != "world":
        res = await db.execute(select(User).where(User.id == user_id))
        current_user = res.scalar_one_or_none()

    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()

    async def _fetch_entries(user_ids_filter=None, city_filter=None, country_filter=None,
                              continent_filter=None, region_filter=None):
        """Fetch theme XP entries with optional user location filter."""
        uxp_q = (
            select(UserThemeXP)
            .where(UserThemeXP.theme_id == theme_id, UserThemeXP.xp > 0)
        )
        if user_ids_filter is not None:
            uxp_q = uxp_q.where(UserThemeXP.user_id.in_(user_ids_filter))

        uxp_q = uxp_q.order_by(UserThemeXP.xp.desc()).limit(limit).offset(offset)
        result = await db.execute(uxp_q)
        entries_xp = result.scalars().all()
        if not entries_xp:
            return []

        all_user_ids = [e.user_id for e in entries_xp]
        u_q = select(User).where(User.id.in_(all_user_ids))
        if city_filter:
            u_q = u_q.where(User.city == city_filter)
        if country_filter:
            u_q = u_q.where(User.country == country_filter)
        if continent_filter:
            u_q = u_q.where(User.continent == continent_filter)
        if region_filter:
            u_q = u_q.where(User.region == region_filter)
        users_res = await db.execute(u_q)
        users_map = {u.id: u for u in users_res.scalars().all()}

        out = []
        rank = offset + 1
        for uxp in entries_xp:
            user = users_map.get(uxp.user_id)
            if not user:
                continue
            lvl = get_level(uxp.xp)
            out.append({
                "id": user.id, "rank": rank, "pseudo": user.pseudo,
                "avatar_seed": user.avatar_seed, "avatar_url": user.avatar_url,
                "level": lvl, "title": get_theme_title(theme, lvl) if theme else "",
                "xp": uxp.xp, "total_xp": uxp.xp,
            })
            rank += 1
        return out

    # ── World ──────────────────────────────────────────────────────────────────
    if scope == "world":
        entries = await _fetch_entries()
        return {"entries": entries, "meta": {"scope_used": "world"}}

    # ── Continent ──────────────────────────────────────────────────────────────
    if scope == "continent":
        if not current_user or not current_user.continent:
            return {"entries": [], "meta": {"scope_used": "continent", "missing": True}}
        entries = await _fetch_entries(continent_filter=current_user.continent)
        return {"entries": entries, "meta": {"scope_used": "continent"}}

    # ── Region ─────────────────────────────────────────────────────────────────
    if scope == "region":
        if not current_user or not current_user.region:
            return {"entries": [], "meta": {"scope_used": "region", "missing": True}}
        entries = await _fetch_entries(
            region_filter=current_user.region,
            country_filter=current_user.country,
        )
        return {"entries": entries, "meta": {"scope_used": "region"}}

    # ── Country ────────────────────────────────────────────────────────────────
    if scope == "country":
        if not current_user or not current_user.country:
            return {"entries": [], "meta": {"scope_used": "country", "missing": True}}
        entries = await _fetch_entries(country_filter=current_user.country)
        return {"entries": entries, "meta": {"scope_used": "country"}}

    # ── City ───────────────────────────────────────────────────────────────────
    if scope == "city":
        if not current_user or not current_user.city:
            return {"entries": [], "meta": {"scope_used": "city", "missing": True}}

        target_city = city_override or current_user.city
        city_entries = await _fetch_entries(
            city_filter=target_city,
            country_filter=current_user.country,
        )

        if len(city_entries) >= CITY_MIN_PLAYERS or city_override:
            return {"entries": city_entries, "meta": {"scope_used": "city", "city_name": target_city}}

        # Not enough → find nearby cities with 10+ theme players
        suggestions = []
        if current_user.lat and current_user.lng:
            cities_q = (
                select(
                    User.city,
                    func.count(UserThemeXP.user_id).label("player_count"),
                    func.avg(User.lat).label("avg_lat"),
                    func.avg(User.lng).label("avg_lng"),
                )
                .join(UserThemeXP, UserThemeXP.user_id == User.id)
                .where(
                    UserThemeXP.theme_id == theme_id,
                    UserThemeXP.xp > 0,
                    User.country == current_user.country,
                    User.city.isnot(None),
                    User.city != target_city,
                    User.lat.isnot(None),
                )
                .group_by(User.city)
                .having(func.count(UserThemeXP.user_id) >= CITY_MIN_PLAYERS)
            )
            cities_result = await db.execute(cities_q)
            with_distance = [
                {
                    "city": row.city,
                    "player_count": row.player_count,
                    "distance_km": round(haversine(
                        current_user.lat, current_user.lng,
                        row.avg_lat, row.avg_lng,
                    )),
                }
                for row in cities_result.all()
                if row.avg_lat and row.avg_lng
            ]
            suggestions = sorted(with_distance, key=lambda x: x["distance_km"])[:5]

        if suggestions:
            return {
                "entries": [],
                "meta": {
                    "scope_used": "city", "city_name": target_city,
                    "too_small": True, "city_player_count": len(city_entries),
                    "suggestions": suggestions,
                },
            }

        # Fallback to country
        fallback_entries = await _fetch_entries(country_filter=current_user.country)
        return {
            "entries": fallback_entries,
            "meta": {
                "scope_used": "country", "city_name": target_city,
                "country_name": current_user.country,
                "too_small": True, "city_player_count": len(city_entries),
                "fallback": True,
            },
        }

    entries = await _fetch_entries()
    return {"entries": entries, "meta": {"scope_used": scope}}

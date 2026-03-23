from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Question, Theme, UserThemeXP, Match
from constants import SUPER_CATEGORY_META, CLUSTER_ICONS
from services.xp import (
    get_level, get_xp_progress, get_theme_title, get_theme_unlocked_titles,
)

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

    if user_id:
        xp_result = await db.execute(
            select(UserThemeXP).where(UserThemeXP.user_id == user_id, UserThemeXP.theme_id == theme_id)
        )
        uxp = xp_result.scalar_one_or_none()
        if uxp:
            user_xp = uxp.xp
            user_level = get_level(user_xp)
            user_title = get_theme_title(theme, user_level)

    followers_count = 0

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


@router.get("/theme/{theme_id}/leaderboard")
async def theme_leaderboard(theme_id: str, limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    limit = min(limit, 100)
    result = await db.execute(
        select(UserThemeXP).where(UserThemeXP.theme_id == theme_id, UserThemeXP.xp > 0)
        .order_by(UserThemeXP.xp.desc()).limit(limit).offset(offset)
    )
    entries_xp = result.scalars().all()

    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()

    if not entries_xp:
        return []

    # Batch fetch all users for leaderboard entries
    user_ids = [entry.user_id for entry in entries_xp]
    users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_res.scalars().all()}

    entries = []
    for i, uxp in enumerate(entries_xp):
        user = users_map.get(uxp.user_id)
        if not user:
            continue
        lvl = get_level(uxp.xp)
        entries.append({
            "id": user.id, "rank": offset + i + 1, "pseudo": user.pseudo,
            "avatar_seed": user.avatar_seed, "level": lvl,
            "title": get_theme_title(theme, lvl) if theme else "", "xp": uxp.xp,
        })
    return entries

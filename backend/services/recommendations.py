"""
Logique de recommandation partagée entre search, themes et boosts.
Score = (matches_Nj + 1) × affinité
Affinité : 3.0 si même cluster, 1.8 si même super-catégorie, 1.0 sinon.
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

CLUSTER_EMOJI: dict[str, str] = {
    "Séries TV": "📺",
    "Cinéma": "🎬",
    "Sport": "⚽",
    "Géographie": "🌍",
    "Histoire": "🏛️",
    "Sciences": "🔬",
    "Musique": "🎵",
    "Jeux Vidéo": "🎮",
    "Gastronomie": "🍽️",
    "Culture générale": "📚",
    "Politique": "🏛️",
    "Technologie": "💻",
    "Nature": "🌿",
    "Art": "🎨",
    "Littérature": "📖",
    "Animés": "🎌",
    "Mangas": "🎌",
}


async def get_user_preferences(user_id: str, db: AsyncSession) -> tuple[set, set]:
    """Retourne (clusters_préférés, super_catégories_préférées) triés par XP."""
    from models import UserThemeXP, Theme

    res = await db.execute(
        select(Theme.cluster, Theme.super_category)
        .join(UserThemeXP, UserThemeXP.theme_id == Theme.id)
        .where(UserThemeXP.user_id == user_id)
        .group_by(Theme.cluster, Theme.super_category)
        .order_by(func.sum(UserThemeXP.xp).desc())
        .limit(5)
    )
    rows = res.all()
    return {r.cluster for r in rows}, {r.super_category for r in rows}


async def get_trending_themes_scored(
    db: AsyncSession,
    user_id: str | None = None,
    limit: int = 10,
    days: int = 7,
    exclude_ids: set | None = None,
) -> list[dict]:
    """
    Retourne une liste de thèmes triés par score.
    Chaque dict : {theme, score, match_count, affinity_label}
    """
    from models import Theme, Match

    exclude_ids = exclude_ids or set()

    # 1. Tendances : count de matches sur les N derniers jours
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    trend_res = await db.execute(
        select(Match.category, func.count(Match.id).label("cnt"))
        .where(Match.created_at >= cutoff)
        .group_by(Match.category)
        .order_by(func.count(Match.id).desc())
        .limit(200)
    )
    trending_map: dict[str, int] = {r.category: r.cnt for r in trend_res}

    # 2. Préférences joueur (optionnel)
    fav_clusters: set = set()
    fav_super_cats: set = set()
    if user_id:
        fav_clusters, fav_super_cats = await get_user_preferences(user_id, db)

    # 3. Candidats (tous les thèmes sauf exclus)
    q = select(Theme).where(Theme.question_count > 0)
    if exclude_ids:
        q = q.where(~Theme.id.in_(exclude_ids))
    cand_res = await db.execute(q.limit(300))
    candidates = cand_res.scalars().all()

    # 4. Calcul du score
    scored = []
    for t in candidates:
        match_count = trending_map.get(t.id, 0)
        if fav_clusters and t.cluster in fav_clusters:
            affinity = 3.0
            affinity_label = "cluster"
        elif fav_super_cats and t.super_category in fav_super_cats:
            affinity = 1.8
            affinity_label = "super_cat"
        else:
            affinity = 1.0
            affinity_label = "global"
        scored.append({
            "theme": t,
            "score": (match_count + 1) * affinity,
            "match_count": match_count,
            "affinity_label": affinity_label,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def theme_to_tag(entry: dict, rank: int) -> dict:
    """Convertit un résultat scoré en tag pour l'affichage search."""
    t = entry["theme"]
    icon = CLUSTER_EMOJI.get(t.cluster or "", "⚡")
    tag_type = "hot" if rank < 3 else "trend"
    return {
        "tag": t.name,
        "icon": icon,
        "type": tag_type,
        "theme_id": t.id,
        "match_count": entry["match_count"],
        "affinity_label": entry["affinity_label"],
    }

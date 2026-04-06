from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Question, Match, Theme, UserThemeXP, WallPost, PostLike, PostComment
from constants import DIFFICULTY_LEVELS, COUNTRY_FLAGS
from services.xp import get_level, get_theme_title, get_theme_unlocked_titles, get_xp_progress

router = APIRouter(prefix="/search", tags=["search"])

# Common aliases: abbreviation → list of words that must appear in the name
SEARCH_ALIASES: dict[str, list[str]] = {
    # Séries TV
    "got": ["game", "thrones"],
    "tlou": ["last", "us"],
    "bb": ["breaking", "bad"],
    "bcs": ["better", "call", "saul"],
    "himym": ["how", "met", "mother"],
    "satc": ["sex", "city"],
    "twd": ["walking", "dead"],
    "aot": ["attack", "titan"],
    "mha": ["hero", "academia"],
    "fma": ["fullmetal", "alchemist"],
    "fmab": ["fullmetal", "alchemist"],
    "hxh": ["hunter"],
    "jjk": ["jujutsu"],
    "s&tc": ["sex", "city"],
    "b99": ["brooklyn"],
    # Cinéma
    "hp": ["harry", "potter"],
    "hpot": ["harry", "potter"],
    "sw": ["star", "wars"],
    "lotr": ["seigneur", "anneaux"],
    "ldr": ["seigneur", "anneaux"],
    "potc": ["pirates", "caribbean"],
    "mib": ["men", "black"],
    "f&f": ["fast", "furious"],
    "fnf": ["fast", "furious"],
    "topg": ["top", "gun"],
    "2001": ["odyssée"],
    # Jeux vidéo
    "ac": ["assassin"],
    "ac ": ["assassin"],
    "bg3": ["baldur"],
    "bg": ["baldur"],
    "gta": ["grand", "theft"],
    "gtav": ["grand", "theft"],
    "rdr": ["red", "dead"],
    "rdr2": ["red", "dead"],
    "rdrd": ["red", "dead"],
    "re": ["resident", "evil"],
    "ds": ["dark", "souls"],
    "er": ["elden", "ring"],
    "mgs": ["metal", "gear"],
    "cod": ["call", "duty"],
    "botw": ["zelda"],
    "totk": ["zelda"],
    "zelda": ["zelda"],
    "wow": ["warcraft"],
    "mc": ["minecraft"],
    "lol": ["league", "legends"],
    "csgo": ["counter"],
    "cs2": ["counter"],
    "among": ["among"],
    "pkmn": ["pokemon"],
    "pk": ["pokemon"],
    # Littérature / BD
    "1984": ["orwell"],
    "hg": ["hunger", "games"],
    "hs": ["hunger", "games"],
    "sherlock": ["holmes"],
    "poirot": ["christie"],
    "jrr": ["tolkien"],
    "rr": ["tolkien"],
    "asm": ["spider"],
    "spidey": ["spider"],
    "bats": ["batman"],
    "supes": ["superman"],
    # Musique
    "mj": ["jackson"],
    "acdc": ["ac/dc"],
    "rhcp": ["chili"],
    "zep": ["zeppelin"],
    "led": ["zeppelin"],
    "pf": ["pink", "floyd"],
    "floyd": ["pink", "floyd"],
    "taylor": ["swift"],
    "ts": ["swift"],
}

# Stop words to ignore when splitting query into words
_STOP = {"de", "du", "des", "le", "la", "les", "l", "d", "et", "en",
         "the", "of", "a", "an", "and", "in", "to"}


def _acronym(name: str) -> str:
    """Return lowercase acronym of significant words in name."""
    words = [w for w in name.lower().split() if w not in _STOP and w.isalpha()]
    return "".join(w[0] for w in words if w)


def _theme_score(query: str, theme_name: str, cluster: str, super_cat: str, description: str) -> int:
    name_l = theme_name.lower()
    cluster_l = (cluster or "").lower()
    super_l = (super_cat or "").lower()
    desc_l = (description or "").lower()
    score = 0

    # 1. Exact substring matches (original logic)
    if query in name_l:
        score += 100
    if query in cluster_l:
        score += 50
    if query in super_l:
        score += 30
    if query in desc_l:
        score += 20

    # 2. Acronym match: "got" matches "Game Of Thrones"
    if _acronym(theme_name) == query:
        score += 90

    # 3. Alias match
    alias_words = SEARCH_ALIASES.get(query)
    if alias_words:
        if all(w in name_l or w in desc_l or w in cluster_l for w in alias_words):
            score += 85

    # 4. All query words appear individually in the name/description
    words = [w for w in query.split() if w not in _STOP and len(w) >= 2]
    if words and all(w in name_l or w in desc_l for w in words):
        score += 60

    # 5. Any significant query word appears in name (partial relevance)
    if not score and words:
        matched = sum(1 for w in words if w in name_l or w in cluster_l)
        if matched:
            score += 15 * matched

    return score


@router.get("/themes")
async def search_themes(
    q: Optional[str] = None, difficulty: Optional[str] = None,
    user_id: Optional[str] = None, limit: int = 20, offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    limit = min(limit, 100)
    query_lower = (q or "").strip().lower()

    # Get all themes from DB
    themes_res = await db.execute(select(Theme).order_by(Theme.super_category, Theme.name))
    all_themes = themes_res.scalars().all()

    # Get user's theme XPs if logged in
    user_xps = {}
    if user_id:
        xp_res = await db.execute(select(UserThemeXP).where(UserThemeXP.user_id == user_id))
        user_xps = {uxp.theme_id: uxp.xp for uxp in xp_res.scalars().all()}

    results = []
    for theme in all_themes:
        if query_lower:
            score = _theme_score(
                query_lower, theme.name,
                theme.cluster or "", theme.super_category or "", theme.description or ""
            )
        else:
            score = 50

        if score == 0 and query_lower:
            continue

        user_xp = user_xps.get(theme.id, 0)
        user_level = get_level(user_xp)
        user_title = get_theme_title(theme, user_level)

        if difficulty and difficulty in DIFFICULTY_LEVELS:
            d = DIFFICULTY_LEVELS[difficulty]
            if user_level < d["min"] or user_level > d["max"]:
                continue

        difficulty_label = "Nouveau"
        for d_key, d_val in DIFFICULTY_LEVELS.items():
            if d_val["min"] <= user_level <= d_val["max"]:
                difficulty_label = d_val["label"]
                break

        results.append({
            "id": theme.id, "name": theme.name,
            "description": theme.description or "",
            "total_questions": theme.question_count or 0,
            "color_hex": theme.color_hex or "#8A2BE2",
            "cluster": theme.cluster or "",
            "super_category": theme.super_category or "",
            "user_level": user_level, "user_title": user_title,
            "difficulty_label": difficulty_label, "relevance_score": score,
        })

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[offset:offset + limit]


@router.get("/players")
async def search_players_enhanced(
    q: Optional[str] = None, title: Optional[str] = None,
    country: Optional[str] = None, min_level: Optional[int] = None,
    limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)
):
    limit = min(limit, 100)
    query = select(User).where(User.is_bot == False)

    if q and q.strip():
        search_term = q.strip()
        if len(search_term) < 2:
            # Require at least 2 chars to avoid full-table scans
            return []
        if search_term.startswith("@"):
            query = query.where(User.pseudo == search_term[1:])
        else:
            # Prefix search (can use index) + suffix fallback for UX
            query = query.where(
                User.pseudo.ilike(f"{search_term}%") | User.pseudo.ilike(f"%{search_term}%")
            )

    if country and country.strip():
        query = query.where(User.country.ilike(f"%{country.strip()}%"))

    query = query.order_by(User.total_xp.desc())

    result = await db.execute(query.limit(limit).offset(offset))
    users = result.scalars().all()

    if not users:
        return []

    player_ids = [u.id for u in users]

    # Batch fetch all theme XP for these players
    theme_xp_res = await db.execute(
        select(UserThemeXP).where(UserThemeXP.user_id.in_(player_ids))
    )
    all_theme_xp = theme_xp_res.scalars().all()

    # Group by user
    user_themes = defaultdict(list)
    for txp in all_theme_xp:
        user_themes[txp.user_id].append(txp)

    # Batch fetch all referenced themes
    all_theme_ids = list(set(txp.theme_id for txp in all_theme_xp))
    themes_map = {}
    if all_theme_ids:
        themes_res = await db.execute(select(Theme).where(Theme.id.in_(all_theme_ids)))
        themes_map = {t.id: t for t in themes_res.scalars().all()}

    players = []
    for u in users:
        # Find best theme XP for this user
        user_txps = user_themes.get(u.id, [])
        best_uxp = max(user_txps, key=lambda x: x.xp) if user_txps else None
        best_level = get_level(best_uxp.xp) if best_uxp else 0
        best_title = ""
        if best_uxp:
            best_theme = themes_map.get(best_uxp.theme_id)
            if best_theme:
                best_title = get_theme_title(best_theme, best_level)

        player_title = u.selected_title or best_title or "Novice"

        if title and title.strip():
            title_lower = title.strip().lower()
            if title_lower not in player_title.lower():
                continue

        if min_level and min_level > 0 and best_level < min_level:
            continue

        players.append({
            "id": u.id, "pseudo": u.pseudo, "avatar_seed": u.avatar_seed,
            "avatar_url": getattr(u, 'avatar_url', None),
            "country": u.country, "country_flag": COUNTRY_FLAGS.get(u.country or "", ""),
            "total_xp": u.total_xp, "matches_played": u.matches_played,
            "selected_title": player_title, "best_level": best_level,
        })

    return players


@router.get("/content")
async def search_content(
    q: str, category: Optional[str] = None,
    user_id: Optional[str] = None, limit: int = 20, offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    limit = min(limit, 100)
    if not q or not q.strip():
        return {"posts": [], "comments": []}

    search_term = q.strip()

    post_query = select(WallPost).where(WallPost.content.ilike(f"%{search_term}%"))
    if category:
        post_query = post_query.where(WallPost.category_id == category)
    post_query = post_query.order_by(WallPost.created_at.desc()).limit(limit).offset(offset)
    post_result = await db.execute(post_query)
    posts = post_result.scalars().all()

    post_data = []
    if posts:
        post_ids = [p.id for p in posts]
        post_user_ids = list({p.user_id for p in posts})
        post_cat_ids = list({p.category_id for p in posts})

        post_authors_res = await db.execute(select(User).where(User.id.in_(post_user_ids)))
        post_authors_map = {u.id: u for u in post_authors_res.scalars().all()}

        likes_res = await db.execute(
            select(PostLike.post_id, func.count(PostLike.id))
            .where(PostLike.post_id.in_(post_ids))
            .group_by(PostLike.post_id)
        )
        likes_map = dict(likes_res.all())

        comments_cnt_res = await db.execute(
            select(PostComment.post_id, func.count(PostComment.id))
            .where(PostComment.post_id.in_(post_ids))
            .group_by(PostComment.post_id)
        )
        comments_map = dict(comments_cnt_res.all())

        liked_set: set = set()
        if user_id:
            liked_res = await db.execute(
                select(PostLike.post_id).where(PostLike.user_id == user_id, PostLike.post_id.in_(post_ids))
            )
            liked_set = {row[0] for row in liked_res.all()}

        post_themes_res = await db.execute(select(Theme).where(Theme.id.in_(post_cat_ids)))
        post_themes_map = {t.id: t for t in post_themes_res.scalars().all()}

        for p in posts:
            author = post_authors_map.get(p.user_id)
            theme = post_themes_map.get(p.category_id)
            post_data.append({
                "id": p.id, "category_id": p.category_id,
                "category_name": theme.name if theme else p.category_id,
                "user": {
                    "id": author.id if author else "", "pseudo": author.pseudo if author else "Inconnu",
                    "avatar_seed": author.avatar_seed if author else "",
                    "avatar_url": getattr(author, 'avatar_url', None) if author else None,
                },
                "content": p.content, "has_image": bool(p.image_base64),
                "likes_count": likes_map.get(p.id, 0), "comments_count": comments_map.get(p.id, 0),
                "is_liked": p.id in liked_set, "created_at": p.created_at.isoformat(),
            })

    comment_query = select(PostComment).where(PostComment.content.ilike(f"%{search_term}%"))
    comment_query = comment_query.order_by(PostComment.created_at.desc()).limit(limit).offset(offset)
    comment_result = await db.execute(comment_query)
    comments = comment_result.scalars().all()

    comment_data = []
    if comments:
        c_user_ids = list({c.user_id for c in comments})
        c_post_ids = list({c.post_id for c in comments})

        c_authors_res = await db.execute(select(User).where(User.id.in_(c_user_ids)))
        c_authors_map = {u.id: u for u in c_authors_res.scalars().all()}

        c_posts_res = await db.execute(select(WallPost).where(WallPost.id.in_(c_post_ids)))
        c_posts_map = {wp.id: wp for wp in c_posts_res.scalars().all()}

        c_cat_ids = list({wp.category_id for wp in c_posts_map.values() if wp.category_id})
        c_themes_map: dict = {}
        if c_cat_ids:
            c_themes_res = await db.execute(select(Theme).where(Theme.id.in_(c_cat_ids)))
            c_themes_map = {t.id: t for t in c_themes_res.scalars().all()}

        for c in comments:
            author = c_authors_map.get(c.user_id)
            parent_post = c_posts_map.get(c.post_id)
            cat_id = parent_post.category_id if parent_post else ""
            cat_theme = c_themes_map.get(cat_id)
            cat_name = cat_theme.name if cat_theme else cat_id
            comment_data.append({
                "id": c.id, "post_id": c.post_id,
                "category_id": cat_id,
                "category_name": cat_name,
                "user": {
                    "id": author.id if author else "", "pseudo": author.pseudo if author else "Inconnu",
                    "avatar_seed": author.avatar_seed if author else "",
                    "avatar_url": getattr(author, 'avatar_url', None) if author else None,
                },
                "content": c.content, "created_at": c.created_at.isoformat(),
            })

    return {"posts": post_data, "comments": comment_data}


@router.get("/trending")
async def get_trending(user_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    from services.recommendations import get_trending_themes_scored, theme_to_tag

    # Thèmes tendance scorés par affinité joueur (1 seule requête agrégée)
    scored = await get_trending_themes_scored(db, user_id=user_id, limit=8, days=7)
    trending_tags = [theme_to_tag(entry, rank) for rank, entry in enumerate(scored)]
    popular_categories = [
        {"id": e["theme"].id, "name": e["theme"].name, "match_count": e["match_count"]}
        for e in scored[:5]
    ]

    top_players_res = await db.execute(
        select(User).where(User.is_bot == False).order_by(User.total_xp.desc()).limit(5)
    )
    top_players = top_players_res.scalars().all()
    top_players_data = [{
        "id": u.id, "pseudo": u.pseudo, "avatar_seed": u.avatar_seed,
        "avatar_url": getattr(u, 'avatar_url', None),
        "total_xp": u.total_xp, "country_flag": COUNTRY_FLAGS.get(u.country or "", ""),
    } for u in top_players]

    return {
        "popular_categories": popular_categories,
        "trending_tags": trending_tags,
        "top_players": top_players_data,
    }

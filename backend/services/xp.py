from datetime import datetime, timezone

MAX_LEVEL = 50
TITLE_THRESHOLDS = [1, 10, 20, 35, 50]


def xp_for_next_level(level: int) -> int:
    """XP needed to go from level to level+1."""
    return 500 + (level - 1) ** 2 * 10

def get_cumulative_xp(level: int) -> int:
    """Total XP needed to reach a specific level."""
    total = 0
    for l in range(1, level):
        total += xp_for_next_level(l)
    return total

def get_level(xp: int) -> int:
    """Calculate level from XP. Cap at 50. Level 0 if no XP."""
    if xp <= 0:
        return 0
    level = 1
    cumulative = 0
    while level < MAX_LEVEL:
        needed = xp_for_next_level(level)
        if cumulative + needed > xp:
            break
        cumulative += needed
        level += 1
    return level

# Keep old name as alias for compatibility during migration
get_category_level = get_level

def get_xp_progress(xp: int, level: int) -> dict:
    """Get XP progress within current level."""
    if level >= MAX_LEVEL:
        return {"current": 0, "needed": 1, "progress": 1.0}
    if level == 0:
        needed = xp_for_next_level(1)
        return {
            "current": xp,
            "needed": needed,
            "progress": round(min(xp / max(needed, 1), 1.0), 3)
        }
    current_level_xp = get_cumulative_xp(level)
    next_level_xp = get_cumulative_xp(level + 1)
    xp_in_level = xp - current_level_xp
    xp_needed = next_level_xp - current_level_xp
    return {
        "current": xp_in_level,
        "needed": xp_needed,
        "progress": round(min(xp_in_level / max(xp_needed, 1), 1.0), 3)
    }

def get_theme_title(theme, level: int) -> str:
    """Get highest unlocked title for a theme at given level."""
    titles = {1: theme.title_lv1, 10: theme.title_lv10, 20: theme.title_lv20, 35: theme.title_lv35, 50: theme.title_lv50}
    current = ""
    for threshold in TITLE_THRESHOLDS:
        if level >= threshold and titles.get(threshold):
            current = titles[threshold]
    return current

def get_theme_unlocked_titles(theme, level: int) -> list:
    """Get all unlocked titles for a theme at given level."""
    titles = {1: theme.title_lv1, 10: theme.title_lv10, 20: theme.title_lv20, 35: theme.title_lv35, 50: theme.title_lv50}
    unlocked = []
    for threshold in TITLE_THRESHOLDS:
        if level >= threshold and titles.get(threshold):
            unlocked.append({"level": threshold, "title": titles[threshold]})
    return unlocked

def get_all_unlocked_titles_v2(user_xps, themes_map) -> list:
    """Get all unlocked titles across all themes for a user.
    user_xps: list of UserThemeXP objects
    themes_map: dict of theme_id -> Theme objects
    """
    all_titles = []
    for uxp in user_xps:
        theme = themes_map.get(uxp.theme_id)
        if not theme:
            continue
        lvl = get_level(uxp.xp)
        for t in get_theme_unlocked_titles(theme, lvl):
            all_titles.append({**t, "theme_id": theme.id, "theme_name": theme.name})
    return all_titles

def check_new_title_theme(theme, level_before: int, level_after: int):
    """Check if a new title was unlocked for a theme. Return highest new one."""
    if level_before >= level_after:
        return None
    titles = {1: theme.title_lv1, 10: theme.title_lv10, 20: theme.title_lv20, 35: theme.title_lv35, 50: theme.title_lv50}
    new_title = None
    for threshold in TITLE_THRESHOLDS:
        if level_before < threshold <= level_after:
            title = titles.get(threshold)
            if title:
                new_title = {"level": threshold, "title": title, "theme_id": theme.id, "theme_name": theme.name}
    return new_title

def get_streak_bonus(streak: int) -> int:
    """Returns cumulative streak bonus XP."""
    if streak >= 10:
        return 50
    if streak >= 5:
        return 25
    if streak >= 3:
        return 10
    return 0

def get_streak_badge(streak: int) -> str:
    """Returns badge emoji based on streak."""
    if streak >= 10:
        return "glow"
    if streak >= 5:
        return "bolt"
    if streak >= 3:
        return "fire"
    return ""

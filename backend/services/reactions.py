"""Réactions entre joueurs : émojis et phrases toutes faites (aucun texte libre → rien à modérer ;
on n'envoie qu'une clé, chaque joueur la lit dans sa langue).

- Pendant un duel en direct : DUEL seulement, une par question.
- Après un match / défi : FREE + celles débloquées (coffre du jour), 3 max par adversaire / 10 min.
"""
import time

DUEL = ["laugh", "fire", "shock", "clap"]
FREE = DUEL + ["handshake", "gg", "well_played", "got_me", "lucky", "oops", "next_time"]
LOCKED = ["crown", "skull", "angry", "mindblown", "too_easy", "no_fear", "lessons", "unstoppable"]
ALL = set(FREE) | set(LOCKED)

MATCH_LIMIT = 3
MATCH_WINDOW_S = 600
_sent: dict[tuple[str, str], list[float]] = {}


def parse_unlocked(raw: str | None) -> list[str]:
    return [k for k in (raw or "").split(",") if k in LOCKED]


def can_use(key: str, unlocked_raw: str | None) -> bool:
    return key in FREE or key in parse_unlocked(unlocked_raw)


def match_allowed(sender_id: str, receiver_id: str) -> bool:
    """Anti-spam des réactions d'après-match (en mémoire, par paire de joueurs)."""
    now = time.monotonic()
    if len(_sent) > 20000:
        _sent.clear()
    k = (sender_id, receiver_id)
    recent = [t for t in _sent.get(k, []) if now - t < MATCH_WINDOW_S]
    if len(recent) >= MATCH_LIMIT:
        _sent[k] = recent
        return False
    recent.append(now)
    _sent[k] = recent
    return True

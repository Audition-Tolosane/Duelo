"""
simulate_games.py — Simulateur de parties DUELO (100 % local, 0 € : aucune IA, aucune API).

Objectif : tester l'ÉQUILIBRAGE du jeu, pas la justesse des questions.
Il fait jouer des milliers de parties bot-contre-bot et rapporte :
  - taux de victoire selon l'écart de niveau (le matchmaking est-il juste ?)
  - distribution des scores, parties parfaites, quasi-nuls, blowouts, égalités
  - durée moyenne d'une partie

Les formules sont RECOPIÉES fidèlement du code réel :
  - proba de bonne réponse : services/bots.py -> simulate_bot_answer()
  - score par question    : frontend/app/game.tsx  (points = clamp(20 - t, 10, 20))
  - 7 questions/partie, matchmaking ±0.20 de skill : constants.py / routers/game.py

Usage :
    python simulate_games.py                 # 20 000 parties, réglages par défaut
    python simulate_games.py --games 100000  # plus de parties = stats plus fines
"""

import argparse
import random
import statistics
import sys
from collections import Counter, defaultdict

# Console Windows : force l'UTF-8 pour les accents et symboles (≤, →…)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# ── Règles reprises du jeu ───────────────────────────────────────────────────
TOTAL_QUESTIONS = 7           # constants.py : TOTAL_QUESTIONS = 7
TIME_LIMIT_S    = 10          # game.tsx : TIMER_DURATION = 10
MATCH_SKILL_SPREAD = 0.20     # services/bots.py : plage ±0.20

# Distribution réelle de difficulté mesurée dans les CSV (ARENA) : 30/40/30
DIFFICULTY_MIX = (
    ["Facile"]   * 30 +
    ["Moyen"]    * 40 +
    ["Difficile"] * 30
)

DIFFICULTY_MODIFIER = {          # services/bots.py
    "Facile":    0.0,
    "Moyen":    -0.10,
    "Difficile": -0.20,
}


def bot_answer(skill_level: float, avg_speed: float, difficulty: str) -> dict:
    """Copie fidèle de services/bots.py::simulate_bot_answer (partie utile)."""
    modifier = DIFFICULTY_MODIFIER.get(difficulty, -0.10)
    p_correct = max(0.05, min(0.99, skill_level + modifier))
    is_correct = random.random() < p_correct

    r = random.random()
    if r < 0.08:
        raw = avg_speed * random.uniform(0.20, 0.40)      # réponse éclair
    elif r < 0.15:
        raw = avg_speed * random.uniform(1.40, 2.00)      # hésitant
    else:
        raw = avg_speed * random.uniform(0.50, 1.55)      # normal
    time_ms = int(max(600, min(TIME_LIMIT_S * 1000 - 200, raw * 1000)))
    return {"is_correct": is_correct, "time_ms": time_ms}


def question_points(is_correct: bool, time_ms: int) -> int:
    """game.tsx : correct -> clamp(20 - secondes_écoulées, 10, 20), sinon 0."""
    if not is_correct:
        return 0
    t = time_ms / 1000.0
    return int(max(min(20 - t, 20), 10))


def play_match(skill_a, speed_a, skill_b, speed_b):
    """Une partie de 7 questions entre deux bots. Renvoie (score_a, score_b)."""
    score_a = score_b = 0
    for _ in range(TOTAL_QUESTIONS):
        diff = random.choice(DIFFICULTY_MIX)   # même question pour les deux
        ra = bot_answer(skill_a, speed_a, diff)
        rb = bot_answer(skill_b, speed_b, diff)
        score_a += question_points(ra["is_correct"], ra["time_ms"])
        score_b += question_points(rb["is_correct"], rb["time_ms"])
    return score_a, score_b


def run(n_games: int, seed: int | None):
    if seed is not None:
        random.seed(seed)

    scores = []
    margins = []
    perfect = draws = blowouts = near_miss = 0
    # taux de victoire du joueur "A" par tranche d'écart de skill (A - B)
    wins_by_gap = defaultdict(lambda: [0, 0])  # gap_bucket -> [victoires_A, parties]

    for _ in range(n_games):
        # Joueur A : skill uniforme réaliste (0.20 à 0.90)
        skill_a = random.uniform(0.20, 0.90)
        # Adversaire matché à ±0.20 (comme find_bot_opponent)
        skill_b = min(0.99, max(0.05, skill_a + random.uniform(-MATCH_SKILL_SPREAD, MATCH_SKILL_SPREAD)))
        # vitesse moyenne de réponse (s) — un bot plus fort répond un peu plus vite
        speed_a = random.uniform(2.5, 6.5) * (1.15 - 0.3 * skill_a)
        speed_b = random.uniform(2.5, 6.5) * (1.15 - 0.3 * skill_b)

        sa, sb = play_match(skill_a, speed_a, skill_b, speed_b)
        scores.append(sa)
        scores.append(sb)
        margins.append(abs(sa - sb))

        if sa == 140 or sb == 140:
            perfect += 1
        if sa == sb:
            draws += 1
        if abs(sa - sb) >= 60:
            blowouts += 1
        if 0 < abs(sa - sb) <= 10:
            near_miss += 1

        gap = round((skill_a - skill_b) / 0.05) * 0.05  # bucket de 0.05
        gap = max(-0.20, min(0.20, gap))
        wins_by_gap[gap][1] += 1
        if sa > sb:
            wins_by_gap[gap][0] += 1

    # ── Rapport ──────────────────────────────────────────────────────────────
    n_matches = n_games
    print(f"\n{'='*60}\n  SIMULATION DUELO — {n_games:,} parties\n{'='*60}")
    print(f"\n  Score moyen / joueur : {statistics.mean(scores):.1f} / 140")
    print(f"  Score médian         : {statistics.median(scores):.0f}")
    print(f"  Écart-type           : {statistics.pstdev(scores):.1f}")
    print(f"  Écart moyen (marge)  : {statistics.mean(margins):.1f} points\n")

    print(f"  Parties parfaites (140) : {perfect:6d}  ({100*perfect/n_matches:.2f} %)")
    print(f"  Égalités                : {draws:6d}  ({100*draws/n_matches:.2f} %)")
    print(f"  Quasi-nuls (≤10 pts)    : {near_miss:6d}  ({100*near_miss/n_matches:.2f} %)")
    print(f"  Blowouts (≥60 pts)      : {blowouts:6d}  ({100*blowouts/n_matches:.2f} %)")

    print(f"\n  Taux de victoire selon l'écart de niveau (skill joueur − adversaire) :")
    print(f"  {'écart':>7} | {'victoire joueur':>16} | parties")
    print(f"  {'-'*7}-+-{'-'*16}-+--------")
    for gap in sorted(wins_by_gap):
        w, tot = wins_by_gap[gap]
        print(f"  {gap:+7.2f} | {100*w/tot:14.1f} % | {tot:6d}")

    print(f"\n  → Lecture : à écart 0.00 on veut ~50 %. Une pente régulière")
    print(f"    (plus de skill = plus de victoires) prouve que le niveau compte")
    print(f"    sans écraser le hasard. {'='*10}\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Simulateur de parties DUELO (équilibrage).")
    ap.add_argument("--games", type=int, default=20_000, help="nombre de parties (défaut 20000)")
    ap.add_argument("--seed", type=int, default=42, help="graine aléatoire (défaut 42)")
    args = ap.parse_args()
    run(args.games, args.seed)

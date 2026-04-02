"""
generate_bots.py — Génère 10 000 profils de bots DUELO via Vertex AI (Gemini 3 Flash).

Usage :
    python generate_bots.py

Prérequis :
    pip install google-cloud-aiplatform
    gcloud auth application-default login   (ou GOOGLE_APPLICATION_CREDENTIALS)

Sorties :
    output_bots/bots.json       — 10 000 profils complets
    output_bots/bot_themes.json — table de liaison bots ↔ thèmes
    bots_checkpoint.json        — sauvegarde de progression (reprise automatique)
"""

import json
import os
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

# ── Configuration ──────────────────────────────────────────────────────────────

PROJECT_ID = os.environ.get("VERTEX_PROJECT_ID", "YOUR_PROJECT_ID")
LOCATION   = os.environ.get("VERTEX_LOCATION", "us-central1")
MODEL_NAME = "gemini-1.5-flash"   # Vertex AI model ID for Gemini Flash

TOTAL_BOTS      = 10_000
BATCH_SIZE      = 100
OUTPUT_DIR      = Path("output_bots")
CHECKPOINT_FILE = Path("bots_checkpoint.json")

# ── Thèmes disponibles (super-catégories) ─────────────────────────────────────

ALL_SUPER_CATEGORIES = ["LEGENDS", "SOUND", "SCREEN", "GLOBE", "ART", "ARENA", "LAB", "MIND", "LIFE"]

LANGUAGE_THEME_PREFS = {
    "fr": ["LEGENDS", "SOUND", "SCREEN", "GLOBE", "ART"],
    "en": ["SCREEN", "ARENA", "LAB", "MIND", "SOUND"],
    "es": ["ARENA", "GLOBE", "SOUND", "SCREEN", "LEGENDS"],
    "pt": ["ARENA", "GLOBE", "SOUND", "SCREEN", "LIFE"],
    "de": ["LAB", "MIND", "LEGENDS", "ARENA", "ART"],
    "it": ["ART", "LEGENDS", "GLOBE", "SCREEN", "MIND"],
}

# ── Distribution géographique ─────────────────────────────────────────────────

GEO_DISTRIBUTION = [
    # (weight, country_fr, language, timezone)
    (12, "États-Unis",         "en", "America/New_York"),
    (10, "États-Unis",         "en", "America/Chicago"),
    (8,  "États-Unis",         "en", "America/Los_Angeles"),
    (6,  "Mexique",            "es", "America/Mexico_City"),
    (5,  "Argentine",          "es", "America/Argentina/Buenos_Aires"),
    (4,  "Colombie",           "es", "America/Bogota"),
    (4,  "Espagne",            "es", "Europe/Madrid"),
    (3,  "Chili",              "es", "America/Santiago"),
    (3,  "Pérou",              "es", "America/Lima"),
    (6,  "Brésil",             "pt", "America/Sao_Paulo"),
    (4,  "Brésil",             "pt", "America/Manaus"),
    (3,  "Portugal",           "pt", "Europe/Lisbon"),
    (5,  "France",             "fr", "Europe/Paris"),
    (3,  "France",             "fr", "Europe/Paris"),
    (2,  "Belgique",           "fr", "Europe/Brussels"),
    (2,  "Suisse",             "fr", "Europe/Zurich"),
    (2,  "Canada",             "fr", "America/Toronto"),
    (3,  "Côte d'Ivoire",      "fr", "Africa/Abidjan"),
    (3,  "Allemagne",          "de", "Europe/Berlin"),
    (3,  "Allemagne",          "de", "Europe/Berlin"),
    (2,  "Autriche",           "de", "Europe/Vienna"),
    (3,  "Italie",             "it", "Europe/Rome"),
    (2,  "Italie",             "it", "Europe/Rome"),
    (2,  "Maroc",              "fr", "Africa/Casablanca"),
    (1,  "Sénégal",            "fr", "Africa/Dakar"),
    (1,  "Cameroun",           "fr", "Africa/Douala"),
]

_GEO_WEIGHTS  = [g[0] for g in GEO_DISTRIBUTION]
_GEO_TOTAL    = sum(_GEO_WEIGHTS)
_GEO_PROBS    = [w / _GEO_TOTAL for w in _GEO_WEIGHTS]


def _pick_geo():
    return random.choices(GEO_DISTRIBUTION, weights=_GEO_WEIGHTS, k=1)[0]


def _pick_themes(language: str) -> list[str]:
    """Assign 3–7 themes to a bot (70% cultural, 30% random)."""
    n = random.randint(3, 7)
    if random.random() < 0.7:
        pool = LANGUAGE_THEME_PREFS.get(language, ALL_SUPER_CATEGORIES)
        extra = [t for t in ALL_SUPER_CATEGORIES if t not in pool]
        combined = pool + extra
    else:
        combined = ALL_SUPER_CATEGORIES[:]
    random.shuffle(combined)
    return combined[:n]


def _random_join_date() -> str:
    """Random date between 4 months ago and 2 weeks ago."""
    now  = datetime.utcnow()
    end  = now - timedelta(weeks=2)
    start = now - timedelta(days=120)
    delta = (end - start).days
    d = start + timedelta(days=random.randint(0, delta))
    return d.strftime("%Y-%m-%d")


# ── Prompt builder ────────────────────────────────────────────────────────────

def build_prompt(batch_geo: list[tuple], batch_num: int) -> str:
    """Build a Gemini prompt for a batch of 100 bots."""
    profiles_spec = []
    for i, (_, country, language, timezone) in enumerate(batch_geo):
        profiles_spec.append(f'{i+1}. country="{country}", language="{language}", timezone="{timezone}"')

    spec_text = "\n".join(profiles_spec)

    return f"""Generate exactly 100 JSON bot profiles for a quiz app called DUELO.
Return a JSON array with exactly 100 objects. No extra text, no markdown, no explanation — ONLY the JSON array.

Each object must have these fields:
- "pseudo": string, unique gamer/Instagram/pop-culture username (max 20 chars). Use separators . - _ variably. No real geographic references. Mix styles.
- "skill_level": float between 0.1 and 0.95, Gaussian distribution centered around 0.5
- "avg_speed": float in seconds (2.0–12.0), inversely correlated with skill_level (better players are faster)
- "win_rate": float 0.25–0.80, correlated with skill_level ±0.10
- "games_played": integer 5–800, older players have more games

The country/language/timezone for each profile (in order) are:
{spec_text}

Rules:
- Pseudos must be unique within this batch
- No two profiles can have identical pseudos
- skill_level, avg_speed, win_rate must be realistic and correlated
- Return ONLY the JSON array, starting with [ and ending with ]
"""


# ── Checkpoint helpers ────────────────────────────────────────────────────────

def load_checkpoint() -> dict:
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE) as f:
            return json.load(f)
    return {"completed_batches": [], "bots": []}


def save_checkpoint(state: dict):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(state, f)


# ── Theme coverage enforcement ────────────────────────────────────────────────

def ensure_minimum_coverage(bot_themes: list[dict]) -> list[dict]:
    """Guarantee every super-category appears at least 50 times."""
    counts = {sc: 0 for sc in ALL_SUPER_CATEGORIES}
    for bt in bot_themes:
        if bt["theme_id"] in counts:
            counts[bt["theme_id"]] += 1

    for sc, cnt in counts.items():
        if cnt < 50:
            # Pick random bots and add this theme to them
            needed = 50 - cnt
            candidates = list({bt["bot_pseudo"] for bt in bot_themes})
            random.shuffle(candidates)
            for pseudo in candidates[:needed]:
                bot_themes.append({
                    "bot_pseudo": pseudo,
                    "theme_id": sc,
                    "games_played_on_theme": random.randint(1, 20),
                    "win_rate_on_theme": round(random.uniform(0.3, 0.7), 2),
                })
    return bot_themes


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Init Vertex AI
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    model = GenerativeModel(MODEL_NAME)
    gen_config = GenerationConfig(
        temperature=0.9,
        max_output_tokens=8192,
        response_mime_type="application/json",
    )

    state = load_checkpoint()
    all_bots: list[dict] = state["bots"]
    completed: set[int]  = set(state["completed_batches"])
    all_pseudos: set[str] = {b["pseudo"] for b in all_bots}

    n_batches = TOTAL_BOTS // BATCH_SIZE

    for batch_idx in range(n_batches):
        if batch_idx in completed:
            print(f"Batch {batch_idx+1}/{n_batches} — already done, skipping")
            continue

        # Assign geo for each bot in this batch
        batch_geo = [_pick_geo() for _ in range(BATCH_SIZE)]

        prompt = build_prompt(batch_geo, batch_idx)

        print(f"Batch {batch_idx+1}/{n_batches} — generating...")
        try:
            response = model.generate_content(prompt, generation_config=gen_config)
            raw = response.text.strip()
            profiles = json.loads(raw)
            if not isinstance(profiles, list):
                raise ValueError("Response is not a JSON array")
        except Exception as e:
            print(f"  ERROR on batch {batch_idx}: {e} — skipping")
            continue

        added = 0
        for i, p in enumerate(profiles[:BATCH_SIZE]):
            pseudo = str(p.get("pseudo", "")).strip()[:20]
            if not pseudo or pseudo in all_pseudos:
                # Generate a fallback unique pseudo
                pseudo = f"Player_{uuid.uuid4().hex[:8]}"
            all_pseudos.add(pseudo)

            _, country, language, timezone = batch_geo[i] if i < len(batch_geo) else batch_geo[-1]

            bot = {
                "pseudo":          pseudo,
                "skill_level":     round(max(0.1, min(0.95, float(p.get("skill_level", 0.5)))), 3),
                "avg_speed":       round(max(2.0, min(12.0, float(p.get("avg_speed", 5.0)))), 2),
                "win_rate":        round(max(0.25, min(0.80, float(p.get("win_rate", 0.5)))), 3),
                "games_played":    max(5, min(800, int(p.get("games_played", 50)))),
                "country":         country,
                "language":        language,
                "timezone":        timezone,
                "preferred_hours": ["20:00-23:00", "12:00-13:00"],
                "join_date":       _random_join_date(),
                "is_bot":          True,
            }
            all_bots.append(bot)
            added += 1

        completed.add(batch_idx)
        state["bots"] = all_bots
        state["completed_batches"] = list(completed)
        save_checkpoint(state)
        print(f"  Added {added} bots (total: {len(all_bots)})")

    print(f"\nGeneration complete: {len(all_bots)} bots")

    # ── Build bot_themes table ─────────────────────────────────────────────────
    print("Building bot_themes table...")
    bot_themes: list[dict] = []
    for bot in all_bots:
        themes = _pick_themes(bot["language"])
        for sc in themes:
            gp = random.randint(1, bot["games_played"] // max(1, len(themes)))
            wr = round(max(0.2, min(0.9, bot["win_rate"] + random.uniform(-0.1, 0.1))), 3)
            bot_themes.append({
                "bot_pseudo":            bot["pseudo"],
                "theme_id":              sc,
                "games_played_on_theme": gp,
                "win_rate_on_theme":     wr,
            })

    bot_themes = ensure_minimum_coverage(bot_themes)
    print(f"bot_themes entries: {len(bot_themes)}")

    # ── Save outputs ──────────────────────────────────────────────────────────
    with open(OUTPUT_DIR / "bots.json", "w", encoding="utf-8") as f:
        json.dump(all_bots, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_DIR / "bot_themes.json", "w", encoding="utf-8") as f:
        json.dump(bot_themes, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to {OUTPUT_DIR}/bots.json and {OUTPUT_DIR}/bot_themes.json")
    print("Done.")


if __name__ == "__main__":
    main()

import json
import logging
import os
import re
import random
import string
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Theme, Question
from auth_middleware import get_current_user_id
from constants import SUPER_CATEGORY_META

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/forge", tags=["forge"])

COMMUNITY_CLUSTER = "Communauté"
DIFFICULTIES = ("Facile", "Moyen", "Difficile")


def _gen_theme_id(name: str) -> str:
    clean = re.sub(r"[^A-Za-z]", "", name).upper()
    prefix = (clean + "USR")[:3]
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}_{suffix}"


GENERATION_PROMPT = """\
Tu génères des questions de quiz en français pour le thème : "{name}".
Description : {description}

Génère exactement 21 questions : 7 Facile, 7 Moyen, 7 Difficile.
Les questions doivent être variées, précises et sans ambiguïté.
Les questions Difficile doivent être vraiment pointues et spécifiques.
Chaque question a 4 options dont UNE SEULE est correcte.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après :
[
  {{
    "question_text": "Question ici ?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_option": 2,
    "difficulty": "Facile"
  }}
]

correct_option = index (0-3) de la bonne réponse dans options.\
"""


@router.post("/create")
async def create_theme(
    request: Request,
    current_user: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate a theme with AI-created questions and save it to the DB."""
    body = await request.json()
    user_id = (body.get("user_id") or "").strip()
    name = (body.get("name") or "").strip()
    description = (body.get("description") or "").strip()
    super_category = (body.get("super_category") or "SCREEN").upper()
    color_hex = body.get("color_hex") or "#8A2BE2"

    if user_id != current_user:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Nom trop court (minimum 2 caractères)")
    if len(name) > 100:
        raise HTTPException(status_code=422, detail="Nom trop long (maximum 100 caractères)")
    if len(description) < 10:
        raise HTTPException(status_code=422, detail="Description trop courte (minimum 10 caractères)")
    if super_category not in SUPER_CATEGORY_META:
        super_category = "SCREEN"

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Service de génération non disponible. Configurez ANTHROPIC_API_KEY.")

    # Generate a unique theme ID
    theme_id = _gen_theme_id(name)
    for _ in range(10):
        existing = await db.execute(select(Theme).where(Theme.id == theme_id))
        if not existing.scalar_one_or_none():
            break
        theme_id = _gen_theme_id(name)

    # Call Claude to generate questions
    prompt = GENERATION_PROMPT.format(name=name, description=description)
    questions_raw: list = []
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        # Extract JSON array even if the model adds extra text
        j_start = text.find("[")
        j_end = text.rfind("]") + 1
        if j_start >= 0 and j_end > j_start:
            text = text[j_start:j_end]
        questions_raw = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"[forge] JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="Erreur de génération : réponse invalide de l'IA")
    except Exception as e:
        logger.error(f"[forge] API error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération des questions")

    if not questions_raw or len(questions_raw) < 7:
        raise HTTPException(status_code=500, detail="Génération insuffisante, veuillez réessayer")

    # Create Theme record
    theme = Theme(
        id=theme_id,
        name=name,
        description=description,
        super_category=super_category,
        cluster=COMMUNITY_CLUSTER,
        color_hex=color_hex,
        question_count=0,
        title_lv1=f"Fan de {name}",
        title_lv10=f"Passionné·e de {name}",
        title_lv20=f"Expert·e {name}",
        title_lv35=f"Maître de {name}",
        title_lv50=f"Légende de {name}",
    )
    db.add(theme)

    # Create Question records
    imported = 0
    for q in questions_raw:
        q_text = (q.get("question_text") or "").strip()
        opts = q.get("options") or []
        correct = q.get("correct_option", 0)
        difficulty = q.get("difficulty", "Moyen")

        if (
            not q_text
            or len(opts) != 4
            or not isinstance(correct, int)
            or correct not in range(4)
        ):
            continue
        if difficulty not in DIFFICULTIES:
            difficulty = "Moyen"

        db.add(Question(
            category=theme_id,
            question_text=q_text[:500],
            options=opts,
            correct_option=correct,
            difficulty=difficulty,
            option_a=str(opts[0])[:200] if opts else "",
            option_b=str(opts[1])[:200] if len(opts) > 1 else "",
            option_c=str(opts[2])[:200] if len(opts) > 2 else "",
            option_d=str(opts[3])[:200] if len(opts) > 3 else "",
        ))
        imported += 1

    theme.question_count = imported
    await db.commit()
    await db.refresh(theme)

    logger.info(f"[forge] Theme '{theme_id}' ('{name}') created with {imported} questions by user {user_id}")

    return {
        "theme_id": theme_id,
        "name": theme.name,
        "question_count": imported,
        "color_hex": color_hex,
        "super_category": super_category,
        "status": "created",
    }

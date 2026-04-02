import csv
import io
import base64
import os
import re
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import HTMLResponse
from sqlalchemy import select, func, text, delete, update, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from models import User, Question, Match, Theme, QuestionReport, Avatar, UserThemeXP, WallPost, PostLike, PostComment, generate_uuid
from schemas import AdminVerify, BulkImportRequest, CSVUploadRequest, DeleteThemesRequest
from config import ADMIN_PASSWORD, ROOT_DIR
from constants import SUPER_CATEGORY_META, CLUSTER_ICONS
from helpers import validate_image_base64

router = APIRouter(prefix="/admin", tags=["admin"])

CORRECT_OPTION_MAP = {"A": 0, "B": 1, "C": 2, "D": 3}


async def verify_admin_key(x_admin_key: str = Header(default="", alias="X-Admin-Key")):
    """Dependency: validates admin password from X-Admin-Key header."""
    if x_admin_key != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Accès refusé")


@router.post("/verify")
async def verify_admin(data: AdminVerify):
    if data.password == ADMIN_PASSWORD:
        return {"verified": True}
    raise HTTPException(status_code=403, detail="Mot de passe incorrect")


@router.post("/import-questions")
async def import_questions(data: BulkImportRequest, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    imported = 0
    duplicates = 0
    errors = []

    for i, q in enumerate(data.questions):
        try:
            q_text = q.get("question_text", "").strip()
            options = q.get("options", [])
            correct = q.get("correct_option", 0)
            difficulty = q.get("difficulty", "medium")

            if not q_text or len(options) != 4:
                errors.append(f"Question {i+1}: format invalide")
                continue

            result = await db.execute(select(Question).where(Question.question_text == q_text))
            if result.scalar_one_or_none():
                duplicates += 1
                continue

            question = Question(
                category=data.category, question_text=q_text, options=options,
                correct_option=correct, difficulty=difficulty
            )
            db.add(question)
            imported += 1
        except Exception as e:
            errors.append(f"Question {i+1}: {str(e)}")

    await db.commit()
    return {"imported": imported, "duplicates": duplicates, "errors": errors, "total_processed": len(data.questions)}


@router.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard():
    html_path = ROOT_DIR / "admin_dashboard.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.post("/import-csv")
async def import_csv_data(request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    themes_csv_text = body.get("themes_csv", "")
    questions_csv_text = body.get("questions_csv", "")

    if not themes_csv_text or not questions_csv_text:
        raise HTTPException(status_code=400, detail="Both themes_csv and questions_csv required")

    themes_reader = csv.DictReader(io.StringIO(themes_csv_text))
    themes_imported = 0
    for row in themes_reader:
        theme_id = row.get("ID_Theme", "").strip()
        if not theme_id:
            continue

        existing = await db.execute(select(Theme).where(Theme.id == theme_id))
        if existing.scalar_one_or_none():
            await db.execute(
                text("""UPDATE themes SET super_category=:sc, cluster=:cl, name=:nm, description=:desc,
                         color_hex=:ch, title_lv1=:t1, title_lv10=:t10, title_lv20=:t20,
                         title_lv35=:t35, title_lv50=:t50, icon_url=:iu WHERE id=:id"""),
                {
                    "id": theme_id, "sc": row.get("Super_Categorie", "").strip(),
                    "cl": row.get("Cluster", "").strip(), "nm": row.get("Nom_Public", "").strip(),
                    "desc": row.get("Description", "").strip(), "ch": row.get("Couleur_Hex", "").strip(),
                    "t1": row.get("Titre_Niv_1", "").strip(), "t10": row.get("Titre_Niv_10", "").strip(),
                    "t20": row.get("Titre_Niv_20", "").strip(), "t35": row.get("Titre_Niv_35", "").strip(),
                    "t50": row.get("Titre_Niv_50", "").strip(), "iu": row.get("URL_Icone", "").strip(),
                }
            )
        else:
            theme = Theme(
                id=theme_id, super_category=row.get("Super_Categorie", "").strip(),
                cluster=row.get("Cluster", "").strip(), name=row.get("Nom_Public", "").strip(),
                description=row.get("Description", "").strip(), color_hex=row.get("Couleur_Hex", "").strip(),
                title_lv1=row.get("Titre_Niv_1", "").strip(), title_lv10=row.get("Titre_Niv_10", "").strip(),
                title_lv20=row.get("Titre_Niv_20", "").strip(), title_lv35=row.get("Titre_Niv_35", "").strip(),
                title_lv50=row.get("Titre_Niv_50", "").strip(), icon_url=row.get("URL_Icone", "").strip(),
            )
            db.add(theme)
        themes_imported += 1

    await db.commit()

    ANSWER_MAP = {"A": 0, "B": 1, "C": 2, "D": 3}
    questions_reader = csv.DictReader(io.StringIO(questions_csv_text))
    questions_imported = 0

    for row in questions_reader:
        q_id = row.get("ID", "").strip()
        theme_id = (row.get("Catégorie") or row.get("Categorie") or row.get("category") or "").strip()
        question_text = (row.get("Question") or row.get("question_text") or "").strip()
        if not q_id or not question_text:
            continue

        rep_a = (row.get("Rep A") or row.get("option_a") or "").strip()
        rep_b = (row.get(" Rep B") or row.get("Rep B") or row.get("option_b") or "").strip()
        rep_c = (row.get("Rep C") or row.get("option_c") or "").strip()
        rep_d = (row.get("Rep D") or row.get("option_d") or "").strip()
        bonne_rep = (row.get("Bonne rep") or row.get("correct_option") or "").strip().upper()
        difficulte = (row.get("Difficulté") or row.get("Difficulte") or row.get("difficulty") or "").strip()

        correct_option = ANSWER_MAP.get(bonne_rep, 0)
        options = [rep_a, rep_b, rep_c, rep_d]

        existing_q = await db.execute(select(Question).where(Question.id == q_id))
        if existing_q.scalar_one_or_none():
            continue

        q = Question(
            id=q_id, category=theme_id, question_text=question_text,
            options=options, correct_option=correct_option, difficulty=difficulte,
        )
        db.add(q)
        questions_imported += 1

        if questions_imported % 500 == 0:
            await db.commit()

    await db.commit()

    result = await db.execute(select(Theme))
    themes_list = result.scalars().all()
    for t in themes_list:
        count_res = await db.execute(select(func.count(Question.id)).where(Question.category == t.id))
        t.question_count = count_res.scalar() or 0
    await db.commit()

    questions_reader2 = csv.DictReader(io.StringIO(questions_csv_text))
    for row in questions_reader2:
        q_id = row.get("ID", "").strip()
        angle = row.get("Angle", "").strip()
        angle_num_str = row.get("Angle Num", "").strip()
        if q_id and angle:
            try:
                angle_num = int(angle_num_str) if angle_num_str else 0
                await db.execute(
                    text("UPDATE questions SET angle=:angle, angle_num=:anum WHERE id=:qid"),
                    {"angle": angle, "anum": angle_num, "qid": q_id}
                )
            except:
                pass
    await db.commit()

    return {"success": True, "themes_imported": themes_imported, "questions_imported": questions_imported}


@router.post("/upload-csv")
async def upload_csv_questions(data: CSVUploadRequest, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    imported = 0
    duplicates = 0
    errors = []

    # Collect all candidate IDs first
    candidate_ids = set()
    for row in data.questions:
        q_id = str(row.get("id", "")).strip()
        if q_id:
            candidate_ids.add(q_id)

    # Single bulk query to find existing IDs
    existing_ids = set()
    if candidate_ids:
        id_list = list(candidate_ids)
        for chunk_start in range(0, len(id_list), 1000):
            chunk = id_list[chunk_start:chunk_start + 1000]
            result = await db.execute(select(Question.id).where(Question.id.in_(chunk)))
            existing_ids.update(row[0] for row in result.fetchall())

    # Now insert without per-row SELECT
    def _get(row, *keys, default=""):
        for k in keys:
            v = row.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        return default

    for i, row in enumerate(data.questions):
        try:
            q_id = _get(row, "id")
            category = _get(row, "category", "theme")
            question_text = _get(row, "question_text", "question")
            opt_a = _get(row, "option_a", "a")
            opt_b = _get(row, "option_b", "b")
            opt_c = _get(row, "option_c", "c")
            opt_d = _get(row, "option_d", "d")
            correct_str = _get(row, "correct_option", "bonne_reponse", "bonne_rep").upper()
            raw_diff = _get(row, "difficulty", "difficulte", "difficulté").lower() or "moyen"
            # Keep French difficulty labels as-is; map English fallbacks
            difficulty = {"easy": "Facile", "medium": "Moyen", "hard": "Difficile"}.get(raw_diff, raw_diff.capitalize()) or "Moyen"
            angle = _get(row, "angle")
            angle_num_str = _get(row, "angle_num")
            batch = _get(row, "batch")
            if not question_text:
                errors.append(f"Ligne {i+1}: question_text manquant"); continue
            if not category:
                errors.append(f"Ligne {i+1}: category manquant"); continue
            if not opt_a or not opt_b or not opt_c or not opt_d:
                errors.append(f"Ligne {i+1}: une ou plusieurs options manquantes"); continue
            if correct_str not in CORRECT_OPTION_MAP:
                errors.append(f"Ligne {i+1}: correct_option invalide '{correct_str}'"); continue

            if not q_id:
                q_id = generate_uuid()

            if q_id in existing_ids:
                duplicates += 1; continue

            correct_int = CORRECT_OPTION_MAP[correct_str]
            options_json = [opt_a, opt_b, opt_c, opt_d]

            angle_num = int(angle_num_str) if angle_num_str.isdigit() else 0
            question = Question(
                id=q_id, category=category, question_text=question_text,
                options=options_json, correct_option=correct_int, difficulty=difficulty,
                option_a=opt_a, option_b=opt_b, option_c=opt_c, option_d=opt_d,
                angle=angle, angle_num=angle_num, batch=batch,
            )
            db.add(question)
            existing_ids.add(q_id)
            imported += 1

        except Exception as e:
            errors.append(f"Ligne {i+1}: erreur de format ou de données")
            continue

        # Intermediate commit outside per-row try/except so failures are not silently swallowed
        if imported % 500 == 0 and imported > 0:
            try:
                await db.commit()
            except Exception as commit_err:
                await db.rollback()
                return {"success": False, "imported": 0, "duplicates": duplicates,
                        "errors": [f"Erreur commit intermédiaire ({imported} lignes) : {commit_err}"] + errors[:20]}

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        return {"success": False, "imported": 0, "duplicates": duplicates,
                "errors": ["Erreur d'enregistrement en base de données"] + errors[:20]}

    try:
        result = await db.execute(select(Theme))
        themes_list = result.scalars().all()
        for t in themes_list:
            # Questions may store category as theme.id OR theme.name
            count_res = await db.execute(
                select(func.count(Question.id)).where(
                    or_(Question.category == t.id, Question.category == t.name)
                )
            )
            t.question_count = count_res.scalar() or 0
        await db.commit()
    except Exception:
        pass

    return {
        "success": True, "imported": imported, "duplicates": duplicates,
        "errors": errors[:50], "total_processed": len(data.questions),
    }


@router.get("/questions-stats")
async def get_questions_stats(limit: int = 100, offset: int = 0, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    limit = min(limit, 200)
    total_res = await db.execute(select(func.count(Question.id)))
    total = total_res.scalar() or 0

    cat_stats = []
    categories_res = await db.execute(
        select(Question.category, func.count(Question.id).label("count"))
        .group_by(Question.category).order_by(func.count(Question.id).desc())
        .limit(limit).offset(offset)
    )
    for row in categories_res:
        cat_stats.append({"category": row[0], "count": row[1]})

    batch_stats = []
    batch_res = await db.execute(
        select(Question.batch, func.count(Question.id).label("count"))
        .where(Question.batch.isnot(None)).where(Question.batch != "")
        .group_by(Question.batch).order_by(func.count(Question.id).desc())
    )
    for row in batch_res:
        batch_stats.append({"batch": row[0], "count": row[1]})

    return {"total_questions": total, "categories": cat_stats, "batches": batch_stats}


@router.post("/upload-themes-csv")
async def upload_themes_csv(request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    themes_csv_text = body.get("themes_csv", "")

    if not themes_csv_text.strip():
        raise HTTPException(status_code=400, detail="CSV vide")

    # Clean up related records before deleting all themes
    # Delete UserThemeXP records
    await db.execute(text("DELETE FROM user_theme_xp"))
    # Delete wall post likes/comments, then wall posts
    wall_posts_result = await db.execute(select(WallPost.id))
    wall_post_ids = [row[0] for row in wall_posts_result.fetchall()]
    if wall_post_ids:
        await db.execute(text("DELETE FROM post_likes WHERE post_id IN (SELECT id FROM wall_posts)"))
        await db.execute(text("DELETE FROM post_comments WHERE post_id IN (SELECT id FROM wall_posts)"))
        await db.execute(text("DELETE FROM wall_posts"))
    # Nullify theme references in matches and reports
    await db.execute(text("UPDATE matches SET category='deleted' WHERE category IN (SELECT id FROM themes)"))
    await db.execute(text("UPDATE question_reports SET category=NULL WHERE category IN (SELECT id FROM themes)"))
    # Now delete themes
    await db.execute(text("DELETE FROM themes"))
    await db.commit()

    # Auto-detect delimiter: try ; then , then \t
    first_line = themes_csv_text.split("\n")[0] if themes_csv_text.strip() else ""
    if ";" in first_line:
        delimiter = ";"
    elif "\t" in first_line:
        delimiter = "\t"
    else:
        delimiter = ","

    themes_reader = csv.DictReader(io.StringIO(themes_csv_text), delimiter=delimiter)
    # Normalize column names: strip whitespace and BOM
    if themes_reader.fieldnames:
        themes_reader.fieldnames = [f.strip().lstrip("\ufeff") for f in themes_reader.fieldnames]

    themes_imported = 0
    duplicates_skipped = 0
    errors = []
    detected_columns = list(themes_reader.fieldnames or [])
    seen_ids = set()

    def col(row, *names):
        """Get first matching column value from row."""
        for n in names:
            v = row.get(n, "")
            if v and v.strip():
                return v.strip()
        return ""

    for i, row in enumerate(themes_reader):
        try:
            theme_id = col(row, "ID_Theme", "id_theme", "id", "ID", "theme_id")
            if not theme_id:
                errors.append(f"Ligne {i+2}: ID_Theme vide"); continue
            if theme_id in seen_ids:
                duplicates_skipped += 1; continue
            seen_ids.add(theme_id)

            theme = Theme(
                id=theme_id,
                super_category=col(row, "Super_Categorie", "super_categorie", "Super_Category", "super_category"),
                cluster=col(row, "Cluster", "cluster"),
                name=col(row, "Nom_Public", "nom_public", "Name", "name", "Nom"),
                description=col(row, "Description", "description"),
                color_hex=col(row, "Couleur_Hex", "couleur_hex", "Color", "color"),
                title_lv1=col(row, "Titre_Niv_1", "titre_niv_1"),
                title_lv10=col(row, "Titre_Niv_10", "titre_niv_10"),
                title_lv20=col(row, "Titre_Niv_20", "titre_niv_20"),
                title_lv35=col(row, "Titre_Niv_35", "titre_niv_35"),
                title_lv50=col(row, "Titre_Niv_50", "titre_niv_50"),
                icon_url=col(row, "URL_Icone", "url_icone", "Icon", "icon"),
            )
            db.add(theme)
            themes_imported += 1
        except Exception as e:
            errors.append(f"Ligne {i+2}: {str(e)}")

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        return {"success": False, "themes_imported": 0, "errors": [f"Erreur DB: {str(e)}"],
                "detected_columns": detected_columns, "detected_delimiter": delimiter}

    try:
        result = await db.execute(select(Theme))
        themes_list = result.scalars().all()
        for t in themes_list:
            count_res = await db.execute(select(func.count(Question.id)).where(Question.category == t.id))
            t.question_count = count_res.scalar() or 0
        await db.commit()
    except Exception:
        pass

    return {
        "success": True, "themes_imported": themes_imported,
        "duplicates_skipped": duplicates_skipped,
        "errors": errors[:50], "detected_delimiter": delimiter,
        "detected_columns": detected_columns,
    }


@router.get("/themes-overview")
async def admin_themes_overview(_: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Theme).order_by(Theme.super_category, Theme.cluster, Theme.name))
    all_themes = result.scalars().all()

    sc_map = {}
    for t in all_themes:
        sc = t.super_category or "UNKNOWN"
        cl = t.cluster or "Sans cluster"
        if sc not in sc_map:
            meta = SUPER_CATEGORY_META.get(sc, {"icon": "?", "color": "#8A2BE2", "label": sc})
            sc_map[sc] = {
                "id": sc, "label": meta["label"], "icon": meta["icon"],
                "color": meta["color"], "clusters": {}, "total_themes": 0, "total_questions": 0,
            }
        if cl not in sc_map[sc]["clusters"]:
            sc_map[sc]["clusters"][cl] = {
                "name": cl, "icon": CLUSTER_ICONS.get(cl, ""), "themes": [], "total_questions": 0,
            }
        q_count = t.question_count or 0
        sc_map[sc]["clusters"][cl]["themes"].append({
            "id": t.id, "name": t.name, "description": t.description or "",
            "question_count": q_count, "color_hex": t.color_hex or "",
        })
        sc_map[sc]["clusters"][cl]["total_questions"] += q_count
        sc_map[sc]["total_themes"] += 1
        sc_map[sc]["total_questions"] += q_count

    result_list = []
    for sc_key, sc_data in sc_map.items():
        sc_data["clusters"] = list(sc_data["clusters"].values())
        result_list.append(sc_data)

    return {
        "super_categories": result_list,
        "totals": {
            "super_categories": len(result_list),
            "clusters": sum(len(sc["clusters"]) for sc in result_list),
            "themes": sum(sc["total_themes"] for sc in result_list),
            "questions": sum(sc["total_questions"] for sc in result_list),
        }
    }


@router.post("/recount-questions")
async def admin_recount_questions(data: dict, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    """Recalculate question_count for all themes (id OR name match)."""
    result = await db.execute(select(Theme))
    themes_list = result.scalars().all()
    updated = 0
    for t in themes_list:
        count_res = await db.execute(
            select(func.count(Question.id)).where(
                or_(Question.category == t.id, Question.category == t.name)
            )
        )
        t.question_count = count_res.scalar() or 0
        updated += 1
    await db.commit()
    total_q = sum(t.question_count for t in themes_list)
    return {"success": True, "themes_updated": updated, "total_questions": total_q}


@router.get("/match-stats-by-theme")
async def admin_match_stats_by_theme(limit: int = 100, offset: int = 0, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    limit = min(limit, 200)
    result = await db.execute(
        select(Match.category, func.count(Match.id).label("match_count"))
        .group_by(Match.category).order_by(func.count(Match.id).desc())
        .limit(limit).offset(offset)
    )
    rows = result.all()

    themes_res = await db.execute(select(Theme))
    themes_map = {t.id: t.name for t in themes_res.scalars().all()}

    stats = []
    total_matches = 0
    for cat, count in rows:
        if cat not in themes_map:
            continue
        stats.append({"theme_id": cat, "theme_name": themes_map[cat], "match_count": count})
        total_matches += count

    return {"stats": stats, "total_matches": total_matches}


@router.get("/reports")
async def admin_get_reports(status: Optional[str] = None, limit: int = 100, offset: int = 0, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    limit = min(limit, 200)
    query = select(QuestionReport).order_by(QuestionReport.created_at.desc())
    if status:
        query = query.where(QuestionReport.status == status)
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    reports = result.scalars().all()

    # Batch-load users to avoid N+1
    user_ids = list({r.user_id for r in reports if r.user_id})
    users_map: dict = {}
    if user_ids:
        users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in users_res.scalars().all()}

    reports_data = []
    for r in reports:
        user = users_map.get(r.user_id)
        reports_data.append({
            "id": r.id, "user_id": r.user_id, "user_pseudo": user.pseudo if user else "Inconnu",
            "question_id": r.question_id, "question_text": r.question_text or "",
            "category": r.category or "", "reason_type": r.reason_type,
            "description": r.description or "", "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })

    pending_res = await db.execute(select(func.count(QuestionReport.id)).where(QuestionReport.status == "pending"))
    pending_count = pending_res.scalar() or 0
    reviewed_res = await db.execute(select(func.count(QuestionReport.id)).where(QuestionReport.status == "reviewed"))
    reviewed_count = reviewed_res.scalar() or 0
    resolved_res = await db.execute(select(func.count(QuestionReport.id)).where(QuestionReport.status == "resolved"))
    resolved_count = resolved_res.scalar() or 0

    return {
        "reports": reports_data,
        "counts": {
            "pending": pending_count, "reviewed": reviewed_count,
            "resolved": resolved_count, "total": pending_count + reviewed_count + resolved_count,
        }
    }


@router.post("/reports/{report_id}/status")
async def admin_update_report_status(report_id: str, request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    new_status = body.get("status", "")
    if new_status not in ("pending", "reviewed", "resolved"):
        raise HTTPException(status_code=400, detail="Status invalide")

    result = await db.execute(select(QuestionReport).where(QuestionReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Signalement introuvable")

    report.status = new_status
    await db.commit()
    return {"success": True, "status": new_status}


@router.post("/delete-themes")
async def delete_themes(data: DeleteThemesRequest, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    if not data.theme_ids:
        raise HTTPException(status_code=400, detail="Aucun theme selectionne")

    deleted_questions = 0
    if data.delete_questions:
        result = await db.execute(delete(Question).where(Question.category.in_(data.theme_ids)))
        deleted_questions = result.rowcount

    # Delete associated UserThemeXP records
    await db.execute(delete(UserThemeXP).where(UserThemeXP.theme_id.in_(data.theme_ids)))

    # Delete associated WallPost records (and their likes/comments)
    wall_posts_result = await db.execute(select(WallPost.id).where(WallPost.category_id.in_(data.theme_ids)))
    wall_post_ids = [row[0] for row in wall_posts_result.fetchall()]
    if wall_post_ids:
        await db.execute(delete(PostLike).where(PostLike.post_id.in_(wall_post_ids)))
        await db.execute(delete(PostComment).where(PostComment.post_id.in_(wall_post_ids)))
        await db.execute(delete(WallPost).where(WallPost.category_id.in_(data.theme_ids)))

    # Nullify category on QuestionReport records for deleted themes
    await db.execute(update(QuestionReport).where(QuestionReport.category.in_(data.theme_ids)).values(category=None))

    # Nullify category on Match records for deleted themes (preserve match history)
    await db.execute(update(Match).where(Match.category.in_(data.theme_ids)).values(category="deleted"))

    result = await db.execute(delete(Theme).where(Theme.id.in_(data.theme_ids)))
    deleted_themes = result.rowcount

    await db.commit()
    return {"success": True, "deleted_themes": deleted_themes, "deleted_questions": deleted_questions}


@router.get("/questions-browse")
async def browse_questions(theme_id: str, limit: int = 200, offset: int = 0, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Question).where(Question.category == theme_id)
        .order_by(Question.question_text).limit(min(limit, 500)).offset(offset)
    )
    questions = res.scalars().all()
    total = await db.execute(select(func.count(Question.id)).where(Question.category == theme_id))
    return {
        "total": total.scalar() or 0,
        "questions": [{"id": q.id, "text": q.question_text, "difficulty": q.difficulty or ""} for q in questions]
    }


@router.post("/questions/bulk-delete")
async def bulk_delete_questions(request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="ids requis")
    # Get affected theme ids for counter update
    themes_res = await db.execute(select(Question.category).where(Question.id.in_(ids)).distinct())
    theme_ids = [r[0] for r in themes_res]
    result = await db.execute(delete(Question).where(Question.id.in_(ids)))
    deleted = result.rowcount
    for tid in theme_ids:
        count_res = await db.execute(select(func.count(Question.id)).where(Question.category == tid))
        theme_res = await db.execute(select(Theme).where(Theme.id == tid))
        theme = theme_res.scalar_one_or_none()
        if theme:
            theme.question_count = count_res.scalar() or 0
    await db.commit()
    return {"success": True, "deleted": deleted}


@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question introuvable")
    theme_id = question.category
    await db.delete(question)
    # Mise à jour du compteur du thème
    count_res = await db.execute(select(func.count(Question.id)).where(Question.category == theme_id))
    theme_res = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = theme_res.scalar_one_or_none()
    if theme:
        theme.question_count = count_res.scalar() or 0
    await db.commit()
    return {"success": True}


@router.get("/avatars")
async def list_avatars(_: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Avatar).order_by(Avatar.category, Avatar.created_at))
    avatars = result.scalars().all()
    return {"avatars": [
        {"id": a.id, "name": a.name, "image_url": a.image_url, "category": a.category}
        for a in avatars
    ]}


@router.post("/avatars/upload")
async def upload_avatar(request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    category = body.get("category", "default").strip()
    image_b64 = body.get("image_base64", "")
    original_filename = body.get("filename", "").strip()

    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 required")

    # Validate MIME type via magic bytes before writing
    try:
        image_data = validate_image_base64(image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(image_data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 5 MB)")

    # Build filename from original name (sanitized) or fallback to UUID
    if original_filename:
        safe_stem = re.sub(r'[^\w\-]', '_', Path(original_filename).stem)[:60]
        base_filename = f"{safe_stem}.webp"
    else:
        base_filename = f"{str(uuid.uuid4())[:12]}.webp"

    # Handle conflicts: append counter if file already exists
    avatars_dir = ROOT_DIR / "static" / "avatars"
    filepath = avatars_dir / base_filename
    if filepath.exists():
        stem = Path(base_filename).stem
        counter = 1
        while filepath.exists():
            filepath = avatars_dir / f"{stem}_{counter}.webp"
            counter += 1
    filename = filepath.name

    with open(filepath, "wb") as f:
        f.write(image_data)

    avatar = Avatar(name=filename, image_url=f"avatars/{filename}", category=category)
    db.add(avatar)
    await db.commit()
    await db.refresh(avatar)

    return {"success": True, "avatar": {"id": avatar.id, "name": avatar.name, "image_url": avatar.image_url, "category": avatar.category}}


@router.patch("/avatars/{avatar_id}")
async def rename_avatar(avatar_id: str, request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    new_name = body.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="name requis")
    result = await db.execute(select(Avatar).where(Avatar.id == avatar_id))
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar introuvable")
    avatar.name = re.sub(r'[^\w\-. ]', '_', new_name)[:80]
    await db.commit()
    return {"success": True, "name": avatar.name}


@router.delete("/avatars/{avatar_id}")
async def delete_avatar(avatar_id: str, request: Request, _: None = Depends(verify_admin_key), db: AsyncSession = Depends(get_db)):
    body = await request.json()
    result = await db.execute(select(Avatar).where(Avatar.id == avatar_id))
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar introuvable")

    # Delete file — validate path stays within static/avatars to prevent path traversal
    static_dir = (ROOT_DIR / "static" / "avatars").resolve()
    filepath = (ROOT_DIR / "static" / avatar.image_url).resolve()
    if filepath.is_relative_to(static_dir) and filepath.exists():
        os.remove(filepath)

    # Null out users who had this avatar
    await db.execute(update(User).where(User.avatar_id == avatar_id).values(avatar_id=None, avatar_url=None))

    await db.delete(avatar)
    await db.commit()
    return {"success": True}

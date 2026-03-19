"""Ultra-fast CSV data importer using asyncpg directly."""
import asyncio
import csv
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import asyncpg

ANSWER_MAP = {"A": 0, "B": 1, "C": 2, "D": 3}

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def import_data(themes_path: str, questions_path: str):
    """Import themes and questions using asyncpg for maximum speed."""
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # ── Import Themes ──
        print("Importing themes...")
        with open(themes_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            themes_count = 0
            for row in reader:
                theme_id = row.get("ID_Theme", "").strip()
                if not theme_id:
                    continue
                
                await conn.execute("""
                    INSERT INTO themes (id, super_category, cluster, name, description, color_hex,
                                       title_lv1, title_lv10, title_lv20, title_lv35, title_lv50,
                                       icon_url, question_count, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        super_category = $2, cluster = $3, name = $4, description = $5,
                        color_hex = $6, title_lv1 = $7, title_lv10 = $8, title_lv20 = $9,
                        title_lv35 = $10, title_lv50 = $11, icon_url = $12
                """,
                    theme_id,
                    row.get("Super_Categorie", "").strip(),
                    row.get("Cluster", "").strip(),
                    row.get("Nom_Public", "").strip(),
                    row.get("Description", "").strip(),
                    row.get("Couleur_Hex", "").strip(),
                    row.get("Titre_Niv_1", "").strip(),
                    row.get("Titre_Niv_10", "").strip(),
                    row.get("Titre_Niv_20", "").strip(),
                    row.get("Titre_Niv_35", "").strip(),
                    row.get("Titre_Niv_50", "").strip(),
                    row.get("URL_Icone", "").strip() or None,
                )
                themes_count += 1
        
        print(f"  {themes_count} themes imported")

        # ── Import Questions using executemany ──
        print("Importing questions...")
        with open(questions_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch = []
            questions_count = 0
            
            for row in reader:
                q_id = row.get("ID", "").strip()
                theme_id = row.get("Catégorie", row.get("Categorie", "")).strip()
                question_text = row.get("Question", "").strip()
                if not q_id or not question_text:
                    continue
                
                rep_a = row.get("Rep A", "").strip()
                rep_b = row.get(" Rep B", row.get("Rep B", "")).strip()
                rep_c = row.get("Rep C", "").strip()
                rep_d = row.get("Rep D", "").strip()
                bonne_rep = row.get("Bonne rep", "").strip().upper()
                difficulte = row.get("Difficulté", row.get("Difficulte", "")).strip()
                angle = row.get("Angle", "").strip()
                angle_num_str = row.get("Angle Num", "").strip()

                correct_option = ANSWER_MAP.get(bonne_rep, 0)
                options_json = json.dumps([rep_a, rep_b, rep_c, rep_d])
                
                try:
                    angle_num = int(angle_num_str)
                except (ValueError, TypeError):
                    angle_num = 0

                batch.append((q_id, theme_id, question_text, options_json, correct_option, difficulte, angle, angle_num))
                
                if len(batch) >= 1000:
                    await _insert_batch(conn, batch)
                    questions_count += len(batch)
                    batch = []
                    if questions_count % 5000 == 0:
                        print(f"  ... {questions_count} questions inserted")
            
            if batch:
                await _insert_batch(conn, batch)
                questions_count += len(batch)
        
        print(f"  {questions_count} questions imported")

        # ── Update question counts ──
        print("Updating question counts...")
        await conn.execute("""
            UPDATE themes SET question_count = sub.cnt
            FROM (SELECT category, COUNT(*) as cnt FROM questions GROUP BY category) sub
            WHERE themes.id = sub.category
        """)
        
        # Verify
        rows = await conn.fetch("SELECT id, name, question_count FROM themes ORDER BY cluster, name")
        for row in rows:
            print(f"  {row['id']}: {row['name']} ({row['question_count']} questions)")
    
    finally:
        await conn.close()
    
    print("\nImport complete!")


async def _insert_batch(conn, batch):
    """Insert a batch using executemany."""
    await conn.executemany("""
        INSERT INTO questions (id, category, question_text, options, correct_option, difficulty, angle, angle_num, created_at)
        VALUES ($1, $2, $3, $4::json, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
            category = $2, question_text = $3, options = $4::json,
            correct_option = $5, difficulty = $6, angle = $7, angle_num = $8
    """, batch)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python fast_import.py <themes.csv> <questions.csv>")
        sys.exit(1)
    
    asyncio.run(import_data(sys.argv[1], sys.argv[2]))

"""Planche de contrôle des icônes de thèmes : HTML (à ouvrir) + PNG (relecture rapide).

Usage (depuis frontend/) :
  python scripts/theme-icons-preview.py --cluster "Séries TV" --out ../docs/design/icones/series-tv
  python scripts/theme-icons-preview.py --ids ARE_CLRY,STV_BBAD --out /tmp/essai
  python scripts/theme-icons-preview.py --all --out ../docs/design/icones/catalogue

Chaque icône est montrée sur sa plaque crème à 128 / 64 / 48 / 32 px (comme dans l'app)
et sans plaque sur fond nuit à 64 px. Les thèmes sans icône personnalisée sont listés à part.
"""
import argparse
import html
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEMES_DIR = os.path.join(ROOT, "assets", "theme-icons", "themes")
CATALOGUE = os.path.join(ROOT, "scripts", "theme-catalogue.json")

CREAM, NIGHT, PETROL = "#E8F1EC", "#071F26", "#0B3D4A"
PLATE_BORDER = "rgba(11,61,74,0.18)"


def svg_inner(path):
    raw = open(path, encoding="utf-8").read()
    return raw[raw.index(">", raw.index("<svg")) + 1: raw.rindex("</svg>")]


def plate(inner, size):
    r = max(8, round(size * 14 / 56))
    ill = round(size * 0.78)
    return (f'<div class="plate" style="width:{size}px;height:{size}px;border-radius:{r}px">'
            f'<svg viewBox="0 0 256 256" width="{ill}" height="{ill}">{inner}</svg></div>')


def build_html(items, missing, title):
    cards = []
    for t, path in items:
        inner = svg_inner(path)
        cards.append(
            '<figure>'
            f'<div class="row">{plate(inner, 128)}<div class="col">{plate(inner, 64)}{plate(inner, 48)}{plate(inner, 32)}</div>'
            f'<div class="night"><svg viewBox="0 0 256 256" width="64" height="64">{inner}</svg></div></div>'
            f'<figcaption><b>{html.escape(t["name"])}</b><span>{t["id"]} · {html.escape(t["cluster"])}</span></figcaption>'
            '</figure>')
    miss = "".join(f"<li>{html.escape(t['name'])} <span>{t['id']}</span></li>" for t in missing)
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(title)}</title>
<style>
:root{{--bg:{NIGHT};--card:{PETROL};--ink:{CREAM};--muted:rgba(232,241,236,.66);--line:rgba(232,241,236,.12)}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,"Segoe UI",sans-serif;padding:24px 16px}}
h1{{font-size:22px;margin:0 0 4px}}p{{color:var(--muted);margin:0 0 20px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}
figure{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px}}
.row{{display:flex;gap:12px;align-items:center}}.col{{display:flex;flex-direction:column;gap:6px;align-items:center}}
.plate{{background:{CREAM};border:1px solid {PLATE_BORDER};display:flex;align-items:center;justify-content:center}}
.night{{background:{NIGHT};border-radius:12px;padding:8px;margin-left:auto}}
figcaption{{margin-top:8px;display:flex;flex-direction:column}}figcaption span{{color:var(--muted);font-size:12px}}
ul{{columns:3;color:var(--muted)}}li span{{opacity:.6;font-size:12px}}
</style></head><body><h1>{html.escape(title)}</h1>
<p>{len(items)} icônes · plaque crème 128 / 64 / 48 / 32 px · sans plaque sur fond nuit 64 px</p>
<div class="grid">{''.join(cards)}</div>
{f'<h2>Sans icône personnalisée ({len(missing)})</h2><ul>{miss}</ul>' if missing else ''}
</body></html>"""


def build_png(items, out_png):
    import pymupdf
    cols, cw, ch = 6, 200, 196
    rows = (len(items) + cols - 1) // cols
    doc = pymupdf.open()
    page = doc.new_page(width=cols * cw, height=max(1, rows) * ch)
    page.draw_rect(page.rect, color=None, fill=(0.027, 0.122, 0.149))
    cream = (0.91, 0.945, 0.925)
    for i, (t, path) in enumerate(items):
        x, y = (i % cols) * cw, (i // cols) * ch
        pdf = pymupdf.open("pdf", pymupdf.open(path).convert_to_pdf())
        for (px, py, s) in [(x + 8, y + 8, 112), (x + 128, y + 8, 48), (x + 128, y + 64, 32), (x + 168, y + 64, 24)]:
            page.draw_rect(pymupdf.Rect(px, py, px + s, py + s), color=None, fill=cream, radius=0.22)
            m = s * 0.11
            page.show_pdf_page(pymupdf.Rect(px + m, py + m, px + s - m, py + s - m), pdf, 0)
        page.show_pdf_page(pymupdf.Rect(x + 128, y + 104, x + 176, y + 152), pdf, 0)
        page.insert_text((x + 8, y + 140), t["name"][:26], fontsize=11, color=cream)
        page.insert_text((x + 8, y + 156), t["id"], fontsize=9, color=(0.6, 0.7, 0.68))
    page.get_pixmap(dpi=96).save(out_png)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--cluster")
    g.add_argument("--ids")
    g.add_argument("--all", action="store_true")
    ap.add_argument("--out", required=True, help="chemin sans extension (.html et .png écrits)")
    a = ap.parse_args()

    themes = json.load(open(CATALOGUE, encoding="utf-8"))["themes"]
    if a.cluster:
        sel = [t for t in themes if t["cluster"] == a.cluster]
        title = f"Icônes SKILKI · {a.cluster}"
    elif a.ids:
        ids = a.ids.split(",")
        sel = [t for t in themes if t["id"] in ids]
        title = "Icônes SKILKI · sélection"
    else:
        sel = themes
        title = "Icônes SKILKI · catalogue"
    items = [(t, os.path.join(THEMES_DIR, t["id"] + ".svg")) for t in sel]
    have = [(t, p) for t, p in items if os.path.exists(p)]
    missing = [t for t, p in items if not os.path.exists(p)]

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out + ".html", "w", encoding="utf-8").write(build_html(have, missing, title))
    # Au-delà de 200 icônes, l'image d'une seule page devient énorme et très lente : HTML seul
    png = 0 < len(have) <= 200
    if png:
        build_png(have, a.out + ".png")
    print(f"{len(have)} icônes, {len(missing)} manquantes → {a.out}.html" + (" + .png" if png else ""))


if __name__ == "__main__":
    main()

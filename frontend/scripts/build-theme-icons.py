"""Génère theme/themeIcons.generated.ts à partir des SVG SKILKI.

Usage :  python scripts/build-theme-icons.py          (depuis frontend/)
         python scripts/build-theme-icons.py --check  (vérifie seulement, n'écrit rien)

Sources :
  assets/theme-icons/*.svg          icônes génériques (repli par cluster / univers)
  assets/theme-icons/themes/*.svg   une icône PERSONNALISÉE par thème, nommée par son id (ARE_CLRY.svg)

Le script VÉRIFIE d'abord chaque SVG contre les règles de la série (et s'arrête en cas
d'erreur bloquante), puis écrit un module TS lu par <ThemeIcon> via react-native-svg.

Règles bloquantes : viewBox 0 0 256 256 · couleurs de la palette SKILKI uniquement ·
2 à 4 couleurs · aucun élément interdit (image, foreignObject, filter, gradients, text) ·
au plus 18 formes · pas deux icônes identiques · id de thème présent au catalogue.
Avertissements : plus de 14 formes (hors groupes) · épaisseur de trait hors {4, 6, 8, 10, 12, 20}.
"""
import hashlib
import json
import os
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "theme-icons")
SRC_THEMES = os.path.join(SRC, "themes")
CATALOGUE = os.path.join(ROOT, "scripts", "theme-catalogue.json")
OUT = os.path.join(ROOT, "theme", "themeIcons.generated.ts")

PALETTE = {"#0B3D4A", "#12606D", "#FF6B5B", "#FFDB3D", "#E8F1EC"}
FORBIDDEN = {"image", "foreignObject", "filter", "linearGradient", "radialGradient", "text", "pattern", "mask", "clipPath"}
SHAPES = {"path", "circle", "rect", "ellipse", "polygon", "line", "polyline"}
ALLOWED = SHAPES | {"g", "svg"}
STROKES = {4, 6, 8, 10, 12, 20}
MAX_SHAPES, WARN_SHAPES = 18, 14
NS = "{http://www.w3.org/2000/svg}"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def camel(attr: str) -> str:
    return re.sub(r"-([a-z])", lambda m: m.group(1).upper(), attr)


def node(el):
    tag = el.tag.replace(NS, "")
    props = {}
    for k, v in el.attrib.items():
        if k in ("role", "aria-label"):
            continue
        props[camel(k)] = float(v) if re.fullmatch(r"-?\d+(\.\d+)?", v) else v
    out = {"t": tag, "p": props}
    kids = [node(c) for c in el]
    if kids:
        out["c"] = kids
    return out


def check(svg):
    errors, warnings = [], []
    if svg.attrib.get("viewBox") != "0 0 256 256":
        errors.append("viewBox doit être 0 0 256 256")
    colors, shapes = set(), 0
    for el in svg.iter():
        tag = el.tag.replace(NS, "")
        if tag in FORBIDDEN or tag not in ALLOWED:
            errors.append(f"élément interdit : <{tag}>")
        if tag in SHAPES:
            shapes += 1
        for attr in ("fill", "stroke"):
            v = el.attrib.get(attr)
            if v and v != "none":
                if v.upper() not in PALETTE:
                    errors.append(f"couleur hors palette : {v}")
                colors.add(v.upper())
        sw = el.attrib.get("stroke-width")
        if sw and float(sw) not in STROKES:
            warnings.append(f"épaisseur de trait {sw} hors série")
    if not 2 <= len(colors) <= 4:
        errors.append(f"{len(colors)} couleurs (attendu 2 à 4)")
    if shapes > MAX_SHAPES:
        errors.append(f"{shapes} formes (maximum {MAX_SHAPES} : illisible à 32 px)")
    elif shapes > WARN_SHAPES:
        warnings.append(f"{shapes} formes (cible ≤ {WARN_SHAPES})")
    return errors, sorted(set(warnings))


def load(folder, valid_ids=None):
    out, failed = {}, False
    if not os.path.isdir(folder):
        return out, failed
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".svg"):
            continue
        name = f[:-4]
        if valid_ids is not None and name not in valid_ids:
            print(f"  ✗ {name}: id absent du catalogue (scripts/theme-catalogue.json)")
            failed = True
            continue
        try:
            svg = ET.parse(os.path.join(folder, f)).getroot()
        except ET.ParseError as e:
            print(f"  ✗ {name}: SVG invalide ({e})")
            failed = True
            continue
        errors, warnings = check(svg)
        for w in warnings:
            print(f"  ! {name}: {w}")
        for e in errors:
            print(f"  ✗ {name}: {e}")
        if errors:
            failed = True
            continue
        out[name] = [node(c) for c in svg]
    return out, failed


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # console Windows : ✗, →, accents
    unknown = [a for a in sys.argv[1:] if a != "--check"]
    if unknown:
        sys.exit(__doc__)  # --help ou option inconnue : afficher l'aide, ne rien écrire
    catalogue = json.load(open(CATALOGUE, encoding="utf-8"))["themes"]
    by_id = {t["id"]: t for t in catalogue}

    generic, f1 = load(SRC)
    themed, f2 = load(SRC_THEMES, set(by_id))
    failed = f1 or f2

    # Deux icônes identiques = un doublon visuel (copier-coller d'un thème à l'autre)
    seen = {}
    for name, nodes in {**generic, **themed}.items():
        h = hashlib.sha1(json.dumps(nodes, sort_keys=True).encode()).hexdigest()
        if h in seen:
            print(f"  ✗ {name}: identique à {seen[h]}")
            failed = True
        seen[h] = name
    if failed:
        sys.exit("Échec : corriger les SVG avant de générer.")
    if "--check" in sys.argv:
        print(f"✓ {len(generic)} génériques + {len(themed)} personnalisées conformes (rien écrit)")
        return

    icons = {**generic, **themed}
    # Nom de thème normalisé → id (les écrans ne connaissent souvent que le nom)
    name_to_id = {}
    for tid in themed:
        name_to_id.setdefault(norm(by_id[tid]["name"]), tid)

    names = " | ".join(f"'{n}'" for n in icons)
    body = json.dumps(icons, ensure_ascii=False, separators=(",", ":"))
    ts = (
        "// FICHIER GÉNÉRÉ par scripts/build-theme-icons.py — ne pas modifier à la main.\n"
        "// Sources : assets/theme-icons/*.svg (génériques) et assets/theme-icons/themes/<id>.svg\n"
        "// (une icône personnalisée par thème), style SKILKI V2 validé.\n\n"
        "export type SvgNode = { t: string; p: Record<string, string | number>; c?: SvgNode[] };\n\n"
        f"export type ThemeIconName = {names};\n\n"
        f"export const THEME_ICONS: Record<ThemeIconName, SvgNode[]> = {body};\n\n"
        "/** Nom de thème normalisé → id du thème qui a une icône personnalisée. */\n"
        f"export const THEME_ID_BY_NAME: Record<string, ThemeIconName> = {json.dumps(name_to_id, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(ts)
    total = len(catalogue)
    print(f"{len(generic)} icônes génériques + {len(themed)} personnalisées "
          f"({len(themed)}/{total} thèmes, {round(100 * len(themed) / total)} %) → {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()

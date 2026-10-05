"""Génère theme/themeIcons.generated.ts à partir des SVG SKILKI de assets/theme-icons/.

Usage :  python scripts/build-theme-icons.py          (depuis frontend/)

Le script VÉRIFIE d'abord chaque SVG contre les règles de la série (et s'arrête en cas
d'erreur bloquante), puis écrit un module TS lu par <ThemeIcon> via react-native-svg.

Règles bloquantes : viewBox 0 0 256 256 · couleurs de la palette SKILKI uniquement ·
2 à 4 couleurs · aucun élément interdit (image, foreignObject, filter, gradients, text).
Avertissements : plus de 14 formes (hors groupes) · épaisseur de trait hors {4, 6, 8, 10, 12, 20}.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "theme-icons")
OUT = os.path.join(ROOT, "theme", "themeIcons.generated.ts")

PALETTE = {"#0B3D4A", "#12606D", "#FF6B5B", "#FFDB3D", "#E8F1EC"}
FORBIDDEN = {"image", "foreignObject", "filter", "linearGradient", "radialGradient", "text", "pattern", "mask"}
SHAPES = {"path", "circle", "rect", "ellipse", "polygon", "line", "polyline"}
ALLOWED = SHAPES | {"g", "svg"}
STROKES = {4, 6, 8, 10, 12, 20}
NS = "{http://www.w3.org/2000/svg}"


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


def check(name, svg):
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
    if shapes > 14:
        warnings.append(f"{shapes} formes (cible ≤ 14)")
    return errors, sorted(set(warnings))


def main():
    icons, failed = {}, False
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".svg"):
            continue
        name = f[:-4]
        svg = ET.parse(os.path.join(SRC, f)).getroot()
        errors, warnings = check(name, svg)
        for w in warnings:
            print(f"  ! {name}: {w}")
        for e in errors:
            print(f"  ✗ {name}: {e}")
        if errors:
            failed = True
            continue
        icons[name] = [node(c) for c in svg]
    if failed:
        sys.exit("Échec : corriger les SVG avant de générer.")

    names = " | ".join(f"'{n}'" for n in icons)
    body = json.dumps(icons, ensure_ascii=False, indent=1)
    ts = (
        "// FICHIER GÉNÉRÉ par scripts/build-theme-icons.py — ne pas modifier à la main.\n"
        "// Source : assets/theme-icons/*.svg (style SKILKI V2 validé).\n\n"
        "export type SvgNode = { t: string; p: Record<string, string | number>; c?: SvgNode[] };\n\n"
        f"export type ThemeIconName = {names};\n\n"
        f"export const THEME_ICONS: Record<ThemeIconName, SvgNode[]> = {body};\n"
    )
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(ts)
    print(f"{len(icons)} icônes écrites dans {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()

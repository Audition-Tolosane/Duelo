"""
Génère frontend/assets/map-paths.json depuis Natural Earth 110m.
Projection équirectangulaire : x = (lon+180)/360*1000, y = (90-lat)/180*500
Aucune dépendance externe — stdlib uniquement.
"""
import json
import urllib.request
import math

SVG_W = 1000
SVG_H = 500

URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_110m_admin_0_countries.geojson"
)

OUTPUT = r"frontend/assets/map-paths.json"


def to_xy(lon: float, lat: float):
    x = (lon + 180) / 360 * SVG_W
    y = (90 - lat) / 180 * SVG_H
    return round(x, 1), round(y, 1)


def ring_to_path(ring) -> str:
    """Convertit un anneau [lon,lat] en commande SVG M…L…Z."""
    if len(ring) < 3:
        return ""
    pts = [to_xy(c[0], c[1]) for c in ring]
    # Déduplique les points consécutifs identiques
    deduped = [pts[0]]
    for p in pts[1:]:
        if p != deduped[-1]:
            deduped.append(p)
    if len(deduped) < 3:
        return ""
    cmd = "M" + "L".join(f"{x},{y}" for x, y in deduped) + "Z"
    return cmd


def geometry_to_paths(geom: dict) -> list[str]:
    """Retourne la liste des chemins SVG pour une géométrie GeoJSON."""
    paths = []
    gtype = geom.get("type", "")

    if gtype == "Polygon":
        polygons = [geom["coordinates"]]
    elif gtype == "MultiPolygon":
        polygons = geom["coordinates"]
    else:
        return paths

    for polygon in polygons:
        if not polygon:
            continue
        # Anneau extérieur uniquement (index 0) — ignore les trous
        outer = polygon[0]
        p = ring_to_path(outer)
        if p:
            paths.append(p)

    return paths


def main():
    print(f"Téléchargement depuis Natural Earth…")
    try:
        with urllib.request.urlopen(URL, timeout=30) as resp:
            raw = resp.read()
        data = json.loads(raw)
    except Exception as e:
        print(f"Erreur téléchargement : {e}")
        return

    print(f"{len(data['features'])} pays trouvés, conversion en SVG…")

    all_paths: list[str] = []
    for feature in data["features"]:
        geom = feature.get("geometry")
        if not geom:
            continue
        all_paths.extend(geometry_to_paths(geom))

    print(f"{len(all_paths)} chemins SVG générés")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(all_paths, f, separators=(",", ":"))

    size_kb = len(json.dumps(all_paths, separators=(",", ":"))) / 1024
    print(f"Fichier écrit : {OUTPUT}  ({size_kb:.1f} Ko)")
    print("Terminé ✓")


if __name__ == "__main__":
    main()

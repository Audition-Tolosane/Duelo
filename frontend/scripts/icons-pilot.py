"""Pilote de production des icônes de thèmes : enchaîne des sessions Claude Code de 10 icônes.

À lancer SOI-MÊME dans un terminal (hors conversation Claude), depuis frontend/ :

    python scripts/icons-pilot.py --dry-run            # montre les lots prévus, ne lance rien
    python scripts/icons-pilot.py                      # produit toutes les icônes manquantes
    python scripts/icons-pilot.py --univers SCREEN     # un seul univers
    python scripts/icons-pilot.py --cluster "Séries TV" --max-lots 3
    python scripts/icons-pilot.py --parallele 2        # 2 sessions en même temps (plus rapide, plus de quota)

Arrêt propre : créer le fichier  frontend/scripts/icons-pilot.STOP  (le lot en cours se termine).
Reprise : relancer la même commande — les thèmes qui ont déjà leur SVG sont sautés.

Pour chaque lot de 10 thèmes d'un même cluster, le script :
  1. lance `claude -p` (mode dontAsk : seuls Read / Write / Edit / Glob / Grep et les deux scripts
     python d'icônes sont autorisés) avec le brief, la liste des thèmes et les symboles déjà pris ;
  2. vérifie le lot (`build-theme-icons.py --check`) ; une icône en erreur est déplacée dans
     assets/theme-icons/rejets/ et sera retentée au prochain passage ;
  3. note le résultat dans docs/design/icones/journal.csv.
Si Claude signale une limite d'utilisation, le pilote attend puis reprend le même lot.
À la fin : génération du module TS et planche globale docs/design/icones/catalogue.html.
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # frontend/
DOCS = os.path.normpath(os.path.join(ROOT, "..", "docs", "design", "icones"))
THEMES_DIR = os.path.join(ROOT, "assets", "theme-icons", "themes")
REJETS_DIR = os.path.join(ROOT, "assets", "theme-icons", "rejets")
CATALOGUE = os.path.join(ROOT, "scripts", "theme-catalogue.json")
REGISTRE_DIR = os.path.join(DOCS, "registre")       # un JSON par lot : [{id, symbole}]
LOTS_DIR = os.path.join(DOCS, "lots")               # planches de chaque lot
JOURNAL = os.path.join(DOCS, "journal.csv")
SESSIONS_DIR = os.path.join(ROOT, "scripts", "icons-sessions")   # sortie brute de chaque session (diagnostic)
STOP_FILE = os.path.join(ROOT, "scripts", "icons-pilot.STOP")
CLAUDE = shutil.which("claude") or "claude"

ALLOWED_TOOLS = [
    "Read", "Write", "Edit", "Glob", "Grep",
    "Bash(python scripts/build-theme-icons.py --check)",
    "Bash(python scripts/theme-icons-preview.py:*)",
]
LIMIT_PATTERNS = re.compile(r"usage limit|rate limit|limit reached|quota|overloaded|429|529", re.I)


def log(msg):
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().encode("ascii", "ignore").decode()).strip("-")


def load_catalogue():
    return json.load(open(CATALOGUE, encoding="utf-8"))["themes"]


def done_ids():
    return {f[:-4] for f in os.listdir(THEMES_DIR) if f.endswith(".svg")}


def registre():
    """Tous les symboles déjà choisis : {id: symbole}."""
    out = {}
    if os.path.isdir(REGISTRE_DIR):
        for f in sorted(os.listdir(REGISTRE_DIR)):
            if f.endswith(".json"):
                try:
                    for e in json.load(open(os.path.join(REGISTRE_DIR, f), encoding="utf-8")):
                        out[e["id"]] = e.get("symbole", "")
                except Exception:
                    pass
    return out


def plan_lots(themes, size, univers=None, cluster=None):
    have = done_ids()
    todo = [t for t in themes if t["id"] not in have
            and (not univers or t["universe"] == univers)
            and (not cluster or t["cluster"] == cluster)]
    lots, cur, key = [], [], None
    for t in todo:                                  # le catalogue est trié univers > cluster > nom
        k = (t["universe"], t["cluster"])
        if cur and (k != key or len(cur) == size):
            lots.append(cur)
            cur = []
        cur.append(t)
        key = k
    if cur:
        lots.append(cur)
    return lots


def build_prompt(lot, lot_name, by_id, reg):
    u, c = lot[0]["universe"], lot[0]["cluster"]
    ids = ",".join(t["id"] for t in lot)
    themes_txt = "\n".join(f"- {t['id']} | {t['name']} | {t['description']}" for t in lot)
    same_cluster = [f"- {by_id[i]['name']} : {s}" for i, s in reg.items() if i in by_id and by_id[i]["cluster"] == c]
    same_univ = [f"- {by_id[i]['name']} : {s}" for i, s in reg.items()
                 if i in by_id and by_id[i]["universe"] == u and by_id[i]["cluster"] != c]
    others = sorted({s for i, s in reg.items() if i in by_id and by_id[i]["universe"] != u})
    same_files = [f"assets/theme-icons/themes/{i}.svg" for i in reg if i in by_id and by_id[i]["cluster"] == c][:3]
    return f"""Tu produis des icônes SVG de thèmes pour l'app de quiz SKILKI. Le dossier courant est `frontend/`.

1. Lis INTÉGRALEMENT le brief : ../docs/design/icones/BRIEF.md (règles de série bloquantes, personnalisation, droits, méthode).
2. Lis les références de style : les 13 icônes génériques assets/theme-icons/*.svg{(' et ' + ', '.join(same_files)) if same_files else ''}.

LOT {lot_name} — univers {u}, cluster « {c} ». Dessine UNE icône personnalisée pour CHACUN de ces {len(lot)} thèmes (fichier assets/theme-icons/themes/<ID>.svg, id exact) :
{themes_txt}

SYMBOLES DÉJÀ PRIS — ne réutilise jamais le même objet principal :
• même cluster :
{chr(10).join(same_cluster) or '(aucun)'}
• même univers, autres clusters :
{chr(10).join(same_univ) or '(aucun)'}
• autres univers (objets principaux) : {', '.join(others) or '(aucun)'}

Méthode obligatoire (commandes à lancer avec l'outil Bash, JAMAIS PowerShell, qui est refusé ici) :
- après avoir écrit tes SVG : `python scripts/build-theme-icons.py --check` et corrige TES erreurs (ignore celles d'autres fichiers) ;
- planche : `python scripts/theme-icons-preview.py --ids {ids} --out ../docs/design/icones/lots/{lot_name}` puis Read du PNG ;
  relis chaque icône (reconnaissable ? lisible à 32 px ? silhouette sur fond nuit ? doublon ?), corrige, refais la planche une fois ;
  cette relecture n'est PAS facultative : sans elle la qualité baisse nettement ;
- ENFIN écris ../docs/design/icones/registre/{lot_name}.json : un tableau JSON [{{"id": "...", "symbole": "objet principal en 2 à 5 mots"}}] pour les {len(lot)} thèmes.
Ne modifie aucun autre fichier. Ne lance pas `build-theme-icons.py` sans `--check`. Termine par une ligne : FIN {lot_name}.
"""


def check_lot(lot):
    """Renvoie (ok_ids, ko: {id: [erreurs]})."""
    r = subprocess.run([sys.executable, "scripts/build-theme-icons.py", "--check"], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    errs = {}
    for line in (r.stdout + r.stderr).splitlines():
        m = re.match(r"\s*✗ (\S+): (.*)", line)
        if m:
            errs.setdefault(m.group(1), []).append(m.group(2))
    ok, ko = [], {}
    for t in lot:
        i = t["id"]
        if not os.path.exists(os.path.join(THEMES_DIR, i + ".svg")):
            ko[i] = ["SVG absent"]
        elif i in errs:
            ko[i] = errs[i]
        else:
            ok.append(i)
    return ok, ko


def journal(row):
    new = not os.path.exists(JOURNAL)
    with open(JOURNAL, "a", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, delimiter=";")
        if new:
            w.writerow(["date", "lot", "univers", "cluster", "themes", "ok", "rejets", "duree_s", "detail"])
        w.writerow(row)


def run_lot(lot, lot_name, by_id, args):
    attempts = 0
    while True:
        if os.path.exists(STOP_FILE):
            return "stop"
        prompt = build_prompt(lot, lot_name, by_id, registre())
        cmd = [CLAUDE, "-p", "--permission-mode", "dontAsk", "--output-format", "json",
               "--allowedTools", *ALLOWED_TOOLS, "--disallowedTools", "PowerShell"]
        if args.model:
            cmd += ["--model", args.model]
        t0 = time.time()
        log(f"▶ {lot_name} ({len(lot)} thèmes : {', '.join(t['name'] for t in lot)})")
        try:
            r = subprocess.run(cmd, input=prompt, cwd=ROOT, capture_output=True, text=True,
                               encoding="utf-8", errors="replace", timeout=args.timeout * 60)
            out = r.stdout + r.stderr
        except subprocess.TimeoutExpired:
            out, r = "TIMEOUT", None
        duree = int(time.time() - t0)
        os.makedirs(SESSIONS_DIR, exist_ok=True)
        with open(os.path.join(SESSIONS_DIR, f"{lot_name}.txt"), "w", encoding="utf-8") as fh:
            fh.write(out)
        if r is not None and r.returncode != 0 and LIMIT_PATTERNS.search(out):
            attempts += 1
            log(f"⏸ limite d'utilisation détectée ({lot_name}) — attente {args.pause} min puis reprise")
            journal([dt.datetime.now().isoformat(timespec="seconds"), lot_name, lot[0]["universe"], lot[0]["cluster"],
                     len(lot), 0, 0, duree, "limite d'utilisation, attente"])
            for _ in range(args.pause * 6):
                if os.path.exists(STOP_FILE):
                    return "stop"
                time.sleep(10)
            if attempts > args.max_attente:
                return "limite"
            continue
        ok, ko = check_lot(lot)
        os.makedirs(REJETS_DIR, exist_ok=True)
        for i in ko:
            p = os.path.join(THEMES_DIR, i + ".svg")
            if os.path.exists(p):
                shutil.move(p, os.path.join(REJETS_DIR, f"{i}.{dt.datetime.now():%Y%m%d%H%M%S}.svg"))
        detail = " | ".join(f"{i}: {', '.join(e)}" for i, e in ko.items())[:500]
        planche = os.path.join(LOTS_DIR, lot_name)
        if not os.path.exists(planche + ".png") and ok:
            # La session n'a pas fait sa relecture : planche générée ici pour la relecture humaine
            subprocess.run([sys.executable, "scripts/theme-icons-preview.py", "--ids", ",".join(ok), "--out", planche],
                           cwd=ROOT, capture_output=True)
            detail = ("SANS RELECTURE (planche absente) " + detail).strip()
        if r is None:
            detail = "session interrompue (délai dépassé) " + detail
        journal([dt.datetime.now().isoformat(timespec="seconds"), lot_name, lot[0]["universe"], lot[0]["cluster"],
                 len(lot), len(ok), len(ko), duree, detail])
        log(f"{'✓' if not ko else '⚠'} {lot_name} : {len(ok)}/{len(lot)} conformes, {len(ko)} rejet(s) — {duree} s")
        return "ok"


def finish():
    log("Génération du module TS…")
    subprocess.run([sys.executable, "scripts/build-theme-icons.py"], cwd=ROOT)
    subprocess.run([sys.executable, "scripts/theme-icons-preview.py", "--all", "--out",
                    os.path.join(DOCS, "catalogue")], cwd=ROOT)
    log(f"Planche globale : {os.path.join(DOCS, 'catalogue.html')}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Pilote des sessions Claude de production d'icônes (10 par lot).")
    ap.add_argument("--taille", type=int, default=10, help="thèmes par session (défaut 10)")
    ap.add_argument("--univers", help="ARENA, ART, GLOBE, LAB, LEGENDS, LIFE, MIND, SCREEN, SOUND")
    ap.add_argument("--cluster", help="nom exact du cluster")
    ap.add_argument("--max-lots", type=int, default=0, help="arrêter après N lots (0 = tous)")
    ap.add_argument("--parallele", type=int, default=1, help="sessions simultanées (défaut 1)")
    ap.add_argument("--model", help="modèle Claude (défaut : celui de Claude Code)")
    ap.add_argument("--timeout", type=int, default=40, help="minutes max par session (défaut 40)")
    ap.add_argument("--pause", type=int, default=20, help="minutes d'attente sur limite d'utilisation (défaut 20)")
    ap.add_argument("--max-attente", type=int, default=12, help="nombre max d'attentes successives (défaut 12)")
    ap.add_argument("--dry-run", action="store_true", help="afficher les lots sans rien lancer")
    args = ap.parse_args()

    for d in (REGISTRE_DIR, LOTS_DIR):
        os.makedirs(d, exist_ok=True)
    themes = load_catalogue()
    by_id = {t["id"]: t for t in themes}
    lots = plan_lots(themes, args.taille, args.univers, args.cluster)
    if args.max_lots:
        lots = lots[: args.max_lots]
    names = []
    for lot in lots:
        base = f"{lot[0]['universe'].lower()}-{slug(lot[0]['cluster'])}-{lot[0]['id'].lower()}"
        names.append(base)
    total = sum(len(l) for l in lots)
    log(f"{total} icônes à produire en {len(lots)} sessions de {args.taille} max "
        f"({len(done_ids())} déjà faites sur {len(themes)}).")
    if args.dry_run:
        for n, lot in zip(names, lots):
            print(f"  {n:55s} {len(lot):2d}  {', '.join(t['name'] for t in lot)}")
        return
    if os.path.exists(STOP_FILE):
        os.remove(STOP_FILE)

    if args.parallele <= 1:
        for n, lot in zip(names, lots):
            if run_lot(lot, n, by_id, args) in ("stop", "limite"):
                log("Arrêt demandé ou limite persistante : le pilote s'arrête (relancer pour reprendre).")
                break
    else:
        # En parallèle, les lots d'un même cluster restent en série (doublons d'idée)
        groups = {}
        for n, lot in zip(names, lots):
            groups.setdefault((lot[0]["universe"], lot[0]["cluster"]), []).append((n, lot))

        def run_group(items):
            for n, lot in items:
                if run_lot(lot, n, by_id, args) in ("stop", "limite"):
                    return
        with ThreadPoolExecutor(max_workers=args.parallele) as ex:
            list(ex.map(run_group, groups.values()))
    finish()


if __name__ == "__main__":
    main()

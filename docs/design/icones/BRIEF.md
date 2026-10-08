# Brief de production : icônes de thèmes SKILKI

Objectif : **une icône personnalisée par thème**, la plus proche possible du thème, dans le style SKILKI V2 validé.

## Fichiers (depuis `Duelo-main/frontend/`)

- **Catalogue** : `scripts/theme-catalogue.json`. Pour chaque thème : `id`, `name`, `cluster`, `universe`, `description`. La description aide à trouver le bon symbole.
- **Sortie** : `assets/theme-icons/themes/<ID>.svg`. Le nom du fichier est l'id exact du thème, en majuscules (`ARE_CLRY.svg`).
- **Références de style à lire avant de dessiner** :
  - les 13 icônes génériques V2 de `assets/theme-icons/*.svg` ;
  - l'exemple personnalisé `assets/theme-icons/themes/STV_BBAD.svg` (Breaking Bad : chapeau et fiole) ;
  - les règles de série en tête de `../../Themes/icones-test/gen_icons_v2.py`.
- **Contrôle** : `python scripts/build-theme-icons.py --check`. Ce mode vérifie sans rien écrire. Ne lance jamais la commande sans `--check`.
- **Planche** : `python scripts/theme-icons-preview.py --ids ID1,ID2,… --out ../docs/design/icones/<nom>`. Elle produit un `.html` et un `.png`. Ouvre le `.png` avec l'outil Read pour te relire.

## Règles de série (bloquantes)

- `viewBox="0 0 256 256"`. Zone utile de 32 à 224. Masse principale d'environ 160 à 190 px, centrée.
- **5 couleurs seulement**, et 2 à 4 par icône :
  - `#12606D` pétrole clair ;
  - `#0B3D4A` pétrole foncé ;
  - `#FFDB3D` jaune ;
  - `#FF6B5B` corail ;
  - `#E8F1EC` crème.
- **Hiérarchie des couleurs** : pétrole dominant, jaune pour l'accent principal, corail pour l'accent secondaire, crème en touche ponctuelle.
- **Silhouette extérieure** toujours en pétrole clair, corail ou jaune. Elle doit être lisible sur la plaque crème ET sur le fond nuit. Le pétrole foncé et le crème ne servent qu'à l'intérieur d'une forme.
- **Un seul trait** de 12 px, aux extrémités et jonctions arrondies (`stroke-linecap="round"`, `stroke-linejoin="round"`). Épaisseurs permises : 4, 6, 8, 10, 12, 20.
- Les polygones sont arrondis par un contour de même couleur (12 px, `stroke-linejoin="round"`).
- **Signature** : un reflet crème en haut à gauche de la masse principale, en trait de 12 px.
- **Éléments permis** : `path`, `circle`, `rect`, `ellipse`, `polygon`, `line`, `polyline`, `g` (et `transform`).
- **Éléments interdits** : `text`, `image`, `clipPath`, `mask`, `filter`, dégradés et `pattern`.
- **Nombre de formes** : 14 au plus visé, 18 au maximum (au-delà, l'icône devient illisible à 32 px).
- **Accessibilité** : `role="img"` et `aria-label="<nom du thème>"` sur la balise `<svg>`.

## Personnalisation, le cœur du travail

- **Un symbole fort et immédiatement associé au thème** : un objet, un attribut, un lieu, un geste. Pense « qu'est-ce qu'un fan reconnaîtrait en 1 seconde ? ». Exemples :
  - Harry Potter : lunettes rondes et éclair ;
  - Star Wars : sabre laser ;
  - Breaking Bad : chapeau et fiole ;
  - Tennis : raquette et balle ;
  - Mozart : perruque poudrée et clé de sol ;
  - Volcans : cône et coulée.
- **Une idée par icône**, avec au plus un « clin d'œil » secondaire. Pas de scène.
- **Lisible à 32 px** : grosses formes, détails d'au moins 12 px. Si un détail disparaît à 32 px, retire-le.
- **Aucun doublon visuel** : deux thèmes ne partagent jamais le même objet principal, surtout dans un même cluster. Une icône personnalisée doit aussi se distinguer nettement de l'icône générique de son cluster.
- **Droit et sensibilité** :
  - ne reproduis jamais un logo ou un design déposé à l'identique (Poké Ball exacte, logo Batman, Triforce, logo d'une marque ou d'un club) : stylise un attribut à la manière SKILKI ;
  - aucun portrait ni visage reconnaissable d'une personne réelle : évoque-la par un attribut (une plume, un instrument, un chapeau…) ;
  - pas de drapeaux, la palette ne le permet pas ;
  - pas de lettres ni de chiffres dessinés (sauf un chiffre emblématique très simple, à justifier) ;
  - rien de violent, sanglant ou offensant.
- **Cohérence** : même épaisseur de trait, même reflet et même densité que les icônes V2. On doit croire à une seule et même série.

## Méthode

1. Lis les références de style.
2. Pour chaque thème, choisis le symbole en t'aidant de la description, puis dessine le SVG.
3. Lance `--check` et corrige tes erreurs. Ignore les erreurs des fichiers des autres agents : ne touche qu'à TES fichiers.
4. Produis ta planche et relis le PNG. Pour chaque icône, demande-toi :
   - est-ce reconnaissable ?
   - est-ce lisible à 32 px ?
   - la silhouette tient-elle sur le fond nuit ?
   - y a-t-il un doublon avec une autre icône ?

   Corrige, puis refais au moins une passe de relecture.
5. Ne modifie aucun autre fichier, ne lance pas le navigateur et ne commite pas.

## Compte rendu attendu (en français, bref)

- Un tableau `id | thème | symbole choisi`.
- Les icônes dont tu n'es pas satisfait, et pourquoi.
- Le chemin de ta planche.

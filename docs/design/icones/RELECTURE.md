# Relecture croisée du catalogue d'icônes (une passe par univers)

Le dossier courant est `C:\Users\julie\OneDrive\Documents\Duelo\Duelo-main\frontend`. Lis d'abord `../docs/design/icones/BRIEF.md`, qui fixe les règles de série, de personnalisation et de droits.

## Données

- Catalogue : `scripts/theme-catalogue.json`.
- Symboles choisis : les fichiers `../docs/design/icones/registre/*.json`, sous la forme `[{id, symbole}]`. Quand un id apparaît dans plusieurs fichiers, c'est le dernier fichier dans l'ordre alphabétique qui fait foi.
- Doublons probables détectés automatiquement : `../docs/design/icones/doublons-candidats.txt`. Ce sont des regroupements par mot-clé. Beaucoup sont des faux amis : « tête d'ours » et « tête de chèvre » ne sont PAS des doublons.

## Ta mission (TON univers uniquement)

1. Pour **chaque cluster de ton univers**, produis la planche avec `python scripts/theme-icons-preview.py --cluster "<nom exact>" --out ../docs/design/icones/relecture/<univers>-<n>`, puis relis le PNG avec Read. Lance les commandes avec l'outil Bash, jamais PowerShell.

2. **Corrige les vrais doublons d'idée** (même objet principal, même lecture à 32 px) :
   - **Dans ton univers** : garde le symbole pour le thème auquel il correspond le mieux, et redessine l'autre.
   - **Avec un autre univers** : la règle est mécanique, pour que deux relecteurs ne corrigent pas la même paire. Tu ne redessines **que si l'id de TON thème est alphabétiquement APRÈS l'id de l'autre thème**. Sinon, laisse-le.
   - Exemples de vrais doublons signalés :
     - Foot Américain et NFL (même casque) ;
     - FC / FIFA et Football Mondial (même ballon) ;
     - Intelligence Artificielle, Réseaux de Neurones et Logique de l'IA (même réseau de neurones) ;
     - Thorgal et Vinland Saga (même bouclier viking) ;
     - Empire Aztèque et Mythes Précolombiens (même pyramide à degrés) ;
     - les deux « Seigneur des Anneaux » (même œil de feu).

3. **Reprends les icônes faibles**, 12 au plus par univers, en commençant par les pires. Une icône est faible si elle est méconnaissable ou trop générique pour un fan, illisible à 32 px, invisible sur le fond nuit, ou si elle ressemble à autre chose (lettre, visage involontaire, objet ridicule).

4. **Vérifie les droits** : aucun portrait ni visage reconnaissable d'une personne réelle, aucun logo de marque ou de club reproduit, aucun drapeau. Corrige tout écart.

5. Après tes corrections :
   - lance `python scripts/build-theme-icons.py --check`, jusqu'à ce que TES fichiers passent ;
   - refais les planches touchées et relis-les ;
   - écris `../docs/design/icones/registre/zz-relecture-<univers>.json` avec `[{id, symbole}]` pour chaque icône redessinée.

Ne modifie que les SVG de ton univers (préfixes d'id indiqués dans ta consigne), plus tes fichiers de relecture et de registre. Ne lance jamais `build-theme-icons.py` sans `--check`, et ne commite pas.

## Compte rendu (en français, bref)

- Tableau des icônes redessinées : `id | thème | avant → après | raison` (doublon, faible ou droits).
- Doublons inter-univers laissés à l'autre relecteur, en application de la règle.
- Ce que tu n'as pas pu régler.

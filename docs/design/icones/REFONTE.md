# Refonte des icônes moyennes

Dossier courant : `C:\Users\julie\OneDrive\Documents\Duelo\Duelo-main\frontend`. Lis d'abord `../docs/design/icones/BRIEF.md` (règles de série, personnalisation, droits).

Ces icônes passent toutes les règles, mais l'utilisatrice les a jugées **moyennes** : symbole mal reconnu, trop générique, ou qui se lit comme autre chose en petit. Ta liste indique le thème et la raison du signalement.

Tu dois **redessiner chacune** (`assets/theme-icons/themes/<ID>.svg`) avec un symbole **immédiatement reconnaissable** pour ce thème. Cherche ce qu'un fan ou le grand public identifie en une seconde : objet culte, lieu, accessoire emblématique, scène iconique réduite à un objet.

## Contraintes

- Vérifie dans le registre (`../docs/design/icones/registre/*.json`, le dernier fichier dans l'ordre alphabétique fait foi) que l'**objet principal** choisi n'est pas déjà celui d'un autre thème.
- Lisible à 32 px. La silhouette doit se voir sur le fond nuit : jaune ou corail en accent, pétrole dominant, crème en reflet.
- Aucun logo, aucun portrait de personne réelle, aucun personnage sous droits dessiné à l'identique, aucun drapeau, aucun texte.
- Si l'ancienne idée était bonne mais mal dessinée, tu peux la garder et la redessiner nettement mieux. Sinon, change d'idée.

## Méthode

Lance les commandes avec l'outil Bash, jamais PowerShell.

1. Dessine les nouveaux SVG.
2. Lance `python scripts/build-theme-icons.py --check` (toujours avec `--check`) et corrige tes erreurs.
3. Produis la planche avec `python scripts/theme-icons-preview.py --ids <tes ids> --out ../docs/design/icones/refonte/<ton-lot>`.
4. Relis le PNG avec Read. Pour chaque icône, demande-toi : la reconnaît-on immédiatement ? est-elle lisible à 32 px ? ressemble-t-elle à autre chose ? Corrige, puis refais **au moins une passe**.
5. Écris `../docs/design/icones/registre/zzzz-refonte-<ton-lot>.json` au format `[{id, symbole}]`.
6. Ne modifie aucun autre fichier et ne commite pas.

## Compte rendu (bref, en français)

- Un tableau `id | thème | avant → après`.
- Les icônes qui restent fragiles, et pourquoi.

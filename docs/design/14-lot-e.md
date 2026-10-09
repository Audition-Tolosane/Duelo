# Généralisation SKILKI : Lot E, progression et récompenses

## Écrans et états migrés

| Élément | Avant | Après |
|---|---|---|
| **Boutique** (`shop.tsx`) | Dégradés violets, emoji, couleurs en dur | Groupes `Card` (Pièces, Boosts) et articles en lignes ; prix en or ; boutons d'achat en secondaire, avec un seul CTA jaune à l'écran (« S'abonner »). La carte Premium est violette, en `GRADIENTS.rare`, seul usage autorisé. Les achats ouvrent un `Dialog` « Bientôt disponible ». |
| **Tournoi** (`tournament.tsx`) | En-tête et cartes faits main | `ScreenHeader`, carte à liseré or, badge « En cours », 4 `StatCard` en 2 × 2, classement en `ListRow` avec ma ligne surlignée en jaune |
| **Roue du jour** (`SpinWheelModal`) | Modale plein écran, segments arc-en-ciel | `BottomSheet`, segments pétrole, gros lot en or, thème offert en corail ; gain en `Card` or avec `GRADIENTS.reward` |
| Avatars (`UserAvatar`) | 6 couleurs vives en dur | Jeton `COLOR.avatar` : 6 teintes sourdes, accordées à la palette |
| `CosmicBackground` | Fond étoilé violet | Supprimé : il n'était plus utilisé |

## Composants

- **Réutilisés** : `ScreenHeader`, `Card`, `Badge`, `Button`, `Dialog`, `BottomSheet`, `StatCard`, `ListRow`, `ThemeIcon`, `EmptyState`.
- **Créés** : aucun.
- **Kit** :
  - icône `coins` ajoutée au registre ;
  - jeton `COLOR.avatar` ;
  - `StatCard` : le libellé peut passer sur 2 lignes, et la valeur rétrécit si besoin (`adjustsFontSizeToFit`, effectif sur mobile natif).

## Dette (sur tout le dépôt)

| Mesure | Après Lot D | Après Lot E |
|---|---|---|
| Couleurs hex en dur | 159 | **38** |
| rgba en dur | 61 | 35 |
| Tailles de police en dur | 55 | 19 |
| Faux gras | 18 | 4 |
| Dégradés hors design system | 24 | 17 |
| Anciennes bibliothèques d'icônes | 5 | 2 |
| Emoji d'interface | 11 | 2 (le texte partagé de la fin de duel) |

## Textes corrigés (suite au contrôle Better Design)

- **Boutique** :
  - « Booste ton jeu » devient « Progresse plus vite » ;
  - une phrase explique à quoi servent les pièces ;
  - le badge Premium « Le plus avantageux », qui concurrençait « Meilleure offre », devient « Sans engagement » ;
  - « Pack de 5 changements / Change 5 missions » devient « 5 missions à remplacer / Remplace une mission qui ne te plaît pas » ;
  - le Bouclier de série devient « Garde ta série de jours même si tu rates un jour » ;
  - le bouton d'achat affiche « Bientôt » tant que l'achat n'est pas branché ;
  - la modale se ferme sur « Compris » au lieu de « OK ».
- **Tournoi** :
  - chiffres libellés de façon homogène : « Ton rang · Ton score · Duels restants · Joueurs » ;
  - « EN DIRECT » devient « En cours » ;
  - « JOUER » devient « Jouer un duel » ;
  - le compte à rebours passe de « 14h 05m » ou « 5:07 » à « 14 h 05 » ou « 5 min ».
- **Roue** :
  - le gain s'appelle partout « XP ×2 », avec « Pendant 15 min » en détail ; il portait trois noms différents ;
  - le thème gagné s'affiche « Thème offert 24 h » ;
  - « Roue Quotidienne » devient « Roue quotidienne ».
- Les nouveaux textes sont traduits dans les 9 autres langues (« Soon », « Pronto », etc.).
- Espaces insécables dans « 24 h », « 15 min » et « 14 h 05 », pour qu'ils ne se coupent plus en fin de ligne.

## Mise en page

- **Boutique en 320** : la colonne de texte ne faisait que 88 px, d'où des titres sur 2 lignes. Le prix et le bouton passent maintenant sous le texte, alignés avec lui.
- **Tournoi** : les 4 chiffres passent en 2 × 2 sur toutes les largeurs. En une seule ligne, « 128 765 » et « Duels restants » débordaient, même en 390.

- **Roue** : le segment gagnant s'affichait tête en bas sous le pointeur, à cause d'un retournement prévu pour la roue au repos. Retournement retiré : le gain se lit toujours à l'endroit.

## Tests

- TypeScript : 8 erreurs, toutes antérieures.
- Garde-fou : aucune dette ajoutée, référence mise à jour.
- Jest : 679 / 679.
- Navigateur, 390 et 320 :
  - aucun bouton imbriqué ;
  - `scrollWidth` égal à la largeur d'écran ;
  - la roue a été capturée avec `/api/spin/claim` simulé, donc aucun tour réel n'a été consommé.

## Better Design

- **`inspect-spacing`** :
  - tournoi : 100/100 (le débordement du chiffre est corrigé par la grille 2 × 2) ;
  - boutique : 55/100, mais les constats relevés sont des faux positifs de zone tactile. Le vrai défaut, la colonne de texte trop étroite en 320, a été corrigé.
- **`check-comprehension`** : les vrais problèmes de rédaction sont corrigés (voir plus haut).

## Restant

- **Backend** : les libellés de gain de `backend/spin.py` sont en français en dur (« Boost ×2 », « Thème 24h »). L'app affiche désormais ses propres libellés traduits pour le boost et le thème, mais le backend n'a pas été modifié.
- « Duelo » reste visible dans l'administration (`admin.tsx`, `AdminUI.tsx`), qui est un outil interne : à traiter au Lot G si tu veux.

## Captures

- `captures/lotE/390x844/` : boutique, boutique-premium, tournoi, roue, roue-gain ;
- `captures/lotE/320x568/` : boutique, tournoi ;
- planches `captures/lotE/planche-*.png`.

# Généralisation SKILKI : Lot D, gameplay secondaire

## Écrans et états migrés

| Élément | Avant | Après |
|---|---|---|
| **Fin de duel** (`results.tsx`, le plus gros fichier de l'app) | 342 points de dette : dégradés cyan/violet, modale violette, emoji, `DueloHeader` | En-tête `ResultState` (victoire = halo jaune, défaite = pétrole sobre jamais rouge, sans-faute = violet, seul usage autorisé). Score : moi en jaune, le rival en corail. XP et récompenses en or. Révision des erreurs : bonnes réponses en vert, mauvaises en rouge texte. Revanche = seul CTA jaune. |
| Récompenses (niveau, titre, succès, bouclier de série) | Modale violette | `Dialog` ton or |
| Signalement d'une question | Modale plein écran | `BottomSheet` en 3 étapes |
| Victoire par forfait (adversaire déconnecté) | Bandeau cyan | `Card` à liseré corail, badge vert |
| **Revanche reçue** (`RematchModal`) | Modale faite main, dégradés | `Dialog` corail, Accepter jaune, Refuser ghost (comme le défi reçu) |
| **Abandon en cours de duel** (`game.tsx`) | `Alert` natif / `window.confirm` | `Dialog` : « Abandonner » en rouge, « Continuer le duel » en ghost |
| Paramètres de partie invalides | `Alert` appelé pendant le rendu | Gabarit d'état d'erreur |
| Emblème des épées (`SwordMark`) | Dégradé cyan→violet par défaut | Crème, avec pommeau or |

Déjà conformes ou absents :
- L'écran de recherche d'adversaire était conforme : ses 4 dégradés sont tous autorisés (halos du VS, fondus) et sa modale de temps écoulé passait déjà par `Dialog`.
- Il n'existe ni power-ups ni pause dans le jeu.

## Composants

- **Réutilisés** : `ResultState`, `Dialog`, `BottomSheet`, `Card`, `Badge`, `Button`, `Loader`, `ScreenHeader`, `ThemeIcon`, `UserAvatar`.
- **Créés** : aucun.
- **Kit** : `ResultState` affichait « FLAWLESS » en anglais en dur ; il affiche maintenant « Sans-faute » (traduit).

## Dette (sur tout le dépôt)

| Mesure | Après Lot C | Après Lot D |
|---|---|---|
| Couleurs hex en dur | 323 | **159** |
| rgba en dur | 156 | 61 |
| Tailles de police en dur | 123 | 55 |
| Faux gras | 48 | 18 |
| Dégradés hors design system | 41 | 24 |
| Anciennes bibliothèques d'icônes | 7 | 5 |
| Emoji d'interface | 11 | 11 |

Les 2 emoji qui restent dans `results.tsx` sont dans le texte partagé vers les autres apps, pas dans l'interface.

## Textes corrigés

- Accents rétablis : « bonnes réponses », « Nouveau titre débloqué », « Détails », « Signalement envoyé », « Erreur réseau », « Viens me défier ».
- Tutoiement : « Revois tes erreurs », « Tu as déjà signalé », « Décris l'erreur ».
- Anglicismes : « Giant Slayer » devient « Tombeur de géant », « Bonus Streak » devient « Bonus de série de victoires ».
- Formule de développeur : « Base (score × 2) » devient « Points du duel ».
- Vocabulaire : « adversaire » partout (et non plus « rival » dans un endroit et « adversaire » dans un autre) ; « Tu perdras ce duel. » au lieu de « La partie sera comptée comme perdue ».
- Forfait : « Tu gagnes le duel et tu gardes tes XP. »
- Divers : « Description (facultative) », « Faute d'orthographe ou de frappe », « Regarde une pub (3 s) ».

## Tests

- TypeScript : 9 erreurs, toutes antérieures.
- Garde-fou : aucune dette ajoutée.
- Jest : 679 / 679.
- Navigateur, 390 et 320 :
  - aucun bouton imbriqué ;
  - `scrollWidth` égal à la largeur d'écran ;
  - **toutes les captures interceptent l'enregistrement de la partie** (`submit-v2`), donc aucune fausse partie n'a été écrite en production.

## Better Design

- **`inspect-spacing`** (fin de duel) : 80/100. Un seul constat réel, mineur : 4 px de marge avant la ligne Total de la carte XP. Faux positif : un confetti hors écran.
- **`check-comprehension`** :
  - les modales Revanche et Abandon passent les 3 tests ;
  - sur l'écran de fin de duel, les alertes sont des mots accentués en capitales lus comme des sigles, ou le détail chiffré de l'XP ;
  - les vrais problèmes de rédaction sont corrigés (voir plus haut).

## Restant

- La capture `inspect-spacing` en 320 ne couvre que le haut de l'écran : les confettis interrompent le relevé.
- « DUEL INTERROMPU » et « VICTOIRE ! » restent empilés lors d'un forfait : ce sont deux titres pour un même écran. C'est la logique d'origine, conservée.

## Captures

- `captures/lotD/390x844/` : sans-faute, récompenses, révision des erreurs, défaite, forfait adverse, revanche, abandon ;
- `captures/lotD/320x568/` : sans-faute, forfait adverse ;
- planches `captures/lotD/planche-*.png`.

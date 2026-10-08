# Généralisation SKILKI : Lot B, social

Même méthode que le Lot A : on applique le design system V1.2, sans refonte conceptuelle. La logique, les appels API, le WebSocket et la navigation sont inchangés.

## Écrans migrés

| Écran | Route | Avant | Après |
|---|---|---|---|
| Onglet Social (Activité, Champions, Créer) | `/players` | Sections « Pulse / Tribus / Forge », une couleur par section (violet, or, vert), anneaux d'aura, emoji, bouton « Défier » en dégradé | Puces de section (sélection jaune), cartes d'exploit sobres (sans-faute en or, série en corail), coach avec un seul bouton jaune, champions avec icônes SVG V2 et couronne or |
| Profil d'un autre joueur | `/player-profile` | En-tête en double, dégradés, couleurs par catégorie | Structure du Profil pilote : « Défier » en jaune (seul CTA), Suivre en secondaire, statistiques, face-à-face (moi jaune, rival corail), thèmes en SVG V2, feuille « Défier » en `BottomSheet` |
| Abonnés et abonnements | `/followers` | Onglets en dégradé cyan→violet, emoji 👥 | Puces, `ListRow`, état vide du kit, bon pluriel (« 0 partie », « 37 parties ») |
| Défi nominatif envoyé (attente, puis temps écoulé) | `/challenge-waiting` | `DueloHeader`, or, cyan | Moi jaune contre rival corail, minuteur du jeu, fin de défi sans rouge, un seul CTA jaune |
| Défi reçu (modale globale) | — | « DÉFIS EN ATTENTE », dégradés | `Dialog` corail « Nouveau défi », barre de temps, Accepter en jaune et Refuser en ghost |

La recherche de joueurs a été migrée au Lot A. La modale de revanche relève du Lot D.

## Composants

- **Réutilisés** : `Txt`, `Icon`, `Button`, `IconButton`, `Card`, `Chip`, `Section`, `ListRow`, `Loader`, `EmptyState`, `Dialog`, `BottomSheet`, `ScreenHeader`, `ScreenContainer`, `ThemeIcon`, `UserAvatar`, `RoundTimer`, `SwipeBackPage`.
- **Créés** : aucun.
- **Supprimés** :
  - l'ancien `components/EmptyState.tsx` et `components/DuelButton.tsx`, qui n'étaient plus utilisés ;
  - dans les écrans : `AuraAvatar`, `ForgeHeroCard`, `GLASS`, `CATEGORY_META`, `CategoryIcon`.
- **Ajout à `i18n.ts`** : `pluralKey(base, n)`, qui applique les règles de pluriel de la langue (en français, 0 et 1 sont au singulier).

## Dette (sur tout le dépôt)

| Mesure | Après Lot A | Après Lot B |
|---|---|---|
| Couleurs hex en dur | 659 | 437 |
| rgba en dur | 267 | 200 |
| Tailles de police en dur | 263 | 173 |
| Faux gras 800/900 | 101 | 68 |
| Dégradés hors design system | 73 | 52 |
| Anciennes bibliothèques d'icônes | 16 | 10 |
| Emoji d'interface | 63 | 51 |
| Anciens jetons Duelo | 18 | **0** |
| « Duelo » visible | 0 | 0 |

Les 5 fichiers du lot sont à 0 sur toutes les mesures.

## Corrections trouvées pendant les vérifications

- **Erreur React** « `<button>` ne peut pas contenir un autre `<button>` » : la carte d'exploit entière était cliquable et contenait le bouton « Défier ». Seul l'en-tête de la carte ouvre désormais le profil (zone de 44 px).
- **« N° 1 en undefined »** sur le profil : l'API envoie `theme_name` et non `category_name`. C'était un bug d'origine, corrigé. Le mois renvoyé en anglais par l'API (« October 2026 ») est traduit (« octobre 2026 »).
- **320 px** :
  - libellés de section tronqués (« Champio… ») : puces dimensionnées selon le libellé, sans icône en 320 ;
  - pseudo de champion rogné des deux côtés ;
  - message du coach coupé à 2 lignes dans 104 px : le bouton passe sous le texte ;
  - ligne « toi vs rival » qui débordait de 7 px.
- **Textes** :
  - « Pulse / Tribus / Forge / Trône » deviennent « Activité / Champions / Créer / Champion » ;
  - « Score Parfait » devient « Sans-faute » ;
  - « Match en » devient « Duel en » ;
  - « À l'instant » prend son accent ;
  - le bouton « Abonné » (qui se confondait avec le compteur d'abonnés) devient « Suivi » ;
  - « Défis » du face-à-face devient « Duels » ;
  - « L'IA génère 5 questions + un logo pour validation » devient « On te propose 5 questions et un logo, tu valides avant publication » ;
  - le surtitre de l'onglet devient « Social », comme son nom dans la tab bar ;
  - l'erreur de chargement dit ce qui a échoué et quoi faire.

## Tests

- TypeScript : 27 erreurs, toutes antérieures.
- Garde-fou : aucune dette ajoutée, référence mise à jour.
- Jest : 684 / 685 (le même ancien test `CategoryIcon`).
- Navigateur, 390 et 320 :
  - aucun avertissement React, aucun bouton imbriqué ;
  - `scrollWidth` égal à la largeur d'écran ;
  - seules restent les 401 du backend non redéployé.

## Better Design

**`inspect-spacing`** (Social, Profil, Attente de défi ; 390 et 320 ; tous `completed`) :
- les vrais constats sont corrigés (coach en 320, zone cliquable de l'exploit, ligne « vs ») ;
- les constats mineurs gardés : écarts de 14, 18 et 10 px dans l'en-tête du profil (marges et `gap` cumulés, sans effet visible), rayon de la pastille de thème ;
- le reste, ce sont des faux positifs : `hitSlop` des puces et des petits boutons, marge de la tab bar.

**`check-comprehension`** (9 états) :
- la modale « Nouveau défi », les abonnés et l'attente de défi passent les 3 tests ;
- les alertes restantes sont des faux positifs : mots accentués en capitales lus comme des sigles, et les puces de navigation comptées comme des actions ;
- les vrais problèmes de rédaction sont corrigés (voir plus haut).

## Restant (hors Lot B)

1. **Icônes de thèmes** : beaucoup de thèmes reçoivent l'icône de leur univers (cinéma pour toutes les séries, basket pour toute l'Arène). Sans cluster fourni par l'API, c'est la boussole qui s'affiche (défi, tendances). À traiter dans le lot icônes.
2. **Vocabulaire duel / défi / match / partie** : il reste « Résultats de match », « parties »… La règle est à fixer (proposition : « duel » pour une partie jouée, « défi » pour l'invitation), puis à appliquer partout.
3. **Messages du coach** : ils sont écrits par le backend (« Reprends ton trône ! », « Tu n'as que 120 XP… »). Ils sont à reformuler côté backend, ce qui demande un redéploiement.
4. **Modale de défi reçu** : elle ne se ferme plus en touchant le fond. Avant, ce geste refusait le défi par erreur, sans confirmation.
5. **« vs »** en italique (`moment`) sur l'attente de défi, comme à l'écran VS validé : c'est voulu.

## Captures

- `captures/lotB/390x844/` (10 états) et `captures/lotB/320x568/` (7 états) ;
- planches `captures/lotB/planche-390x844.png` et `planche-320x568.png`.

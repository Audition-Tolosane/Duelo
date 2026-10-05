# Design system SKILKI

Code : `frontend/theme/tokens.ts` (jetons) · `frontend/components/ui/` (kit) · vitrine `/design-system` (développement).
Captures de la vitrine : `captures/design-system/planche.png`.

## Principes

1. **Une couleur, un sens.** Le jaune ne sert qu'à agir, sélectionner, marquer mon camp. Le corail sert à l'adversaire et aux événements. L'or sert aux récompenses et au prestige. Le vert signifie juste, le rouge faux ou erreur. Le violet est réservé au rare.
2. **Le pétrole structure, le crème se lit.** Pas de gris neutres pour le texte, pas de noir-bleu `#050510`.
3. **Le spectacle est réservé au jeu.** Halos et dégradés seulement au VS, à la victoire et à la bonne réponse. Les écrans de navigation restent calmes.
4. **Pas de vignettes dans des vignettes.** Jamais de `Card` dans une `Card`. Une rangée de stats tient dans une seule carte.
5. **Lisible sur téléphone.** Aucun texte informatif sous 11 px (10 px seulement pour les pastilles de compteur), cibles tactiles de 44 px, grossissement système plafonné à 1,3.

## Couleurs (par rôle : `COLOR.*`)

| Rôle | Valeur | Usage |
|---|---|---|
| `bg.primary` | `#071F26` | Fond de tous les écrans |
| `bg.deep` | `#05171C` | Bas de page, voiles |
| `surface.card` | `#0B3D4A` | Cartes, réponses, champs, tab bar |
| `surface.elevated` | `#12606D` | État pressé ou élevé. **Jamais pour du texte** (2,4:1 sur la nuit) |
| `text.primary` | `#E8F1EC` | Texte principal (~14,8:1 sur la nuit, AAA) |
| `text.secondary` / `tertiary` / `disabled` | crème à 72 / 60 / 40 % | Sous-titres / méta / désactivé |
| `text.onAction` | `#071F26` | Texte posé sur jaune, corail, vert, or |
| `action.primary` | `#FFDB3D` | **Seule** couleur d'action : CTA, sélection, onglet actif |
| `action.secondary` / `ghost` | `#12606D` / crème 6 % | Bouton secondaire / bouton discret (Annuler, Retour) |
| `player.self` / `player.opponent` | jaune / corail | Mon camp / le rival (VS, scores, résultats) |
| `accent.warm` | `#FF6B5B` | Événement, défi reçu, série, chrono < 5 s |
| `accent.rare` | `#A78BFA` | **Uniquement** : sans-faute (flawless), Premium, palier ultime |
| `reward.gold` | `#F0A93B` | XP, pièces, trophées, rangs. Plus chaud et plus sombre que le jaune. **Jamais sur un bouton** |
| `status.success` | `#32E7A3` | Bonne réponse (+ icône ✓) |
| `status.error` | `#F0445E` | Mauvaise réponse, erreur (+ icône ✕). Plus froid que le corail |
| `border.subtle` / `default` / `strong` / `active` | crème 8 / 14 / 24 % / jaune | Bordures |
| `overlay.scrim` | nuit à 85 % | Voile des modales |
| `plate.fill` / `plate.border` | crème / pétrole à 18 % | Plaque des icônes de thèmes |

## Typographie (`<Txt variant>`, `TYPO.*`)

La graisse est portée par la famille de police : **`fontWeight` est interdit** (Space Grotesk s'arrête à 700, donc 800/900 donne un faux gras).

| Variante | Police / taille / interligne | Usage |
|---|---|---|
| `display` | Space Grotesk Bold 44/48, −1,5 | VICTOIRE / DÉFAITE |
| `h1` | SG Bold 28/32 | Titre d'écran |
| `h2` | SG Bold 22/26 | Titre de section, de modale |
| `h3` | SG SemiBold 18/22 | Sous-section, en-tête de page empilée |
| `cardTitle` | SG SemiBold 16/20 | Nom de thème, pseudo, mode |
| `bodyLarge` / `body` / `bodySmall` | SG Regular 17/24 · 15/22 · 13/18 | Texte courant |
| `label` | SG Medium 13/16 | Libellés, liens |
| `caption` | SG Medium 12/16, crème 60 % | Méta, temps relatif |
| `overline` | JetBrains Mono Bold 11/14, MAJ, +1,5 | Surtitres, libellés de stats |
| `button` / `buttonSmall` | SG Bold 15/20 · 13/16, MAJ | Boutons |
| `statLarge` / `statMedium` / `score` | SG Bold 40 · 24 · 30, chiffres tabulaires | Stats, scores |
| `countdown` | SG Bold 72/76 | Décompte VS (exception documentée) |
| `moment` | Fraunces 500 italique 40/44 | « vs », Égalité, Bravo (liste fermée) |
| `micro` | SG Bold 10/12 | Pastilles de compteur uniquement |

## Espacements, rayons, hauteurs, ombres

- **`SPACE`** (grille de 4) : 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56. Marge d'écran 16, padding de carte 16, écart entre sections 28.
- **`RADII`** : xs 4 (tirets) · sm 8 (puces) · md 12 (boutons, champs) · lg 16 (cartes) · xl 24 (hero, modales, VS) · plate 14 · pill.
- **`SIZE`** : cible tactile 44 · boutons 40 / 52 / 56 · champ 48 · puce 32 · ligne 60 · en-tête 46.
- **`ELEVATION`** (noir uniquement) : e1, e2, e3.
- **`GLOW`** (couleur) : `cta`, `opponent`, `success`, `reward`. Réservés au CTA actif, au VS, à la bonne réponse et aux récompenses exceptionnelles.

## Dégradés autorisés (`GRADIENTS`, liste fermée de 14)

`screen` (ambiance d'écran), `screenDeep`, `fadeBottom`, `fadeTop`, `fadeRight` (fondus de défilement), `vsSelf`, `vsOpponent` (halos VS), `victory`, `defeat`, `draw`, `reward`, `rare`, `hero`, `scrim`.

Interdits : tout dégradé entre deux teintes (cyan→violet…), tout dégradé sur un bouton ou une carte, tout dégradé construit à partir d'une couleur de catégorie, les `textShadow` néon.

## Composants (`components/ui`)

| Composant | Rôle |
|---|---|
| `Txt` | Seul composant de texte |
| `Icon` | Icônes d'interface Lucide (registre fermé, trait 2) |
| `Button` | primary (jaune) · secondary · ghost · danger ; tailles sm, md, lg ; chargement ; icône |
| `IconButton` / `BackButton` | Cible de 44 px, pastille de compteur ; retour unique |
| `Card` | Surface pétrole ; accents `event` (liseré corail), `selected` (jaune), `reward` (or) |
| `Section` | Surtitre + titre + « Voir tout › » (seulement si la liste est tronquée) |
| `ScreenContainer` | Fond nuit pétrole opaque + halo d'ambiance (remplace CosmicBackground) |
| `AppHeader` / `ScreenHeader` | En-tête des onglets (logotype + 3 actions) / des pages empilées (retour + titre) |
| `Wordmark` | Logotype SKILKI provisoire (typographique, point jaune) |
| `Chip` / `Badge` | Filtre (actif = jaune) / pastille ou étiquette |
| `StatCard` / `ProgressBar` | Chiffre tabulaire + libellé / barre pleine sans dégradé |
| `ListRow` | Ligne de liste de 60 px |
| `Dialog` / `BottomSheet` | Modale centrée / feuille du bas |
| `ThemeIcon` / `ThemeCard` | Illustration SKILKI sur plaque crème / carte de thème (tuile ou ligne) |
| `PlayerCard` | Joueur côté moi (jaune) ou rival (corail), halo au VS |
| `AnswerButton` | Réponse : idle · selected · correct · wrong · dimmed, + marqueur du rival |
| `ResultState` | En-tête de fin de duel (victoire, défaite, égalité, sans-faute) |
| `EmptyState` / `Loader` / `SearchField` | État vide / chargement / recherche (déclencheur ou champ) |

La tab bar est restylée avec l'Accueil (lot pilote 5) : elle vit dans `app/(tabs)/_layout.tsx`.

## Icônes : trois familles étanches

1. **Interface** : Lucide via `<Icon name>`, trait 2, crème au repos, jaune quand actif. Aucun emoji dans l'interface (ils restent permis dans le contenu des joueurs : chat, drapeaux).
2. **Thèmes** : illustrations SKILKI (`assets/theme-icons/*.svg`, style V2 validé) sur **plaque crème**, de 28 à 112 px, jamais teintées par le code.
   - Génération : `npm run icons:build`. Le script vérifie chaque SVG (viewBox 256, palette, 2 à 4 couleurs, éléments interdits, nombre de formes), puis produit `theme/themeIcons.generated.ts`.
   - Repli : nom du thème → cluster → univers. Les univers ART, LIFE et MIND reçoivent un pictogramme Lucide sur la même plaque, en attendant leurs illustrations.
   - Corrections de série faites au passage : Moyen Âge ramené à 4 couleurs (bande en corail), pixels de Jeux vidéo fusionnés en un seul tracé.
   - Production des 917 icônes : **pas avant la validation du pilote**.
3. **Badges et rangs** : système à part (écusson commun, or pour le prestige, violet pour le palier ultime), à concevoir avec le Profil.

## Garde-fous (migration progressive)

- `npm run design:check` compte, fichier par fichier, la dette design : couleurs hex et rgba codées en dur, `fontSize` numériques, `fontWeight` 800/900, `LinearGradient`, imports d'autres familles d'icônes, emoji.
  - Il **échoue si un fichier en ajoute** par rapport à la référence `scripts/design-baseline.json`.
  - Un nouveau fichier d'écran doit être à zéro.
  - Le kit `components/ui` doit être à zéro sur les couleurs, les tailles, les graisses, les icônes et les emoji.
- Après la migration d'un écran : `npm run design:baseline` enregistre la nouvelle référence, plus basse.
- Référence de départ, le 06/10/2026 : 1 488 hex · 673 rgba · 689 fontSize · 215 graisses 800/900 · 152 dégradés · 32 imports d'icônes · 113 emoji.

## Changement global fait à cette étape

- `app/+html.tsx` (web uniquement) : le fond étoilé violet chargé depuis le serveur et la règle CSS qui forçait la transparence de 12 niveaux de conteneurs sont supprimés. Fond nuit pétrole opaque.
  - Cette règle causait la superposition des écrans constatée au Lot 0.
  - Elle faisait aussi diverger le web du natif, qui affiche un satin anthracite et non un ciel violet.
- `UserAvatar` : les couleurs de repli néon sont remplacées par des teintes neutres de la palette, jamais jaune ni corail, pour ne pas brouiller moi et le rival.
- Accents rétablis : DÉFAITE, ÉGALITÉ, ACCEPTÉE.

Les anciens jetons (`COLORS`, `RADIUS`, `SPACING`, `TYPE`, `glassTheme`) restent en place, marqués comme obsolètes, jusqu'à la fin de la migration (étape 7).

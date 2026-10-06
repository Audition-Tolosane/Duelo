# Généralisation SKILKI : Lot A, navigation et écrans transversaux

Référence : V1.2 validée. On applique le design system aux écrans restants, sans refonte conceptuelle :
- aucune nouvelle couleur, famille d'icônes, animation ou style de bouton ;
- aucune logique modifiée (auth, OAuth, `scheme: 'duelo'`, clés `duelo_*`, API, WebSocket) ;
- les 6 écrans pilotes restent inchangés, à 3 corrections d'incohérence près (voir plus bas).

## Écrans migrés

| Écran | Route | Avant | Après |
|---|---|---|---|
| Connexion (invité, e-mail, Google, Apple) | `/` | Décor cosmique cyan/violet, image de fond, onglets en dégradé | Fond nuit pétrole, logotype, onglets en puces jaunes, `Button`, champs pétrole avec validation verte et rouge |
| Onboarding (bienvenue, thèmes, tutoriel, bonus) | `/onboarding` | 11 dégradés, cyan/violet | Disque pétrole, icônes SVG V2 et Lucide, points d'étape jaunes, bonus en or |
| **Onglet Jouer** (centre de la tab bar, arrivée après connexion) | `/play` | « QUICK MATCH » en dégradé cyan→violet | Même carte « Duel rapide » que l'Accueil validé, et modes en lignes de liste |
| Recherche | `/search` | En-tête global en double, onglets en dégradé, couleurs calculées | `ScreenHeader`, `SearchField`, onglets en puces, `ThemeCard`, `ListRow` |
| Notifications | `/notifications` | Cyan/violet, icônes MaterialCommunity | Liste sobre ; non lu en corail, défi en corail, résultat en or |
| Réglages des notifications | `/notification-settings` | 5 dégradés | Gabarit de Réglages, interrupteurs jaunes |
| Langue | `/language-settings` | Ionicons, `paddingTop: 55` en dur | `ScreenHeader`, `ListRow`, coche jaune, `SwipeBackPage` |
| Messages (boîte de réception) | `/conversations` | Anneau dégradé, `CosmicBackground` | `ListRow`, pastilles corail |
| Conversation | `/chat` | Bulles cyan/violet, emoji dans les réponses rapides | Ma bulle en jaune, celle du rival en pétrole, carte de match (moi jaune, rival corail, XP or) |
| Hors ligne (surcouche globale) | — | Rouge plein écran | Pictogramme crème, sobre (une coupure n'est pas une faute) |
| Erreur inattendue | — | Fond `#0a0a0a`, bouton violet `#6C63FF`, emoji ⚠️ | Gabarit d'état vide SKILKI, bouton jaune |
| Fond racine, pages empilées, page web | — | `#050510` | `COLOR.bg.primary` |

L'en-tête global et la tab bar, migrés pendant le pilote, ont été vérifiés : ils sont propres, sans dette et sans « Duelo » visible.

## Composants

- **Réutilisés** : `Txt`, `Icon`, `Button`, `IconButton`, `Card`, `Chip`, `ListRow`, `SearchField`, `ScreenHeader`, `ScreenContainer`, `EmptyState`, `Loader`, `Badge`, `ThemeIcon`, `ThemeCard`, `Wordmark`, `SwipeBackPage`.
- **Créés** : aucun.
- **Ajustements du kit** (invisibles, ou corrections de contraste) :
  - `Icon` : 21 icônes Lucide ajoutées au registre fermé (hors ligne, tout lire, épingle, flèches…) ;
  - `ListRow` : la variante « danger » passe à `status.errorText` (4,6:1 au lieu de 3,96:1) ;
  - `Button` taille `sm` : zone tactile élargie à 44 px par `hitSlop` ;
  - `SearchField` : le champ occupe toute la hauteur de la barre (avant, seuls 22 px sur 48 donnaient le focus) ;
  - `UserAvatar` : initiale en police système, sans faux gras 900 ; fond d'image en pétrole.
- **Pilote** (incohérences évidentes) :
  - `settings.tsx` : le pouce des interrupteurs était vert-bleu sur le web ;
  - l'avatar hérite de la correction ci-dessus ;
  - la liste « danger » de Réglages hérite du contraste corrigé.

## Dette supprimée

Mesures du garde-fou (`npm run design:check`) sur l'ensemble du dépôt, avant et après le Lot A. La nouvelle mesure `legacy` compte les anciens jetons Duelo (`COLORS.cyan`…) : elle n'était pas mesurée jusqu'ici.

| Mesure | Avant le lot | Après | Écart |
|---|---|---|---|
| Couleurs hex en dur | 940 | 659 | −281 |
| rgba en dur | 435 | 267 | −168 |
| Tailles de police en dur | 385 | 263 | −122 |
| Faux gras 800/900 | 122 | 101 | −21 |
| Dégradés hors design system | 103 | 73 | −30 |
| Anciennes bibliothèques d'icônes | 25 | 16 | −9 |
| Emoji d'interface | 74 | 63 | −11 |
| Anciens jetons Duelo | 104 | 18 | −86 |
| « Duelo » visible | 2 (coach en japonais et en chinois) | **0** | −2 |

Sur les fichiers du lot, tout est à 0, sauf :
- les 4 couleurs du logo Google (marque) ;
- le dégradé `GRADIENTS.hero` autorisé de l'onglet Jouer ;
- `UserAvatar` (18 hex) : les cadres cosmétiques, qui relèvent de la boutique (Lot E/F).

## Textes

- **Tutoiement partout** : recherche, messagerie, erreur réseau, défi reçu (`te défie`).
- **Anglicismes retirés** :
  - « Likes » devient « J'aime » ;
  - « Email » devient « E-mail » ;
  - « matché » devient « On te trouve un adversaire de ton niveau » ;
  - « TOP JOUEURS » devient « Meilleurs joueurs » ;
  - « follower » devient « abonné ».
- **Formules creuses retirées** :
  - « personnaliser ton expérience » ;
  - les deux encarts des réglages de notifications, raccourcis ;
  - les points d'exclamation en série.
- **Autres** :
  - « Google Sign In non configuré » devient « Connexion Google indisponible pour l'instant » ;
  - « plus de 500 thèmes » devient « Plus de 900 thèmes » (la base en compte 917) ;
  - « Tout lire » devient « Tout marquer comme lu » ;
  - les textes d'exemple de la recherche sont raccourcis : ils étaient coupés en 390.

## Tests

- TypeScript : 27 erreurs, toutes antérieures (28 avant ; celle de `CategoryIcon` dans l'onboarding a disparu).
- Garde-fou : aucune dette ajoutée, référence mise à jour.
- Jest : 684 / 685 (le même ancien test `CategoryIcon`).
- Navigateur, 390 et 320 :
  - aucune erreur React, aucun avertissement React, aucune surcouche d'erreur ;
  - `scrollWidth` égal à la largeur d'écran ;
  - seules restent les 401 des compteurs de non-lus, à cause du backend non redéployé.

## Better Design

**`check-comprehension`** (8 écrans) :
- aucun constat critique ;
- connexion, onboarding, notifications, langue, boîte de réception : les 3 tests passent ;
- les alertes restantes sont des faux positifs : libellés en majuscules lus comme des sigles, mots additionnés de plusieurs états qui ne s'affichent jamais ensemble ;
- les vrais problèmes de rédaction relevés ont été corrigés (voir « Textes »).

**`inspect-spacing`** (7 écrans × 390 et 320, tous `completed`) :
- les scores bas viennent presque entièrement des zones tactiles que l'outil ne sait pas lire : `hitSlop` des puces et des petits boutons, interrupteurs natifs ;
- vrais constats, corrigés :
  - champ de recherche cliquable sur 22 px seulement (corrigé dans `SearchField`) ;
  - tuiles de thèmes de hauteurs inégales dans l'onboarding ;
  - rythme 20/16/20 du formulaire de connexion ;
  - réponses rapides sur 2 lignes en 320 (une seule rangée qui défile, désormais).

## Incohérences restantes (hors Lot A)

1. **Icônes des tuiles de l'onboarding** : l'API « tendances » ne renvoie pas le cluster des thèmes, d'où la boussole de repli. À traiter dans le lot icônes : table préfixe d'identifiant → cluster (`ARE_`, `STV_`, `LIF_`…).
2. **Recherche** : « AC Milan » reçoit une illustration de basket, problème de correspondance des icônes (lot icônes et thèmes).
3. **Vocabulaire** : match, partie et duel désignent la même chose ; un seul mot est à choisir.
4. **Logique, `index.tsx`** : la condition `AppleAuthentication.isAvailableAsync &&` est toujours vraie (fonction non appelée). Erreur TypeScript ancienne, laissée en l'état (hors design).
5. **Accessibilité** : `ListRow` n'expose pas `accessibilityState` (langue sélectionnée annoncée seulement par la coche).
6. **Modales globales** : `RematchModal` et `ChallengeReadyModal` restent dans l'ancienne DA. Elles relèvent du gameplay et du défi : Lot B/D.
7. **CGU et support** vouvoient (Lot G, choix à trancher pour le juridique).

## Captures

- `captures/lotA/390x844/` et `captures/lotA/320x568/` : 13 écrans ou états ;
- planches `captures/lotA/planche-390x844.png` et `planche-320x568.png`.

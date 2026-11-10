# Handoff — Refonte UI Duelo (cosmique premium) · 33 écrans

## Vue d'ensemble
Refonte visuelle complète de l'app de quiz **Duelo** (React Native / Expo). On conserve l'ADN cosmique (épées croisées, cyan × violet, fond stellaire) mais on raffine la hiérarchie, on aère la mise en page, et on ajoute des **animations cinématiques** sur les moments clés (victoire, level-up, streak, pop de score) pour augmenter la rétention.

**33 écrans** couverts, en **version finale unique** (les variations ont déjà été tranchées par le client). La direction est figée.

---

## ⚠️ À propos des fichiers de design (LIRE EN PREMIER)

Les fichiers de ce bundle sont des **références de design écrites en HTML/React DOM (web)**. Ce sont des prototypes qui montrent l'intention visuelle et les interactions — **PAS du code à copier-coller**.

**La cible est une app React Native / Expo.** Il faut donc **recréer** ces écrans avec les composants et patterns natifs déjà en place dans le repo `frontend/`, et non porter le HTML.

### Table d'équivalence web → React Native
| Dans les maquettes (HTML) | À utiliser dans l'app (React Native) |
|---|---|
| `<div>` | `<View>` |
| `<div>` avec texte | `<Text>` (le texte DOIT être dans `<Text>`) |
| `onClick` | `onPress` sur `<TouchableOpacity>` / `Pressable` / `ScalePressable` existant |
| `background: linear-gradient(...)` | `<LinearGradient>` (`expo-linear-gradient`, déjà importé partout) |
| `background: conic-gradient(...)` | `<Svg>` avec dégradé angulaire, ou image — pas de conic natif |
| `backdropFilter: blur` (glass) | `<BlurView>` (`expo-blur`) ou fond semi-opaque `rgba(...)` |
| `overflowY: auto` | `<ScrollView>` / `<FlatList>` |
| `position: absolute; inset: 0` | `...StyleSheet.absoluteFillObject` |
| `boxShadow` | `shadowColor/Offset/Opacity/Radius` (iOS) + `elevation` (Android) |
| `@keyframes` CSS | `react-native-reanimated` (déjà utilisé dans le repo) |
| `<input>` / `<textarea>` | `<TextInput>` |
| `<svg>` (anneaux timer, icônes) | `react-native-svg` (`<Svg><Circle/></Svg>`) — déjà utilisé (matchmaking, themes) |
| `fontFamily: 'Fraunces'` | charger via `expo-font` (voir Assets) |
| emoji catégories | garder le système `CategoryIcon` existant |
| Avatar lettre/gradient | garder `UserAvatar` existant |
| Étoiles SVG fond | garder le `CosmicBackground` existant (image `fond_duelo.webp`) |

---

## Design tokens

À ajouter dans `frontend/theme/` (étendre `glassTheme.ts` ou créer `tokens.ts`) :

```ts
export const COLORS = {
  // Fonds
  abyss:  '#050510', night: '#0A0A1A', ink: '#12122A', panel: '#1A1A35',
  // Accents marque (DUEL = cyan vs violet)
  cyan:   '#00E5FF',   // joueur 1 / primaire
  violet: '#B366FF',   // joueur 2 / primaire
  // Sémantiques
  gold:   '#FFB547',   // victoire, XP, pièces
  fire:   '#FF6B2C',   // streak / urgence
  mint:   '#32E7A3',   // bonne réponse / succès
  red:    '#FF3D5E',   // mauvaise réponse / défaite / erreur
  // Texte sur fond sombre
  white: '#FFFFFF',
  dim1:  'rgba(255,255,255,0.85)',
  dim2:  'rgba(255,255,255,0.60)',
  dim3:  'rgba(255,255,255,0.40)',
  stroke: 'rgba(255,255,255,0.08)', strokeStrong: 'rgba(255,255,255,0.14)',
  surface: 'rgba(255,255,255,0.04)', surfaceLight: 'rgba(255,255,255,0.07)',
};
export const RADIUS = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

// Couleurs catégories
export const CATEGORY_COLORS = {
  geo: '#00E5FF', histoire: '#FFB547', cinema: '#B366FF',
  sciences: '#32E7A3', sport: '#FF6B2C', musique: '#FF3D5E',
};
```

### Typographie (3 familles)
| Rôle | Font | Usage | Poids |
|---|---|---|---|
| **Display** | Space Grotesk | UI, boutons, scores, gros chiffres, titres d'écran | 400–900 |
| **Editorial** | Fraunces *italic* | titres hero, moments forts (Bravo., Égalité), numéros de section | 400–500 |
| **Technical** | JetBrains Mono | eyebrows, labels, timestamps, scores mono | 400–700 |

Échelle (px, lisibles sur mobile) : Hero serif 48–64 · Titre écran 24–34 · Section 16–22 · Corps 13–15 · Label 11–12 · Eyebrow mono 9–11 (letterSpacing 2–3, UPPERCASE) · Gros chiffres arcade 38–72 (weight 900, letterSpacing négatif).

---

## Les 33 écrans

> **Référence visuelle unique : `Duelo Tout.html`** (tout sur une page, nav latérale). Ou les 3 fichiers thématiques : `Duelo Final.html`, `Duelo Suite.html`, `Duelo États.html`. Ouvre-les dans un navigateur pour le rendu + animations.
>
> Composants : `screens_final.jsx` (`F_*`), `screens_suite1/2/3.jsx` (`S_*`), `screens_states.jsx` (`E_*`), `proto.jsx` (flow jouable), `primitives.jsx` (Phone, CosmicBg, Avatar, NavBar, SwordMark, PrimaryBtn).

### A. Écrans principaux (9) — `screens_final.jsx`
| # | Écran | Fichier app cible | Notes clés |
|---|---|---|---|
| 1 | Onboarding | `app/onboarding.tsx` | Mascotte logo dans disque conic animé (pulse), titre Space Grotesk 40px UPPERCASE, 3 dots, bouton gradient. |
| 2 | Accueil | `app/(tabs)/accueil.tsx` | Barre XP sous pseudo, gros bloc « DUEL ! » gradient **+ sous-texte « Trouve un adversaire en ~8s »**, carte streak 🔥, duels avec bordure cyan 2px si « YOUR TURN ». |
| 3 | Matchmaking | `app/matchmaking.tsx` | Reveal VS : 2 cartes (cyan haut / violet bas), « VS » serif or, stats WR%/streak, décompte « 3 » or glow. |
| 4 | Quiz | `app/game.tsx` | Score split haut, dots progression, **TIMER ROND** (anneau SVG + secondes au centre) → rouge+pulse sous 3s, question Space Grotesk 24px, réponses grille 2×2, bonne réponse gradient menthe. ⚠️ garder `TOTAL_QUESTIONS=7` du repo, pas le « 10 » des maquettes. |
| 5 | Résultats (victoire) | `app/results.tsx` | Badge FLAWLESS, « VICTOIRE » 64px, cartes score, **détail des points** (Base+50/Victoire+30/Précision+24/Série+20) **+ TOTAL +124 XP**, barre niveau LV12→13, confettis. Mapper sur `XpBreakdown` existant. |
| 6 | Thèmes | `app/(tabs)/themes.tsx` | Carte vedette « CINÉMA · POPULAIRE » gradient + reste des catégories en **grille 2 colonnes** (cartes carrées teintées). |
| 7 | Leaderboard | `app/leaderboard.tsx` | Header saison, tabs gradient, **podium 3 colonnes** (or/argent/bronze, #1 ring or), liste avec ta ligne bordée cyan. |
| 8 | Profil | `app/(tabs)/profile.tsx` | Avatar 96px ring or, barre XP, 3 stats, trophées scrollables. **Typo Space Grotesk display** (pas de Fraunces) : pseudo + chiffres en 900 UPPERCASE. |
| 9 | Shop | `app/shop.tsx` | Carte deal « FLASH -30% » gradient feu/rouge, grille 2×2 boosts/skins, compteur pièces header. |

### B. Social & joueurs (7) — `screens_suite1.jsx`
| # | Écran | Fichier app cible | Notes clés |
|---|---|---|---|
| 10 | Conversations | `app/conversations.tsx` | Liste messages : avatar + dot online vert, dernier message, badge non-lus cyan. |
| 11 | Chat | `app/chat.tsx` | **Interactif** : bulles (les miennes en gradient, autres glass), input + envoi, bouton « DÉFIER » dans le header. Header avec statut en ligne. |
| 12 | Recherche | `app/search.tsx` | **Interactif** : champ filtrant joueurs + thèmes en temps réel, tags populaires, état « aucun résultat ». |
| 13 | Notifications | `app/notifications.tsx` | Liste typée (défi/classement/streak/follow) avec icône colorée, non-lus surlignés, CTA inline (Accepter/Suivre). |
| 14 | Joueurs | `app/(tabs)/players.tsx` | Barre recherche, carte « rival du jour », suggestions avec amis communs + bouton défier. |
| 15 | Profil joueur | `app/player-profile.tsx` | Profil d'un autre : actions Défier/Suivre/Message, **bloc face-à-face** (ton bilan vs lui), stats. |
| 16 | Communauté | `app/followers.tsx` | Tabs Abonnés/Abonnements, lignes avec bouton Suivi/Suivre. |

### C. Jeu & contenu (6) — `screens_suite2.jsx`
| # | Écran | Fichier app cible | Notes clés |
|---|---|---|---|
| 17 | Défi en attente | `app/challenge-waiting.tsx` | Avatars TOI vs adversaire (anneaux ping animés), chip thème, anneau décompte 15s, bouton annuler. |
| 18 | Modes de jeu | `app/(tabs)/play.tsx` | Gros bloc Quick Match gradient + lignes (Défier ami / Tournoi avec badge LIVE / Entraînement). |
| 19 | Tournoi | `app/tournament.tsx` | Hero trophée + décompte H/M/S, tes stats (rang/score/parties), classement, CTA jouer. |
| 20 | Univers | `app/super-category.tsx` | Hero univers, barre maîtrise globale, liste thèmes avec anneau de progression SVG. |
| 21 | Détail thème | `app/category-detail.tsx` | Hero thème, carte niveau + %, stats (joués/gagnés/précision), mini-leaderboard, CTA duel. |
| 22 | Créer un thème | `app/create-theme.tsx` | **Interactif** : form (sujet + choix univers) → écran génération IA animé → écran succès avec confettis. |

### D. Réglages (4) — `screens_suite3.jsx`
| # | Écran | Fichier app cible | Notes clés |
|---|---|---|---|
| 23 | Notif-settings | `app/notification-settings.tsx` | Groupes (Duels/Social/Progression) avec toggles switch gradient. |
| 24 | Langue | `app/language-settings.tsx` | **Interactif** : liste langues (drapeau + natif), sélection avec check gradient. |
| 25 | Aide & support | `app/support.tsx` | Carte contact, liste FAQ avec icônes, version app en pied. |
| 26 | Conditions | `app/terms.tsx` | Sections numérotées (Fraunces italic), liens légaux. |

### E. États & cas limites (7) — `screens_states.jsx`
| # | État | Où l'appliquer | Notes clés |
|---|---|---|---|
| 27 | Défaite | `app/results.tsx` (cond. `!won && !draw`) | « PRESQUE… » gris, score perdant grisé / gagnant violet, **XP de consolation réduit** (+36), rappel streak intacte, CTA revanche. |
| 28 | Égalité | `app/results.tsx` (cond. `draw`) | « Au coude à coude. » serif, scores symétriques 5=5, « = » or, XP partagés, CTA « La belle ! ». |
| 29 | Adversaire parti | `app/game.tsx` / `results.tsx` | Avatar adversaire avec croix rouge, **victoire par forfait** +40 XP, CTA nouveau duel. |
| 30 | Aucun duel | `app/(tabs)/accueil.tsx` (liste vide) | EmptyState centré : icône ⚔, titre, CTA « Trouver un adversaire ». |
| 31 | Aucun message | `app/conversations.tsx` (liste vide) | EmptyState 💬, CTA « Trouver des joueurs ». |
| 32 | Recherche vide | `app/search.tsx` (0 résultat) | EmptyState 🔍 avec le terme recherché. |
| 33 | Hors ligne | Composant global / overlay | Icône wifi coupé, message, indicateur « Reconnexion… » pulse. À brancher sur l'état réseau (le repo a `WebSocketContext`). |

> **Pattern EmptyState** : icône dans tuile arrondie + halo radial, titre Space Grotesk 22px, corps gris, CTA gradient. Toujours proposer une action — jamais de page blanche. Réutilisable (voir `EmptyState` dans `screens_states.jsx`).

---

## Interactions & animations (à porter en Reanimated)

| Animation | Détail | Équivalent Reanimated |
|---|---|---|
| **Timer rond stress** | anneau SVG cyan → rouge + pulse scale 1↔1.1 sous 3s | `withRepeat(withTiming)` + interpolate couleur sur `strokeDashoffset` animé |
| **Score pop** | scale 1→1.4→1 + flash menthe (0.8s) | `withSequence(withSpring(1.4), withSpring(1))` |
| **Transition héros** | anneau or qui s'étend (20→600px, fade) + titre serif zoom-in overshoot | `withTiming` scale + opacity |
| **XP counter** | compteur 0 → +124 qui s'incrémente | `useSharedValue` + `useDerivedValue` → state texte |
| **Confettis** | ~30 particules qui tombent (translateY + rotate 720°) | `react-native-confetti-cannon` (DÉJÀ dans le repo, utilisé dans `results.tsx`) |
| **Anneaux ping** (matchmaking, défi) | cercles scale 1→2.2 + fade, décalés | `withRepeat` + `delay` |
| **Pulse logo / génération IA** | disque conic en pulse lente | `withRepeat(withTiming(scale))` |
| **Apparition résultats** | éléments en fadeSlide décalés (0.2s, 0.4s, 0.6s) | `entering={FadeInDown.delay(n)}` (déjà utilisé via reanimated) |

Haptics (le repo utilise déjà `expo-haptics`) : `notificationAsync(Success)` sur victoire/forfait, `notificationAsync(Error)` sur défaite, `impactAsync(Medium)` sur sélection de réponse, `impactAsync(Light)` sur navigation.

---

## State & logique (déjà dans le repo)
- `game.tsx` : `TIMER_DURATION=10`, `TOTAL_QUESTIONS=7`, `MAX_PTS_PER_Q=20`. Garder ces valeurs réelles.
- `results.tsx` : type `XpBreakdown` (base, victory, perfection, giant_slayer, streak, total) → mapper sur le détail des points. Gérer les 3 cas `won` / `draw` / défaite (écrans 5, 27, 28).
- XP/niveaux : helpers `getXpLevel` / `getXpInLevel` (dans `accueil.tsx`).
- Réseau : `WebSocketContext` → brancher l'état Hors-ligne (33) et Adversaire-parti (29).
- **Les données des maquettes (noms, scores, « 10 questions ») sont fictives.** Brancher sur l'état réel, ne pas changer la logique de jeu.

---

## Assets
- **Fonts à ajouter** (via `expo-font`, `frontend/assets/fonts/`) : Space Grotesk (400–900), Fraunces (italic 400/500), JetBrains Mono (400–700). Source : Google Fonts.
- **Existants à réutiliser** : `fond_duelo.webp` (fond cosmique), logo épées (`icon-v2.png` ou SVG `SwordMark`), `CategoryIcon`, `UserAvatar`, `CosmicBackground`, `ScalePressable`, `DueloHeader`, `GLASS`.
- **Icônes** : `MaterialCommunityIcons` (déjà utilisé). Les « ◆ » des eyebrows sont du texte simple.

---

## Fichiers de référence (dans ce bundle)
- **`Duelo Tout.html`** ⭐ — LA référence : les 33 écrans sur une page + nav latérale + proto interactif. **Ouvre-la en premier.**
- `Duelo Final.html` / `Duelo Suite.html` / `Duelo États.html` — mêmes écrans, répartis par thème (plus léger).
- `screens_final.jsx` / `screens_suite1.jsx` / `screens_suite2.jsx` / `screens_suite3.jsx` / `screens_states.jsx` — composants des écrans.
- `proto.jsx` — flow jouable Quiz→Victoire (animations cibles).
- `primitives.jsx` — composants partagés. `tokens.js` — valeurs de design.

### Plan d'intégration recommandé (par phases)
Avance **écran par écran**, valide chacun avant le suivant. Ordre suggéré (impact décroissant) :

1. **Fondations** : ajouter les fonts (`expo-font`) + les tokens dans `theme/`. Créer 2-3 composants partagés (`DuelButton`, `EmptyState`, `RoundTimer`).
2. **Cœur de boucle** : Quiz (4) → Résultats victoire/défaite/égalité (5, 27, 28) → Accueil (2). C'est ce qui crée la rétention.
3. **Découverte** : Matchmaking (3), Modes de jeu (18), Thèmes (6), Leaderboard (7), Profil (8).
4. **Social** : Chat (11), Conversations (10), Joueurs (14), Profil joueur (15), Notifications (13).
5. **Reste** : Shop (9), Tournoi (19), Univers/Détail (20, 21), Créer thème (22), Réglages (23–26).
6. **Finitions** : tous les états vides + erreurs (29–33), animations Reanimated, haptics.

### Prompt de départ pour Claude Code
> « Lis `design_handoff_duelo/README.md` et ouvre `Duelo Tout.html` comme référence visuelle. On va intégrer le redesign écran par écran en React Native dans `frontend/`. Commence par la Phase 1 (fondations) : ajoute les 3 fonts via expo-font, crée le fichier de tokens dans `theme/`, et prépare les composants partagés `RoundTimer`, `EmptyState`, `DuelButton`. Réutilise nos composants existants (`CosmicBackground`, `UserAvatar`, `CategoryIcon`, `LinearGradient`, `reanimated`, `react-native-confetti-cannon`). Ne change pas la logique de jeu. Montre-moi le diff avant d'appliquer. »

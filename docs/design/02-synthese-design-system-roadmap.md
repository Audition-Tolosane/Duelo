# Synthèse multi-agents : refonte DA SKILKI

*Audit en lecture seule. Deux points ont été revérifiés dans le code :*
- *`matchmaking.tsx` ne lit jamais `opponentId`. Le paramètre n'apparaît qu'à la l.517, quand on lance `/game`. La l.296 fait bien `router.replace('/(tabs)/play')`.*
- *`theme/tokens.ts:4-14` code la marque en `cyan '#00E5FF'` (« joueur 1 / primaire »), `violet '#B366FF'` (« joueur 2 »), `gold '#FFB547'`, `abyss '#050510'` et `night '#0A0A1A'`.*

---

## 1. Diagnostic commun (ce qui marche, ce qui ne marche pas, en 10 lignes max)

1. **Ce qui marche :** le pipeline Recherche → VS → Question → Résultat est court (`router.replace`, matchmaking.tsx:516). L'écran VS est spectaculaire : VS en Fraunces italique 38, décompte de 72 px, cartes qui glissent (matchmaking.tsx:700-788, 914-928). La grille 2×2 est placée dans la zone du pouce (game.tsx:874-944).
2. Le trio typographique Space Grotesk / JetBrains Mono / Fraunces, les surfaces glass sobres (blanc à 4-8 %), la progression par thème (roadmap, Top maître) et les retours haptiques et sonores forment les ~70 % à garder.
3. **Ce qui ne marche pas, côté identité :** l'app est codée « cyan contre violet » jusque dans les tokens (tokens.ts:4-6). On compte environ 320 hex violet et cyan, au moins 163 LinearGradient, et un CTA principal en dégradé cyan→violet avec glow (DuelButton.tsx:31-35). C'est exactement le cliché « IA / gaming » à retirer. Aucune couleur SKILKI n'est présente dans le code.
4. **Ce qui ne marche pas, côté système :** les tokens sont contournés. On trouve 1 639 hex et 717 rgba en dur contre 127 `COLORS.*`, 7 écrans qui redéclarent CYAN/VIOLET/GOLD, et 0 usage de `TYPE`. On compte aussi 33 tailles de police, 40 rayons, 168 styles de bouton et 6 boutons retour différents.
5. **Lisibilité :** environ deux textes sur trois sont en police système. Il y a 226 `fontWeight` 800/900 alors que Space Grotesk s'arrête à 700. 20 % des textes font 10 px ou moins, et le texte `#525252` affiche environ 2,6:1 de contraste (85 occurrences).
6. **Confiance, P0 fonctionnels :** les boutons « Défier X » lancent un match aléatoire ou renvoient vers Jouer. « Retour à l'accueil » mène à Jouer. Le swipe-retour permet d'abandonner un match sans forfait. En ligne, aucun état « sélectionné » ne s'affiche et la bonne réponse n'est jamais montrée quand on se trompe.
7. **Sémantique couleur cassée en jeu :** les réponses sont teintées cyan / menthe / violet / or *avant* la révélation (game.tsx:55). La menthe est déjà la couleur du « juste ».
8. **Densité :** l'Accueil empile environ 14 blocs, 22 éléments cliquables et 7 CTA concurrents. Le Profil compte 14 sections et affiche des statistiques en double. Le bouton Jouer de la page thème est au même niveau que deux autres boutons.
9. **Thèmes :** les icônes sont des glyphes MCI génériques (450 glyphes pour 913 thèmes), avec un repli en emoji. Leur couleur est un arc-en-ciel calculé par hachage (`hashColor`, 3 copies). La série SKILKI V2 est saine, mais elle n'est pas lisible sur nuit pétrole : `#12606D` sur `#071F26` donne 2,37:1.
10. **Conclusion :** il faut d'abord fiabiliser les CTA de duel et centraliser les tokens, ensuite seulement changer la palette. Sinon la refonte se fera fichier par fichier.

---

## 2. Désaccords entre agents

| # | Tension | Positions | Arbitrage |
|---|---|---|---|
| D1 | **Couple de couleurs du duel** | A2 : moi jaune contre rival corail. A6 : moi crème/jaune contre rival corail, jaune réservé à la sélection en jeu. A7 : il faut des tokens `playerMe` / `playerOpp` avant de supprimer le cyan, et quelqu'un pourrait vouloir garder le violet pour l'adversaire. | **Moi = jaune `#FFDB3D`, rival = corail `#FF6B5B`** sur VS, Résultat, RematchModal et classement. **Exception en jeu :** ma boîte de score est en crème avec un liseré jaune de 2 px, pour que le jaune plein reste le signal de *ma réponse sélectionnée*. Le violet ne sert plus à l'adversaire : sa sémantique « rare » serait perdue. Tokens découplés : `player.me` et `player.opp`. |
| D2 | **Or `#FFB547` contre jaune `#FFDB3D`** | A2 : deux rôles étanches ou fusion. A7 : fusion dans le jaune. A6 : à trancher, désaccord prévisible avec la progression. | **Garder un token `reward` `#FFB547`**, limité aux chiffres d'XP, aux pièces et à la médaille n°1. Il n'est jamais utilisé sur un bouton ni sur un état actif. Le jaune reste la seule couleur d'action. Le VS, le décompte et l'eyebrow « Q1 · 7 » passent de l'or au jaune. *Question Q2.* |
| D3 | **Violet : combien et où** | A2 : moins de 10 occurrences. A6 : FLAWLESS uniquement. A5 : garder le mode VO en `#A78BFA`. A7 : Premium et rang légendaire. A4 : palier de badge ultime. | `#A78BFA` = **rareté seulement**, sur 3 usages fermés : palier ultime de ligue (ex-diamond), FLAWLESS et Premium. **Le mode VO passe en chip neutre** : c'est une option, pas une rareté. |
| D4 | **Corail proche du rouge d'erreur** | A2 et A6 : risque de confusion, décaler le rouge vers une teinte plus froide, toujours doubler par une icône. | Erreur = **`#F0445E`** (rouge rosé plus froid), toujours accompagné d'une icône ✕. En jeu, le corail ne marque jamais une réponse : il sert au timer sous 5 s, au rival et aux événements. Les boutons Annuler et Refuser deviennent des boutons ghost crème, et plus jamais rouges. |
| D5 | **Plaque des icônes de thèmes** | A4 : plaque crème recommandée (6,24:1 avec le pétrole), ou plaque pétrole avec silhouette inversée. A4 et A5 anticipent des points clairs trop nombreux dans les grilles. A5 : carré `#12606D`. | **Plaque crème `#E8F1EC` en squircle** pour les illustrations de 28 px et plus. Les V2 sont déjà dessinées pour fonctionner sur crème, ce qui évite de redessiner 917 icônes. Les cartes autour restent en pétrole. Le carré `#12606D` d'A5 est **rejeté** : la silhouette `#12606D` y disparaît. Avant de lancer la production, prototyper la grille d'Explorer avec les deux options. *Question Q4.* |
| D6 | **Jeu d'icônes d'interface** | A4 : Lucide (même grammaire que les SVG maison, stroke 2). A7 : MCI (déjà 302 balises) ou set maison. | **Lucide** (`lucide-react-native`, qui repose sur react-native-svg, déjà installé), via un wrapper `<Icon>`. Les SVG maison de la tab bar et du header ont déjà le même trait, donc le passage ne crée pas de rupture. MCI reste toléré derrière `<Icon>` pendant la migration. |
| D7 | **Densité de l'Accueil contre bloc « Tes thèmes »** | A1 : 6 blocs maximum. A5 : ajouter un carrousel « Tes thèmes » sur l'Accueil. A1 signale aussi le conflit entre le pager à swipe et les 3 carrousels horizontaux. | **Pas de carrousel supplémentaire sur l'Accueil.** Le hero Duel porte une ligne « Rejoue : [3 puces de thèmes] ». Le carrousel complet « Tes thèmes » vit en haut d'Explorer. L'Accueil garde **un seul** carrousel horizontal (« À toi de jouer »). |
| D8 | **Carrousels ou listes (Explorer, super-catégorie)** | A1 : la grille 2 colonnes est bonne. A5 : passer les univers en lignes, ou en tuiles sans cartouches. A5 : carrousel seulement si plus de 4 thèmes. | Univers : **grille 2 colonnes conservée, sans cartouches** (icône, nom, compteur), pour garder l'impact visuel. Super-catégorie : carrousel de 6 cartes au plus s'il y a plus de 4 thèmes, sinon des lignes. « Voir tout » ouvre un écran liste. |
| D9 | **Swipe entre onglets** | A1 : le désactiver ou le limiter aux bords. Vigilance A1 : les joueurs ont pris l'habitude de ce geste. | **Désactiver le pan du pager** (_layout.tsx:303-305). La tab bar suffit, et cela supprime le conflit avec les carrousels. On réévaluera après le pilote si des retours le demandent. |
| D10 | **Spectacle ou lisibilité (VS, victoire)** | A3 : ramener le décompte à 64. A1 et A6 : garder 72. A2 : ne pas éteindre la scène. A3 et A6 : supprimer les glows. | **Décompte à 72 px, exception documentée.** On garde les halos du VS (jaune et corail ≤ 20 %) et de la victoire. Glow coloré autorisé seulement sur la bonne réponse, la victoire et le CTA actif. Partout ailleurs, ombre noire. |
| D11 | **Plancher typographique** | A1 et A2 : 11 px, 10 px pour les eyebrows. A3 : 10 px pour les micro-pastilles, 11 px pour les labels. A7 : 10 px. | **11 px minimum pour tout texte informatif**, eyebrows et tab bar compris. **10 px seulement pour les pastilles de compteur.** |
| D12 | **Taille de la question** | A3 : 22/28 avec `adjustsFontSizeToFit`. A6 : paliers selon la longueur. | **Paliers déterministes** (A6) : pas de saut de mise en page, rendu identique pour les deux joueurs. Interligne ≥ 1,25. |
| D13 | **JetBrains Mono** | A3 : la garder (ton « tableau de score »). Un rôle produit pourrait la trouver trop « dev ». | **On la garde**, limitée aux eyebrows, labels et métadonnées en 11 px majuscules, avec un espacement de +1,5. |
| D14 | **« Défier X »** | A1 : brancher sur `challenges/send`, ou à défaut renommer. A1 (vigilance) : à valider côté backend. | Cible : flux défi existant (player-profile.tsx:159-193). **Correctif immédiat :** renommer en « Jouer ce thème » ou masquer les boutons sans catégorie, pour ne plus mentir dans l'interface. *Question Q3.* |
| D15 | **GlassIconFrame** | A4 : composant mort, contraire à la DA, on ne garde que l'anneau. A7 : en faire le cadre officiel ou le supprimer. | **Supprimer**, en reprenant l'anneau de progression (l.39-55) dans un composant `ProgressRing` (jaune sur piste crème à 12 %). |
| D16 | **Couleur d'une défaite** | A2 : dégradé pétrole désaturé. A6 : titre crème avec filet corail. | Fond pétrole `#0B3D4A` → `#071F26`, titre crème, filet corail de 2 px sous le titre. Ni violet, ni rouge plein : une défaite n'est pas une erreur. |
| D17 | **Seuils du timer** | A2 : corail sous 5 s. A6 : corail sous 50 % du temps. Les deux : rouge sous 3 s. | **Crème, puis corail sous 5 s, puis rouge sous 3 s** avec pulsation. Une règle unique, lisible quelle que soit la durée (10, 13 ou 15 s). |

---

## 3. Problèmes classés

### P0 : incohérence majeure ou UX critique

| # | Écran | Problème | Preuve (fichier:ligne) | Action |
|---|---|---|---|---|
| 0.1 | Global / tokens | La marque est codée cyan contre violet dans les tokens, et les tokens sont contournés (1 639 hex et 717 rgba en dur). 7 constantes locales existent, `glassTheme` fait doublon. | tokens.ts:4-14 ; accueil.tsx:29-33, play.tsx:16-18, profile.tsx:67-71, category-detail.tsx:25-29, game.tsx:50-55, search.tsx:22-26, leaderboard.tsx:34-35 ; glassTheme.ts:5 | Réécrire tokens.ts par rôles (§4), garder des alias `cyan`/`violet` temporaires, supprimer les constantes locales, fusionner `glassTheme`. |
| 0.2 | CTA / Quick Match / vedette Explorer | CTA principal en dégradé cyan→violet avec glow cyan. Le Quick Match, la vedette d'Explorer, la Forge et le bouton Jouer du thème sont violets. | DuelButton.tsx:31-35, 69-74 ; play.tsx:78 ; themes.tsx:122-126, 210, 251-252 ; category-detail.tsx:824 ; results.tsx:777-782 ; profile.tsx:649 ; leaderboard.tsx:333/359 | `<Button primary>` en jaune plein `#FFDB3D`, texte `#071F26`, ombre noire. Aucun dégradé bicolore. |
| 0.3 | Accueil / Classement / Joueurs | Les boutons « Défier X » ne défient pas X : ils lancent un matchmaking aléatoire, ou renvoient vers Jouer quand il n'y a pas de catégorie. | matchmaking.tsx:231 (pas d'`opponentId`), 295-296 ; accueil.tsx:320, 1192-1193 ; leaderboard.tsx:459 ; players.tsx:527-529 | Brancher sur `challenges/send` → `challenge-waiting` (player-profile.tsx:159-193), ou renommer en attendant. |
| 0.4 | Accueil / Jouer | Le Quick Match d'un nouveau joueur (aucun thème joué) atterrit sur un rebond vers Jouer. Deux implémentations coexistent. | accueil.tsx:1741-1744, 2058-2063 ; play.tsx:34-55 | Une fonction partagée `startQuickMatch()` (logique de play.tsx:36-55), appelée partout. |
| 0.5 | Game / Matchmaking | Le swipe-retour est actif sur tout l'écran : on peut quitter sans forfait et sans `matchmaking_leave`. | _layout.tsx:37-44 ; SwipeBackPage.tsx:60-64 ; game.tsx:809 ; matchmaking.tsx:548-562 | Retirer SwipeBackPage en jeu et en phase VS. Ajouter un bouton « Abandonner » de 44 px avec confirmation et forfait (game.tsx:136-150). Pendant la recherche, le swipe déclenche `handleCancel`. |
| 0.6 | Résultat | « Retour à l'accueil » mène à Jouer, « DÉFIER UN AMI » ouvre le partage système, et un refus de revanche relance automatiquement un matchmaking. | results.tsx:766, 754, 324, 170-204 ; i18n.ts:305, 310 | Pointer vers `/(tabs)/accueil`, renommer en « Partager mon score », afficher un état « Refusée » avec Nouveau duel / Retour. |
| 0.7 | Question | Les 4 réponses sont colorées avant la révélation, dont la menthe (couleur du succès) et l'or (proche de la sélection). | game.tsx:50-55, 779, 789, 906-909 | Options neutres : pétrole, bordure crème à 14 %, badge lettre en crème. |
| 0.8 | Question (en ligne) | Aucun état « sélectionné » pendant les 8 s d'attente maximum du serveur, et pas d'haptique au tap. | game.tsx:551, 569-575, 779-799 | État `selected` immédiat : bordure jaune 3 px, fond jaune à 14 %, scale 0,97, haptique Light, autres options à 40 %. |
| 0.9 | Révélation (en ligne) | La bonne réponse n'est jamais montrée quand on se trompe ou que le temps expire. | game.tsx:771-776, 503-514 | Le backend renvoie `correct_option` dans `answer_result`, *après* la réponse (anti-triche). |
| 0.10 | Question | Question figée en 24/28 (ratio 1,17) en weight 900, même pour plus de 300 caractères, ce qui écrase la grille. | game.tsx:1117, 36, 1120 | Paliers 24/30 · 22/28 · 19/25 · 17/23 selon la longueur, en Space Grotesk Bold, crème. |
| 0.11 | Global / contraste | Gris de texte `#525252`, `#555`, `#444` à environ 2,6:1 (88 textes). Tab bar en 9 px à 38 % d'opacité. | profile.tsx:211 ; players.tsx:835 ; category-detail.tsx:568-571 ; accueil.tsx:2399 ; matchmaking.tsx:861 ; _layout.tsx:186, 447-448 | Échelle de texte en crème 100 / 72 / 60 % (§4). Bannir les gris neutres pour le texte. |
| 0.12 | Fond global | Satin anthracite sur `#050510` (65 occurrences en dur), voile bleuté, aucune identité. | CosmicBackground.tsx:4, 29, 38 ; matchmaking.tsx:631, 830 ; game.tsx:813 ; results.tsx:452-455 | `<ScreenBackground>` en nuit pétrole `#071F26` avec un radial `#0B3D4A` doux. Remplacer `fond_duelo.webp`. |
| 0.13 | Global / typo | Environ deux tiers des textes sont en police système. 226 `fontWeight` 800/900 sur une police qui s'arrête à 700. Les réponses du quiz sont en police système. | game.tsx:1117, 1136, 1050 ; profile.tsx (70 fontSize / 3 fontFamily) ; _layout.tsx:447 ; RematchModal.tsx (5/0) | Composant `<Txt variant>` obligatoire, graisse portée par la famille, `fontWeight` interdit. |
| 0.14 | Icônes de thèmes | Glyphes MCI génériques (450 pour 913 thèmes, `sword` ×14), repli emoji, couleur arc-en-ciel par hachage. | CategoryIcon.tsx:3, 1045, 1049 ; super-category.tsx:24, 42-49, 191 ; search.tsx:46-53 ; category-detail.tsx:46-53 | `<ThemeIcon id size>` en SVG SKILKI à couleurs fixes, repli thème → cluster → univers. Supprimer `hashColor` et `shiftHue`. |
| 0.15 | Série test d'icônes | `#12606D` dominant à 2,37:1 sur `#071F26`. Traits de 4 à 20 px qui disparaissent à 32 px. Aperçu testé sur `#050510`. | gen_icons_v2.py:5, 51, 113, 184-186, 263 | Plaque crème, traits limités à {12, 20}, lint bloquant, aperçu sur `#071F26` et `#0B3D4A` et planche à 32 px **avant** la production en masse. |
| 0.16 | Page thème | Jouer n'est pas dominant : 3 boutons en `flex:1`, Jouer violet avec emoji ⚡, enfermés dans une carte qui en contient 3 à 4 niveaux. | category-detail.tsx:436-455, 807-824, 438 | Bouton « Jouer ce thème » jaune, 56 px, pleine largeur, collant en bas. Suivre devient une icône, Classement une ligne. |
| 0.17 | Explorer | Aucune recherche visible pour environ 917 thèmes. Seul accès : une icône de 40 px parmi 4. | themes.tsx:110-116 ; DueloHeader.tsx:79, 130-132 | Barre de recherche pleine largeur de 48 px en tête d'Explorer, qui ouvre `/search` avec le clavier. |
| 0.18 | Marque | « Duelo » reste visible dans les assets, l'UI, les partages, la boutique et environ 14 clés i18n × 10 langues. « duelo » signifie « duel » en espagnol et en portugais. | app.json:3, 8, 49 ; DueloHeader.tsx:8 ; index.tsx:27, 171 ; shop.tsx:95 ; results.tsx:322-323 ; profile.tsx:340 ; language-settings.tsx:29, notification-settings.tsx:186, support.tsx:64, terms.tsx:21 ; i18n.ts:142, 312, 314, 329, 437, 451, 584, 730-744 (faux positifs : 53, 92, 94, 232) | Liste de renommage explicite, sans rechercher-remplacer global. Le scheme et le slug changent seulement en coordination avec OAuth. |

### P1 : amélioration importante

| # | Écran | Problème | Preuve (fichier:ligne) | Action |
|---|---|---|---|---|
| 1.1 | Accueil | Environ 14 blocs, 22 éléments cliquables, 7 CTA. Les défis reçus arrivent après 5 widgets. 21 dégradés de teintes différentes. | accueil.tsx:1656-2128 ; 290, 324, 384, 536, 687, 1076, 1708, 1752, 1839 | 6 blocs maximum (§5), un seul CTA jaune au-dessus de la ligne de flottaison, cartes en aplat pétrole, événements en liseré corail. |
| 1.2 | Accueil / Jouer | Deux Quick Match (machine à sous ou tendances), deux libellés, promesse « ~8s » alors que le bot arrive à 30 s. | accueil.tsx:1722-1764, 1991-2001 ; play.tsx:85-91 ; matchmaking.tsx:287-291 | Un nom unique, « Duel rapide ». Le thème tiré s'affiche sur la recherche (chip l.647-650). Retirer « ~8s ». |
| 1.3 | Résultat | Revanche en bas du scroll, modale de récompenses intercalée, aucun MMR ni ligue affiché. | results.tsx:752-812, 822 | Barre fixe en bas (Revanche jaune `flex:2` / Retour ghost), puce « +18 MMR · Or II », détail XP repliable. |
| 1.4 | Résultat | 14 dégradés, défaite violette, confettis arc-en-ciel, 5 accents concurrents, badge « VAINQUEUR » violet. | results.tsx:455, 535, 593-612, 850, 884, 895, 986, 1011, 1144, 1286, 1365, 1387 | Halo jaune à 22 % pour la victoire, pétrole pour la défaite, confettis jaune/corail/crème, carte gagnante bordée de jaune. |
| 1.5 | Profil | 14 sections, statistiques en double, réglages et suppression de compte dans le même scroll, tiers en dégradés métal et cyan. | profile.tsx:602-618, 684-704, 804-923, 37-42, 664 | Hero avec ligue et MMR → 4 stats → Mes thèmes → Historique → Succès. Réglages dans un écran à part. |
| 1.6 | Jouer → Défier un ami | Ouvre l'onglet Joueurs (Pulse / Tribus / Forge) : 3 à 4 étapes. | play.tsx:99-115 ; players.tsx:569-740 | Bottom sheet « Défier » (abonnements et adversaires récents) branchée sur `challenges/send`. |
| 1.7 | Tab bar | 5 couleurs actives, labels de 9 px, glow cyan, bouton central violet `#7B22E2` en webp, badges en double avec le header. | _layout.tsx:52, 75-82, 149-153, 186-203, 408, 430-483 ; DueloHeader.tsx:89-102 | Actif jaune, inactif crème à 55 %, label 11 px, disque central jaune avec SVG nuit, badges seulement dans le header. |
| 1.8 | VS / Matchmaking | Joueur cyan contre adversaire violet, textShadow néon, timeout en `#8A2BE2→#00FFFF`, carte du monde en 3 couches avec 22 couleurs d'épingles, « localisé » en vert, Annuler en rouge. | matchmaking.tsx:59-64, 588-611, 646-653, 669, 680-682, 697-751, 811-813, 854-864, 907-908 | Moi jaune / rival corail, une seule couche pétrole pour la carte, épingle rival corail, Annuler en ghost, timeout en CTA jaune. |
| 1.9 | Question | Réponses à 11 px, badge 28×28 qui mange la largeur. | game.tsx:914-923, 1122-1136 | Paliers 16 / 14 / 13 en SemiBold. Liste 1×4 si une réponse dépasse 60 caractères. Badge de 22 px en ligne. |
| 1.10 | Timer | Anneau qui avance par sauts, cyan, « SEC » en 8 px, `timerAnim` mort, timer de 22 px en `#00BFFF`. | RoundTimer.tsx:19-55 ; game.tsx:104, 411-414, 1055-1061 | Anneau continu (Reanimated), crème → corail (< 5 s) → rouge (< 3 s), haptique et tick sur 3-2-1, retirer « SEC ». |
| 1.11 | Bandeau des scores | Pseudos de 9 px, scores de 22 px, pas de pop adverse, aucun témoin « a répondu ». | game.tsx:839, 856, 1158-1168, 280-286 | Scores 28-30 px en chiffres tabulaires, pseudos 11 px, point corail « a répondu », calé sur `revealDelay` du bot. |
| 1.12 | Feedback juste / faux | Pas d'animation, marqueur adverse en violet de 8 px. | game.tsx:783-784, 934-936, 1126-1141 | Juste : vert, spring et icône check. Faux : bordure rouge et tremblement ±6 px. Avatar rival de 20 px sur sa réponse. |
| 1.13 | Toast de série | Dégradé violet, emoji, textes en dur, toast absent en ligne. | game.tsx:590-601, 955-963 | Toast corail plein, texte nuit, icône Lucide `Flame`, passage par `t()`, série suivie aussi en ligne. |
| 1.14 | Rematch / ChallengeReady | Modales tout en violet. Accepter en blanc sur menthe (environ 1,2:1). Les deux modales sont quasi identiques. | RematchModal.tsx:104-108, 141-147, 160-167, 201-214, 240-262 ; ChallengeReadyModal.tsx:137, 182, 204-211, 246, 274, 296-322 | Fusionner en `<DuelInviteDialog>` : corail pour l'événement, Accepter jaune, Refuser ghost. |
| 1.15 | Global / sémantique | 5 rouges, 4 verts, 6 ors et oranges. | game.tsx:1060 `#FF3B30` ; tournament.tsx:257 `#00FF9D` ; #FFB547 ×88, #FFD700 ×28, #FF6B2C ×25… | Un seul `success`, un seul `error`, un seul `reward` ; feu et urgence → corail. |
| 1.16 | Global / typo | 33 tailles, 16 valeurs de letterSpacing, 6 rendus d'eyebrow différents, chiffres non tabulaires (2 `fontVariant`). | matchmaking.tsx:872 ; themes.tsx:239 ; play.tsx:178 ; accueil.tsx:2210, 2256, 2432 ; results.tsx:1324 ; player-profile.tsx:743 | Échelle à 15 variantes (§4), 3 tracks, `tabular-nums` sur toutes les stats. |
| 1.17 | Boutons / headers | 168 styles de bouton, `DuelButton` utilisé seulement par EmptyState, 6 boutons retour, 4 structures de sous-en-tête, `paddingTop: 55` en dur. | EmptyState.tsx:7 ; support.tsx:216 ; leaderboard.tsx:310-316 ; shop.tsx:238 ; followers.tsx:51-53 ; terms.tsx:18, 53, 57 ; game.tsx:729 | `<Button>`, `<IconButton 44>`, `<ScreenHeader>`. |
| 1.18 | Modales | 7 voiles différents (0,7 à 0,9) et 5 fonds de carte différents. | player-profile.tsx:777 ; profile.tsx:226, 1378 ; results.tsx:1154-1157 ; SpinWheelModal.tsx:259-266 ; category-detail.tsx:982 | `<Dialog>` et `<BottomSheet>` : voile `#071F26` à 85 %, surface `#0B3D4A`, rayon 24. |
| 1.19 | Super-catégorie | « Voir tout » déplie une grille *en plus* du carrousel (doublons). Badges #1-#7 = nombre de questions. Méta en 8 px, cartes de 125 px. | super-category.tsx:19-22, 134-137, 192-234, 254-306, 384-430 | Écran `/theme-list?cluster=` dédié, retrait des « #n », cartes 140×168, méta 11 px. |
| 1.20 | Explorer | Tuiles avec cartouches qui débordent. Rangée « Bientôt » en emoji néon de 9 px. Forge violet→cyan. | themes.tsx:34-43, 156-173, 194, 210, 305-333, 366-376 | Tuiles icône / nom / compteur, « Bientôt » en une ligne de pied de page, Forge en ligne avec icône corail. |
| 1.21 | Recherche | Liste complète non virtualisée, animée ligne par ligne. Filtre de difficulté faux. Chips de catégorie sans libellé, avec des identifiants obsolètes. Onglets cyan→violet. | search.tsx:55-72, 154, 176-179, 286, 446, 483, 549-611, 706, 734, 801 | FlatList groupée par univers, état vide « Récents / Tendances / Tes thèmes », filtre par univers, contrôle segmenté jaune. |
| 1.22 | Page thème | Roadmap des paliers en `#444` à 9-10 px, XP en double, « Niv. » et « Dép. » en dur, mur communautaire envahissant. | category-detail.tsx:497-530, 555-576, 620-723, 875-924 | Section « Ta progression » (niveau 48 px en jaune, une seule barre), communauté limitée à 2 posts, textes via `t()`. |
| 1.23 | Icônes d'interface | 6 familles d'icônes, emoji servant d'icônes de bouton, Ionicons et FA5 marginaux. | category-detail.tsx:438, 446, 452, 468, 674, 681 ; game.tsx:960 ; accueil.tsx:1843 ; search.tsx:585, 628, 652 ; terms.tsx:18 ; language-settings.tsx:26 | `<Icon>` sur Lucide. Emoji uniquement dans le contenu utilisateur (chat, drapeaux, texte de partage). |
| 1.24 | Badges et rangs | Glyphes MCI génériques sur dégradés métal et cyan, `sword-cross` utilisé deux fois. | profile.tsx:37-42, 75-98 ; leaderboard.tsx:37-42, 253-260, 462 | Famille Badges : écusson commun en aplats, violet uniquement pour le palier ultime. |
| 1.25 | Série test d'icônes | Moyen-âge en 5 couleurs, Égypte V2 identique à V1, clin d'œil d'Histoire absent, jeux-vidéo à 52 éléments, dépassement de la zone 32-224. | v2/moyen-age.svg ; gen_icons_v2.py:60, 125-137, 200 | Lint : ≤ 4 couleurs, ≤ 14 éléments, bounding box mesurée après stroke, rotations ≤ ±15°. |
| 1.26 | Icônes à petite taille | Illustrations rendues à 14-18 px. | accueil.tsx:634 ; players.tsx:662, 688 ; super-category.tsx:202 ; create-theme.tsx:230 | En dessous de 24 px, pictogramme Lucide mono de l'univers. Illustrations à 28 px minimum. |
| 1.27 | États vides et loaders | 7 états vides refaits à la main, 8 couleurs d'`ActivityIndicator`, EmptyState en cyan avec emoji. | EmptyState.tsx:13, 25, 43 ; category-detail.tsx:928-931 ; chat.tsx:676-688 ; tournament.tsx:141-145 | EmptyState avec icône Lucide et accent jaune, composant `<Loader>` crème unique. |
| 1.28 | Profil joueur / Classement | Header en violet-noir `#1A0A2E`, tuiles cyan/violet/menthe, bouton Défier orange. | player-profile.tsx:243, 324-346, 525, 580 ; leaderboard.tsx:333, 359, 462 | Header pétrole, tuiles en surface uniforme, Défier jaune, podium en aplats. |

### P2 : polish

| # | Écran | Problème | Preuve (fichier:ligne) | Action |
|---|---|---|---|---|
| 2.1 | Global / cibles | Cibles tactiles de 21 à 40 px. | accueil.tsx:162/504, 346, 442, 1220-1221, 2749-2757 ; category-detail.tsx:804 ; results.tsx:1218 ; super-category.tsx:331 ; DueloHeader.tsx:130-133 | `<IconButton>` de 44 px ou `hitSlop`, `paddingVertical` ≥ 12. |
| 2.2 | Global / micro-typo | Textes de 8-9 px. | game.tsx:1158-1160 ; RoundTimer.tsx:55 ; super-category.tsx:390, 430 ; accueil.tsx:261, 269, 1132 ; play.tsx:235 ; tournament.tsx:251 ; shop.tsx:245 | Plancher 11 px (10 px pour les pastilles de compteur). `maxFontSizeMultiplier` 1,3. |
| 2.3 | VS | Aucune sortie pendant environ 5,2 s, VS sans ligue ni MMR, recherche à `bottom: 60` sans tenir compte des insets. | matchmaking.tsx:489-519, 719-762, 841 | Badge tier + MMR, `insets.bottom + 40`, `navDelay` d'environ 4 s ou passage au tap (visuel seulement). |
| 2.4 | Question | Progression affichée 3 fois, barre cachée sous l'encoche, animations mortes. | game.tsx:818-825, 863-880, 124, 1026, 1176-1183 | Ne garder que les 7 tirets sémantiques (vert / rouge / jaune / crème à 12 %). |
| 2.5 | Pages empilées | Header global de 4 icônes au-dessus de la rangée retour, y compris sur Résultat. | super-category.tsx:163-165 ; category-detail.tsx:394-396 ; results.tsx:469 | `<ScreenHeader>` seul sur les piles. Résultat en plein écran. |
| 2.6 | Onglets | Pan du pager en conflit avec les carrousels, Forge présente deux fois. | _layout.tsx:303-305 ; accueil.tsx:1190, 1941, 1965 ; players.tsx:716-750 | Désactiver le pan (D9). Forge uniquement dans Explorer. |
| 2.7 | Effets | Glows colorés (shadowColor `#8A2BE2` ×5, cyan ×7, opacité jusqu'à 0,9). | _layout.tsx:188, 203, 438-440 ; matchmaking.tsx:907-908, 927 ; GlassIconFrame.tsx:140, 222-224 | Tokens ELEVATION en ombre noire, `glowCta` et `glowHot` seulement. |
| 2.8 | Rayons et espacements | 40 rayons, 33 espacements, `RADIUS` et `SPACING` non utilisés. | tokens.ts:41-57 ; glassTheme.ts | Échelles du §4. Migration 14 → 12/16, 10 → 8/12. |
| 2.9 | Polices | Fraunces 400 chargé pour un seul usage. | app/_layout.tsx:57-66 ; fonts.ts:14 | Retirer le 400. Fraunces limité à vs / Égalité / Bravo / nouveau rang. |
| 2.10 | Chargement en jeu | Spinner et bouton Réessayer en `#8A2BE2`. | game.tsx:713-759, 985-990 | Loader crème, Réessayer jaune, cartes VS réutilisées pendant le chargement. |
| 2.11 | i18n | Textes en dur dans le gameplay et les pages. | game.tsx:963 ; results.tsx:513, 582, 612, 685 ; challenge-waiting.tsx:207 ; RematchModal.tsx:42 ; category-detail.tsx:516, 526, 569 ; accueil.tsx:2017-2033 ; i18n.ts:310 (accent manquant) | Passer par `t()` pendant la migration. |
| 2.12 | Son | Pas de son au VS ni au décompte, aucun réglage, `playsInSilentMode: true`. | utils/sounds.ts ; matchmaking.tsx:499-511 | `whoosh_vs` et `countdown`, réglage Son dans Réglages, respect du mode silencieux. |
| 2.13 | Fonds | `#0a0a0a`, `#060611`, dégradés `#1A0A2E` et `#12042A`. | support.tsx:205 ; create-theme.tsx:337 ; player-profile.tsx:243 ; index.tsx et onboarding.tsx | `<ScreenBackground>` partout. |
| 2.14 | Réglages | Icônes colorées arbitrairement, deux styles de ligne. | profile.tsx:890-893, 1306 ; notification-settings.tsx:434 | `<ListRow>` avec icônes crème. |
| 2.15 | Code mort | GlassIconFrame, 4 webp d'onglets et 3 webp de header inutilisés, `SwordMark` en dégradé. | GlassIconFrame.tsx ; assets/tabs/*.webp ; assets/header/{message,notification,search}.webp ; SwordMark.tsx:21-22 | Supprimer (en gardant l'anneau de progression). SwordMark en crème, pommeau jaune. |
| 2.16 | Onboarding | `CategoryIcon` appelé sans `color`. | onboarding.tsx:255 ; CategoryIcon.tsx:1029 | Disparaît avec `<ThemeIcon>`. |
| 2.17 | API (à signaler) | `super-categories` ignore `user_id`, pas d'endpoint « mes thèmes ». | backend/routers/themes.py:122-123 ; themes.tsx:58-60 | Ajouter `played_themes` / `best_level` et `/me/themes` (prérequis de « Tes thèmes »). |

---

## 4. Design system final proposé

### 4.1 Couleurs (theme/tokens.ts, par rôles)

| Token | Hex | Rôle | Contraste estimé |
|---|---|---|---|
| `bg.night` | `#071F26` | Fond de tous les écrans | référence |
| `bg.nightDeep` | `#081F27` | Voile des modales (85 %), fades de scroll | – |
| `surface.base` | `#0B3D4A` | Cartes, options de réponse, champs, tab bar | crème dessus : ~10,2:1 |
| `surface.raised` | `#12606D` | Pressé, élevé, bordures fortes. **Jamais pour du texte ni pour une silhouette d'icône sur nuit** (2,37:1) | – |
| `border.subtle` | `rgba(232,241,236,0.08)` | Bord de carte, liseré haut | – |
| `border.default` | `rgba(232,241,236,0.14)` | Options de réponse, inputs, boutons ghost | – |
| `border.focus` | `#FFDB3D` | Focus, sélection | – |
| `text.primary` | `#E8F1EC` | Texte principal | **~14,8:1 sur `#071F26`** (AAA), ~10,2:1 sur `#0B3D4A` |
| `text.secondary` | `rgba(232,241,236,0.72)` | Sous-titres | ~7,8:1 sur night |
| `text.tertiary` | `rgba(232,241,236,0.60)` | Méta, labels (minimum sur surface pétrole) | ~5,8:1 sur night, ~4,7:1 sur `#0B3D4A` |
| `text.faint` | `rgba(232,241,236,0.50)` | Seulement sur night et à 12 px ou plus (désactivé, placeholder) | ~4,6:1 sur night (**3,8:1 sur pétrole, interdit**) |
| `text.onAccent` | `#071F26` | Texte sur jaune, corail ou vert | ~12,5:1 sur jaune, ~6,1:1 sur corail |
| `accent.primary` | `#FFDB3D` | Seule couleur d'action : CTA, sélection, onglet actif, mon niveau, `player.me` | ~12,5:1 sur night |
| `accent.warm` | `#FF6B5B` | Événements, rival (`player.opp`), série, timer sous 5 s, Forge | ~6,1:1 sur night |
| `reward` | `#FFB547` | XP, pièces, médaille n°1. Jamais sur un bouton (à valider, Q2) | ~10:1 sur night |
| `state.success` | `#32E7A3` | Bonne réponse uniquement (+ icône check) | ~10,6:1 |
| `state.error` | `#F0445E` | Mauvaise réponse et erreurs système (+ icône ✕) | ~4,6:1 (texte ≥ 14 bold ou icône) |
| `accent.rare` | `#A78BFA` | 3 usages : palier ultime, FLAWLESS, Premium | ~6,3:1 |
| `player.me` / `player.opp` | alias jaune / corail | VS, scores, résultats, revanche | – |

Règles :
- Interdits : texte crème ou blanc sur jaune (~1,2:1), crème sur corail (~2,6:1), `#444` / `#525252` / `#555` / `#666` pour du texte, cyan et rose `#FF3E9D` partout.
- Couleurs d'univers : 9 teintes désaturées dans tokens.ts, en repère de 6 px seulement. `hashColor` est supprimé.
- Alias temporaires : `cyan → accent.primary`, `violet → accent.warm`, `abyss → bg.night`, tant que la migration n'est pas finie.

### 4.2 Typographie (composant `<Txt variant>`, crème par défaut, `maxFontSizeMultiplier` 1,3)

Abréviations : SG = Space Grotesk, JBM = JetBrains Mono.

| Variante | Police / taille / interligne | Tracking | Usage |
|---|---|---|---|
| `displayXL` | SG Bold 72/76, tabular | -4 | Décompte VS (exception documentée) |
| `display` | SG Bold 48/52, majuscules | -1,5 | VICTOIRE / DÉFAITE (aujourd'hui 60/66) |
| `moment` | Fraunces 500 Italic 40/44 | -0,5 | vs, Égalité, Bravo, nouveau rang (liste fermée) |
| `h1` | SG Bold 28/32 (majuscules sur les onglets) | -0,8 | Titres d'écran |
| `h2` | SG Bold 20/24 | -0,3 | Titres de section et de modale |
| `question` | SG Bold, paliers 24/30 · 22/28 · 19/25 · 17/23 | -0,3 → 0 | Question |
| `cardTitle` | SG SemiBold 16/20 | -0,2 | Nom de thème, pseudo, mode |
| `answer` | SG SemiBold 16/21 · 14/19 · 13/18 | 0 | Réponses |
| `body` | SG Regular 15/22 | 0 | Texte courant |
| `bodySm` | SG Regular 13/18, crème 72 % | 0 | Descriptions |
| `caption` | SG Medium 12/16, crème 60 % | 0 | Temps relatif, sous-titres |
| `label` / `eyebrow` | JBM Bold 11/14, MAJUSCULES | +1,5 | Eyebrows, labels de stat, compteur de question, tab bar |
| `button` / `buttonSm` | SG Bold 15/20 · 13/16, MAJUSCULES | +0,8 / +0,5 | Boutons |
| `stat` / `statSm` / `statXL` | SG Bold 28/32 · 20/24 · 40/44, `tabular-nums` | -1 / -0,5 / -1,5 | Scores, timer, XP, rang |
| `micro` | SG Bold 10/12 | 0 | Pastilles de compteur uniquement |

Graisses : 400 / 500 / 600 / 700 via la famille. `fontWeight` interdit (règle de lint). Fraunces 400 retiré.

### 4.3 Espacements, rayons, élévations

- **SPACING (grille de 4)** : 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56. Alias : `screenX` 16, `cardPad` 16, `stackGap` 8 et 12, `sectionGap` 32.
- **RADIUS** : xs 4 (barres, tirets) · sm 8 (chips) · md 12 (boutons, inputs, réponses) · lg 16 (cartes) · xl 24 (hero, modales, cartes VS) · pill 999. Avatars à `size / 2`.
- **ELEVATION** : `e1` (`#000`, opacité 0,25, rayon 8, y 2) · `e2` (0,35, rayon 16, y 6) · `e3` (0,5, rayon 24, y 12). Plus un liseré haut `rgba(232,241,236,0.08)`.

### 4.4 Dégradés et effets lumineux

- **Permis (environ 20 dans l'app, contre au moins 163)** :
  - un fond d'ambiance par écran, radial `#0B3D4A` → `#071F26` ;
  - halos du VS et du Résultat en jaune ou corail à 22 % maximum ;
  - fades de scroll en `#071F26`.
- **Interdits** : tout dégradé entre deux teintes (cyan→violet, menthe→cyan, orange→rouge), tout dégradé sur un bouton, une carte ou une tuile, tout dégradé construit sur une couleur de catégorie, les `textShadow` néon.
- **Glow coloré** limité à 2 tokens :
  - `glowCta` (`#FFDB3D`, opacité 0,35, rayon 16) pour le CTA actif et la sélection ;
  - `glowHot` (`#FF6B5B`, opacité 0,3, rayon 16) pour la série et le rival.
  
  Le glow vert n'est autorisé que sur la bonne réponse, le glow jaune que sur la victoire.

### 4.5 Composants de base

| Composant | Spécification |
|---|---|
| `Button primary` | Fond `#FFDB3D`, texte `#071F26` en `button`, hauteur 52 (lg 56, sm 40), rayon 12, `e2` |
| `Button secondary` | Fond `#12606D`, texte crème |
| `Button ghost` | Fond `rgba(232,241,236,0.06)`, bordure 14 %, texte crème (Annuler, Refuser, Retour) |
| `Button danger` | Ghost avec texte et icône en `state.error` (suppression de compte uniquement) |
| `IconButton` | 44×44, rayon 22, fond crème à 6 %, icône Lucide 24 en crème |
| `Card` | `#0B3D4A`, rayon 16, `border.subtle`, `e1`, padding 16, **jamais imbriquée dans une autre Card** |
| `Chip` | Hauteur 32, rayon 8 ou pill, `label` ; actif = fond jaune et texte nuit ; inactif = crème 60 % sur pétrole |
| `ListRow` | 56-64 px, icône 24 (ou ThemeIcon 40 sur plaque), `cardTitle` + `caption`, valeur à droite, chevron crème 50 % |
| `AppHeader` (ex-DueloHeader) | 46 px (constante `HEADER_ROW_H` conservée), logo SKILKI, 3 `IconButton` au plus, seul endroit des badges |
| `ScreenHeader` | `IconButton` retour + eyebrow JBM + `h1`, insets gérés en interne, utilisé sur toutes les pages empilées |
| `TabBar` | Fond `rgba(7,31,38,0.96)`, bordure crème 8 %, actif jaune (icône, label, point de 4 px), inactif crème 55 %, label 11 px, disque central jaune 56 px avec SVG `#071F26` |
| `Badge` | Pastille 18 px, fond corail, texte nuit `micro` ; badge de rang = écusson SVG |
| `Dialog` / `BottomSheet` | Voile `#071F26` à 85 %, surface `#0B3D4A`, rayon 24, actions `Button` |
| `EmptyState` / `Loader` | Icône Lucide 40 en crème, `h2`, CTA jaune ; loader crème |
| `ScreenBackground` | Nuit pétrole, remplace CosmicBackground et les `#050510` |
| `ProgressRing` | Récupéré de GlassIconFrame : jaune sur piste crème à 12 % |

### 4.6 Icônes : trois familles étanches

1. **UI linéaires** : Lucide via `<Icon name size tone>`, stroke 2, tailles 20 / 24 / 28. Crème au repos, jaune quand actif. Aussi pour les pictogrammes d'univers sous 24 px. Aucun emoji dans l'UI.
2. **Thèmes illustrés** : SVG 256, 2 à 4 couleurs fixes, **sur plaque crème** (squircle), de 28 à 80 px, jamais teintés par le code.
   - Lint : traits {12, 20}, ≤ 14 éléments, zone 32-224, rotations ≤ ±15°, contraste silhouette/plaque ≥ 3:1, hash de rendu unique par cluster.
   - Génération : `themeIcons.generated.ts` (chemins + index de palette) → `<ThemeIcon>`.
   - Repli : thème → cluster → univers. MCI crème sur plaque en transition seulement, jamais d'emoji.
   - Propriété intellectuelle : objets métaphoriques, aucun logo ni personnage.
3. **Badges et rangs** : écusson commun plein, socle pétrole, emblème jaune, corail pour les événements, violet pour le palier ultime. Podium en aplats (or `reward`, crème, corail).

---

## 5. Changements écran par écran

### Accueil (app/(tabs)/accueil.tsx)
- **Garder** : les composants mémoïsés (LeagueBanner, RivalBanner, MissionsWidget), la machine à sous si elle devient le Duel rapide commun, le fil social.
- **Changer** :
  - ordre en 6 blocs ;
  - hero Duel jaune appelant `startQuickMatch()` ;
  - « À toi de jouer » (défis + revanches, conditionnel, le seul carrousel de l'écran) ;
  - une carte « Aujourd'hui » à pastilles (série, missions, roue, question du jour) ;
  - « Compétition » regroupant ligue, rival et tournoi, avec liseré corail pour l'événement ;
  - titre de grade en crème (l.2178) ;
  - cibles d'au moins 44 px.
- **Retirer** : les 21 dégradés, le halo violet (l.1634-1638), le résumé hebdo et les offres x2 (déplacés vers Profil ou notifications, Q5), les fades `#080810`.

```
┌ SKILKI              🔍 💬 🔔 ┐
│ Salut Julie · Or II · 1 240 MMR
│ ████████░░ Niv. 23  640/900 XP│
│ ┌──────────────────────────┐ │
│ │ ⚔  DUEL RAPIDE            │ │ pétrole + SwordMark crème
│ │ [  TROUVER UN ADVERSAIRE ]│ │ ← seul CTA jaune
│ │ Rejoue : [Rome][F1][Star W]│ │
│ └──────────────────────────┘ │
│ À TOI DE JOUER · 3           │
│ [Léa ⚔ Rome  Accepter][Tom…]→│ corail = entrant
│ AUJOURD'HUI  🔥5 · 2/3 · 🎡 · ?│ carte repliable
│ COMPÉTITION                  │
│ Ligue Or II ▸ │ Rival Max ▸ │ Tournoi ▸
│ FIL                          │
└──────────────────────────────┘
```

### Explorer (app/(tabs)/themes.tsx)
- **Garder** : l'eyebrow et le titre de duel (compactés), la grille 2 colonnes, l'haptique, FadeInDown plafonné.
- **Changer** :
  - barre de recherche de 48 px (fond `#0B3D4A`, loupe jaune) ;
  - carrousel « Tes thèmes » (5 cartes, niveau en jaune, nécessite l'API 2.17) ;
  - vedette « À la une » en aplat pétrole avec ThemeIcon 128, CTA jaune, liseré corail si événement ;
  - tuiles icône / nom / compteur sans cartouches ;
  - Forge en ligne avec icône corail ;
  - « Bientôt » en une ligne de pied de page.
- **Retirer** : le dégradé violet→cyan et l'ombre violette, le badge « POPULAIRE » mensonger, le filigrane de 130 px, les emoji et néons des univers à venir.
- Wireframe : celui d'A5 (proposition 1), qui est retenu.

### Page thème (app/category-detail.tsx)
- **Garder** : badge de niveau, roadmap 1/10/20/35/50, « Top maître », abonnement optimiste, VO (en chip neutre).
- **Changer** :
  - hero à plat (ThemeIcon 96, nom `h1`) ;
  - bouton « Jouer ce thème » jaune de 56 px, collant ;
  - Suivre en `IconButton` dans le header ;
  - section Progression unique (niveau 48 px jaune, une seule barre, jalons crème 45 % ou jaunes) ;
  - classement top 3 ;
  - communauté limitée à 2 posts.
- **Retirer** : la carte d'en-tête imbriquée, `#B366FF` et ⚡, l'XP en double (l.527-529), `#444`, `hashColor`, le DueloHeader au-dessus de la rangée retour.
- Wireframe : celui d'A5 (proposition 4), avec le VO en chip crème et non violet.

### VS (app/matchmaking.tsx)
- **Garder** : les 3 phases, le glissement des cartes, « vs » en Fraunces 38, le décompte de 72 px, les filets de part et d'autre (en jaune), l'haptique Heavy.
- **Changer** :
  - moi = halo et bordure jaunes, rival = corail ;
  - badge de ligue et MMR sous chaque pseudo ;
  - « Adversaire localisé » en corail ;
  - carte du monde en une seule couche (remplissage `#0B3D4A`, trait `#12606D`), épingles crème 60 %, épingle du rival en corail pulsée ;
  - Annuler en ghost ;
  - timeout en CTA jaune ;
  - `bottom: insets.bottom + 40` ;
  - sons whoosh et décompte.
- **Retirer** : cyan, violet, `#8A2BE2→#00FFFF`, le `textShadow` néon, les 22 couleurs d'épingles, le SwipeBackPage en phase VS.

```
┌──────────────────────────────┐
│ ┌────────┐            halo J │
│ │ (Julie)│ jaune             │
│ │ Or II · 1 240              │
│ └────────┘                   │
│      ── vs ──  (Fraunces)    │
│            ┌────────┐ corail │
│            │ (Max)  │        │
│            │ Or I · 1 310    │
│            └────────┘        │
│              3   (72 px)     │
│        Thème : Rome antique  │
└──────────────────────────────┘
```

### Question (app/game.tsx + RoundTimer)
- **Garder** : la grille 2×2 en `flex:1`, la durée 10/13/15 s déterministe, les tirets de progression, la réponse toujours affichée en entier, le forfait AppState.
- **Changer** :
  - options neutres sur pétrole ;
  - sélection jaune immédiate avec haptique ;
  - révélation vert ou rouge avec icône, et `correct_option` affiché en ligne ;
  - question et réponses par paliers, liste 1×4 si réponse longue ;
  - scores 28-30 px tabulaires (moi crème avec liseré jaune, rival corail), point « a répondu » ;
  - timer fluide crème → corail → rouge ;
  - toast de série corail ;
  - bouton « Abandonner » de 44 px.
- **Retirer** : `OPTION_COLORS`, le fond cyan/violet (l.812-816), la barre de 4 px du haut, l'eyebrow « Q1 · 7 » (on garde un compteur `label`), `timerAnim` et `progressPendingOpacity`, le SwipeBackPage.

```
┌ [✕]   JULIE 4 ◄ ⏱ ► 3 MAX ●   ┐  ● corail = a répondu
│ ▬ ▬ ▬ ▬ ▭ ▭ ▭   Q4/7          │ tirets vert/rouge/jaune
│                              │
│ Quel empereur a fait         │ question 22/28 crème
│ construire le Colisée ?      │
│ ┌─────────────┐┌───────────┐ │
│ │A Néron      ││B Vespasien│ │ pétrole, bord crème 14 %
│ └─────────────┘└───────────┘ │
│ ┌─────────────┐┌───────────┐ │ sélection = bord jaune 3 px
│ │C Trajan     ││D Auguste  │ │
│ └─────────────┘└───────────┘ │
└──────────────────────────────┘
```

### Profil (app/(tabs)/profile.tsx)
- **Garder** : avatar, titre, historique, succès et titres, drapeaux (contenu).
- **Changer** :
  - hero avec ligue et MMR en écusson SKILKI, et engrenage vers Réglages ;
  - une rangée de 4 stats tabulaires (Duels, Victoires %, Série en corail, Meilleure) ;
  - Mes thèmes en `ListRow` avec ThemeIcon ;
  - textes en `Txt`.
- **Retirer** : les stats en double (l.684-704), le dégradé cyan→violet (l.649), les dégradés menthe→cyan (l.809/876), TIER_COLORS cyan et métal ; le parrainage, les réglages, la déconnexion et la suppression de compte partent dans un écran Réglages.

```
┌ ‹ (AppHeader)            ⚙  ┐
│   (avatar)  Julie            │
│   « Stratège » · [écusson] Or II · 1 240
│ ┌────┬────┬────┬────┐        │
│ │312 │58 %│🔥5 │ 14 │ stat   │
│ └────┴────┴────┴────┘        │
│ MES THÈMES          Voir tout›│
│ [◉] Rome    Niv. 12        › │
│ HISTORIQUE                   │
│ SUCCÈS & TITRES              │
└──────────────────────────────┘
```

### Autres écrans (une ligne chacun)
- **Jouer** : hero Duel rapide en pétrole avec CTA jaune (logique partagée). « Défier un ami » ouvre le BottomSheet de défi. Badges en 11 px.
- **Résultat** : barre fixe Revanche jaune / Retour ghost, puce MMR, halos victoire / défaite / égalité selon D16, pas de header global, libellés corrigés, pas de relance automatique.
- **Super-catégorie** : hero à plat, puces d'ancrage, carrousels de 6 cartes (140×168) ou lignes, « Voir tout » vers `/theme-list` (nouvelle route), « #n » retirés.
- **Recherche** : contrôle segmenté jaune, FlatList groupée, état vide Récents / Tendances / Tes thèmes, filtre par univers.
- **Classement** : podium en aplats, ligne « toi » surlignée en jaune, « Défier » via le flux défi.
- **Profil joueur** : header pétrole, tuiles uniformes, Défier jaune (le flux de référence).
- **Tab bar / Header** : §4.5, play.webp remplacé par un SVG, badges uniquement dans le header, logo SKILKI.
- **Rematch / ChallengeReady** : fusion en `DuelInviteDialog` corail.
- **Players** : Forge retirée, filtre catégorie avec libellés ou supprimé.
- **Tournament, Shop, Notifications, Conversations, Support, Terms, Language, Notification-settings** : `ScreenHeader` + `ScreenBackground` + `ListRow`, « ◆ DUELO » → clé i18n, « SKILKI Premium » en violet rare.
- **Chat, Followers, Create-theme, Challenge-waiting** : `ScreenHeader`, CTA jaune, textes via i18n, emoji conservés dans le contenu.
- **Index (login), Onboarding** : fond pétrole, logo SKILKI, scheme OAuth inchangé tant que Q6 n'est pas tranchée.
- **SpinWheelModal** : `Dialog` standard, segments en palette pétrole / jaune / corail / crème.
- **Admin** : hors périmètre.

---

## 6. Roadmap

**Lot 0, correctifs de confiance (en parallèle de l'étape 2, sans dépendance à la DA)**
- Couvre : P0 0.3, 0.4, 0.5, 0.6 et 0.9 (avec le backend), ainsi que P1 1.2 et 1.6.
- Fichiers :
  - `utils/quickMatch.ts` (nouveau) ;
  - accueil.tsx:320, 1192, 1741, 2058 ;
  - leaderboard.tsx:459 ;
  - players.tsx:527 ;
  - play.tsx:36-55, 99 ;
  - results.tsx:170-204, 754, 766 ;
  - _layout.tsx:37-44 ;
  - SwipeBackPage.tsx (prop `enabled`) ;
  - game.tsx (bouton Abandonner) ;
  - i18n.ts:305, 310 ;
  - backend `answer_result`.

**Étape 2, design system en code**
- Couvre : P0 0.1, 0.12, 0.13, 0.15 et 0.18 (inventaire seulement) ; P1 1.15-1.18, 1.23, 1.25, 1.27 ; P2 2.7, 2.8, 2.9.
- **Modifier :**
  - `theme/tokens.ts` : rôles du §4.1, alias temporaires, TYPE, SPACING, RADIUS, ELEVATION, ICON_SIZE ;
  - `theme/fonts.ts` ;
  - `app/_layout.tsx` : retrait de Fraunces 400 ;
  - `components/DuelButton.tsx` → `ui/Button.tsx` ;
  - `components/DueloHeader.tsx` → `AppHeader.tsx` (46 px conservés) ;
  - `CosmicBackground.tsx` → `ScreenBackground.tsx` ;
  - `EmptyState.tsx` ;
  - `RoundTimer.tsx`.
- **Créer :**
  - `components/ui/` : `Txt`, `IconButton`, `Card`, `Chip`, `ListRow`, `ScreenHeader`, `Badge`, `Dialog`, `BottomSheet`, `Loader`, `Icon` (Lucide), `ProgressRing` ;
  - `components/ThemeIcon.tsx` et `theme/themeIcons.generated.ts` ;
  - un écusson de rang.
- **Côté icônes (`Themes/icones-test/`)** : ajouter à `gen_icons_v2.py` le lint (traits, couleurs, éléments, bounding box, contraste), un export TS, un aperçu sur `#071F26` et `#0B3D4A` et une planche à 32 px ; corriger moyen-âge, histoire, Égypte et jeux-vidéo ; produire les 12 univers et les 27 clusters.
- **Règle eslint** `no-restricted-syntax` : `fontSize`, `fontWeight`, `fontFamily` et hex littéraux interdits hors de `theme/`.
- **Supprimer à la fin de l'étape 7** : `theme/glassTheme.ts`, `GlassIconFrame.tsx`, les webp morts.

**Étape 3, pilote (dans cet ordre)**
1. **Question + VS ensemble**, parce que le couple joueur/rival doit être cohérent :
   - P0 0.7, 0.8, 0.10 ;
   - P1 1.8-1.13 ;
   - P2 2.3, 2.4, 2.10, 2.12.
2. **Page thème** : P0 0.16, 0.14 (repli cluster/univers) ; P1 1.22 ; P2 2.5.
3. **Explorer** (+ route `/theme-list`) : P0 0.2 (vedette), 0.17 ; P1 1.19, 1.20, 1.26 ; nécessite l'API 2.17 pour « Tes thèmes ».
4. **Accueil** : P0 0.2, 0.11 ; P1 1.1 ; P2 2.1, 2.2, 2.6.
5. **Profil** (+ écran Réglages) : P1 1.5, 1.24 ; P2 2.14.
6. **Tab bar**, livrée avec l'Accueil : P1 1.7.

**Étape 4, vérification web**
- Lancer `expo start --web`, viewport 390×844 dans Chrome DevTools.
- Captures avant/après des 6 écrans pilotes.
- Contrôles : contraste (Lighthouse et calcul manuel des paires du §4.1), absence de scroll horizontal, cibles de 44 px.

**Étape 5, captures mobile**
- iPhone 390 pt et Android 360 dp, plus la police système à 130 %.
- À vérifier :
  - le rendu de `fontWeight` sur police custom sous Android ;
  - les débordements dus aux planchers de 11 px ;
  - les paliers de question et de réponse avec des questions de plus de 300 caractères ;
  - la fluidité du timer et de la carte VS sur un Android d'entrée de gamme.

**Étape 6, revue et ajustements**
- Grille de thèmes : plaque crème contre plaque pétrole (Q4).
- Revue daltonisme (vert / rouge / corail + icônes).
- Revue propriétaire, puis gel des tokens.

**Étape 7, généralisation**
- Résultat (P1 1.3, 1.4), Recherche (1.21), Super-catégorie, Classement et Profil joueur (1.28), modales (1.14, 1.18), Jouer, Players, Shop, Tournament, écrans de réglages et de support (1.17, 2.13), Onboarding et Index.
- Renommage SKILKI selon la liste 0.18, i18n (2.11), nettoyage du code mort (2.15, 2.16).
- Ensuite seulement : suppression des alias `cyan` / `violet` et de `glassTheme`, puis vagues d'icônes (top 100 des thèmes, puis la longue traîne par cluster).

---

## 7. Questions à trancher par la propriétaire avant implémentation

1. **Couple du duel** : validez-vous « moi = jaune `#FFDB3D`, rival = corail `#FF6B5B` » sur le VS, les scores et le Résultat, sans violet pour l'adversaire ?
2. **Or des récompenses** : gardez-vous un or distinct `#FFB547` réservé à l'XP et aux pièces (jamais sur un bouton), ou le fondez-vous dans le jaune pour une palette plus courte ?
3. **« Défier X »** : faut-il brancher tous ces boutons sur le défi nominatif asynchrone (`challenges/send`, ce qui demande de vérifier que le backend accepte ces points d'entrée), ou les renommer « Jouer ce thème » pour l'instant ?
4. **Plaque des icônes de thèmes** : plaque crème (recommandée, sans redessiner les V2) ou plaque pétrole avec silhouettes inversées ? Ce choix conditionne la production des 917 icônes.
5. **Accueil** : parmi la roue, les offres ×2 pub, le résumé hebdo et la question du jour, lesquels peuvent quitter l'Accueil (vers une carte « Aujourd'hui » repliée, le Profil ou les notifications) sans gêner vos objectifs de rétention et de monétisation ?
6. **Renommage technique** : le logo et le splash SKILKI sont-ils prêts, et faut-il changer dès maintenant le scheme `duelo`, le slug et les redirections OAuth, ou seulement les textes visibles ?
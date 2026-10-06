# Revue Better Design du pilote V1.1

Revue de validation, sans aucune modification de code. Périmètre : les 6 écrans pilotes de la V1.1 (Accueil, Explorer, Page thème, VS, Question, Profil), branche `refonte-skilki`, commit 3f737fb.

## Outils Better Design utilisés

| Outil | Usage |
|---|---|
| `get-review-rules` (toutes catégories) | Grille : accessibilité WCAG, design visuel, animation, contenu, compréhension |
| `get-ui-principle` | Hiérarchie (« un seul élément mène »), cibles tactiles de 44 px, écarts entre cibles, densité |
| `get-ux-principle` | Vocabulaire cohérent, microcopie, retours d'erreur |
| `check-comprehension` | Les 6 écrans : mom test, test des 15 secondes, test de la capture |
| `inspect-spacing` | Les 6 écrans en **390×844 et 320×568** (12 états, tous `completed`), mesurés sur le rendu réel (géométrie DOM) |

Contrastes : calculés selon la formule WCAG sur les couleurs réelles des jetons.

**Limites des outils, à garder en tête :**
- `check-comprehension` compte comme « actions » la tab bar, l'en-tête et les 4 réponses d'une question, qui sont structurelles. Ses alertes « trop d'actions » et « trop de mots » sont donc surestimées : il lit le texte de toute la page défilée, pas seulement le premier écran.
- `inspect-spacing` ne voit pas la hiérarchie ni l'intention (décor ou contenu). Chaque relevé a été qualifié à la main.
- Les largeurs bureau (1440 et 1728) ne s'appliquent pas : l'app est mobile.

## Contrastes (WCAG AA : 4,5:1 pour un petit texte, 3:1 pour un grand texte ou une icône)

| Paire | Ratio | Verdict |
|---|---|---|
| Crème sur nuit (texte principal) | 14,8:1 | Conforme (AAA) |
| Crème 72 % sur carte pétrole | 6,1:1 | Conforme |
| Crème 60 % sur carte pétrole (méta) | 4,75:1 | Conforme |
| Nuit sur jaune (CTA) | 12,5:1 | Conforme |
| Or sur pétrole | 5,9:1 | Conforme |
| Vert sur pétrole · nuit sur vert | 7,4:1 · 10,6:1 | Conforme |
| **Corail sur pétrole** (petit texte : pseudo du rival, « Adversaire localisé ») | **4,2:1** | **Juste sous le seuil pour un petit texte** |
| **Rouge erreur sur pétrole** | **3,2:1** | Suffit pour une bordure ou une icône ✕, **pas pour un petit texte** |
| **Crème 40 % sur pétrole** (réponses grisées après révélation) | **2,95:1** | Sous le seuil (texte encore utile à lire) |

## Écarts par écran

Gravité :
- **P0** : bloquant (compréhension, interaction) ;
- **P1** : important ;
- **P2** : finition (polish).

### Accueil

**Conforme :**
- un seul élément mène (le CTA jaune), toutes les cibles font 44 px ;
- aucun mot de jargon ;
- test de la capture réussi : on comprend à quoi sert l'écran ;
- contraste du CTA à 12,5:1.

| # | Écart | Source | Gravité | Corriger ? | Correction minimale |
|---|---|---|---|---|---|
| A1 | Puce « Rejoue : Clash Royale » : cible de 123×32 px | inspect-spacing (touch-target), mesuré | P2 | Oui | `hitSlop` vertical de 6 px (pas de changement visuel) |
| A2 | Carte progression + série : écarts irréguliers 8 / 4 / 16 px | inspect-spacing (sibling-gap-drift), mesuré | P2 | Oui | Un seul `gap` sur la carte (12) au lieu de marges mélangées |
| A3 | Texte « 1 jour(s) de série » : pluriel bricolé | Revue du contenu | P2 | Oui | « 1 jour de série » / « 5 jours de série » |
| A4 | 4 boutons de l'en-tête espacés de 4 px (règle : 12 px entre contrôles pleins) | get-ui-principle (clearances), mesuré | P2 | Oui, faible coût | Écart de 8 px |
| A5 | 116 mots et 14 « actions » sur toute la page | check-comprehension | — | **Non** | Faux positif : comptage sur toute la page défilée, navigation comprise. Au premier écran, une seule action domine. |
| A6 | Padding bas de 120 px hors échelle | inspect-spacing (off-scale) | — | **Non** | Réserve volontaire sous la tab bar flottante |

### Explorer

**Conforme :**
- recherche pleine largeur ;
- 6 univers visibles au premier écran ;
- toutes les cibles font au moins 44 px ;
- pas de carte dans une carte.

| # | Écart | Source | Gravité | Corriger ? | Correction minimale |
|---|---|---|---|---|---|
| E1 | **Noms d'univers en codes anglais majuscules** (SCREEN, ARENA, LAB, MIND, LIFE, SOUND, GLOBE, ART, LEGENDS) lus comme des sigles, sans indication de contenu dans les tuiles | check-comprehension (mom test) | **P1** | **Oui** | Garder les noms (identité), ajouter sous chaque nom une ligne de 2 sous-catégories (« Cinéma · Séries »), comme déjà sur « À la une ». Aucun changement de mise en page. |
| E2 | Vignette de 56 px de « À la une » avec un rayon de 14 dans une carte de rayon 16 (non concentrique) | inspect-spacing, mesuré | P2 | Optionnel | La plaque d'icône a son propre rayon par design. Rien à faire, sauf à aligner sur 12 au passage. |
| E3 | Titre « Choisis ton champ de bataille » : cliché « gaming » | Revue du contenu (texte qui sonne généré) | P2 | À votre goût | Par exemple « Explorer les thèmes » ou « Tous les thèmes ». Le surtitre « Univers » suffit déjà. |

### Page thème

**Conforme :**
- action principale évidente (« Jouer ce thème » jaune et collant) ;
- paliers lisibles ;
- favori en corail ;
- nom du thème non répété dans l'en-tête.

| # | Écart | Source | Gravité | Corriger ? | Correction minimale |
|---|---|---|---|---|---|
| T1 | **Débordement horizontal** : l'arc décoratif (624 px, de −117 à 507) et le filigrane (jusqu'à x = 516) dépassent l'écran. `scrollWidth` vaut 780 en 390 et 640 en 320 : la page peut glisser de côté ou se dézoomer sur le web. | inspect-spacing (viewport-overflow), mesuré | **P1** | **Oui** | `overflow: 'hidden'` sur le conteneur du hero |
| T2 | « 0 FOLLOWERS » : mot anglais dans une interface française | check-comprehension (mom test) | **P1** | **Oui** | « Abonnés » (clé `category.followers`) |
| T3 | Surtitre « MUR DE LA COMMUNAUTÉ » + titre « Communauté » : répétition | Revue du contenu | P2 | Oui | Garder le titre seul |
| T4 | Carte progression : écarts 12 / 20, paliers serrés à 0 px | inspect-spacing, mesuré | P2 | Optionnel | 4 px entre les paliers. Les rangées font déjà 36 px, donc la lecture n'est pas gênée. |
| T5 | 100 mots, 6 actions | check-comprehension | — | **Non** | Page de contenu défilante. L'action principale est unique et collante. |

### VS

**Conforme :**
- compréhension réussie sans aucune alerte (35 mots, 1 action) ;
- moi en jaune, rival en corail ;
- tient sans défilement en 320.

| # | Écart | Source | Gravité | Corriger ? | Correction minimale |
|---|---|---|---|---|---|
| V1 | **Cercle fantôme** : l'épingle du rival sur la carte (73×73, avec la lettre) reste visible sous la ligne « vs » | inspect-spacing (relevé sur le décor), confirmé sur les deux captures | **P1** (lisibilité au moment clé) | **Oui** | Masquer les épingles pendant la phase VS (opacité 0) |
| V2 | « Adversaire localisé » en corail, petit texte, à 4,2:1 sur pétrole | Contraste calculé | P2 | Oui | Le passer en surtitre crème avec un point corail, ou prendre un corail plus clair pour le texte |
| V3 | Avatar rond dans une carte arrondie (« non concentrique ») | inspect-spacing | — | **Non** | Faux positif : un cercle n'a pas à suivre le rayon de sa carte |
| V4 | Écarts verticaux 16 / 24 / 0 entre titre, cartes, vs et décompte | inspect-spacing | — | **Non** | Composition scénique voulue : le décompte est isolé exprès |

### Question

**Conforme :**
- mom test et test de la capture réussis ;
- 4 réponses en grandes zones (≥ 56 px) ;
- bascule 1×4 pour les réponses longues ;
- vert ✓ ou rouge ✕ toujours doublés d'une icône (pas d'information par la couleur seule).

| # | Écart | Source | Gravité | Corriger ? | Correction minimale |
|---|---|---|---|---|---|
| Q1 | **Vide de 130 px entre la question et les réponses en 390** (41 px en 320), malgré la V1.1 | inspect-spacing (sibling-gap-drift), mesuré | **P1** (équilibre vertical, demandé en V1.1) | **Oui** | Centrer la question dans l'espace libre entre la rangée des scores et les réponses, au lieu de la caler en haut avec tout le vide dessous. Le vide se répartit au-dessus et en dessous. |
| Q2 | Réponses grisées après révélation à 2,95:1 | Contraste calculé | P2 | Oui | Crème 50 % au lieu de 40 % (environ 3,6:1) : elles restent secondaires mais lisibles |
| Q3 | Pseudo du rival en corail 11 px à 4,2:1 | Contraste calculé | P2 | Oui | Pseudo en crème 72 % ; le liseré corail suffit à identifier le camp |
| Q4 | « 5 actions » | check-comprehension | — | **Non** | Faux positif : les 4 réponses sont le jeu lui-même |

### Profil

**Conforme :**
- hiérarchie rang → niveau → victoires ;
- or réservé au prestige ;
- taux de victoire lisible d'un coup d'œil ;
- toutes les cibles font 44 px.

| # | Écart | Source | Gravité | Corriger ? | Correction minimale |
|---|---|---|---|---|---|
| P1 | **« MMR » non expliqué** (jargon de joueur expert) | check-comprehension (mom test) | **P1** | **Oui** | « 1 000 pts de classement », ou garder « MMR » mais avec un libellé explicite à côté |
| P2 | Carte niveau : écarts 12 / 25 / 12 | inspect-spacing, mesuré | P2 | Oui | Ramener le 25 à 12 |
| P3 | En-tête : écarts 12 / 2 / 0 entre avatar, pseudo, titre et lieu | inspect-spacing, mesuré | P2 | Optionnel | `gap` uniforme de 4 entre pseudo, titre et lieu |
| P4 | 70 mots, 5 actions | check-comprehension | — | **Non** | Page de consultation, aucune action concurrente |

### Transversal

| # | Écart | Gravité | Corriger ? | Correction |
|---|---|---|---|---|
| X1 | Tab bar en 320 : onglets à 1–2 px les uns des autres (16 px en 390) | P2 | Optionnel | Les cibles font bien 56 px ; réduire leur largeur à 52 px en dessous de 360 |
| X2 | Rouge erreur à 3,2:1 sur pétrole pour du texte (bouton « Supprimer le compte » dans Réglages) | P2 | Oui | Le texte du bouton danger en rouge plus clair, ou le poser sur fond nuit (environ 3,9:1) avec l'icône |

## Synthèse

- **P0 : aucun.** Aucun écart ne bloque la compréhension ni l'interaction.
- **P1 : 6.**
  - T1 : débordement horizontal de la page thème ;
  - Q1 : vide entre la question et les réponses ;
  - V1 : cercle fantôme au VS ;
  - E1 : noms d'univers peu explicites ;
  - T2 : « FOLLOWERS » ;
  - P1 : « MMR ».
- **P2 recommandés (petits, sans risque) :**
  - A1 : cible « Rejoue » ;
  - A2 : écarts de la carte progression ;
  - A3 : « jour(s) » ;
  - A4 : espacement des boutons de l'en-tête ;
  - T3 : répétition « Communauté » ;
  - V2 : contraste d'« Adversaire localisé » ;
  - Q2 : réponses grisées ;
  - Q3 : pseudo du rival ;
  - P2 : écarts de la carte niveau ;
  - X2 : rouge du bouton danger.
- **Non retenus** (faux positifs ou choix de design voulus) :
  - A5 : « trop d'actions » sur l'Accueil ;
  - A6 : padding sous la tab bar ;
  - T5 : densité de la page thème ;
  - V3 : avatar « non concentrique » ;
  - V4 : écarts du VS ;
  - Q4 : « trop d'actions » sur la Question ;
  - P4 : densité du Profil.
- **À votre goût** : E3, le titre « Choisis ton champ de bataille ».

## Verdict

**Mini V1.2 recommandée, strictement limitée aux 6 P1 et aux 10 P2 recommandés ci-dessus**, avant la généralisation.

Ce sont uniquement des corrections locales :
- 1 propriété de débordement ;
- 1 répartition verticale ;
- 1 masquage de décor ;
- 1 ligne de sous-titre dans les tuiles ;
- quelques libellés ;
- quelques écarts et opacités.

Il n'y a aucun nouveau composant, aucune couleur nouvelle, et la direction artistique ne change pas. Les P1 T1, Q1 et V1 sont précisément ceux qui se verraient en généralisant (débordement, équilibre vertical, propreté du moment VS).

Après la V1.2 : relancer `inspect-spacing` et `check-comprehension` sur les écrans touchés, refaire les captures 390 et 320, puis feu vert pour la généralisation.

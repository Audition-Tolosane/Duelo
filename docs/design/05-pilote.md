# Pilote SKILKI — 6 écrans

Branche `refonte-skilki`. Comparaison visuelle : `docs/design/pilote.html` (captures en 390×844 dans `captures/avant` et `captures/apres`).

## Méthode

- **Trois phases ordonnées**, deux agents par phase sur des fichiers disjoints :
  1. Question + VS ;
  2. Page thème + Explorer ;
  3. Accueil + tab bar, Profil.
- Les agents n'avaient le droit de toucher ni au kit, ni aux jetons, ni aux traductions, ni à la logique métier. J'ai intégré moi-même les 95 clés de traduction (10 langues).
- Avant et après captures : même compte invité, même viewport, mêmes thèmes (Clash Royale).

## Résultat chiffré (garde-fou `npm run design:check`)

| Dette | Référence avant pilote | Après pilote |
|---|---|---|
| Couleurs hex en dur | 1 488 | 940 |
| rgba en dur | 673 | 435 |
| fontSize en dur | 689 | 385 |
| Graisses 800/900 | 215 | 122 |
| LinearGradient | 152 | 103 |
| Imports d'autres icônes | 32 | 25 |
| Emoji | 113 | 74 |

Les 6 écrans pilotes sont à **0** sur toutes les mesures. Seuls restent les dégradés autorisés : fondus, halo VS, carte hero. La nouvelle référence est enregistrée.

- **TypeScript** : 28 erreurs, contre 34 avant le pilote, aucune nouvelle.
- **Tests** : 684 sur 685.
  - Réparés : l'en-tête (test réécrit pour SKILKI), `utils` (simulation d'AsyncStorage ajoutée pour tous les tests) et Lucide sous Jest.
  - Reste l'ancien test `CategoryIcon`, sur le composant que `ThemeIcon` remplacera.

## Ce qui a changé, écran par écran

- **Question**
  - Fond uni nuit pétrole. Scores : moi avec liseré jaune, rival avec liseré corail. Chrono crème → corail (< 5 s) → rouge pulsé (< 3 s), sans « SEC ».
  - 7 tirets sémantiques + « Q4/7 ». Question sans carte, taille par paliers. Réponses en `AnswerButton`.
  - Toast de série corail avec icône flamme. Chargement et erreur via le kit.
- **VS**
  - Carte du monde sur une couche pétrole. Épingle du rival corail pulsée. « Adversaire localisé » en corail.
  - Cartes joueur jaune (moi) et corail (rival). « vs » en Fraunces, décompte de 72 px conservé.
  - Annuler en bouton ghost. Plus de cyan, de violet ni de néon.
- **Page thème**
  - Hero à plat avec `ThemeIcon`, « Jouer ce thème » jaune collant, Suivre dans l'en-tête.
  - Progression unique : niveau en grand jaune, une barre, **paliers en liste verticale** (corrigé après capture : les titres étaient coupés en plein mot).
  - Classement en lignes, « Maître » en or, communauté limitée à 2 posts.
- **Explorer**
  - Recherche pleine largeur, « Tes thèmes » en haut, univers à la une en aplat, grille des univers sans cartouches, Forge discrète, « Bientôt » en pied de page.
  - Super-catégorie : puces d'ancrage, carrousels de 6 au plus, **nouvel écran `/theme-list`** pour « Voir tout » (plus de grille dépliée en doublon).
- **Accueil + tab bar**
  - Ordre : salut, duel rapide (un seul CTA jaune, « Rejoue » avec puces), défis reçus (si présents), progression + série, missions, un carrousel recommandé.
  - Regroupés dans la feuille « Bonus & événements » : roue, offres ×2, question du jour, résumé, ligue, rival, tournoi.
  - Tab bar : icônes Lucide, actif jaune, disque Jouer jaune. Logotype SKILKI dans l'en-tête (renommage visuel).
- **Profil**
  - Hero (avatar, titre en or), niveau et XP, rang en or + MMR, une carte de 4 stats, succès, thèmes favoris, historique.
  - **Nouvel écran `/settings`** : parrainage, langue, notifications, son, support, conditions, déconnexion, suppression de compte. Mêmes appels, rien n'est supprimé.

## Corrections faites après comparaison visuelle

1. **Boutons imbriqués sur le web** : la carte « À la une » d'Explorer était cliquable et contenait un bouton. L'erreur de développement s'affichait sur tous les onglets.
2. **Halos VS trop présents** : ils salissaient le fond en olive et brun. Opacité 22 % → 12 %, hauteur 45 % → 30 %.
3. **Paliers de la page thème** : titres coupés en plein mot, passés en liste verticale.
4. `/theme-list` et `/settings` : ajoutés aux pages empilées, avec glissement et swipe-retour comme les autres.

## Points à valider par la propriétaire

1. **Accueil** : le regroupement « Bonus & événements » (roue, offres, question du jour, ligue, rival, tournoi) vous convient-il, ou un de ces blocs doit-il revenir sur l'accueil ?
2. **Swipe entre onglets désactivé** (arbitrage D9, conflit avec les carrousels) : on navigue uniquement par la tab bar.
3. **Profil** : « Victoires » affiche le pourcentage, plus le nombre brut. « Changer d'avatar » se fait en touchant l'avatar.
4. **Page thème** : le nom du thème apparaît dans l'en-tête et en grand dans le hero. On peut retirer celui de l'en-tête. Le « J'aime » d'un post passe en corail (et non plus en rouge, réservé aux erreurs).
5. Les autres écrans (Social, Jouer, Résultat, Recherche, Boutique…) reçoivent déjà le fond nuit pétrole et le nouvel en-tête, mais pas encore leur refonte : un mélange est visible tant que la généralisation n'est pas faite.

## Risques à vérifier sur appareil (non vérifiables sur le web)

- **Performances Android** d'entrée de gamme : chrono pulsé, épingle pulsée, ombres et halos (`GLOW`).
- **Petits écrans (320–360 px) et grossissement système à 130 %** :
  - VS sans défilement ;
  - pseudos longs dans les boîtes de score ;
  - réponses de plus de 90 caractères dans la grille 2×2 (la liste 1×4 n'est pas encore faite) ;
  - en-tête (logotype + 4 boutons de 44 px).
- **Duel en direct à deux humains** (après redéploiement du backend du Lot 0) : tirets juste/faux, révélation avec `correct_option`.
- **Le son** se règle maintenant dans Réglages, mais n'est pas mémorisé au redémarrage (comportement inchangé, à corriger plus tard).
- **Partage du parrainage** : le texte contient encore « Duelo ». Il est dans la liste du renommage visuel à finir.
- **Explorer** utilise l'API profil pour « Tes thèmes » avec `posts_limit=0`. Vérifier que le backend accepte ce paramètre.

## Pas encore fait (généralisation, après validation)

- **Refonte des autres écrans** : Résultat, Jouer, Social, Recherche, Classement, Profil joueur, Boutique, modales.
- **Fin du renommage visuel** : splash, icône d'app, textes « Duelo » restants.
- **Production des icônes de thèmes** au-delà des 12.
- **Système de badges et rangs**.
- **Suppression des anciens jetons** (`COLORS`, `glassTheme`, `CosmicBackground`).

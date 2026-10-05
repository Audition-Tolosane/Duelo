# Lot 0 — Correctifs de confiance

Branche `refonte-skilki`, 06/10/2026. Objectif : aucun bouton ne ment, on ne quitte plus un match par accident, la sémantique des couleurs en jeu est juste.

## Ce qui a été corrigé

| # audit | Problème | Correction | Fichiers |
|---|---|---|---|
| 0.3 | « Défier X » lançait un matchmaking aléatoire, ou renvoyait vers Jouer | Tous les « Défier X » ouvrent la fiche du joueur **avec la fenêtre de défi déjà ouverte** (`/player-profile?id=…&challenge=1&themeId=…`). Le défi part via le vrai flux `POST /api/challenges/send` → `challenge-waiting`. Le thème du contexte est présélectionné. | accueil.tsx (rival, suggestions), leaderboard.tsx, players.tsx, player-profile.tsx |
| 0.3 | Option « Thème libre » : une salle sans thème ne trouve aucune question (`load_and_start_game`) et le duel échouait | Option retirée. Un thème est obligatoire, présélectionné (contexte, sinon meilleur thème de l'adversaire). Bouton désactivé tant qu'aucun thème n'est choisi. Les erreurs d'envoi (404, 429) sont affichées au lieu d'être silencieuses. Le 409 affiche « Défi déjà envoyé ». | player-profile.tsx |
| — (trouvé en route) | **Défi accepté en direct : la partie ne démarrait jamais.** `join_challenge_room` créait la salle, mais personne ne chargeait les questions | `handle_challenge_join` appelle `load_and_start_game` dès que les deux joueurs sont entrés | backend/routers/ws.py |
| — (trouvé en route) | **Duel en direct : `game_start` perdu.** Le serveur l'envoie pendant l'animation VS (~5 s), avant que l'écran de jeu n'écoute, d'où un écran de chargement infini | Le client garde le dernier `game_start` (`dueloWS.takeGameStart(roomId)`) et l'écran de jeu le récupère au montage. Pas d'effet sur l'équité : le chrono est côté client. | services/websocket.ts, game.tsx |
| — (trouvé en route) | **Revanche acceptée contre un joueur réel : celui qui proposait jouait contre un bot, celui qui acceptait partait dans la file aléatoire** | `accept_rematch` crée une salle privée (même mécanisme que les défis) et envoie `room_id` aux deux joueurs. Le proposant navigue depuis Résultat, celui qui accepte depuis RematchModal. | backend/services/ws_manager.py, results.tsx, RematchModal.tsx, matchmaking.tsx |
| — | Revanche contre un bot : un **autre** bot tiré au hasard | Le bot de revanche garde le pseudo de l'adversaire du match (`botPseudo`) | results.tsx, matchmaking.tsx |
| 0.4 | Quick Match d'un nouveau joueur : rebond vers Jouer. Deux implémentations différentes. | `utils/quickMatch.ts` (tirage dans les tendances, sinon Explorer), utilisé par Jouer, le hero de l'Accueil (cas sans thème) et l'état vide | quickMatch.ts, play.tsx, accueil.tsx |
| 1.2 | Promesse « ~8s » (le bot arrive à 30 s) | Retirée (Accueil, Jouer, traduction `play.quick_sub` ×10) | accueil.tsx, play.tsx, i18n.ts |
| 0.5 | Swipe-retour plein écran en match et pendant le VS : abandon sans forfait, file non quittée | `SwipeBackPage` accepte `enabled` et `onBack`. Désactivé en jeu et une fois l'adversaire trouvé. Pendant la recherche, le swipe appelle `handleCancel` (envoie `matchmaking_leave`). Retour Android : confirmation d'abandon en jeu, annulation propre en recherche. | SwipeBackPage.tsx, game.tsx, matchmaking.tsx |
| 0.5 | Pas de moyen explicite d'abandonner | Bouton ✕ en haut à gauche en jeu, avec confirmation « Abandonner le duel ? La partie sera comptée comme perdue. » (même forfait que la mise en arrière-plan) | game.tsx, i18n.ts |
| 0.6 | « Retour à l'accueil » menait à Jouer | Mène à `/(tabs)/accueil`. Accent corrigé. | results.tsx, i18n.ts |
| 0.6 | « DÉFIER UN AMI » ouvrait un partage système | Renommé « PARTAGER MON SCORE » (10 langues) | results.tsx, i18n.ts |
| 0.6 | Refus, expiration ou délai de revanche : relance automatique d'un matchmaking aléatoire 2 s plus tard | Plus de relance. Le bouton affiche « REFUSÉE · NOUVEAU DUEL » et c'est le joueur qui décide. | results.tsx, i18n.ts |
| — | « Revanche » de l'Accueil (défaites récentes) : matchmaking aléatoire | Adversaire réel : défi nominatif sur le même thème. Bot : bouton renommé « REJOUER CE THÈME ». Le backend expose `opponent_id` dans `pending_duels`. | accueil.tsx, backend/routers/social.py |
| — | « Revanche » des cartes de partie du chat : matchmaking aléatoire | Défi nominatif à l'interlocuteur | chat.tsx |
| 0.7 | Réponses teintées cyan / menthe / violet / or **avant** la révélation | Réponses neutres (pétrole, bordure crème 14 %) | game.tsx |
| 0.8 | Aucun état « sélectionné » pendant l'attente du serveur (jusqu'à 8 s) | Sélection immédiate en jaune : bordure 3 px, fond jaune 14 %, badge lettre jaune, haptique légère au tap | game.tsx |
| 0.9 | En ligne, la bonne réponse n'était jamais montrée quand on se trompait | Le serveur renvoie `correct_option` dans `answer_result`, **après** la réponse (jamais dans `game_start` ni `next_question`). Révélation : bonne réponse en vert + ✓, ma mauvaise réponse en rouge + ✕, réponse du rival marquée en corail. | ws_manager.py, game.tsx |

Les premières couleurs **par rôle** (`COLOR.bg / surface / text / action / player / status / reward / border / overlay`) sont posées dans `theme/tokens.ts`. L'écran Question les utilise déjà, sans nouvelle couleur codée en dur. L'étape 2 complétera le système.

## Vérifications faites

- **TypeScript** : 34 erreurs, toutes déjà présentes avant le lot (aucune nouvelle).
- **Tests Jest** : 670 / 674. Les 4 mêmes échecs qu'avant le lot (DueloHeader ×3 et CategoryIcon, tests obsolètes ; utils, mock AsyncStorage manquant).
- **Backend, test hors base** (`ConnectionManager` avec envoi simulé) :
  1. une revanche acceptée donne la même `room_id` aux deux joueurs ;
  2. les deux joueurs entrent, la salle de jeu est créée et `match_found` est envoyé aux deux ;
  3. `answer_result.correct_option` est présent, mais absent de `game_start`.
- **Navigateur, mobile 390×844, compte invité de test** :
  - réponses neutres avant de jouer (capture `captures/lot0/question-neutre.png`) ;
  - délai écoulé : bonne réponse en vert + ✓, choix du bot en point corail ;
  - Résultat : « PARTAGER MON SCORE » et « Retour à l'accueil » (qui mène bien à `/accueil`) ;
  - revanche contre un bot : même pseudo d'adversaire ;
  - bouton ✕ : confirmation puis défaite ;
  - « DÉFIER » de l'onglet Social : fiche joueur avec la fenêtre de défi ouverte, Harlan Coben présélectionné, sans « Thème libre » (capture `captures/lot0/defi-nominatif.png`). Le défi n'a pas été envoyé, car il serait parti vers un vrai joueur.

## Points bloqués ou non vérifiés

1. **Le backend doit être redéployé** (Railway) pour activer : la bonne réponse en duel en direct, le démarrage des défis acceptés en direct, la revanche en salle privée et la revanche nominative de l'Accueil. Sans redéploiement, le front reste correct : pas de bonne réponse affichée en ligne si le serveur ne l'envoie pas, et une revanche acceptée sans salle rejoint la file du thème au lieu d'un bot.
2. **Le duel en direct à deux humains n'a pas pu être testé de bout en bout.** Il faut deux appareils et le backend redéployé. À faire lors du test du pilote.
3. **Défaut d'affichage web (déjà présent avant le lot)** : sur les écrans empilés (jeu, résultat, fiche joueur), l'onglet du dessous apparaît par transparence en haut de l'écran. Il sera traité avec le pilote, car il fausse les captures web.
4. **Compte de test en production** : un invité « SkilkiTest » a été créé et a joué 3 parties contre des bots. À supprimer si besoin.
5. Une fois, une confirmation d'abandon s'est affichée en quittant la page après un test d'abandon. Elle n'a pas été reproduite (une partie quittée par navigation ne la déclenche pas). À surveiller.

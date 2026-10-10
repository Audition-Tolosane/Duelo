# Refonte SKILKI : ce qu'il reste à faire

Liste tenue à jour à chaque lot. Elle regroupe les points ouverts des rapports `10-lot-a.md` à `16-lot-g.md` (Lots A à G terminés).

## Mise en production de la refonte

A. **Tester sur un vrai téléphone (Expo Go).** Toutes les vérifications ont été faites sur le web en 390 et 320 px : il faut repasser sur iOS et Android, en particulier les dialogues imbriqués dans la feuille Bonus, le clavier du support et la roue.
B. **Fusionner la branche `refonte-skilki` dans `master`**, qui a 22 commits d'avance. Elle n'a jamais été poussée : la pousser seulement après ta validation.
C. **Fichiers backend non suivis** (`backend/i18n.py`, `backend/simulate_games.py`) : décider s'ils vont avec le prochain déploiement.

## À trancher par toi

1. **Vocabulaire duel / défi / match / partie.** Il reste « Résultats de match » et « parties ». Proposition : « duel » pour une partie jouée, « défi » pour l'invitation. *(Lot B)*
2. **« Suis des joueurs pour les voir ici »** sous l'onglet « Amis » : faut-il parler de suivre ou d'amis ? *(Lot C)*
3. **Ballon de Toy Story** (icône de thème) : il garde un léger risque de droits. *(Icônes)*

## Backend (à faire au prochain redéploiement sur Railway)

4. **Messages du coach** écrits en dur par le backend (« Reprends ton trône ! », « Tu n'as que 120 XP… ») : à reformuler et traduire. *(Lot B)*
5. **Libellés de gain de la roue** dans `backend/spin.py`, en français en dur (« Boost ×2 », « Thème 24h »). L'app a ses propres libellés pour le boost et le thème, mais pas pour les autres gains. *(Lot E)*
6. **Clusters « Litterature » et « Littérature »** en double : à fusionner en base. *(Lot C)*
7. **Tester un duel entre deux humains**, puis redéployer le backend. *(Hors design)*

## Contenu

14. **Adresse de support `support@duelo-app.com`** : c'est la seule mention « Duelo » encore visible. Elle est à remplacer quand une adresse SKILKI existera. *(Lot G)*
15. **Conditions d'utilisation** : vouvoiement (le reste de l'app tutoie), guillemets « ”tel quel” », date du 22 mars 2026. C'est un texte juridique, à faire relire plutôt que réécrire. *(Lot G)*
16. **Administration** : outil interne, non migré vers le design system (seul le nom a été changé). *(Lot G)*

## Produit (hors design)

8. **Pubs non branchées** (`TODO AdMob rewarded` dans l'Accueil) : l'app attend 1 s puis active le bonus. *(Lot F)*
9. **Achats non branchés** : les boutons de la boutique affichent « Bientôt » et ouvrent « Bientôt disponible ». *(Lot E)*

## Finitions mineures

10. « 1 j de Premium » : passer à « 1 jour » ou « 7 jours », ce qui demande un pluriel sur le nombre de jours. *(Lot F)*
11. **Forfait** : « DUEL INTERROMPU » et « VICTOIRE ! » restent empilés, soit deux titres pour un même écran. C'est la logique d'origine. *(Lot D)*
12. **Espacements non mesurés automatiquement** pour la fin de duel en 320 (les confettis gênent le relevé) et pour le Lot F (session de test perdue). *(Lots D et F)*
13. **Libellés des segments du bas de la roue** à l'envers pendant la rotation, comme sur une vraie roue. Le gain, lui, se lit toujours à l'endroit. *(Lot E)*

## Réglé depuis

- Les 1 032 icônes de thèmes sont produites et relues, les 56 icônes moyennes refaites et les 9 icônes à risque de droits remplacées (le Lot B les signalait comme restant à faire).
- Les traductions des textes revus aux Lots E et F sont faites dans les 10 langues.

# Généralisation SKILKI : Lot F, monétisation et premium

## Périmètre

Il n'existe **pas d'écran d'abonnement séparé** dans l'app. La monétisation est répartie à quatre endroits :

| Surface | Où | État |
|---|---|---|
| Boutique et carte Premium | `shop.tsx` | Traitée au Lot E |
| Bouton pub de fin de duel | `results.tsx` | Traité au Lot D |
| Offres XP ×2 financées par la pub, missions ×2, changement de mission | Accueil, feuille Bonus | **Traité ici** |
| Statut Premium gagné par parrainage | `settings.tsx` | **Traité ici** |

## Corrections

| Élément | Avant | Après |
|---|---|---|
| **Confirmation d'une offre XP ×2** | `Alert.alert` natif. Sur le web, une alerte à boutons ne s'affiche pas : toucher l'offre ne faisait rien. | `Dialog` or rendu dans la feuille Bonus (modal imbriqué). « Regarder la pub » est le seul bouton jaune, « Pas maintenant » est en ghost. |
| Badge « Pub » des offres | Collé en haut de la ligne (le `Badge` du kit est en `alignSelf: flex-start`) | Centré verticalement |
| **Vocabulaire Premium** | Les Réglages disaient « Pro » (« 7 j de Pro »), alors que la boutique vend « SKILKI Premium » | « Premium » partout, dans les 10 langues. Le badge des Réglages devient « Premium actif » : placé près du code, il laissait croire que le code lui-même était Premium. |
| Missions | « ×2 toutes (pub) » | « Doubler l'XP (pub) » |
| Offres | « Changer (pub) » ; sous-titre « Regarde une pub pour l'activer », qui répétait le badge « Pub » | « Autres offres (pub) » ; « Double l'XP sur ce thème » |
| Règle du parrainage | « …après 3 parties, un compte lié et 24 h. » | « Un filleul est confirmé quand il a lié son compte, joué 3 parties et attendu 24 h. » |
| Comptes à rebours de l'Accueil | « 06h20 », « 3h 05m », « 24:57 » | « 6 h 20 », « 25 min » : même format que le tournoi |
| Thèmes recommandés | « 1 duels » | « 1 duel » (pluriel avec `pluralKey`) |

Les nouveaux textes sont traduits dans les 10 langues. Les deux formats de durée réutilisent les clés `pilot.tournament.hours` et `pilot.tournament.minutes`.

## Composants

- **Réutilisés** : `Dialog`, `Button`, `Badge`, `BottomSheet`.
- **Créés** : aucun. Le kit n'a pas été modifié.

## Dette (sur tout le dépôt)

Inchangée depuis le Lot E : hex 38, rgba 35, tailles de police 19, faux gras 4, dégradés 17, anciennes bibliothèques d'icônes 2, emoji 2. Ce lot n'a déplacé que des textes et un dialogue.

## Tests

- TypeScript : 8 erreurs, toutes antérieures.
- Jest : 679 / 679.
- Garde-fou : aucune dette ajoutée.
- Navigateur, 390 et 320 :
  - aucun bouton imbriqué ;
  - `scrollWidth` égal à la largeur d'écran ;
  - les données sont simulées (fil, missions, parrainage) et **tout POST est intercepté**, donc aucune pub n'a été activée et rien n'a été écrit en production.

## Better Design

- **`check-comprehension`** :
  - le dialogue et le pied des missions passent ;
  - la feuille Bonus et la carte Parrainage étaient « à revoir » : les 5 vrais constats sont corrigés (voir plus haut) ;
  - faux positifs : « SKIL » (le préfixe du code de parrainage, pas un sigle à expliquer) et « 5 actions » (feuille de type menu).
- **`inspect-spacing`** : non mesuré. L'outil exige la géométrie du DOM, et la session de test avait été perdue au redémarrage du navigateur. À l'œil, les espacements sont réguliers : 8 px entre les boutons du dialogue.

## Restant

- « 1 j de Premium » garde l'abréviation « j ». Passer à « jour » ou « jours » demande un pluriel sur le nombre de jours, qui est distinct du nombre de filleuls. C'est mineur.
- **Les pubs ne sont pas branchées** (`TODO AdMob rewarded`) : l'app attend 1 s puis active le bonus. C'est hors design.

## Captures

- `captures/lotF/390x844/` : offres, offre-confirmation, reglages-premium ;
- `captures/lotF/320x568/` : offres, offre-confirmation, missions ;
- planches `captures/lotF/planche-*.png`.

# Généralisation SKILKI : Lot G, écrans rares et utilitaires

## Périmètre

| Surface | État |
|---|---|
| **Support** (`support.tsx`) | **Refait** |
| **Conditions d'utilisation** (`terms.tsx`) | **Refait** |
| **Suppression de compte** (Réglages) | **Corrigé** |
| Administration (`admin.tsx`, `AdminUI.tsx`) | Outil interne : « Duelo » renommé en « SKILKI », sans refonte |
| Erreurs techniques (hors ligne, plantage) | Déjà traitées au Lot A (`OfflineOverlay`, `ErrorBoundary`) |
| Maintenance, mise à jour obligatoire | **Inexistantes** dans l'app : rien à migrer |

## Écrans

| Élément | Avant | Après |
|---|---|---|
| **Support** | Fond noir `#0a0a0a`, en-tête `DueloHeader` en double avec un second en-tête, dégradés cyan→violet, puces de catégorie multicolores (rouge, jaune, cyan, gris), MaterialCommunityIcons, vouvoiement. **« Envoyer » n'envoyait rien** et affichait « Message envoyé ! ». | `ScreenHeader`, catégories en `Chip` (sélection jaune) avec icônes Lucide, champ aux jetons du kit, un seul CTA jaune. « Envoyer » **ouvre l'app mail** avec le message prérempli (objet « [SKILKI] Catégorie », version de l'app en pied) ; l'écran suivant le dit honnêtement : « Ton app mail est ouverte ». Tutoiement. |
| **Conditions d'utilisation** | Fond `#050510`, Ionicons, numéro de section en cyan **en plus** du numéro déjà présent dans le titre (« 01 » puis « 1. Acceptation… ») | `ScreenHeader`, sections dans une `Card` séparées par des filets, un seul numéro, titres en `cardTitle` (rôle d'en-tête pour l'accessibilité), texte en `bodySmall` secondaire |
| **Suppression de compte** | `Alert.alert` à boutons : **sur le web, rien ne s'affichait, donc impossible de supprimer son compte**. L'erreur réseau passait aussi par une alerte invisible. | `Dialog` : « Supprimer définitivement » en rouge, « Annuler » en ghost, chargement pendant l'appel. En cas d'échec, l'erreur s'affiche **dans le dialogue** : « La suppression a échoué. Vérifie ta connexion et réessaie. » |

## Composants

- **Réutilisés** : `ScreenContainer`, `ScreenHeader`, `Chip`, `Button`, `Card`, `ListRow`, `EmptyState`, `Dialog`, `Txt`, `Icon`.
- **Créés** : aucun. Le kit n'a pas été modifié.

## Dette (sur tout le dépôt, hors administration et kit)

| Mesure | Après Lot F | Après Lot G |
|---|---|---|
| Couleurs hex en dur | 38 | **7** |
| rgba en dur | 35 | **1** |
| Tailles de police en dur | 19 | **0** |
| Faux gras | 4 | **0** |
| Dégradés hors design system | 17 | 12 |
| Anciennes bibliothèques d'icônes | 2 | **0** |
| Emoji d'interface | 2 | 2 (le texte partagé de la fin de duel) |

Ce qui reste est légitime :
- les 4 couleurs du **logo Google** sur l'écran de connexion, imposées par la charte de Google ;
- le noir de l'**ombre du geste de retour** (`SwipeBackPage`) ;
- les dégradés des moments émotionnels.

L'administration (environ 310 points) est exclue du garde-fou par conception : c'est un outil interne.

## Textes

- Nouveaux textes du support et de l'erreur de suppression, dans les 10 langues.
- « Décrivez votre problème... » devient « Décris ton problème ou ton idée… ».
- « Ou contactez-nous par email : » devient « Écris-nous » (le libellé long était tronqué en 320).

## Tests

- TypeScript : 8 erreurs, toutes antérieures.
- Jest : 679 / 679.
- Garde-fou : aucune dette ajoutée, référence mise à jour.
- Navigateur, 390 et 320 :
  - aucun bouton imbriqué ;
  - `scrollWidth` égal à la largeur d'écran.
- **Aucun appel réel** :
  - `DELETE /api/auth/delete-account` a été intercepté (réponse 500 simulée pour l'état d'erreur), après vérification que l'interception était active ;
  - `window.open` a été neutralisé, donc aucune app mail ne s'est ouverte sur le PC.

## Better Design

- **`check-comprehension`** :
  - support et app mail ouverte : réussis ;
  - suppression avec erreur : réussi ;
  - faux positifs : « CATÉGORIE » lu comme un sigle, et le texte tapé par l'utilisateur compté comme du texte d'interface.
- **`inspect-spacing`** : non lancé (même limite qu'au Lot F). À l'œil, j'ai corrigé un double espacement en haut et en bas de la carte des Conditions.

## Restant

- **Adresse `support@duelo-app.com`** : c'est une vraie adresse, que je n'ai pas modifiée. Il faudra une adresse SKILKI quand le domaine existera.
- **Contenu juridique des Conditions** : vouvoiement, guillemets « ”tel quel” » et date du 22 mars 2026. Je n'ai rien réécrit, puisque c'est un texte juridique.
- **Administration** : interface interne non migrée vers le design system (en dehors du nom).

## Captures

- `captures/lotG/390x844/` : support, support-rempli, support-mail-ouvert, conditions, suppression-compte, suppression-erreur ;
- `captures/lotG/320x568/` : support, conditions, suppression-compte ;
- planches `captures/lotG/planche-*.png`.

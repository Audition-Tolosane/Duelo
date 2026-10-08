# Taxonomie des icônes de thèmes SKILKI

Catalogue : 1 032 thèmes, 9 univers, 28 clusters (`frontend/scripts/theme-catalogue.json`, extrait de l'API de production le 08/10/2026). Repère : 113 icônes personnalisées après le lot pilote.

Règle commune : une icône **par thème**, au symbole le plus proche du thème, dans le style V2 (voir `BRIEF.md`). Tant qu'un thème n'a pas la sienne, l'app affiche l'icône de son cluster ou de son univers.

## Familles visuelles par univers

| Univers | Famille de symboles |
|---|---|
| ARENA | Objets de sport et de jeu (équipement, terrain, objet culte du jeu vidéo) |
| ART | Œuvres, monuments, objets de mode |
| GLOBE | Plats, monuments, objets culturels (jamais de drapeau) |
| LAB | Objets scientifiques et techniques, astres |
| LEGENDS | Attributs historiques et mythologiques (casques, armes légendaires sans violence, monuments) |
| LIFE | Organes stylisés, animaux sympathiques, nature |
| MIND | Attribut de l’œuvre ou de l’auteur, objets de pensée et de jeu |
| SCREEN | Objet ou accessoire culte de l’œuvre (jamais le logo ni le personnage dessiné) |
| SOUND | Instrument, accessoire ou objet culte de l’artiste (jamais un portrait) |

## Avancement par cluster

| Univers | Cluster | Thèmes | Faites | Restantes | Lots prévus |
|---|---|---|---|---|---|
| ARENA | Combat & Athlé | 28 | 4 | 24 | 1 |
| ARENA | E-sport & Gaming | 87 | 4 | 83 | 4 |
| ARENA | Sports de Balle | 50 | 4 | 46 | 2 |
| ART | Architecture | 18 | 4 | 14 | 1 |
| ART | Mode & Design | 18 | 4 | 14 | 1 |
| ART | Peinture & Sculpture | 21 | 4 | 17 | 1 |
| GLOBE | Gastronomie | 20 | 4 | 16 | 1 |
| GLOBE | Langues & Cultures | 23 | 4 | 19 | 1 |
| GLOBE | Voyage & Géo | 28 | 4 | 24 | 1 |
| LAB | Espace & Univers | 18 | 4 | 14 | 1 |
| LAB | Physique & Chimie | 19 | 4 | 15 | 1 |
| LAB | Tech & IA | 22 | 4 | 18 | 1 |
| LEGENDS | Antiq. & M-Â | 20 | 4 | 16 | 1 |
| LEGENDS | Hist. Moderne | 22 | 4 | 18 | 1 |
| LEGENDS | Mythologies | 25 | 4 | 21 | 1 |
| LIFE | Corps Humain | 20 | 4 | 16 | 1 |
| LIFE | Monde Animal | 22 | 4 | 18 | 1 |
| LIFE | Nature & Écologie | 19 | 4 | 15 | 1 |
| MIND | Litterature | 90 | 4 | 86 | 4 |
| MIND | Littérature | 18 | 4 | 14 | 1 |
| MIND | Maths & Logique | 18 | 4 | 14 | 1 |
| MIND | Philo & Psycho | 19 | 4 | 15 | 1 |
| SCREEN | Animation & Anime | 86 | 4 | 82 | 4 |
| SCREEN | Cinéma | 69 | 4 | 65 | 3 |
| SCREEN | Séries TV | 155 | 5 | 150 | 6 |
| SOUND | Hits & Pop Culture | 55 | 4 | 51 | 3 |
| SOUND | Musiques de Films & Jeux | 17 | 4 | 13 | 1 |
| SOUND | Rock & Classiques | 25 | 4 | 21 | 1 |

**Reste : 919 icônes, en 47 lots de 25 au plus** (un lot = un cluster ou une tranche de cluster ; même univers = mêmes contrôles de doublons).

## Contrôles à chaque lot

1. `python scripts/build-theme-icons.py --check` : palette, 2 à 4 couleurs, ≤ 18 formes, éléments interdits, **doublon exact**, id présent au catalogue.
2. Planche `scripts/theme-icons-preview.py` (HTML + PNG) : 128 / 64 / 48 / 32 px sur plaque crème, 64 px sur fond nuit, relue par l'agent puis par moi.
3. Doublons **d'idée** entre univers (même objet principal) : relecture croisée de la planche globale ; corrigés au pilote : drakkar ×2, tour Eiffel ×2, soucoupe ×2, trident ×2, aileron ×2, pyramides/montagnes.
4. Droits : aucun logo ni design déposé reproduit, aucun portrait de personne réelle, aucun drapeau.

## Incohérence de données à signaler

Deux clusters MIND portent presque le même nom : « Litterature » (90 thèmes) et « Littérature » (18 thèmes). À fusionner côté base.

import { THEME_ICONS, THEME_ID_BY_NAME, type ThemeIconName } from './themeIcons.generated';
import type { IconName } from '../components/ui/Icon';

// Résolution thème → icône SKILKI, avec repli :
//   icône personnalisée du thème (par id, sinon par nom) → mots-clés du nom → cluster → univers.
// Les icônes personnalisées sont produites par lots (assets/theme-icons/themes/<id>.svg) ;
// tant qu'un thème n'a pas la sienne, il reçoit celle de son cluster ou de son univers.
// Jamais d'emoji.

const norm = (s?: string | null) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Mots-clés présents dans le NOM du thème
const BY_THEME_NAME: [RegExp, ThemeIconName][] = [
  [/\begypt/, 'egypte-antique'],
  [/\bmoyen age\b|\bmedieva|\bchevalier/, 'moyen-age'],
  [/\brevolution francaise\b/, 'revolution-francaise'],
  // Rétro / arcade : le Space Invader ; « Jeux vidéo » générique garde la manette
  [/\bretro|\barcade|\bpixel|\bspace invaders?\b|\bpac ?man\b|\batari\b|\bnes\b|\bsnes\b/, 'retro-gaming'],
];

// Cluster (sous-catégorie) normalisé
const BY_CLUSTER: Record<string, ThemeIconName> = {
  'cinema': 'cinema',
  'series tv': 'cinema',
  'animation anime': 'cinema',
  'e sport gaming': 'jeux-video',
  'jeux video': 'jeux-video',
  'sports de balle': 'sport',
  'combat sports individuels': 'sport',
  'sports mecaniques': 'sport',
  'gastronomie': 'gastronomie',
  'espace univers': 'espace',
  'physique chimie': 'sciences',
  'tech ia': 'sciences',
  'voyage geo': 'geographie',
  'langues cultures': 'geographie',
  'antiquite moyen age': 'histoire',
  'histoire moderne': 'histoire',
  'histoires nationales': 'histoire',
  'mythes religions': 'histoire',
  'hits pop culture': 'musique',
  'rock classiques': 'musique',
  'musiques de films jeux': 'musique',
  // Noms traduits renvoyés par l'API en EN / ES (backend/i18n.py, CLUSTERS_TRADUITS)
  'movies': 'cinema', 'cine': 'cinema',
  'tv series': 'cinema', 'series de tv': 'cinema',
  'animacion y anime': 'cinema',
  'esports gaming': 'jeux-video', 'esports y videojuegos': 'jeux-video',
  'ball sports': 'sport', 'deportes de pelota': 'sport',
  'combat individual sports': 'sport', 'combate y deportes individuales': 'sport',
  'motorsport': 'sport', 'deportes de motor': 'sport',
  'gastronomy': 'gastronomie', 'gastronomia': 'gastronomie',
  'space universe': 'espace', 'espacio y universo': 'espace',
  'physics chemistry': 'sciences', 'fisica y quimica': 'sciences',
  'tech ai': 'sciences', 'tecnologia e ia': 'sciences',
  'travel geography': 'geographie', 'viajes y geografia': 'geographie',
  'languages cultures': 'geographie', 'lenguas y culturas': 'geographie',
  'antiquity middle ages': 'histoire', 'antiguedad y edad media': 'histoire',
  'modern history': 'histoire', 'historia moderna': 'histoire',
  'national histories': 'histoire', 'historias nacionales': 'histoire',
  'myths religions': 'histoire', 'mitos y religiones': 'histoire',
  'exitos y cultura pop': 'musique',
  'rock classical': 'musique', 'rock y clasica': 'musique',
  'film game music': 'musique', 'musica de cine y videojuegos': 'musique',
};

// Univers (super-catégorie)
const BY_UNIVERSE: Record<string, ThemeIconName> = {
  SCREEN: 'cinema',
  SOUND: 'musique',
  ARENA: 'sport',
  LEGENDS: 'histoire',
  LAB: 'sciences',
  GLOBE: 'geographie',
};

// Univers sans illustration pour l'instant : pictogramme Lucide sur la même plaque crème
export const UNIVERSE_FALLBACK_GLYPH: Record<string, IconName> = {
  ART: 'palette',
  LIFE: 'leaf',
  MIND: 'brain',
};

export type ThemeIconSource = {
  /** Id du thème (ARE_CLRY…) : clé de son icône personnalisée. */
  themeId?: string | null;
  themeName?: string | null;
  cluster?: string | null;
  superCategory?: string | null;
};

export type ResolvedThemeIcon =
  | { kind: 'illustration'; name: ThemeIconName }
  | { kind: 'glyph'; name: IconName };

export function resolveThemeIcon({ themeId, themeName, cluster, superCategory }: ThemeIconSource): ResolvedThemeIcon {
  if (themeId && themeId in THEME_ICONS) return { kind: 'illustration', name: themeId as ThemeIconName };
  const n = norm(themeName);
  const byName = THEME_ID_BY_NAME[n];
  if (byName) return { kind: 'illustration', name: byName };
  for (const [re, icon] of BY_THEME_NAME) if (re.test(n)) return { kind: 'illustration', name: icon };
  const c = BY_CLUSTER[norm(cluster)];
  if (c) return { kind: 'illustration', name: c };
  const sc = (superCategory || '').toUpperCase();
  if (BY_UNIVERSE[sc]) return { kind: 'illustration', name: BY_UNIVERSE[sc] };
  return { kind: 'glyph', name: UNIVERSE_FALLBACK_GLYPH[sc] ?? 'compass' };
}

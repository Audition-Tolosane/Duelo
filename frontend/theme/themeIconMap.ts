import type { ThemeIconName } from './themeIcons.generated';
import type { IconName } from '../components/ui/Icon';

// Résolution thème → icône SKILKI, avec repli : thème → cluster → univers.
// Tant que la bibliothèque n'est pas produite, la plupart des thèmes reçoivent l'icône de leur
// cluster ou de leur univers. Jamais d'emoji, jamais de pictogramme générique répété.

const norm = (s?: string | null) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Mots-clés présents dans le NOM du thème
const BY_THEME_NAME: [RegExp, ThemeIconName][] = [
  [/\begypt/, 'egypte-antique'],
  [/\bmoyen age\b|\bmedieva|\bchevalier/, 'moyen-age'],
  [/\brevolution francaise\b/, 'revolution-francaise'],
];

// Cluster (sous-catégorie) normalisé
const BY_CLUSTER: Record<string, ThemeIconName> = {
  'cinema': 'cinema',
  'series tv': 'cinema',
  'animation anime': 'cinema',
  'e sport gaming': 'jeux-video',
  'jeux video': 'jeux-video',
  'sports de balle': 'sport',
  'combat athle': 'sport',
  'gastronomie': 'gastronomie',
  'espace univers': 'espace',
  'physique chimie': 'sciences',
  'tech ia': 'sciences',
  'voyage geo': 'geographie',
  'langues cultures': 'geographie',
  'antiq m a': 'histoire',
  'hist moderne': 'histoire',
  'mythologies': 'histoire',
  'hits pop culture': 'musique',
  'rock classiques': 'musique',
  'musiques de films jeux': 'musique',
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
  themeName?: string | null;
  cluster?: string | null;
  superCategory?: string | null;
};

export type ResolvedThemeIcon =
  | { kind: 'illustration'; name: ThemeIconName }
  | { kind: 'glyph'; name: IconName };

export function resolveThemeIcon({ themeName, cluster, superCategory }: ThemeIconSource): ResolvedThemeIcon {
  const n = norm(themeName);
  for (const [re, icon] of BY_THEME_NAME) if (re.test(n)) return { kind: 'illustration', name: icon };
  const c = BY_CLUSTER[norm(cluster)];
  if (c) return { kind: 'illustration', name: c };
  const sc = (superCategory || '').toUpperCase();
  if (BY_UNIVERSE[sc]) return { kind: 'illustration', name: BY_UNIVERSE[sc] };
  return { kind: 'glyph', name: UNIVERSE_FALLBACK_GLYPH[sc] ?? 'compass' };
}

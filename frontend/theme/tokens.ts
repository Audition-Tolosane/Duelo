import { FONTS } from './fonts';

export const COLORS = {
  // Accents marque (DUEL = cyan vs violet)
  cyan:   '#00E5FF',   // joueur 1 / primaire
  violet: '#B366FF',   // joueur 2 / primaire
  gold:   '#FFB547',   // victoire, XP, pièces
  fire:   '#FF6B2C',   // streak / urgence
  mint:   '#32E7A3',   // bonne réponse / succès
  red:    '#FF3D5E',   // mauvaise réponse / défaite / erreur

  // Fonds (du plus profond au plus clair)
  abyss:  '#050510',
  night:  '#0A0A1A',
  ink:    '#12122A',
  panel:  '#1A1A35',

  // Texte sur fond sombre
  white:  '#FFFFFF',
  dim1:   'rgba(255,255,255,0.85)',
  dim2:   'rgba(255,255,255,0.60)',
  dim3:   'rgba(255,255,255,0.40)',
  inkSub: 'rgba(255,255,255,0.55)',
  inkDim: 'rgba(255,255,255,0.30)',

  // Surfaces / strokes (glass)
  surface:      'rgba(255,255,255,0.04)',
  surfaceLight: 'rgba(255,255,255,0.07)',
  stroke:       'rgba(255,255,255,0.08)',
  strokeStrong: 'rgba(255,255,255,0.14)',
  strokeCyan:   'rgba(0,229,255,0.20)',
  strokeViolet: 'rgba(179,102,255,0.20)',
  strokeGold:   'rgba(255,181,71,0.20)',

  // Voiles sombres (overlays / scrims)
  scrim1: 'rgba(5,5,16,0.60)',
  scrim2: 'rgba(5,5,16,0.80)',
  scrim3: 'rgba(5,5,16,0.95)',
} as const;

export const RADIUS = {
  xs:  6,
  sm:  10,
  md:  16,
  lg:  22,
  xl:  28,
  pill: 999,
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
} as const;

// Couleurs catégories (cf. CategoryIcon)
export const CATEGORY_COLORS: Record<string, string> = {
  geo:      '#00E5FF',
  histoire: '#FFB547',
  cinema:   '#B366FF',
  sciences: '#32E7A3',
  sport:    '#FF6B2C',
  musique:  '#FF3D5E',
};

// Échelle typographique du redesign — à étaler avec StyleSheet :
// style={[TYPE.eyebrow, { color: COLORS.cyan }]}
export const TYPE = {
  // Fraunces italic — titres hero, moments forts (« Bravo. », « Égalité »)
  hero: {
    fontFamily: FONTS.editorial.mediumItalic,
    fontSize: 48,
    color: COLORS.white,
  },
  // Titre d'écran
  screenTitle: {
    fontFamily: FONTS.display.bold,
    fontSize: 28,
    letterSpacing: -0.5,
    color: COLORS.white,
  },
  // Titre de section
  section: {
    fontFamily: FONTS.display.bold,
    fontSize: 18,
    color: COLORS.white,
  },
  // Corps
  body: {
    fontFamily: FONTS.display.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.dim2,
  },
  // Label
  label: {
    fontFamily: FONTS.display.semiBold,
    fontSize: 12,
    color: COLORS.dim2,
  },
  // Eyebrow mono UPPERCASE
  eyebrow: {
    fontFamily: FONTS.mono.regular,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase' as const,
    color: COLORS.dim3,
  },
  // Gros chiffres arcade (scores, décomptes)
  arcade: {
    fontFamily: FONTS.display.bold,
    fontSize: 48,
    letterSpacing: -1,
    color: COLORS.white,
  },
} as const;

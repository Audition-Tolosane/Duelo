import { FONTS } from './fonts';

// ─────────────────────────────────────────────────────────────────────────────
// SKILKI — couleurs PAR RÔLE. Les écrans n'utilisent que ces rôles, jamais un hex.
// Règles : jaune = action / sélection / mon camp ; corail = adversaire / accent chaud ;
// or = récompense / rang / prestige ; vert = juste ; rouge = faux / erreur ;
// pétrole = structure ; crème = texte ; violet = rareté (flawless, premium) uniquement.
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  night:      '#071F26',
  nightDeep:  '#05171C',
  petrol:     '#0B3D4A',
  petrolLight:'#12606D',
  yellow:     '#FFDB3D',
  coral:      '#FF6B5B',
  cream:      '#E8F1EC',
  gold:       '#F0A93B',   // plus chaud et plus sombre que le jaune : jamais confondu avec une action
  green:      '#32E7A3',
  red:        '#F0445E',   // plus froid que le corail : une erreur ne ressemble pas à l'adversaire
  violet:     '#A78BFA',
} as const;

export const COLOR = {
  bg: {
    primary:   PALETTE.night,
    deep:      PALETTE.nightDeep,
  },
  surface: {
    card:      PALETTE.petrol,
    elevated:  PALETTE.petrolLight,           // pressé / élevé — jamais pour du texte
    subtle:    'rgba(232,241,236,0.04)',
    input:     PALETTE.petrol,
  },
  text: {
    primary:   PALETTE.cream,
    secondary: 'rgba(232,241,236,0.72)',
    tertiary:  'rgba(232,241,236,0.60)',
    disabled:  'rgba(232,241,236,0.40)',
    onAction:  PALETTE.night,                 // texte posé sur jaune, corail, vert, or
  },
  action: {
    primary:   PALETTE.yellow,
    primaryPressed: '#E9C52F',
    secondary: PALETTE.petrolLight,
    ghost:     'rgba(232,241,236,0.06)',
    selectedFill: 'rgba(255,219,61,0.14)',
  },
  player: {
    self:      PALETTE.yellow,
    opponent:  PALETTE.coral,
  },
  accent: {
    warm:      PALETTE.coral,                 // événements, série, défi reçu
    rare:      PALETTE.violet,                // flawless, premium — rien d'autre
  },
  status: {
    success:   PALETTE.green,
    successFill: 'rgba(50,231,163,0.16)',
    error:     PALETTE.red,
    errorFill: 'rgba(240,68,94,0.16)',
  },
  reward: {
    gold:      PALETTE.gold,
  },
  border: {
    subtle:    'rgba(232,241,236,0.08)',
    default:   'rgba(232,241,236,0.14)',
    strong:    'rgba(232,241,236,0.24)',
    active:    PALETTE.yellow,
  },
  overlay: {
    scrim:     'rgba(5,23,28,0.85)',
  },
} as const;

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

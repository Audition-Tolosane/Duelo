import { FONTS } from './fonts';

// ─────────────────────────────────────────────────────────────────────────────
// SKILKI — couleurs PAR RÔLE. Les écrans n'utilisent que ces rôles, jamais un hex.
// Règles : jaune = action / sélection / mon camp ; corail = adversaire / accent chaud ;
// or = récompense / rang / prestige ; vert = juste ; rouge = faux / erreur ;
// pétrole = structure ; crème = texte ; violet = rareté (flawless, premium) uniquement.
// ─────────────────────────────────────────────────────────────────────────────
export const PALETTE = {
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

/** Teinte transparente d'une couleur de la palette : alpha(PALETTE.yellow, 0.12). Pour halos et motifs ton sur ton. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

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
    dimmed:    'rgba(232,241,236,0.55)',  // réponses non choisies après révélation (≥ 5:1, reste en retrait)
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
    // Même corail, éclairci de 14 % vers le crème : petit texte du rival lisible (4,7:1 sur pétrole)
    opponentText: '#FC7E6F',
  },
  accent: {
    warm:      PALETTE.coral,                 // événements, série, défi reçu
    rare:      PALETTE.violet,                // flawless, premium — rien d'autre
  },
  status: {
    success:   PALETTE.green,
    successFill: 'rgba(50,231,163,0.16)',
    error:     PALETTE.red,
    // Même rouge, éclairci de 17 % vers le crème : texte d'erreur sur fond nuit (4,6:1)
    errorText: '#EF6176',
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
    soft:      'rgba(5,23,28,0.60)',
  },
  // Piste des barres de progression / anneaux
  track:       'rgba(232,241,236,0.12)',
  // Voile posé sur une surface verte/jaune (badge lettre de la bonne réponse)
  onAccentTint:'rgba(7,31,38,0.16)',
  // Plaque des icônes de thèmes : crème + liseré pétrole très léger (validé)
  plate: {
    fill:      PALETTE.cream,
    border:    'rgba(11,61,74,0.18)',
  },
  // Teintes « douces » pour fonds de puces / halos (jamais pour du texte)
  tint: {
    self:      'rgba(255,219,61,0.14)',
    opponent:  'rgba(255,107,91,0.14)',
    gold:      'rgba(240,169,59,0.14)',
    rare:      'rgba(167,139,250,0.14)',
  },
} as const;

// ── Espacements (grille de 4) ─────────────────────────────────────────────────
export const SPACE = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, giant: 56,
  screenX: 16,      // marge latérale de tous les écrans
  cardPad: 16,      // padding interne des cartes
  sectionGap: 28,   // espace entre deux sections
} as const;

// ── Rayons ────────────────────────────────────────────────────────────────────
export const RADII = {
  xs: 4,       // barres, tirets
  sm: 8,       // puces, badges lettre
  md: 12,      // boutons, champs, réponses
  lg: 16,      // cartes
  xl: 24,      // hero, modales, cartes VS
  plate: 14,   // plaque d'icône de thème (squircle)
  pill: 999,
} as const;

// ── Hauteurs ──────────────────────────────────────────────────────────────────
export const SIZE = {
  touch: 44,          // cible tactile minimale
  buttonSm: 40,
  button: 52,
  buttonLg: 56,
  input: 48,
  chip: 32,
  listRow: 60,
  header: 46,         // hauteur de la rangée d'en-tête (constante historique conservée)
  tabBar: 64,
} as const;

// ── Épaisseurs de bordure ─────────────────────────────────────────────────────
export const BORDER = {
  hair: 1,
  default: 1.5,
  strong: 2,
  selected: 3,        // ma sélection en jeu
} as const;

// ── Tailles d'icônes ──────────────────────────────────────────────────────────
export const ICON_SIZE = {
  sm: 16, md: 20, lg: 24, xl: 28,
  theme: { xs: 28, sm: 40, md: 56, lg: 80, hero: 112 },
} as const;

// ── Ombres (noires uniquement) ────────────────────────────────────────────────
export const ELEVATION = {
  e1: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 },  elevation: 2 },
  e2: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },  elevation: 6 },
  e3: { shadowColor: '#000', shadowOpacity: 0.50, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} as const;

// ── Halos colorés : réservés aux moments forts (VS, victoire, CTA actif, bonne réponse)
export const GLOW = {
  cta:      { shadowColor: PALETTE.yellow, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  opponent: { shadowColor: PALETTE.coral,  shadowOpacity: 0.30, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  success:  { shadowColor: PALETTE.green,  shadowOpacity: 0.40, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  reward:   { shadowColor: PALETTE.gold,   shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
} as const;

// ── Dégradés AUTORISÉS (liste fermée — tout autre LinearGradient est à migrer) ──
// Jamais de dégradé entre deux teintes (cyan→violet…), jamais sur un bouton ou une carte.
export const GRADIENTS = {
  screen:        { colors: ['#0B3D4A', '#071F26', '#071F26'] as const, locations: [0, 0.45, 1] as const },  // ambiance d'écran
  screenDeep:    { colors: ['#071F26', '#05171C'] as const },                                              // bas de page
  fadeBottom:    { colors: ['rgba(7,31,38,0)', '#071F26'] as const },                                      // fin de scroll
  fadeTop:       { colors: ['#071F26', 'rgba(7,31,38,0)'] as const },
  fadeRight:     { colors: ['rgba(7,31,38,0)', '#071F26'] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  vsSelf:        { colors: ['rgba(255,219,61,0.12)', 'rgba(255,219,61,0)'] as const },                    // halo moi (VS)
  vsOpponent:    { colors: ['rgba(255,107,91,0.12)', 'rgba(255,107,91,0)'] as const },                    // halo rival (VS)
  victory:       { colors: ['rgba(255,219,61,0.22)', 'rgba(7,31,38,0)'] as const },                       // halo victoire
  defeat:        { colors: ['#0B3D4A', '#071F26'] as const },                                              // défaite = pétrole, jamais rouge
  draw:          { colors: ['rgba(232,241,236,0.10)', 'rgba(7,31,38,0)'] as const },
  reward:        { colors: ['rgba(240,169,59,0.24)', 'rgba(240,169,59,0)'] as const },                    // récompense exceptionnelle
  rare:          { colors: ['rgba(167,139,250,0.22)', 'rgba(167,139,250,0)'] as const },                  // flawless / premium
  hero:          { colors: ['#12606D', '#0B3D4A'] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }, // carte hero (même famille)
  scrim:         { colors: ['rgba(5,23,28,0)', 'rgba(5,23,28,0.85)'] as const },                         // lisibilité sur image
} as const;

// ── Typographie ───────────────────────────────────────────────────────────────
// Toujours via <Txt variant="…">. La graisse est portée par la famille : fontWeight interdit
// (Space Grotesk s'arrête à 700, un 800/900 est un faux gras).
const SG = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;
const TAB = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] };

export const TYPO = {
  display:    { fontFamily: SG.bold,     fontSize: 44, lineHeight: 48, letterSpacing: -1.5 },
  h1:         { fontFamily: SG.bold,     fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  h2:         { fontFamily: SG.bold,     fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  h3:         { fontFamily: SG.semiBold, fontSize: 18, lineHeight: 22, letterSpacing: -0.2 },
  cardTitle:  { fontFamily: SG.semiBold, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
  bodyLarge:  { fontFamily: SG.regular,  fontSize: 17, lineHeight: 24 },
  body:       { fontFamily: SG.regular,  fontSize: 15, lineHeight: 22 },
  bodySmall:  { fontFamily: SG.regular,  fontSize: 13, lineHeight: 18 },
  label:      { fontFamily: SG.medium,   fontSize: 13, lineHeight: 16 },
  caption:    { fontFamily: SG.medium,   fontSize: 12, lineHeight: 16 },
  overline:   { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, lineHeight: 14, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  button:     { fontFamily: SG.bold,     fontSize: 15, lineHeight: 20, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  buttonSmall:{ fontFamily: SG.bold,     fontSize: 13, lineHeight: 16, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  statLarge:  { fontFamily: SG.bold,     fontSize: 40, lineHeight: 44, letterSpacing: -1, ...TAB },
  statMedium: { fontFamily: SG.bold,     fontSize: 24, lineHeight: 28, letterSpacing: -0.5, ...TAB },
  score:      { fontFamily: SG.bold,     fontSize: 30, lineHeight: 34, letterSpacing: -0.5, ...TAB },
  // Exceptions documentées : moments de jeu
  countdown:  { fontFamily: SG.bold,     fontSize: 72, lineHeight: 76, letterSpacing: -3, ...TAB },
  moment:     { fontFamily: 'Fraunces_500Medium_Italic', fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  // Pastilles de compteur uniquement (seul texte sous 11 px)
  micro:      { fontFamily: SG.bold,     fontSize: 10, lineHeight: 12 },
} as const;

export type TypoVariant = keyof typeof TYPO;

// Couleur par défaut de chaque variante
export const TYPO_COLOR: Record<TypoVariant, string> = {
  display: COLOR.text.primary, h1: COLOR.text.primary, h2: COLOR.text.primary, h3: COLOR.text.primary,
  cardTitle: COLOR.text.primary, bodyLarge: COLOR.text.primary, body: COLOR.text.primary,
  bodySmall: COLOR.text.secondary, label: COLOR.text.secondary, caption: COLOR.text.tertiary,
  overline: COLOR.text.tertiary, button: COLOR.text.onAction, buttonSmall: COLOR.text.onAction,
  statLarge: COLOR.text.primary, statMedium: COLOR.text.primary, score: COLOR.text.primary,
  countdown: COLOR.text.primary, moment: COLOR.text.primary, micro: COLOR.text.onAction,
};

// Durées d'animation communes
export const MOTION = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// ANCIEN SYSTÈME (Duelo) — @deprecated, conservé le temps de la migration écran par écran.
// Ne plus utiliser dans du nouveau code : COLOR / SPACE / RADII / TYPO ci-dessus.
// ═════════════════════════════════════════════════════════════════════════════

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

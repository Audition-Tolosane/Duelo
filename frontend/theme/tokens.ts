export const COLORS = {
  // Brand primaries
  cyan:   '#00E5FF',
  violet: '#B366FF',
  gold:   '#FFB547',
  fire:   '#FF6B2C',
  mint:   '#32E7A3',
  red:    '#FF3D5E',

  // Backgrounds
  abyss:  '#050510',
  night:  '#0A0A1A',
  panel:  '#0E0E1E',

  // Text / ink
  ink:    '#FFFFFF',
  inkSub: 'rgba(255,255,255,0.55)',
  inkDim: 'rgba(255,255,255,0.30)',

  // Surfaces / overlays
  surface:  'rgba(255,255,255,0.04)',
  dim1:     'rgba(5,5,16,0.60)',
  dim2:     'rgba(5,5,16,0.80)',
  dim3:     'rgba(5,5,16,0.95)',

  // Strokes
  stroke:       'rgba(255,255,255,0.08)',
  strokeCyan:   'rgba(0,229,255,0.20)',
  strokeViolet: 'rgba(179,102,255,0.20)',
  strokeGold:   'rgba(255,181,71,0.20)',
} as const;

export const RADIUS = {
  xs:  6,
  sm:  10,
  md:  16,
  lg:  20,
  xl:  28,
  pill: 999,
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  40,
  xxl: 64,
} as const;

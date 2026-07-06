// ============================================================
// Duelo — Neon admin theme layer
// À copier dans : frontend/theme/adminTheme.ts
// Import : import { NEON, glow, gradients } from '../theme/adminTheme';
// Réutilise COLORS / RADIUS / FONTS existants. Aucun conflit.
// ============================================================
import { Platform, ViewStyle } from 'react-native';
import { COLORS, RADIUS } from './tokens';

/** Palette Neon (fond quasi-noir, bordures cyan/violet lumineuses). */
export const NEON = {
  bg:         '#04040C',          // fond global (plus profond que abyss)
  panel:      'rgba(10,12,28,0.60)',
  panelSoft:  'rgba(10,12,28,0.40)',
  panelHi:    'rgba(0,229,255,0.06)',
  border:     'rgba(0,229,255,0.18)',
  borderHi:   'rgba(179,102,255,0.40)',
  gridLine:   'rgba(0,229,255,0.04)',

  cyan:   COLORS.cyan,
  violet: COLORS.violet,
  gold:   COLORS.gold,
  fire:   COLORS.fire,
  mint:   COLORS.mint,
  red:    COLORS.red,

  txt:  COLORS.white,
  txt1: COLORS.dim1,
  txt2: COLORS.dim2,
  txt3: COLORS.dim3,
} as const;

/**
 * Glow cross-platform. iOS/web = shadow*, Android = elevation (+ pas de teinte,
 * on compense avec une bordure lumineuse côté composant).
 */
export function glow(color: string, radius = 20, opacity = 0.5): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: Math.round(radius / 3) };
  }
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 0 },
  };
}

/** Dégradés prêts pour <LinearGradient colors={...}>. */
export const gradients = {
  brand:      [COLORS.cyan, COLORS.violet] as const,     // barre top des cartes, boutons
  brandDiag:  [COLORS.cyan, COLORS.violet] as const,
  bar:        [COLORS.violet, COLORS.cyan] as const,     // remplissage barres de stats
  fade:       ['rgba(0,229,255,0.14)', 'rgba(179,102,255,0.04)'] as const,
  topAccent:  [COLORS.cyan, COLORS.violet, 'transparent'] as const,
} as const;

/** Rayons Neon (un poil plus doux). */
export const NRADIUS = {
  card: RADIUS.md,   // 16
  sm:   RADIUS.sm,   // 10
  pill: RADIUS.pill, // 999
} as const;

/** Couleurs de statut des signalements (repris de admin.tsx). */
export const STATUS = {
  pending:  { color: COLORS.gold, label: 'En attente' },
  reviewed: { color: COLORS.cyan, label: 'Examiné' },
  resolved: { color: COLORS.mint, label: 'Résolu' },
} as const;

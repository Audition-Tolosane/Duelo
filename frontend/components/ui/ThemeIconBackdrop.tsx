import React, { memo, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  SharedValue, useSharedValue, useAnimatedStyle, useFrameCallback, useReducedMotion,
} from 'react-native-reanimated';
import { THEME_ICONS, SvgNode, ThemeIconName } from '../../theme/themeIcons.generated';
import { renderNode } from './ThemeIcon';
import { PALETTE, alpha } from '../../theme/tokens';

// Fond décoratif de l'onglet Jouer : rangées d'icônes de thèmes sur mini-plaques pétrole,
// posées sur un écran panoramique légèrement incurvé (centre droit, bords un peu plus marqués).
// Les rangées défilent lentement, chacune dans le sens inverse de celle du dessus.
// La courbure est fixe à l'écran : chaque icône la suit en traversant (calcul sur le thread UI).
// Pure texture : aucun nom, aucune interaction, ignoré par les lecteurs d'écran.

const ROWS = 11;              // rangées visibles ; la première et la dernière sont coupées à moitié
const POOL = 36;              // icônes distinctes utilisées
const OPACITY = 0.5;          // opacité du motif
const CURVE = 0.07;           // bombé vertical aux bords (fraction de la distance au centre)
const SPREAD = 0.06;          // étirement horizontal aux bords
const WIDEN = 0.1;            // grossissement aux bords
const SKEW_MAX = 6;           // inclinaison maximale (degrés) : les icônes restent quasi plates
const SPEED = 10;             // défilement, px/s : un mouvement de fond, jamais un manège
const PLATE_RADIUS = 64;      // en unités du viewBox 256 (= RADII.plate / 56)

const VISIBLE = new Set<string>([PALETTE.yellow, PALETTE.coral, PALETTE.cream, PALETTE.gold].map((c) => c.toUpperCase()));

// Icônes dont les couleurs restent lisibles sur pétrole (jaune, corail, crème, or majoritaires)
// et assez légères pour être répétées. Tirage déterministe : même fond à chaque ouverture.
function pickPool(): ThemeIconName[] {
  const scored: { id: ThemeIconName; h: number }[] = [];
  for (const id of Object.keys(THEME_ICONS) as ThemeIconName[]) {
    if (!/^[A-Z]{3}_/.test(id)) continue;
    const colors: string[] = [];
    let count = 0;
    const walk = (n: SvgNode) => {
      count += 1;
      for (const k of ['fill', 'stroke'] as const) {
        const c = n.p[k];
        if (typeof c === 'string' && c.startsWith('#')) colors.push(c.toUpperCase());
      }
      n.c?.forEach(walk);
    };
    THEME_ICONS[id].forEach(walk);
    if (count > 10 || colors.length === 0) continue;
    if (colors.filter((c) => VISIBLE.has(c)).length / colors.length < 0.6) continue;
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    scored.push({ id, h: h >>> 0 });
  }
  return scored.sort((a, b) => a.h - b.h).slice(0, POOL).map((s) => s.id);
}

const ICON_POOL = pickPool();

type Grid = { width: number; height: number; tile: number; pitchX: number; pitchY: number; first: number; span: number };

function makeGrid(width: number, height: number): Grid {
  const pitchY = height / (ROWS - 1);
  const tile = Math.max(34, Math.min(52, Math.round(pitchY * 0.56)));
  const pitchX = tile * 1.22;
  const first = -2;
  const last = Math.ceil(width / pitchX) + 2;
  // Boucle : une icône sortie d'un côté (hors écran) revient de l'autre
  return { width, height, tile, pitchX, pitchY, first, span: (last - first + 1) * pitchX };
}

/** Position projetée sur l'écran incurvé d'une icône dont l'abscisse « à plat » est x0. */
function project(x0: number, y: number, g: Grid) {
  'worklet';
  const cx = g.width / 2;
  const cy = g.height / 2;
  const u = (x0 - cx) / cx;
  const v = (y - cy) / cy;
  const slope = (v * cy * CURVE * 2 * u) / cx;
  return {
    x: cx + cx * u * (1 + SPREAD * u * u),
    y: y + v * cy * CURVE * u * u,
    scale: 1 + WIDEN * u * u,
    skew: Math.max(-SKEW_MAX, Math.min(SKEW_MAX, (Math.atan(slope) * 180) / Math.PI)),
  };
}

// Une icône sur sa plaque : dessinée une fois, seul son placement change à chaque image
const Plate = memo(function Plate({ id, size }: { id: ThemeIconName; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Rect x={0} y={0} width={256} height={256} rx={PLATE_RADIUS} fill={PALETTE.petrol} />
      <G transform="translate(28 28) scale(0.78)">
        {THEME_ICONS[id].map((n, i) => renderNode(n, String(i)))}
      </G>
    </Svg>
  );
});

type SlotProps = { id: ThemeIconName; base: number; y: number; dir: 1 | -1; grid: Grid; shift: SharedValue<number> };

function Slot({ id, base, y, dir, grid, shift }: SlotProps) {
  const style = useAnimatedStyle(() => {
    const start = grid.first * grid.pitchX;
    let x0 = (base - start + dir * shift.value) % grid.span;
    if (x0 < 0) x0 += grid.span;
    const p = project(start + x0, y, grid);
    return {
      transform: [
        { translateX: p.x - grid.tile / 2 },
        { translateY: p.y - grid.tile / 2 },
        { skewY: `${p.skew}deg` },
        { scale: p.scale },
      ],
    };
  });
  return (
    <Animated.View style={[styles.slot, { width: grid.tile, height: grid.tile }, style]}>
      <Plate id={id} size={grid.tile} />
    </Animated.View>
  );
}

type Props = { width: number; height: number; /** false : défilement suspendu (onglet caché) */ active?: boolean };

export default function ThemeIconBackdrop({ width, height, active = true }: Props) {
  const reduceMotion = useReducedMotion();
  const shift = useSharedValue(0);
  const frame = useFrameCallback((f) => {
    const dt = Math.min(f.timeSincePreviousFrame ?? 0, 100);
    shift.value += (dt / 1000) * SPEED;
  }, false);

  useEffect(() => {
    frame.setActive(active && !reduceMotion);
  }, [active, reduceMotion, frame]);

  const grid = useMemo(() => (width >= 100 && height >= 100 ? makeGrid(width, height) : null), [width, height]);
  const slots = useMemo(() => {
    if (!grid) return [];
    const out: Omit<SlotProps, 'grid' | 'shift'>[] = [];
    const count = Math.round(grid.span / grid.pitchX);
    for (let r = 0; r < ROWS; r++) {
      const y = r * grid.pitchY;
      const offset = ((r % 2) * grid.pitchX) / 2; // quinconce
      for (let k = 0; k < count; k++) {
        const c = grid.first + k;
        const id = ICON_POOL[(((r * 7 + c * 5) % ICON_POOL.length) + ICON_POOL.length) % ICON_POOL.length];
        out.push({ id, base: c * grid.pitchX + offset, y, dir: r % 2 === 0 ? -1 : 1 });
      }
    }
    return out;
  }, [grid]);

  if (!grid) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[StyleSheet.absoluteFill, styles.motif]}>
        {slots.map((s, i) => <Slot key={i} {...s} grid={grid} shift={shift} />)}
      </View>
      {/* Voile : la barre d'onglets reste sur un fond calme */}
      <LinearGradient
        colors={[alpha(PALETTE.night, 0), alpha(PALETTE.night, 0.8)]}
        style={styles.veilBottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  motif: { opacity: OPACITY, overflow: 'hidden' },
  slot: { position: 'absolute', left: 0, top: 0 },
  veilBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
});

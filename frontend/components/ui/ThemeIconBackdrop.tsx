import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, G, Rect, Use } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME_ICONS, SvgNode, ThemeIconName } from '../../theme/themeIcons.generated';
import { renderNode } from './ThemeIcon';
import { PALETTE, alpha } from '../../theme/tokens';

// Fond décoratif de l'onglet Jouer : rangées d'icônes de thèmes sur mini-plaques pétrole,
// posées sur un écran panoramique légèrement incurvé (centre droit, bords un peu plus marqués).
// Pure texture : aucun nom, aucune interaction, ignoré par les lecteurs d'écran.
// Un seul <Svg> : chaque icône est définie une fois (<Defs>) puis réutilisée (<Use>).
// layoutRow() accepte un décalage `phase` : faire défiler une rangée revient plus tard
// à animer ce décalage (rangées paires vers la gauche, impaires vers la droite).

const ROWS = 11;              // rangées visibles ; la première et la dernière sont coupées à moitié
const POOL = 36;              // icônes distinctes utilisées
const OPACITY = 0.3;          // opacité globale du motif
const CURVE = 0.07;           // bombé vertical aux bords (fraction de la distance au centre)
const SPREAD = 0.06;          // étirement horizontal aux bords
const WIDEN = 0.1;            // grossissement aux bords
const SKEW_MAX = 6;           // inclinaison maximale (degrés) : les icônes restent quasi plates
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

export type BackdropIcon = { key: string; id: ThemeIconName; x: number; y: number; scale: number; skew: number };

/** Position des icônes d'une rangée, courbure comprise. `phase` (px) : décalage horizontal futur. */
export function layoutRow(row: number, width: number, height: number, phase = 0): BackdropIcon[] {
  const pitchY = height / (ROWS - 1);
  const tile = Math.max(34, Math.min(52, Math.round(pitchY * 0.56)));
  const pitchX = tile * 1.22;
  const cx = width / 2;
  const cy = height / 2;
  const y = row * pitchY;
  const v = (y - cy) / cy;
  // Rangées décalées d'une demi-case en quinconce ; le motif déborde des deux côtés
  const offset = (((row % 2) * pitchX) / 2 + phase) % pitchX;
  const first = -2;
  const last = Math.ceil(width / pitchX) + 2;
  const out: BackdropIcon[] = [];
  for (let c = first; c <= last; c++) {
    const x0 = c * pitchX + offset;
    const u = (x0 - cx) / cx;
    const x = cx + cx * u * (1 + SPREAD * u * u);
    const yy = y + v * cy * CURVE * u * u;
    const slope = (v * cy * CURVE * 2 * u) / cx;
    const skew = Math.max(-SKEW_MAX, Math.min(SKEW_MAX, (Math.atan(slope) * 180) / Math.PI));
    const id = ICON_POOL[(((row * 7 + c * 5) % ICON_POOL.length) + ICON_POOL.length) % ICON_POOL.length];
    out.push({ key: `${row}:${c}`, id, x, y: yy, scale: (tile * (1 + WIDEN * u * u)) / 256, skew });
  }
  return out;
}

type Props = { width: number; height: number };

export default function ThemeIconBackdrop({ width, height }: Props) {
  const icons = useMemo(() => {
    if (width <= 0 || height <= 0) return [];
    const all: BackdropIcon[] = [];
    for (let r = 0; r < ROWS; r++) all.push(...layoutRow(r, width, height));
    return all;
  }, [width, height]);

  if (!icons.length) return null;
  const used = Array.from(new Set(icons.map((i) => i.id)));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} style={{ opacity: OPACITY }}>
        <Defs>
          {used.map((id) => (
            <G key={id} id={`skbd-${id}`}>
              <Rect x={0} y={0} width={256} height={256} rx={PLATE_RADIUS} fill={PALETTE.petrol} />
              <G transform="translate(28 28) scale(0.78)">
                {THEME_ICONS[id].map((n, i) => renderNode(n, `${id}.${i}`))}
              </G>
            </G>
          ))}
        </Defs>
        {icons.map((i) => (
          <Use
            key={i.key}
            href={`#skbd-${i.id}`}
            transform={`translate(${i.x.toFixed(1)} ${i.y.toFixed(1)}) skewY(${i.skew.toFixed(2)}) scale(${i.scale.toFixed(4)}) translate(-128 -128)`}
          />
        ))}
      </Svg>
      {/* Voile : la barre d'onglets reste sur un fond calme */}
      <LinearGradient
        colors={[alpha(PALETTE.night, 0), alpha(PALETTE.night, 0.8)]}
        style={styles.veilBottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  veilBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
});

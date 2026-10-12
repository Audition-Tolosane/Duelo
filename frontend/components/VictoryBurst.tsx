import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, SharedValue,
} from 'react-native-reanimated';
import { PALETTE, alpha } from '../theme/tokens';

// Éclat de fin de duel : des paillettes partent du titre au moment où il se pose, avec une onde
// de choc. Victoire = jaune / corail / or / crème ; sans-faute = violet (rareté) / jaune / crème.
// Une seule valeur animée pilote toutes les paillettes (pas de rendu React par image).

type Variant = 'victory' | 'flawless';

type Props = {
  /** Centre de l'éclat, en px, dans le repère du parent (overlay en absoluteFill). */
  origin: { x: number; y: number } | null;
  play: boolean;
  variant?: Variant;
};

const COUNT = 40;
const DURATION = 1300;
const RING_DURATION = 700;

const PALETTES: Record<Variant, string[]> = {
  victory: [PALETTE.yellow, PALETTE.coral, PALETTE.gold, PALETTE.yellow, PALETTE.cream],
  flawless: [PALETTE.violet, PALETTE.yellow, PALETTE.violet, PALETTE.cream],
};

// Pseudo-aléatoire déterministe : même éclat à chaque rendu, sans Math.random dans un worklet.
function rnd(i: number, k: number) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

type Shape = 'strip' | 'dot' | 'spark';
type Particle = { angle: number; dist: number; spin: number; rot: number; shape: Shape; color: string };

function makeParticles(variant: Variant): Particle[] {
  const colors = PALETTES[variant];
  return Array.from({ length: COUNT }, (_, i) => ({
    // Réparties sur le cercle, légèrement décalées, avec un biais vers le haut (l'éclat « jaillit »)
    angle: (i / COUNT) * Math.PI * 2 + (rnd(i, 1) - 0.5) * 0.4,
    dist: 110 + rnd(i, 2) * 120,
    spin: (rnd(i, 3) - 0.5) * 540,
    rot: rnd(i, 4) * 360,
    shape: (['strip', 'dot', 'spark'] as Shape[])[i % 3],
    color: colors[i % colors.length],
  }));
}

function Piece({ p, progress }: { p: Particle; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const travel = 1 - Math.pow(1 - t, 3);            // part vite, ralentit
    const x = Math.cos(p.angle) * p.dist * travel;
    const y = Math.sin(p.angle) * p.dist * travel * 0.8 + 70 * t * t; // gravité légère
    const opacity = t === 0 ? 0 : t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
    const scale = t < 0.08 ? 0.5 + (t / 0.08) * 0.5 : 1 - 0.35 * t;
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${p.rot + p.spin * t}deg` }, { scale }],
    };
  });
  return <Animated.View style={[styles.piece, styles[p.shape], { backgroundColor: p.color }, style]} />;
}

export default function VictoryBurst({ origin, play, variant = 'victory' }: Props) {
  const progress = useSharedValue(0);
  const ring = useSharedValue(0);
  const particles = React.useMemo(() => makeParticles(variant), [variant]);

  useEffect(() => {
    if (!play || !origin) return;
    progress.value = 0;
    ring.value = 0;
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.linear });
    ring.value = withTiming(1, { duration: RING_DURATION, easing: Easing.bezier(0.215, 0.61, 0.355, 1) });
  }, [play, origin]);

  const ringColor = variant === 'flawless' ? PALETTE.violet : PALETTE.yellow;
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 || ring.value === 1 ? 0 : 0.8 * (1 - ring.value),
    transform: [{ scale: 0.4 + ring.value * 2.6 }],
  }));

  if (!origin) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.center, { left: origin.x, top: origin.y }]}>
        <Animated.View style={[styles.ring, { borderColor: alpha(ringColor, 0.9) }, ringStyle]} />
        {particles.map((p, i) => <Piece key={i} p={p} progress={progress} />)}
      </View>
    </View>
  );
}

const RING = 120;
const styles = StyleSheet.create({
  center: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3 },
  piece: { position: 'absolute' },
  strip: { width: 5, height: 14, borderRadius: 1.5 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  spark: { width: 8, height: 8, borderRadius: 1.5 },
});

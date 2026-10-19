import React, { useEffect, useId } from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { RADII, BORDER, ELEVATION, PALETTE, alpha } from '../../theme/tokens';

// Surface satinée pétrole : métal anodisé sombre, pas chrome ni verre.
// Matière : dégradé pétrole diagonal, reflet diffus en haut à gauche, deux voiles satin,
// bas légèrement enfoncé. Lumière : arête haute plus claire, liseré qui chauffe vers
// le jaune dans les coins « chauds », lueur très douce qui déborde de ces coins.
// `halo` (hero) : lumière chaude diffuse dans l'angle haut droit ; elle « respire » lentement.

// 'gold' : tout le liseré prend un reflet doré (carte de prestige : rang, niveau)
type Warm = 'none' | 'tr' | 'tr-bl' | 'gold';

type Props = {
  children: React.ReactNode;
  /** 'hero' = carte principale (rayon xl, ombre e2) ; 'card' = carte courante (rayon lg, ombre e1) */
  variant?: 'hero' | 'card';
  /** Coins dont le liseré chauffe vers le jaune */
  warm?: Warm;
  halo?: boolean;
  /** Rayon imposé (tuiles denses) ; sinon celui de la variante */
  radius?: number;
  /** 'event' = liseré corail à gauche (défi reçu), comme Card */
  accent?: 'none' | 'event';
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

const SIZES = {
  hero: { radius: RADII.xl, bloom: 280, glow: 110, sheen: 0.11, elevation: ELEVATION.e2 },
  card: { radius: RADII.lg, bloom: 150, glow: 0, sheen: 0.1, elevation: ELEVATION.e1 },
};
const BREATH = 4200; // une respiration complète du halo (ms)

// Liseré : dégradé diagonal du coin haut droit au coin bas gauche
function rimColors(warm: Warm): [string, string, ...string[]] {
  const hot = PALETTE.yellow;
  const lit = alpha(PALETTE.cream, 0.24);
  const dim = alpha(PALETTE.cream, 0.08);
  if (warm === 'none') return [alpha(PALETTE.cream, 0.2), lit, dim, dim];
  if (warm === 'tr') return [hot, lit, dim, alpha(PALETTE.cream, 0.09)];
  if (warm === 'gold') return [hot, alpha(PALETTE.gold, 0.55), alpha(PALETTE.gold, 0.22), alpha(PALETTE.gold, 0.45)];
  return [hot, lit, dim, alpha(PALETTE.yellow, 0.6)];
}
const RIM_STOPS: [number, number, ...number[]] = [0, 0.26, 0.7, 1];

function Radial({ id, size, stops }: { id: string; size: number; stops: [number, string, number][] }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          {stops.map(([o, c, a]) => <Stop key={o} offset={o} stopColor={c} stopOpacity={a} />)}
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

export default function SatinSurface({
  children, variant = 'hero', warm = 'tr', halo = false, accent = 'none', radius, onPress, testID, accessibilityLabel, style, contentStyle,
}: Props) {
  const s = { ...SIZES[variant], radius: radius ?? SIZES[variant].radius };
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const breath = useSharedValue(0.85);

  useEffect(() => {
    if (!halo || reduceMotion) return;
    breath.value = withRepeat(withTiming(1, { duration: BREATH / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [halo, reduceMotion, breath]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: breath.value }));
  const inner = s.radius - BORDER.hair;
  const corner = (size: number, at: 'tr' | 'bl') => ({
    position: 'absolute' as const, width: size, height: size,
    ...(at === 'tr' ? { top: -size / 2, right: -size / 2 } : { bottom: -size / 2, left: -size / 2 }),
  });
  const warmCorners: ('tr' | 'bl')[] = warm === 'none' ? [] : warm === 'tr-bl' ? ['tr', 'bl'] : ['tr'];

  const body = (pressed: boolean) => (
    <>
      {/* Lueur qui déborde des coins chauds : à peine visible autour de l'arête */}
      {s.glow > 0 && warmCorners.map(at => (
        <View key={`g${at}`} pointerEvents="none" style={corner(s.glow, at)}>
          <Radial id={`satinGlow${at}${uid}`} size={s.glow} stops={[
            [0, PALETTE.gold, at === 'tr' ? 0.22 : 0.12], [0.4, PALETTE.gold, 0.07], [1, PALETTE.gold, 0],
          ]} />
        </View>
      ))}
      {/* Liseré lumineux (1 px) : la carte se dessine dedans */}
      <LinearGradient
        colors={rimColors(warm)}
        locations={RIM_STOPS}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.rim, { borderRadius: s.radius }]}
      >
        <View style={[styles.surface, { borderRadius: inner }, contentStyle]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Fond : pétrole clair en haut à gauche → pétrole → pétrole un peu plus sombre */}
            <LinearGradient
              colors={[PALETTE.petrolLight, PALETTE.petrol, alpha(PALETTE.petrol, 0.92)]}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Reflet diffus : une tache de lumière douce, jamais un reflet blanc net */}
            <View style={[styles.sheen, { width: s.bloom * 1.6, height: s.bloom * 1.6, top: -s.bloom * 0.7, left: -s.bloom * 0.5 }]}>
              <Radial id={`satinSheen${uid}`} size={s.bloom * 1.6} stops={[
                [0, PALETTE.cream, s.sheen], [0.5, PALETTE.cream, s.sheen * 0.35], [1, PALETTE.cream, 0],
              ]} />
            </View>
            {/* Satin : deux voiles de lumière diagonaux */}
            <LinearGradient
              colors={[alpha(PALETTE.cream, 0), alpha(PALETTE.cream, 0.085), alpha(PALETTE.cream, 0.02), alpha(PALETTE.cream, 0.055), alpha(PALETTE.cream, 0)]}
              locations={[0.16, 0.34, 0.5, 0.64, 0.82]}
              start={{ x: 0, y: 0.15 }}
              end={{ x: 1, y: 0.85 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Brillance satinée : une arête de lumière fine et douce dans le voile principal */}
            <LinearGradient
              colors={[alpha(PALETTE.cream, 0), alpha(PALETTE.cream, 0.07), alpha(PALETTE.cream, 0)]}
              locations={[0.27, 0.32, 0.38]}
              start={{ x: 0, y: 0.1 }}
              end={{ x: 1, y: 0.9 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Bas enfoncé : relief sans ombre portée visible */}
            <LinearGradient
              colors={[alpha(PALETTE.night, 0), alpha(PALETTE.night, 0.36)]}
              locations={[0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Chaleur intérieure dans les coins chauds */}
            {warmCorners.map(at => {
              const size = at === 'tr' && halo ? s.bloom : s.bloom * 0.8;
              const stops: [number, string, number][] = at === 'tr' && halo
                ? [[0, PALETTE.yellow, 0.36], [0.3, PALETTE.gold, 0.17], [0.65, PALETTE.gold, 0.04], [1, PALETTE.gold, 0]]
                : [[0, PALETTE.yellow, at === 'tr' ? 0.16 : 0.1], [0.4, PALETTE.gold, 0.05], [1, PALETTE.gold, 0]];
              const content = <Radial id={`satinBloom${at}${uid}`} size={size} stops={stops} />;
              return at === 'tr' && halo
                ? <Animated.View key={at} style={[corner(size, at), haloStyle]}>{content}</Animated.View>
                : <View key={at} style={corner(size, at)}>{content}</View>;
            })}
            {/* Arête haute : la lumière accroche le bord supérieur */}
            <LinearGradient
              colors={[alpha(PALETTE.cream, 0.08), alpha(PALETTE.cream, 0.3), alpha(warm === 'none' ? PALETTE.cream : PALETTE.yellow, 0.22)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topEdge}
            />
            {accent === 'event' ? <View style={styles.event} /> : null}
            {pressed ? <View style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
          </View>
          {children}
        </View>
      </LinearGradient>
    </>
  );

  const shell = [styles.shell, { borderRadius: s.radius }, s.elevation, style];
  if (!onPress) return <View testID={testID} style={shell}>{body(false)}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={shell}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Coque : porte l'ombre (la surface rogne son décor, ce qui couperait l'ombre sur iOS)
  shell: { backgroundColor: PALETTE.petrol },
  rim: { padding: BORDER.hair },
  surface: { overflow: 'hidden', backgroundColor: PALETTE.petrol },
  sheen: { position: 'absolute' },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  pressed: { backgroundColor: alpha(PALETTE.cream, 0.05) },
  event: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, backgroundColor: PALETTE.coral },
});

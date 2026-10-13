import React, { useEffect, useId } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { COLOR, RADII, BORDER, ELEVATION, PALETTE, alpha } from '../../theme/tokens';

// Surface satinée pétrole : carte principale d'un écran (une seule par écran).
// Lumière venue du haut : liseré supérieur plus clair, bas légèrement assombri,
// deux voiles de lumière diagonaux très faibles (satin, pas chrome ni verre).
// `halo` : lumière jaune chaude, diffuse, dans l'angle haut droit ; elle « respire » lentement.

const HALO = 260;           // diamètre du halo (px), centré sur l'angle haut droit
const BREATH = 4200;        // une respiration complète (ms)

type Props = {
  children: React.ReactNode;
  halo?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function SatinSurface({ children, halo = false, style, contentStyle }: Props) {
  const reduceMotion = useReducedMotion();
  const gradId = `satinHalo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const breath = useSharedValue(0.85);

  useEffect(() => {
    if (!halo || reduceMotion) return;
    breath.value = withRepeat(withTiming(1, { duration: BREATH / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [halo, reduceMotion, breath]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.surface, contentStyle]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={[PALETTE.petrolLight, PALETTE.petrol, PALETTE.petrol]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Satin : deux bandes de lumière diffuses, à peine perceptibles */}
          <LinearGradient
            colors={[alpha(PALETTE.cream, 0), alpha(PALETTE.cream, 0.05), alpha(PALETTE.cream, 0), alpha(PALETTE.cream, 0.03), alpha(PALETTE.cream, 0)]}
            locations={[0.2, 0.38, 0.52, 0.68, 0.84]}
            start={{ x: 0, y: 0.15 }}
            end={{ x: 1, y: 0.85 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Le bas de la carte s'enfonce un peu : relief sans ombre portée visible */}
          <LinearGradient
            colors={[alpha(PALETTE.night, 0), alpha(PALETTE.night, 0.28)]}
            locations={[0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          {halo ? (
            <Animated.View style={[styles.halo, haloStyle]}>
              <Svg width={HALO} height={HALO}>
                <Defs>
                  <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={PALETTE.yellow} stopOpacity={0.36} />
                    <Stop offset="0.3" stopColor={PALETTE.gold} stopOpacity={0.17} />
                    <Stop offset="0.65" stopColor={PALETTE.gold} stopOpacity={0.04} />
                    <Stop offset="1" stopColor={PALETTE.gold} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={HALO} height={HALO} fill={`url(#${gradId})`} />
              </Svg>
            </Animated.View>
          ) : null}
          {/* Liseré haut : la lumière accroche l'arête supérieure */}
          <LinearGradient
            colors={[alpha(PALETTE.cream, 0.04), alpha(PALETTE.cream, 0.22), alpha(halo ? PALETTE.yellow : PALETTE.cream, 0.18)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rim}
          />
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Coque : porte l'ombre (la surface rogne son décor, ce qui couperait l'ombre sur iOS)
  shell: { borderRadius: RADII.xl, backgroundColor: COLOR.surface.card, ...ELEVATION.e2 },
  surface: {
    borderRadius: RADII.xl,
    borderWidth: BORDER.hair,
    borderColor: alpha(PALETTE.cream, 0.07),
    borderTopColor: alpha(PALETTE.cream, 0.14),
    overflow: 'hidden',
  },
  halo: { position: 'absolute', top: -HALO / 2, right: -HALO / 2, width: HALO, height: HALO },
  rim: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});

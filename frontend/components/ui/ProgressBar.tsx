import React, { useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion } from 'react-native-reanimated';
import { COLOR, RADII, PALETTE, alpha } from '../../theme/tokens';

type Props = {
  /** 0 → 1 */
  value: number;
  tone?: 'action' | 'reward' | 'success' | 'warm';
  height?: number;
  /** Barre vedette (XP de l'Accueil) : remplissage satiné, léger halo, remplissage animé à l'arrivée */
  sheen?: boolean;
  style?: StyleProp<ViewStyle>;
};

const FILL = {
  action: COLOR.action.primary,
  reward: COLOR.reward.gold,
  success: COLOR.status.success,
  warm: COLOR.accent.warm,
};

const FILL_IN = 900; // ms

// Barre unique (XP, niveau, missions) : piste crème 12 %, remplissage plein.
// Variante `sheen` réservée à une seule barre par écran.
export default function ProgressBar({ value, tone = 'action', height = 8, sheen = false, style }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = FILL[tone];
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(sheen && !reduceMotion ? 0 : pct);

  useEffect(() => {
    width.value = sheen && !reduceMotion ? withTiming(pct, { duration: FILL_IN, easing: Easing.out(Easing.cubic) }) : pct;
  }, [pct, sheen, reduceMotion, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.track, sheen && styles.trackOpen, { height, borderRadius: height / 2 }, style]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, borderRadius: height / 2 },
          sheen && { boxShadow: `0 0 10px ${alpha(color, 0.45)}` },
          fillStyle,
        ]}
      >
        {sheen ? (
          <LinearGradient
            colors={[alpha(PALETTE.cream, 0.45), alpha(PALETTE.cream, 0)]}
            locations={[0, 0.6]}
            style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: COLOR.track, overflow: 'hidden', borderRadius: RADII.xs },
  trackOpen: { overflow: 'visible' }, // laisse passer le halo du remplissage
  fill: { height: '100%', overflow: 'hidden' },
});

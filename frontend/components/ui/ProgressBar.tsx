import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLOR, RADII } from '../../theme/tokens';

type Props = {
  /** 0 → 1 */
  value: number;
  tone?: 'action' | 'reward' | 'success' | 'warm';
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const FILL = {
  action: COLOR.action.primary,
  reward: COLOR.reward.gold,
  success: COLOR.status.success,
  warm: COLOR.accent.warm,
};

// Barre unique (XP, niveau, missions) : piste crème 12 %, remplissage plein, sans dégradé.
export default function ProgressBar({ value, tone = 'action', height = 8, style }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: FILL[tone], borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: COLOR.track, overflow: 'hidden', borderRadius: RADII.xs },
  fill: { height: '100%' },
});

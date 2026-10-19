import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLOR } from '../../theme/tokens';

type Props = {
  /** 0 → 1 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: 'action' | 'reward' | 'success' | 'warm';
  /** Contenu centré (icône, chiffre) */
  children?: React.ReactNode;
};

const ARC = {
  action: COLOR.action.primary,
  reward: COLOR.reward.gold,
  success: COLOR.status.success,
  warm: COLOR.accent.warm,
};

// Anneau de progression compact (missions) : même piste que ProgressBar, arc plein à bouts ronds.
export default function ProgressRing({ value, size = 44, stroke = 3, tone = 'action', children }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLOR.track} strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ARC[tone]}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

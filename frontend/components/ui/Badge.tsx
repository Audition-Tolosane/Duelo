import React from 'react';
import { View, StyleSheet } from 'react-native';
import Txt from './Txt';
import { COLOR, RADII, SPACE } from '../../theme/tokens';

type Tone = 'warm' | 'action' | 'reward' | 'rare' | 'neutral' | 'success';

type Props =
  | { count: number; label?: never; tone?: Tone }
  | { label: string; count?: never; tone?: Tone };

const BG: Record<Tone, string> = {
  warm: COLOR.accent.warm,
  action: COLOR.action.primary,
  reward: COLOR.reward.gold,
  rare: COLOR.accent.rare,
  neutral: COLOR.surface.elevated,
  success: COLOR.status.success,
};

// Pastille de compteur (corail par défaut : un événement attend le joueur) ou étiquette courte.
export default function Badge(props: Props) {
  const tone = props.tone ?? 'warm';
  const fg = tone === 'neutral' ? COLOR.text.primary : COLOR.text.onAction;
  if (typeof props.count === 'number') {
    const txt = props.count > 99 ? '99+' : String(props.count);
    return (
      <View style={[styles.count, { backgroundColor: BG[tone] }]}>
        <Txt variant="micro" color={fg}>{txt}</Txt>
      </View>
    );
  }
  return (
    <View style={[styles.label, { backgroundColor: BG[tone] }]}>
      <Txt variant="overline" color={fg}>{props.label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  label: { alignSelf: 'flex-start', paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADII.sm },
});

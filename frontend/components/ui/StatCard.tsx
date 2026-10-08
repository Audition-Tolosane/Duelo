import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Txt from './Txt';
import Icon, { IconName } from './Icon';
import { COLOR, RADII, SPACE } from '../../theme/tokens';

type Tone = 'neutral' | 'action' | 'warm' | 'reward' | 'success';

const TONE: Record<Tone, string> = {
  neutral: COLOR.text.primary,
  action: COLOR.action.primary,
  warm: COLOR.accent.warm,
  reward: COLOR.reward.gold,
  success: COLOR.status.success,
};

type Props = {
  value: string | number;
  label: string;
  icon?: IconName;
  tone?: Tone;
  size?: 'md' | 'lg';
  /** 'plain' = sans fond (dans une rangée de stats posée sur une Card). */
  appearance?: 'card' | 'plain';
  style?: StyleProp<ViewStyle>;
};

// Chiffre tabulaire + libellé. Une rangée de StatCard 'plain' dans UNE Card plutôt que 4 petites cartes.
export default function StatCard({ value, label, icon, tone = 'neutral', size = 'md', appearance = 'card', style }: Props) {
  return (
    <View style={[styles.base, appearance === 'card' && styles.card, style]}>
      <View style={styles.valueRow}>
        {icon ? <Icon name={icon} size={18} color={TONE[tone]} /> : null}
        <Txt variant={size === 'lg' ? 'statLarge' : 'statMedium'} color={TONE[tone]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Txt>
      </View>
      <Txt variant="overline" numberOfLines={2}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, gap: SPACE.xs, alignItems: 'flex-start' },
  card: { backgroundColor: COLOR.surface.card, borderRadius: RADII.lg, padding: SPACE.md, borderWidth: 1, borderColor: COLOR.border.subtle },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});

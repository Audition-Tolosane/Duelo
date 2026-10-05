import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Txt from './Txt';
import Icon, { IconName } from './Icon';
import { COLOR, RADII, SIZE, SPACE, BORDER } from '../../theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Puce de filtre / de choix : actif = jaune plein (texte nuit), inactif = pétrole.
export default function Chip({ label, selected, onPress, icon, testID, style }: Props) {
  const fg = selected ? COLOR.text.onAction : COLOR.text.secondary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => { Haptics.selectionAsync(); onPress?.(); }}
      style={({ pressed }) => [styles.base, selected && styles.selected, pressed && !selected && styles.pressed, style]}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Txt variant="label" color={fg} numberOfLines={1}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: SIZE.chip,
    paddingHorizontal: SPACE.md,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
  },
  selected: { backgroundColor: COLOR.action.primary, borderColor: COLOR.action.primary },
  pressed: { backgroundColor: COLOR.surface.elevated },
});

import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLOR, RADII, SPACE, BORDER, ELEVATION } from '../../theme/tokens';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  /** 'event' = liseré corail à gauche (défi reçu, événement) ; 'selected' = bordure jaune. */
  accent?: 'none' | 'event' | 'selected' | 'reward';
  padded?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Surface pétrole unique. Règle : JAMAIS de Card dans une Card (pas de vignettes dans des vignettes).
export default function Card({ children, onPress, accent = 'none', padded = true, testID, style }: Props) {
  const content = [
    styles.base,
    padded && styles.padded,
    accent === 'event' && styles.event,
    accent === 'selected' && styles.selected,
    accent === 'reward' && styles.reward,
    style,
  ];
  if (!onPress) return <View testID={testID} style={content}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...content, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLOR.surface.card,
    borderRadius: RADII.lg,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    overflow: 'hidden',
    ...ELEVATION.e1,
  },
  padded: { padding: SPACE.cardPad },
  event: { borderLeftWidth: 3, borderLeftColor: COLOR.accent.warm },
  selected: { borderWidth: BORDER.strong, borderColor: COLOR.border.active },
  reward: { borderWidth: BORDER.default, borderColor: COLOR.reward.gold },
  pressed: { backgroundColor: COLOR.surface.elevated },
});

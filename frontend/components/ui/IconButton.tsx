import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon, { IconName } from './Icon';
import Badge from './Badge';
import { COLOR, SIZE, ICON_SIZE } from '../../theme/tokens';

type Props = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  /** Pastille de compteur (notifications, messages). */
  count?: number;
  active?: boolean;
  /** 'filled' = disque crème 6 % (par défaut) ; 'bare' = icône seule. */
  appearance?: 'filled' | 'bare';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Cible tactile de 44 px garantie.
export default function IconButton({ icon, onPress, accessibilityLabel, count, active, appearance = 'filled', testID, style }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
      style={({ pressed }) => [styles.base, appearance === 'filled' && styles.filled, pressed && styles.pressed, style]}
    >
      <Icon name={icon} size={ICON_SIZE.md} color={active ? COLOR.action.primary : COLOR.text.primary} />
      {count ? (
        <View style={styles.badge}><Badge count={count} /></View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: COLOR.action.ghost },
  pressed: { opacity: 0.7 },
  badge: { position: 'absolute', top: 2, right: 2 },
});

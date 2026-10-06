import React from 'react';
import { Pressable, View, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Txt from './Txt';
import Icon, { IconName } from './Icon';
import { COLOR, RADII, SIZE, SPACE, BORDER, ELEVATION } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Un seul bouton pour toute l'app.
// primary = jaune plein (LA couleur d'action) · secondary = pétrole clair ·
// ghost = crème 6 % (Annuler, Retour, Refuser) · danger = ghost avec texte rouge (suppression).
const BG: Record<Variant, string> = {
  primary: COLOR.action.primary,
  secondary: COLOR.action.secondary,
  ghost: COLOR.action.ghost,
  danger: COLOR.action.ghost,
};
const FG: Record<Variant, string> = {
  primary: COLOR.text.onAction,
  secondary: COLOR.text.primary,
  ghost: COLOR.text.primary,
  danger: COLOR.status.errorText,
};
const HEIGHT: Record<Size, number> = { sm: SIZE.buttonSm, md: SIZE.button, lg: SIZE.buttonLg };

export default function Button({
  label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, fullWidth, haptic = true, testID, style,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        if (haptic) Haptics.impactAsync(variant === 'primary' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], backgroundColor: pressed && variant === 'primary' ? COLOR.action.primaryPressed : BG[variant] },
        variant === 'primary' && ELEVATION.e2,
        (variant === 'ghost' || variant === 'danger') && styles.outlined,
        fullWidth && styles.full,
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={FG[variant]} /> : null}
          <Txt variant={size === 'sm' ? 'buttonSmall' : 'button'} color={FG[variant]} numberOfLines={1}>{label}</Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADII.md,
    paddingHorizontal: SPACE.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: { borderWidth: BORDER.hair, borderColor: COLOR.border.default },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  pressed: { transform: [{ scale: 0.98 }] },
  inactive: { opacity: 0.4 },
});

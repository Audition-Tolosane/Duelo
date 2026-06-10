import React from 'react';
import { Text, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScalePressable from './ScalePressable';
import { COLORS, RADIUS } from '../theme/tokens';
import { FONTS } from '../theme/fonts';

type DuelButtonProps = {
  label: string;
  onPress?: () => void;
  // gradient = CTA principal cyan→violet · white = CTA secondaire · ghost = glass
  variant?: 'gradient' | 'white' | 'ghost';
  size?: 'md' | 'sm';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function DuelButton({
  label, onPress, variant = 'gradient', size = 'md', disabled = false, style,
}: DuelButtonProps) {
  const sizeStyle = size === 'sm' ? styles.bodySm : styles.bodyMd;
  const textStyle = size === 'sm' ? styles.textSm : styles.textMd;

  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled}
      style={[variant === 'gradient' && styles.glow, disabled && styles.disabled, style]}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={[COLORS.cyan, COLORS.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.body, sizeStyle]}
        >
          <Text style={[textStyle, styles.textGradient]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.body, sizeStyle,
            variant === 'white' ? styles.bodyWhite : styles.bodyGhost,
          ]}
        >
          <Text style={[textStyle, variant === 'white' ? styles.textWhiteBg : styles.textGhost]}>
            {label}
          </Text>
        </View>
      )}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md + 2,
  },
  bodyMd: { paddingVertical: 18, paddingHorizontal: 28 },
  bodySm: { paddingVertical: 13, paddingHorizontal: 24, borderRadius: RADIUS.md - 2 },
  bodyWhite: { backgroundColor: COLORS.white },
  bodyGhost: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.strokeStrong,
  },
  glow: {
    shadowColor: COLORS.cyan,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  disabled: { opacity: 0.4 },
  textMd: {
    fontFamily: FONTS.display.bold,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textSm: {
    fontFamily: FONTS.display.bold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  textGradient: { color: '#000000' },
  textWhiteBg: { color: COLORS.abyss, textTransform: 'none', letterSpacing: -0.2 },
  textGhost: { color: COLORS.white },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Txt from './Txt';
import { COLOR } from '../../theme/tokens';

type Props = { size?: 'sm' | 'md' | 'lg' };

const FONT: Record<NonNullable<Props['size']>, number> = { sm: 20, md: 26, lg: 44 };

// Logotype SKILKI provisoire (typographique) en attendant le logo définitif :
// crème, point jaune final = la touche d'action de la marque.
export default function Wordmark({ size = 'md' }: Props) {
  const fs = FONT[size];
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="SKILKI">
      <Txt variant="h1" color={COLOR.text.primary} style={{ fontSize: fs, lineHeight: fs * 1.1, letterSpacing: fs * -0.03 }}>
        SKILKI
      </Txt>
      <View style={[styles.dot, { width: fs * 0.24, height: fs * 0.24, borderRadius: fs * 0.12, marginBottom: fs * 0.14 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  dot: { backgroundColor: COLOR.action.primary },
});

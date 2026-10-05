import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Txt from './Txt';
import { COLOR, SPACE } from '../../theme/tokens';

// Chargement unique : indicateur crème, message optionnel. Remplace les 8 couleurs d'ActivityIndicator.
export default function Loader({ label, fill = false }: { label?: string; fill?: boolean }) {
  return (
    <View style={[styles.base, fill && styles.fill]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={COLOR.text.primary} />
      {label ? <Txt variant="bodySmall" align="center">{label}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', gap: SPACE.md, padding: SPACE.xl },
  fill: { flex: 1 },
});

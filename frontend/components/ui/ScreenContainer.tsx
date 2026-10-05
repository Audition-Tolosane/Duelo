import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOR, GRADIENTS } from '../../theme/tokens';

type Props = {
  children: React.ReactNode;
  /** Ambiance : léger halo pétrole en haut (défaut) ou fond uni. */
  ambient?: boolean;
  /** Applique les marges de sécurité haut / bas. */
  safeTop?: boolean;
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Fond unique de tous les écrans SKILKI : nuit pétrole opaque (remplace CosmicBackground et #050510).
export default function ScreenContainer({ children, ambient = true, safeTop = false, safeBottom = false, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, safeTop && { paddingTop: insets.top }, safeBottom && { paddingBottom: insets.bottom }, style]}>
      {ambient ? (
        <LinearGradient
          colors={GRADIENTS.screen.colors}
          locations={GRADIENTS.screen.locations}
          style={styles.ambient}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg.primary },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
});

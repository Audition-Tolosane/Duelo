import React, { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Icon, { IconName } from './Icon';
import { alpha } from '../../theme/tokens';

type Props = {
  name: IconName;
  /** Couleur de l'icône, du disque teinté et du halo */
  color: string;
  size?: number;
};

// Icône dans un disque teinté, entourée d'un halo doux de sa couleur (série, récompense).
// Le halo déborde du disque sans en changer l'encombrement.
export default function HaloIcon({ name, color, size = 40 }: Props) {
  const gradId = `haloIcon${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const glow = size * 1.9;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={glow} height={glow} style={[styles.glow, { top: (size - glow) / 2, left: (size - glow) / 2 }]} pointerEvents="none">
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0.45" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${gradId})`} />
      </Svg>
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.32) }]}>
        <Icon name={name} size={Math.round(size * 0.5)} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
  disc: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

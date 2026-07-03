import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

// Épées croisées du design handoff (primitives.jsx) — gradient cyan→violet
// par défaut, ou couleur unie via `color` (ex. '#FFF' pour un filigrane).
type SwordMarkProps = {
  size?: number;
  color?: string; // couleur unie ; si absente → gradient marque
};

export default function SwordMark({ size = 40, color }: SwordMarkProps) {
  const gradId = `swordGrad${size}`;
  const fill = color || `url(#${gradId})`;
  const pommel = color || '#FFB547';

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {!color && (
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#00E5FF" />
            <Stop offset="1" stopColor="#B366FF" />
          </LinearGradient>
        </Defs>
      )}
      <Path d="M8 8 L20 20 L18 22 L6 10 Z" fill={fill} />
      <Path d="M32 8 L20 20 L22 22 L34 10 Z" fill={fill} />
      <Path d="M14 26 L20 20 L26 26 L22 30 L20 30 L18 30 Z" fill={fill} opacity={0.8} />
      <Circle cx={20} cy={20} r={3} fill={pommel} />
    </Svg>
  );
}

import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLOR } from '../theme/tokens';

// Épées croisées SKILKI : couleur unie (crème par défaut, ou `color`), pommeau or quand la
// couleur n'est pas imposée. Plus de dégradé de marque : la palette SKILKI ne mélange pas les teintes.
type SwordMarkProps = {
  size?: number;
  color?: string; // couleur unie des lames et du pommeau ; par défaut crème + pommeau or
};

export default function SwordMark({ size = 40, color }: SwordMarkProps) {
  const fill = color || COLOR.text.primary;
  const pommel = color || COLOR.reward.gold;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path d="M8 8 L20 20 L18 22 L6 10 Z" fill={fill} />
      <Path d="M32 8 L20 20 L22 22 L34 10 Z" fill={fill} />
      <Path d="M14 26 L20 20 L26 26 L22 30 L20 30 L18 30 Z" fill={fill} opacity={0.8} />
      <Circle cx={20} cy={20} r={3} fill={pommel} />
    </Svg>
  );
}

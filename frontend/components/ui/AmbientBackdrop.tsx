import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { PALETTE } from '../../theme/tokens';

// Fond d'ambiance d'un écran : nappes de lumière pétrole très diffuses sur le fond nuit,
// et une chaleur à peine perceptible en haut à droite. Aucun motif, aucune forme lisible.
const POOLS: { id: string; cx: string; cy: string; r: string; color: string; a: number }[] = [
  { id: 'ambA', cx: '8%', cy: '6%', r: '60%', color: PALETTE.petrolLight, a: 0.3 },
  { id: 'ambB', cx: '100%', cy: '48%', r: '50%', color: PALETTE.petrolLight, a: 0.16 },
  { id: 'ambC', cx: '92%', cy: '20%', r: '32%', color: PALETTE.gold, a: 0.05 },
  { id: 'ambD', cx: '0%', cy: '92%', r: '45%', color: PALETTE.petrol, a: 0.35 },
];

export default function AmbientBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {POOLS.map(p => (
            <RadialGradient key={p.id} id={p.id} cx={p.cx} cy={p.cy} r={p.r} fx={p.cx} fy={p.cy}>
              <Stop offset="0" stopColor={p.color} stopOpacity={p.a} />
              <Stop offset="1" stopColor={p.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {POOLS.map(p => <Rect key={p.id} x={0} y={0} width="100%" height="100%" fill={`url(#${p.id})`} />)}
      </Svg>
    </View>
  );
}

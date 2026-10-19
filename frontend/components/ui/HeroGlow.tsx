import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path } from 'react-native-svg';
import { PALETTE } from '../../theme/tokens';

// Décor d'en-tête : nappe de lumière pétrole et deux courbes lumineuses or, très fines.
// Purement décoratif (pointerEvents none) ; à placer en absolu derrière un en-tête de page.
// Le dessin s'étire sur la largeur (viewBox 390×340, preserveAspectRatio none).

const W = 390;
const H = 340;

export default function HeroGlow({ height = H }: { height?: number }) {
  return (
    <View style={[styles.box, { height }]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="hgPool" cx="50%" cy="34%" r="52%">
            <Stop offset="0" stopColor={PALETTE.petrolLight} stopOpacity={0.4} />
            <Stop offset="1" stopColor={PALETTE.petrolLight} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hgWarm" cx="18%" cy="42%" r="30%">
            <Stop offset="0" stopColor={PALETTE.gold} stopOpacity={0.12} />
            <Stop offset="1" stopColor={PALETTE.gold} stopOpacity={0} />
          </RadialGradient>
          {/* Courbes : s'allument au centre, s'éteignent vers les bords */}
          <LinearGradient id="hgLine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={PALETTE.gold} stopOpacity={0} />
            <Stop offset="0.3" stopColor={PALETTE.yellow} stopOpacity={0.5} />
            <Stop offset="0.55" stopColor={PALETTE.gold} stopOpacity={0.18} />
            <Stop offset="0.85" stopColor={PALETTE.gold} stopOpacity={0.3} />
            <Stop offset="1" stopColor={PALETTE.gold} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="hgLineSoft" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={PALETTE.cream} stopOpacity={0} />
            <Stop offset="0.5" stopColor={PALETTE.cream} stopOpacity={0.1} />
            <Stop offset="1" stopColor={PALETTE.cream} stopOpacity={0} />
          </LinearGradient>
          {/* Voile sous la courbe principale : la lumière « coule » vers le bas */}
          <LinearGradient id="hgSheet" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={PALETTE.gold} stopOpacity={0.07} />
            <Stop offset="1" stopColor={PALETTE.gold} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#hgPool)" />
        <Rect x={0} y={0} width={W} height={H} fill="url(#hgWarm)" />
        <Path d="M0 150 C 70 120, 120 165, 200 205 S 330 230, 390 200 L 390 340 L 0 340 Z" fill="url(#hgSheet)" />
        <Path d="M0 150 C 70 120, 120 165, 200 205 S 330 230, 390 200" stroke="url(#hgLine)" strokeWidth={1.4} fill="none" />
        <Path d="M0 185 C 90 165, 150 215, 230 240 S 350 245, 390 230" stroke="url(#hgLineSoft)" strokeWidth={1} fill="none" />
        <Path d="M20 110 C 110 90, 180 140, 260 150 S 360 130, 390 120" stroke="url(#hgLineSoft)" strokeWidth={0.8} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', top: 0, left: 0, right: 0 },
});

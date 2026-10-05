import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Txt from './ui/Txt';
import { COLOR } from '../theme/tokens';

type RoundTimerProps = {
  timeLeft: number;
  total?: number;
  size?: number;
  // En dessous : anneau rouge + pulsation
  urgentThreshold?: number;
  // En dessous : anneau corail (alerte, sans pulsation)
  warnThreshold?: number;
  // Couleur de l'anneau hors zones d'alerte (crème par défaut)
  color?: string;
};

const RING_STROKE = 4;

// Timer rond du quiz : anneau crème → corail sous 5 s → rouge pulsé sous 3 s.
// Le chiffre est tabulaire pour ne pas « danser » d'une seconde à l'autre.
export default function RoundTimer({
  timeLeft, total = 10, size = 86, urgentThreshold = 3, warnThreshold = 5, color: baseColor = COLOR.text.primary,
}: RoundTimerProps) {
  const r = size / 2 - RING_STROKE;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - timeLeft / total);
  const urgent = timeLeft <= urgentThreshold;
  const warn = timeLeft <= warnThreshold;
  const color = urgent ? COLOR.status.error : warn ? COLOR.accent.warm : baseColor;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (urgent) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [urgent]);

  return (
    <Animated.View
      accessibilityRole="timer"
      accessibilityLabel={String(timeLeft)}
      style={{ width: size, height: size, transform: [{ scale: pulseAnim }] }}
    >
      <View style={[StyleSheet.absoluteFill, styles.ring]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLOR.track} strokeWidth={RING_STROKE} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={RING_STROKE} fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </Svg>
      </View>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Txt variant={size >= 80 ? 'score' : 'statMedium'} color={color}>{timeLeft}</Txt>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { transform: [{ rotate: '-90deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
});

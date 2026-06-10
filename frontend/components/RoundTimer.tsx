import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../theme/tokens';
import { FONTS } from '../theme/fonts';

type RoundTimerProps = {
  timeLeft: number;
  total?: number;
  size?: number;
  // En dessous : anneau rouge + pulse
  urgentThreshold?: number;
};

// Timer rond du quiz : anneau SVG cyan → rouge + pulse en zone urgente
export default function RoundTimer({
  timeLeft, total = 10, size = 86, urgentThreshold = 3,
}: RoundTimerProps) {
  const r = size / 2 - 9;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - timeLeft / total);
  const urgent = timeLeft <= urgentThreshold;
  const color = urgent ? COLORS.red : COLORS.cyan;
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
    <Animated.View style={{ width: size, height: size, transform: [{ scale: pulseAnim }] }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, transform: [{ rotate: '-90deg' }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.stroke} strokeWidth="4" fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="4" fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </Svg>
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                     alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontWeight: '900', fontSize: 28, color, lineHeight: 32, fontFamily: FONTS.display.bold }}>{timeLeft}</Text>
        <Text style={{ fontSize: 8, color: COLORS.dim3, letterSpacing: 1, fontFamily: FONTS.mono.regular }}>SEC</Text>
      </View>
    </Animated.View>
  );
}

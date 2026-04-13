/**
 * Daily spin wheel modal.
 * Shows a 6-segment SVG wheel, animates a spin, then shows a celebration.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, withTiming, useAnimatedStyle, Easing, runOnJS,
} from 'react-native-reanimated';
import Svg, { Path, Text as SvgText, Circle, G, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SW } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(SW - 48, 300);
const CX = WHEEL_SIZE / 2;
const CY = WHEEL_SIZE / 2;
const R = WHEEL_SIZE / 2 - 4;
const N = 6;
const SEG_DEG = 360 / N;

export const SPIN_REWARDS = [
  { type: 'xp',    value: 50,  label: '50 XP',    color: '#6A0DAD', textColor: '#E8D5FF', icon: '⚡'  },
  { type: 'xp',    value: 100, label: '100 XP',   color: '#0077AA', textColor: '#B3E8FF', icon: '✨'  },
  { type: 'xp',    value: 200, label: '200 XP',   color: '#CC4400', textColor: '#FFD5C2', icon: '🔥'  },
  { type: 'xp',    value: 500, label: '500 XP',   color: '#8B6914', textColor: '#FFD700', icon: '💎'  },
  { type: 'boost', value: 15,  label: 'Boost ×2', color: '#005533', textColor: '#00FF9D', icon: '⚡×2'},
  { type: 'theme', value: 24,  label: 'Thème 24h',color: '#770022', textColor: '#FF69B4', icon: '🎭'  },
];

// SVG path for segment i (pie slice)
function slicePath(i: number): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startAngle = toRad(i * SEG_DEG - 90); // -90 so segment 0 starts at top
  const endAngle = toRad((i + 1) * SEG_DEG - 90);
  const x1 = CX + R * Math.cos(startAngle);
  const y1 = CY + R * Math.sin(startAngle);
  const x2 = CX + R * Math.cos(endAngle);
  const y2 = CY + R * Math.sin(endAngle);
  return `M${CX},${CY} L${x1},${y1} A${R},${R},0,0,1,${x2},${y2} Z`;
}

// Center of a segment for label positioning
function labelCenter(i: number): { x: number; y: number; rotation: number } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const midDeg = (i + 0.5) * SEG_DEG - 90;
  const midRad = toRad(midDeg);
  const dist = R * 0.62;
  // Rotate text so it reads from center outward; flip upside-down segments
  let textRot = midDeg + 90;
  if (textRot > 90 && textRot <= 270) textRot += 180;
  return {
    x: CX + dist * Math.cos(midRad),
    y: CY + dist * Math.sin(midRad),
    rotation: textRot,
  };
}

type SpinResult = {
  reward: {
    type: string; value: number; label: string;
    icon: string; color: string; segment_index: number;
  };
  applied: Record<string, any>;
};

type Props = {
  visible: boolean;
  onClose: (spinDone: boolean) => void;
};

export default function SpinWheelModal({ visible, onClose }: Props) {
  const rotation = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const confettiRef = useRef<any>(null);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const onSpinComplete = useCallback((res: SpinResult) => {
    setResult(res);
    setSpinning(false);
    setShowResult(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => confettiRef.current?.start(), 100);
  }, []);

  const startSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await authFetch(`${API_URL}/api/spin/claim`, { method: 'POST' });
      if (!res.ok) { setSpinning(false); return; }
      const data: SpinResult = await res.json();
      const segIdx = data.reward.segment_index;
      // Segment segIdx center is at: segIdx*60+30 degrees from top (clockwise)
      // To bring it under pointer (top): rotate wheel clockwise by (360 - (segIdx*60+30)) % 360
      const landOffset = (360 - (segIdx * SEG_DEG + SEG_DEG / 2)) % 360;
      const finalAngle = rotation.value % 360 + 5 * 360 + landOffset;
      rotation.value = withTiming(finalAngle, {
        duration: 3200,
        easing: Easing.out(Easing.cubic),
      }, (finished) => { if (finished) runOnJS(onSpinComplete)(data); });
    } catch {
      setSpinning(false);
    }
  };

  const handleClose = (done: boolean) => {
    setShowResult(false);
    setResult(null);
    rotation.value = rotation.value % 360; // keep visual position, don't reset
    onClose(done);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => handleClose(false)}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>🎡 {t('spin.title')}</Text>
          <Text style={s.subtitle}>{t('spin.sub')}</Text>

          {/* Wheel + pointer */}
          <View style={s.wheelContainer}>
            {/* Triangle pointer pointing down at top center */}
            <View style={s.pointerWrap}>
              <View style={s.pointer} />
            </View>

            <Animated.View style={[{ width: WHEEL_SIZE, height: WHEEL_SIZE }, wheelStyle]}>
              <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
                {SPIN_REWARDS.map((seg, i) => {
                  const lc = labelCenter(i);
                  return (
                    <G key={i}>
                      <Path d={slicePath(i)} fill={seg.color} stroke="#050510" strokeWidth={2.5} />
                      <SvgText
                        x={lc.x} y={lc.y - 7}
                        fill={seg.textColor}
                        fontSize={9} fontWeight="bold"
                        textAnchor="middle"
                        transform={`rotate(${lc.rotation}, ${lc.x}, ${lc.y})`}
                      >
                        {seg.icon}
                      </SvgText>
                      <SvgText
                        x={lc.x} y={lc.y + 7}
                        fill={seg.textColor}
                        fontSize={8} fontWeight="700"
                        textAnchor="middle"
                        transform={`rotate(${lc.rotation}, ${lc.x}, ${lc.y})`}
                      >
                        {seg.label}
                      </SvgText>
                    </G>
                  );
                })}
                {/* Divider lines */}
                {SPIN_REWARDS.map((_, i) => {
                  const angleDeg = i * SEG_DEG - 90;
                  const angleRad = (angleDeg * Math.PI) / 180;
                  return (
                    <Line
                      key={`line-${i}`}
                      x1={CX} y1={CY}
                      x2={CX + R * Math.cos(angleRad)}
                      y2={CY + R * Math.sin(angleRad)}
                      stroke="#050510" strokeWidth={2}
                    />
                  );
                })}
                {/* Center hub */}
                <Circle cx={CX} cy={CY} r={26} fill="#050510" />
                <Circle cx={CX} cy={CY} r={20} fill="#1A0033" stroke="#8A2BE2" strokeWidth={2} />
              </Svg>
            </Animated.View>
          </View>

          {/* Spin button */}
          {!showResult && (
            <TouchableOpacity
              style={s.spinBtn}
              onPress={startSpin}
              disabled={spinning}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={spinning ? ['#2A2A2A', '#1A1A1A'] : ['#8A2BE2', '#6A1FB0']}
                style={s.spinBtnGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <MaterialCommunityIcons
                  name={spinning ? 'loading' : 'rotate-right'}
                  size={20} color={spinning ? '#525252' : '#FFF'}
                />
                <Text style={[s.spinBtnText, spinning && { color: '#525252' }]}>
                  {spinning ? t('spin.spinning') : t('spin.spin_btn')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {!spinning && !showResult && (
            <TouchableOpacity onPress={() => handleClose(false)} style={s.laterBtn}>
              <Text style={s.laterText}>{t('spin.later')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Result overlay */}
        {showResult && result && (
          <View style={s.resultOverlay}>
            <View style={s.resultCard}>
              <Text style={s.resultEmoji}>{result.reward.icon}</Text>
              <Text style={s.resultWon}>{t('spin.won')}</Text>
              <Text style={[s.resultLabel, { color: result.reward.color === '#8B6914' ? '#FFD700' : result.reward.color }]}>
                {result.reward.label}
              </Text>
              {result.applied.theme_name && (
                <Text style={s.resultThemeName}>📚 {result.applied.theme_name}</Text>
              )}
              {result.applied.boost_minutes && (
                <Text style={s.resultThemeName}>⏱ {result.applied.boost_minutes} min</Text>
              )}
              <TouchableOpacity style={s.collectBtn} onPress={() => handleClose(true)} activeOpacity={0.8}>
                <LinearGradient colors={['#8A2BE2', '#6A1FB0']} style={s.collectBtnGrad}>
                  <Text style={s.collectBtnText}>{t('spin.collect')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ConfettiCannon
          ref={confettiRef}
          count={90}
          origin={{ x: SW / 2, y: -20 }}
          autoStart={false}
          fadeOut
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0A0A1E', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 20, paddingBottom: 36, paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1, borderColor: 'rgba(138,43,226,0.3)',
  },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#A3A3A3', fontSize: 13, marginBottom: 16 },
  wheelContainer: { alignItems: 'center', marginBottom: 20 },
  pointerWrap: {
    width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 22,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#FFD700',
    marginBottom: 2, zIndex: 10,
  },
  pointer: {},
  spinBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  spinBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  spinBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  laterBtn: { paddingVertical: 8 },
  laterText: { color: '#525252', fontSize: 13 },
  // Result overlay
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  resultCard: {
    backgroundColor: '#10102A', borderRadius: 24, padding: 32,
    alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.4)',
  },
  resultEmoji: { fontSize: 56, marginBottom: 12 },
  resultWon: { color: '#A3A3A3', fontSize: 14, marginBottom: 6 },
  resultLabel: { fontSize: 28, fontWeight: '900', marginBottom: 8 },
  resultThemeName: { color: '#A3A3A3', fontSize: 14, marginBottom: 16 },
  collectBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  collectBtnGrad: {
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  collectBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

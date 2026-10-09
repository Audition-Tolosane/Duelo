/**
 * Daily spin wheel modal.
 * Shows a 6-segment SVG wheel, animates a spin, then shows the reward.
 */
import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, withTiming, useAnimatedStyle, Easing, runOnJS,
} from 'react-native-reanimated';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import { Txt, Icon, IconName, Button, Card, BottomSheet } from './ui';
import { COLOR, PALETTE, SPACE, RADII, BORDER, GRADIENTS } from '../theme/tokens';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SW } = Dimensions.get('window');
// La roue tient dans la feuille (marges latérales 16 de chaque côté)
const WHEEL_SIZE = Math.min(SW - 48, 300);
const CX = WHEEL_SIZE / 2;
const CY = WHEEL_SIZE / 2;
const R = WHEEL_SIZE / 2 - 4;
const N = 6;
const SEG_DEG = 360 / N;
const LABEL_W = 72;

// Récompense : segments pétrole alternés, or pour le gros lot, corail pour le thème offert (événement).
// Le texte suit la surface : crème sur pétrole, nuit sur or / corail.
export const SPIN_REWARDS: { type: string; value: number; label: string; icon: IconName; fill: string; ink: string }[] = [
  { type: 'xp',    value: 50,  label: '50 XP',  icon: 'bolt',  fill: PALETTE.petrolLight, ink: COLOR.text.primary },
  { type: 'xp',    value: 100, label: '100 XP', icon: 'bolt',  fill: PALETTE.petrol,      ink: COLOR.text.primary },
  { type: 'xp',    value: 200, label: '200 XP', icon: 'bolt',  fill: PALETTE.petrolLight, ink: COLOR.text.primary },
  { type: 'xp',    value: 500, label: '500 XP', icon: 'gem',   fill: PALETTE.gold,        ink: COLOR.text.onAction },
  { type: 'boost', value: 15,  label: 'boost',  icon: 'trend', fill: PALETTE.petrol,      ink: COLOR.text.primary },
  { type: 'theme', value: 24,  label: 'theme',  icon: 'gift',  fill: PALETTE.coral,       ink: COLOR.text.onAction },
];

const CONFETTI = [PALETTE.yellow, PALETTE.gold, PALETTE.coral, PALETTE.cream, PALETTE.petrolLight];

function segmentLabel(i: number): string {
  const seg = SPIN_REWARDS[i];
  if (seg.type === 'boost') return t('pilot.spin.boost');
  if (seg.type === 'theme') return t('pilot.spin.theme');
  return seg.label;
}

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
  // Texte droit quand le segment passe en haut : le gain se lit toujours à l'endroit sous le pointeur
  // (pas de retournement : il mettait le segment gagnant tête en bas une fois la roue arrêtée)
  const textRot = midDeg + 90;
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

  const won = result ? SPIN_REWARDS[result.reward.segment_index] : undefined;

  return (
    <BottomSheet
      visible={visible}
      onClose={() => handleClose(!!showResult)}
      title={t('pilot.spin.title')}
      subtitle={t('pilot.spin.sub')}
      footer={showResult && result ? (
        <Button label={t('spin.collect')} fullWidth onPress={() => handleClose(true)} />
      ) : (
        <View style={s.footer}>
          <Button
            label={spinning ? t('spin.spinning') : t('pilot.spin.spin')}
            icon="replay"
            size="lg"
            fullWidth
            loading={spinning}
            haptic={false}
            onPress={startSpin}
          />
          {!spinning ? (
            <Button label={t('spin.later')} variant="ghost" fullWidth onPress={() => handleClose(false)} />
          ) : null}
        </View>
      )}
    >
      {/* Roue + repère : le repère jaune désigne le gain (sélection) */}
      <View style={s.wheelContainer}>
        <View style={s.pointer} />

        <Animated.View style={[{ width: WHEEL_SIZE, height: WHEEL_SIZE }, wheelStyle]}>
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
            {SPIN_REWARDS.map((seg, i) => (
              <G key={i}>
                <Path d={slicePath(i)} fill={seg.fill} stroke={COLOR.bg.primary} strokeWidth={2.5} />
              </G>
            ))}
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
                  stroke={COLOR.bg.primary} strokeWidth={2}
                />
              );
            })}
            {/* Center hub */}
            <Circle cx={CX} cy={CY} r={26} fill={COLOR.bg.primary} />
            <Circle cx={CX} cy={CY} r={20} fill={COLOR.surface.card} stroke={COLOR.reward.gold} strokeWidth={2} />
          </Svg>

          {/* Libellés des gains : tournent avec la roue */}
          {SPIN_REWARDS.map((seg, i) => {
            const lc = labelCenter(i);
            return (
              <View
                key={`label-${i}`}
                pointerEvents="none"
                style={[s.label, { left: lc.x - LABEL_W / 2, top: lc.y - 20, transform: [{ rotate: `${lc.rotation}deg` }] }]}
              >
                <Icon name={seg.icon} size={16} color={seg.ink} />
                <Txt variant="caption" color={seg.ink} align="center" numberOfLines={1}>{segmentLabel(i)}</Txt>
              </View>
            );
          })}
        </Animated.View>
      </View>

      {/* Gain : moment de récompense (or) */}
      {showResult && result ? (
        <Card accent="reward" style={s.result}>
          <LinearGradient colors={GRADIENTS.reward.colors} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={s.resultIcon}>
            <Icon name={won?.icon ?? 'gift'} size={28} color={COLOR.reward.gold} />
          </View>
          <Txt variant="overline" color={COLOR.reward.gold}>{t('spin.won')}</Txt>
          {/* Libellé client pour boost et thème (celui du backend est en français en dur) */}
          <Txt variant="statMedium" color={COLOR.reward.gold} align="center">
            {won?.type === 'boost' ? t('pilot.spin.boost') : won?.type === 'theme' ? t('pilot.spin.theme_won') : result.reward.label}
          </Txt>
          {result.applied.theme_name ? (
            <View style={s.detail}>
              <Icon name="book" size={16} color={COLOR.text.secondary} />
              <Txt variant="bodySmall" numberOfLines={2} style={s.flexShrink}>{result.applied.theme_name}</Txt>
            </View>
          ) : null}
          {result.applied.boost_minutes ? (
            <View style={s.detail}>
              <Icon name="timer" size={16} color={COLOR.text.secondary} />
              <Txt variant="bodySmall">{t('pilot.spin.boost_minutes', { n: String(result.applied.boost_minutes) })}</Txt>
            </View>
          ) : null}
        </Card>
      ) : null}

      <ConfettiCannon
        ref={confettiRef}
        count={90}
        origin={{ x: SW / 2, y: -20 }}
        autoStart={false}
        fadeOut
        colors={CONFETTI}
      />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  wheelContainer: { alignItems: 'center', paddingVertical: SPACE.sm },
  // Triangle jaune pointant vers la roue
  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 22,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: COLOR.action.primary,
    marginBottom: -SPACE.sm, zIndex: 10,
  },
  label: { position: 'absolute', width: LABEL_W, alignItems: 'center', gap: SPACE.xxs },
  footer: { gap: SPACE.sm },
  result: { alignItems: 'center', gap: SPACE.xs, paddingVertical: SPACE.xl },
  resultIcon: {
    width: 56, height: 56, borderRadius: RADII.pill,
    backgroundColor: COLOR.tint.gold,
    borderWidth: BORDER.hair, borderColor: COLOR.reward.gold,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.xs,
  },
  detail: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, maxWidth: '100%' },
  flexShrink: { flexShrink: 1 },
});

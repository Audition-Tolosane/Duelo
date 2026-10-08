import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWS } from '../contexts/WebSocketContext';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import { Txt, Button, Dialog, ThemeIcon } from './ui';
import { COLOR, SPACE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';

const TIMEOUT_SECONDS = 30;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// This modal is for Player B (the challenged player) receiving a real-time challenge
export default function ChallengeReadyModal() {
  const { on } = useWS();
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  const [challengerPseudo, setChallengerPseudo] = useState('');
  const [themeName, setThemeName] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [themeId, setThemeId] = useState('');
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);
  const [accepting, setAccepting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const dismiss = () => {
    clearTimer();
    progressAnim.stopAnimation();
    setVisible(false);
    setAccepting(false);
  };

  useEffect(() => {
    const unsubs = [
      // challenge_incoming = Player B receives a real-time challenge from Player A
      on('challenge_incoming', (msg: any) => {
        const data = msg.data || {};
        setChallengerPseudo(data.challenger_pseudo || t('pilot.challenge.someone'));
        setThemeName(data.theme_name || '');
        setChallengeId(data.challenge_id || '');
        setThemeId(data.theme_id || '');
        setCountdown(TIMEOUT_SECONDS);
        setVisible(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        progressAnim.setValue(1);
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: TIMEOUT_SECONDS * 1000,
          useNativeDriver: false,
        }).start(() => dismiss());

        clearTimer();
        let remaining = TIMEOUT_SECONDS;
        timerRef.current = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) clearTimer();
        }, 1000);
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      clearTimer();
    };
  }, []);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const res = await authFetch(`${API_URL}/api/challenges/${challengeId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        const data = await res.json();
        dismiss();
        const roomId = data.room_id;
        if (roomId) {
          router.push(
            `/matchmaking?room_id=${roomId}&category=${themeId}&challenge=true&opponentPseudo=${encodeURIComponent(challengerPseudo)}&themeName=${encodeURIComponent(themeName)}`
          );
        } else if (themeId) {
          router.push(`/matchmaking?category=${themeId}&themeName=${encodeURIComponent(themeName)}`);
        } else {
          router.push('/(tabs)/play');
        }
      }
    } catch {
      Alert.alert(t('common.error'), t('common.error_loading'));
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismiss();
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      await authFetch(`${API_URL}/api/challenges/${challengeId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
    } catch {
      // Decline failure is non-critical: the challenge will expire on its own
      console.warn('[ChallengeReadyModal] decline failed silently');
    }
  };

  if (!visible) return null;

  // Défi reçu = événement (corail) : modale unique du kit, un seul CTA jaune « Accepter ».
  // Pas de fermeture en touchant le voile : refuser doit rester un choix explicite.
  return (
    <Dialog
      visible
      onClose={handleDecline}
      dismissable={false}
      icon="duel"
      tone="event"
      title={t('pilot.challenge.incoming')}
      actions={
        <>
          <Button
            label={t('challenge.accept')}
            icon="duel"
            loading={accepting}
            disabled={accepting}
            fullWidth
            haptic={false}
            onPress={handleAccept}
          />
          <Button label={t('challenge.decline')} variant="ghost" fullWidth haptic={false} onPress={handleDecline} />
        </>
      }
    >
      <Txt variant="body" color={COLOR.text.secondary} align="center">
        <Txt variant="body" color={COLOR.player.opponentText}>{challengerPseudo}</Txt>
        {' '}{t('challenge.vs')}
      </Txt>

      {themeName ? (
        <View style={styles.themePill}>
          <ThemeIcon themeName={themeName} size={ICON_SIZE.theme.xs} />
          <Txt variant="label" color={COLOR.text.primary} numberOfLines={1} style={styles.flexShrink}>{themeName}</Txt>
        </View>
      ) : null}

      {/* Temps restant pour répondre */}
      <View style={styles.timer}>
        <View style={styles.progressBg}>
          <Animated.View
            style={[
              styles.progressBar,
              { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
        <Txt variant="caption" align="center">{t('pilot.challenge.seconds_left', { n: String(countdown) })}</Txt>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flexShrink: { flexShrink: 1 },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: SPACE.sm,
    maxWidth: '100%',
    backgroundColor: COLOR.surface.subtle,
    borderRadius: RADII.pill,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    paddingLeft: SPACE.xs,
    paddingRight: SPACE.lg,
    paddingVertical: SPACE.xs,
  },
  timer: { gap: SPACE.xs },
  progressBg: {
    width: '100%',
    height: 4,
    backgroundColor: COLOR.track,
    borderRadius: RADII.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLOR.accent.warm,
    borderRadius: RADII.xs,
  },
});

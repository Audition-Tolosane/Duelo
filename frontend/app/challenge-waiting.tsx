import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import UserAvatar from '../components/UserAvatar';
import { useWS } from '../contexts/WebSocketContext';
import { t } from '../utils/i18n';

const WAIT_SECONDS = 15;

export default function ChallengeWaitingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { on: wsOn } = useWS();

  const {
    challenge_id,
    opponent_pseudo,
    opponent_seed,
    theme_id,
    theme_name,
  } = useLocalSearchParams<{
    challenge_id: string;
    opponent_pseudo: string;
    opponent_seed: string;
    theme_id: string;
    theme_name: string;
  }>();

  const opponentName = opponent_pseudo ? decodeURIComponent(opponent_pseudo) : '...';
  const themeTitleStr = theme_name ? decodeURIComponent(theme_name) : '';

  const [countdown, setCountdown] = useState(WAIT_SECONDS);
  const [phase, setPhase] = useState<'waiting' | 'timeout' | 'declined'>('waiting');

  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Start progress bar animation
    animRef.current = Animated.timing(progressAnim, {
      toValue: 0,
      duration: WAIT_SECONDS * 1000,
      useNativeDriver: false,
    });
    animRef.current.start();

    // Start countdown
    let remaining = WAIT_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearTimer();
        setPhase('timeout');
      }
    }, 1000);

    // WS listeners
    const unsubs = [
      wsOn('challenge_ready', (msg: any) => {
        const data = msg.data || {};
        clearTimer();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Player B accepted → go to shared matchmaking room
        router.replace(
          `/matchmaking?room_id=${data.room_id}&category=${data.theme_id || theme_id || ''}&challenge=true` +
          `&opponentPseudo=${encodeURIComponent(opponentName)}&themeName=${encodeURIComponent(themeTitleStr)}`
        );
      }),
      wsOn('challenge_declined', () => {
        clearTimer();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPhase('declined');
      }),
    ];

    return () => {
      clearTimer();
      animRef.current?.stop();
      unsubs.forEach((u) => u());
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const goPlayNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Player A plays solo — answers recorded, Player B will play later in reveal mode.
    router.replace(
      `/game?category=${theme_id || ''}&asyncMode=solo` +
      `&opponentPseudo=${encodeURIComponent(opponentName)}` +
      `&opponentSeed=${encodeURIComponent(opponent_seed || '')}` +
      `&challenge_id=${challenge_id || ''}`
    );
  };

  const goChangeOpponent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Launch classic matchmaking on the same theme
    router.replace(
      `/matchmaking?category=${theme_id || ''}&themeName=${encodeURIComponent(themeTitleStr)}`
    );
  };

  return (
    <SwipeBackPage>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DueloHeader />

        <View style={styles.content}>

          {/* Avatar + name */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarGlow}>
              <UserAvatar
                avatarUrl={undefined}
                avatarSeed={opponent_seed || opponentName}
                pseudo={opponentName}
                size={80}
              />
            </View>
            <Text style={styles.opponentName}>{opponentName}</Text>
            {themeTitleStr ? (
              <View style={styles.themePill}>
                <MaterialCommunityIcons name="star" size={12} color="#BF5FFF" />
                <Text style={styles.themeText}>{themeTitleStr}</Text>
              </View>
            ) : null}
          </View>

          {phase === 'waiting' && (
            <>
              {/* Waiting state */}
              <View style={styles.waitBox}>
                <View style={styles.pulseRing} />
                <MaterialCommunityIcons name="clock-outline" size={28} color="#BF5FFF" />
                <Text style={styles.waitTitle}>{t('challenge.waiting_for')}</Text>
                <Text style={styles.waitSubtitle}>{opponentName}…</Text>
              </View>

              {/* Countdown bar */}
              <View style={styles.progressWrap}>
                <View style={styles.progressBg}>
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.countdownText}>{countdown}s</Text>
              </View>

              {/* Cancel button */}
              <TouchableOpacity style={styles.changeBtn} onPress={goChangeOpponent} activeOpacity={0.8}>
                <MaterialCommunityIcons name="account-switch" size={16} color="#A3A3A3" />
                <Text style={styles.changeBtnText}>{t('challenge.find_opponent')}</Text>
              </TouchableOpacity>
            </>
          )}

          {(phase === 'timeout' || phase === 'declined') && (
            <>
              {/* Timeout / declined state */}
              <View style={styles.timeoutBox}>
                <MaterialCommunityIcons
                  name={phase === 'declined' ? 'close-circle-outline' : 'clock-alert-outline'}
                  size={36}
                  color={phase === 'declined' ? '#FF3B5C' : '#FF9F0A'}
                />
                <Text style={styles.timeoutTitle}>
                  {phase === 'declined' ? `${opponentName} a refusé` : t('challenge.timeout_title')}
                </Text>
                <Text style={styles.timeoutBody}>{t('challenge.timeout_body')}</Text>
              </View>

              <View style={styles.choiceButtons}>
                {/* Play now with same theme — challenge stays for B */}
                <TouchableOpacity style={styles.playNowBtn} onPress={goPlayNow} activeOpacity={0.8}>
                  <LinearGradient
                    colors={['#8A2BE2', '#BF5FFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.playNowGradient}
                  >
                    <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFF" />
                    <View>
                      <Text style={styles.playNowTitle}>{t('challenge.play_now')}</Text>
                      <Text style={styles.playNowSub}>{opponentName} {t('challenge.vs')}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Find a different opponent */}
                <TouchableOpacity style={styles.changeBtn2} onPress={goChangeOpponent} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="account-switch" size={16} color="#A3A3A3" />
                  <Text style={styles.changeBtnText}>{t('challenge.find_opponent')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },

  avatarSection: { alignItems: 'center', gap: 10 },
  avatarGlow: {
    borderRadius: 48,
    shadowColor: '#BF5FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  opponentName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(191,95,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(191,95,255,0.25)',
  },
  themeText: {
    color: '#BF5FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  waitBox: {
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(191,95,255,0.2)',
  },
  waitTitle: {
    fontSize: 15,
    color: '#A3A3A3',
    fontWeight: '600',
    marginTop: 4,
  },
  waitSubtitle: {
    fontSize: 20,
    color: '#BF5FFF',
    fontWeight: '800',
  },

  progressWrap: { width: '100%', alignItems: 'center', gap: 6 },
  progressBg: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#BF5FFF',
    borderRadius: 3,
  },
  countdownText: {
    fontSize: 13,
    color: '#525252',
    fontWeight: '700',
  },

  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  changeBtnText: {
    color: '#A3A3A3',
    fontSize: 14,
    fontWeight: '600',
  },

  timeoutBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.2)',
  },
  timeoutTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
  },
  timeoutBody: {
    fontSize: 14,
    color: '#A3A3A3',
    textAlign: 'center',
  },

  choiceButtons: { width: '100%', gap: 12 },
  playNowBtn: { borderRadius: 16, overflow: 'hidden' },
  playNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
  },
  playNowTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  playNowSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '500',
  },
  changeBtn2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});

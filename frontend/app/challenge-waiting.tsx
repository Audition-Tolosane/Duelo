import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import UserAvatar from '../components/UserAvatar';
import RoundTimer from '../components/RoundTimer';
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
  const [myPseudo, setMyPseudo] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Anneaux ping autour de l'avatar adverse (scale + fade en boucle, décalés)
  const ping1 = useRef(new Animated.Value(0)).current;
  const ping2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('duelo_pseudo').then(p => { if (p) setMyPseudo(p); });
    const mkPing = (v: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    const a1 = mkPing(ping1, 0);
    const a2 = mkPing(ping2, 600);
    a1.start(); a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, []);

  const pingStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
  });

  useEffect(() => {
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
    // #23 — Guard against navigating with an empty theme_id which would break the game
    if (!theme_id) {
      Alert.alert(t('common.error'), t('common.error_loading'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.replace(
      `/game?category=${theme_id}&asyncMode=solo` +
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

          {phase === 'waiting' && (
            <>
              {/* En-tête */}
              <View style={styles.waitHead}>
                <Text style={styles.waitEyebrow}>◆ {t('challenge.waiting_for')} ◆</Text>
                <Text style={styles.waitName}>{opponentName}</Text>
              </View>

              {/* Duel : toi VS adversaire (anneaux ping) */}
              <View style={styles.duelRow}>
                <View style={styles.duelSide}>
                  <UserAvatar avatarSeed="me" pseudo={myPseudo || t('home.you')} size={70} />
                  <Text style={[styles.duelLabel, { color: '#00E5FF' }]} numberOfLines={1}>
                    {(myPseudo || t('home.you')).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.duelVs}>VS</Text>
                <View style={styles.duelSide}>
                  <View>
                    <UserAvatar
                      avatarSeed={opponent_seed || opponentName}
                      pseudo={opponentName}
                      size={70}
                    />
                    <Animated.View pointerEvents="none" style={[styles.pingRing, pingStyle(ping1)]} />
                    <Animated.View pointerEvents="none" style={[styles.pingRing, pingStyle(ping2)]} />
                  </View>
                  <Text style={[styles.duelLabel, { color: '#B366FF' }]} numberOfLines={1}>
                    {opponentName.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Chip thème */}
              {themeTitleStr ? (
                <View style={styles.themePill}>
                  <MaterialCommunityIcons name="star-four-points" size={14} color="#00E5FF" />
                  <Text style={styles.themeText}>{themeTitleStr}</Text>
                </View>
              ) : null}

              {/* Anneau décompte or */}
              <RoundTimer timeLeft={countdown} total={WAIT_SECONDS} size={96} color="#FFB547" />

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

  waitHead: { alignItems: 'center', gap: 6 },
  waitEyebrow: {
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', color: '#FFB547',
    letterSpacing: 3, textTransform: 'uppercase',
  },
  waitName: {
    fontSize: 26, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF', letterSpacing: -0.8, textTransform: 'uppercase',
  },

  duelRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  duelSide: { alignItems: 'center', gap: 8, maxWidth: 110 },
  duelLabel: {
    fontSize: 12, fontWeight: '800', fontFamily: 'SpaceGrotesk_700Bold',
  },
  duelVs: {
    fontSize: 32, color: '#FFB547', fontFamily: 'Fraunces_500Medium_Italic',
  },
  pingRing: {
    position: 'absolute', top: 0, left: 0,
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 2, borderColor: '#B366FF',
  },

  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.30)',
  },
  themeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk_600SemiBold',
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

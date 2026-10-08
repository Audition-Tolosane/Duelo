import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import RoundTimer from '../components/RoundTimer';
import { useWS } from '../contexts/WebSocketContext';
import { t } from '../utils/i18n';
import { Txt, Icon, Button, Card, ScreenContainer, ScreenHeader, ThemeIcon } from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';

const WAIT_SECONDS = 15;

export default function ChallengeWaitingScreen() {
  const router = useRouter();
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

  const declined = phase === 'declined';

  // Attente d'un défi nominatif : moment d'anticipation, sobre (pas de halo).
  // Moi = jaune, rival = corail ; un seul CTA jaune quand le rival n'a pas répondu.
  return (
    <SwipeBackPage>
      <ScreenContainer>
        <ScreenHeader overline={t('pilot.challenge.sent')} title={opponentName} />

        <View style={styles.content}>

          {phase === 'waiting' && (
            <>
              <Txt variant="overline" align="center">{t('challenge.waiting_for')}…</Txt>

              {/* Duel : toi VS adversaire (anneaux d'attente autour du rival) */}
              <View style={styles.duelRow}>
                <View style={styles.duelSide}>
                  <UserAvatar
                    avatarSeed="me"
                    pseudo={myPseudo || t('home.you')}
                    size={72}
                    borderColor={COLOR.player.self}
                    borderWidth={BORDER.strong}
                  />
                  <Txt variant="label" color={COLOR.player.self} align="center" numberOfLines={1}>
                    {myPseudo || t('home.you')}
                  </Txt>
                </View>
                <Txt variant="moment" color={COLOR.text.secondary}>vs</Txt>
                <View style={styles.duelSide}>
                  <View>
                    <UserAvatar
                      avatarSeed={opponent_seed || opponentName}
                      pseudo={opponentName}
                      size={72}
                      borderColor={COLOR.player.opponent}
                      borderWidth={BORDER.strong}
                    />
                    <Animated.View pointerEvents="none" style={[styles.pingRing, pingStyle(ping1)]} />
                    <Animated.View pointerEvents="none" style={[styles.pingRing, pingStyle(ping2)]} />
                  </View>
                  <Txt variant="label" color={COLOR.player.opponentText} align="center" numberOfLines={1}>
                    {opponentName}
                  </Txt>
                </View>
              </View>

              {/* Thème du défi */}
              {themeTitleStr ? (
                <View style={styles.themePill}>
                  <ThemeIcon themeName={themeTitleStr} size={ICON_SIZE.theme.xs} />
                  <Txt variant="label" color={COLOR.text.primary} numberOfLines={1} style={styles.flexShrink}>{themeTitleStr}</Txt>
                </View>
              ) : null}

              {/* Décompte (anneau crème, corail puis rouge en fin de course) */}
              <RoundTimer timeLeft={countdown} total={WAIT_SECONDS} size={96} />

              <Button
                label={t('challenge.find_opponent')}
                icon="users"
                variant="ghost"
                size="sm"
                onPress={goChangeOpponent}
              />
            </>
          )}

          {(phase === 'timeout' || declined) && (
            <>
              <Card style={styles.timeoutBox}>
                <View style={styles.timeoutIcon}>
                  <Icon name={declined ? 'error' : 'clock'} size={28} color={COLOR.text.secondary} />
                </View>
                <Txt variant="h3" align="center">
                  {declined ? t('pilot.challenge.declined', { name: opponentName }) : t('challenge.timeout_title')}
                </Txt>
                <Txt variant="body" color={COLOR.text.secondary} align="center">{t('challenge.timeout_body')}</Txt>
              </Card>

              <View style={styles.choiceButtons}>
                {/* Jouer tout de suite sur le même thème — le défi reste ouvert pour le rival */}
                <Button label={t('challenge.play_now')} icon="bolt" size="lg" fullWidth onPress={goPlayNow} />
                <Txt variant="caption" align="center" numberOfLines={2}>
                  {opponentName} {t('challenge.async_will_play')}
                </Txt>
                <Button
                  label={t('challenge.find_opponent')}
                  icon="users"
                  variant="ghost"
                  fullWidth
                  onPress={goChangeOpponent}
                  style={styles.secondaryBtn}
                />
              </View>
            </>
          )}

        </View>
      </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xxl,
    gap: SPACE.xxl,
  },
  flexShrink: { flexShrink: 1 },

  // Colonnes souples (104 px au plus) : la ligne tient dans les 272 px utiles d'un écran de 320
  duelRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  duelSide: { flex: 1, maxWidth: 104, alignItems: 'center', gap: SPACE.sm },
  pingRing: {
    position: 'absolute', top: 0, left: 0,
    width: 72, height: 72, borderRadius: 36,
    borderWidth: BORDER.strong, borderColor: COLOR.player.opponent,
  },

  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    maxWidth: '100%',
    backgroundColor: COLOR.surface.card,
    borderRadius: RADII.pill,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    paddingLeft: SPACE.xs,
    paddingRight: SPACE.lg,
    paddingVertical: SPACE.xs,
  },

  timeoutBox: { width: '100%', alignItems: 'center', gap: SPACE.sm },
  timeoutIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLOR.surface.subtle,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.xs,
  },

  choiceButtons: { width: '100%', gap: SPACE.sm },
  secondaryBtn: { marginTop: SPACE.sm },
});

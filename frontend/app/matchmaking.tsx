import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, withSpring, Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import { useWS } from '../contexts/WebSocketContext';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

// Real world map paths from Natural Earth data (Mercator projection, 1000×500 viewBox)
import MAP_PATHS from '../assets/map-paths.json';

const { width: SW, height: SH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const BADGE_ICON_MAP: Record<string, string> = { fire: 'fire', bolt: 'lightning-bolt', glow: 'shimmer' };

// Pin positions computed from lat/lon via equirectangular:
// x = (lon + 180) / 360 * 1000  |  y = (90 - lat) / 180 * 500
const PIN_POSITIONS = [
  { x: 225, y: 139 },  // USA (40°N, 99°W)
  { x: 356, y: 283 },  // Brésil (12°S, 52°W)
  { x: 508, y: 122 },  // France (46°N, 3°E)
  { x: 525, y: 222 },  // Nigeria (10°N, 9°E)
  { x: 603, y: 94  },  // Russie / Moscou (56°N, 37°E)
  { x: 717, y: 189 },  // Inde (22°N, 78°E)
  { x: 789, y: 150 },  // Chine (36°N, 104°E)
  { x: 883, y: 150 },  // Japon (36°N, 138°E)
  { x: 872, y: 317 },  // Australie (24°S, 134°E)
  { x: 547, y: 78  },  // Suède (62°N, 17°E)
  { x: 214, y: 186 },  // Mexique (23°N, 103°W)
  { x: 625, y: 183 },  // Arabie Saoudite (24°N, 45°E)
  { x: 781, y: 206 },  // Thaïlande (16°N, 101°E)
  { x: 817, y: 253 },  // Indonésie/Bornéo (1°S, 114°E)
  { x: 231, y: 94  },  // Canada (56°N, 97°W)
  { x: 567, y: 258 },  // RD Congo (3°S, 24°E)
  { x: 528, y: 108 },  // Allemagne (51°N, 10°E)
  { x: 322, y: 344 },  // Argentine (34°S, 64°W)
  { x: 569, y: 330 },  // Afrique du Sud (29°S, 25°E)
  { x: 583, y: 178 },  // Égypte (26°N, 30°E)
  { x: 597, y: 142 },  // Turquie (39°N, 35°E)
  { x: 689, y: 117 },  // Kazakhstan (48°N, 68°E)
];

const PLAYER_NAMES = [
  'Alex', 'Mia', 'Lucas', 'Emma', 'Noah', 'Léa', 'Hugo', 'Chloé',
  'Tom', 'Jade', 'Liam', 'Sarah', 'Enzo', 'Luna', 'Adam', 'Zoé',
  'Max', 'Sofia', 'Ryo', 'Omar', 'Maya', 'Diego',
];

const PIN_COLORS = [
  '#FF6B35', '#00D4FF', '#4CAF50', '#FF3B5C', '#FFB800',
  '#00FF9D', '#E53935', '#8A2BE2', '#FF69B4', '#1565C0',
  '#FF9800', '#00BCD4', '#9C27B0', '#CDDC39', '#FF5722', '#3F51B5',
  '#7C4DFF', '#00E5FF', '#F50057', '#69F0AE', '#FFAB40', '#E040FB',
];

// Map sizing
const SVG_W = 1000;
const SVG_H = 500;
const SCALE = Math.max(SW / SVG_W, SH / SVG_H) * 1.9;
const REAL_W = SVG_W * SCALE;
const REAL_H = SVG_H * SCALE;

// Start centered on Atlantic
const INIT_X = -(REAL_W * 0.38 - SW / 2);
const INIT_Y = -(REAL_H * 0.3 - SH / 2);

type OpponentData = {
  id: string;
  pseudo: string;
  avatar_seed: string;
  is_bot: boolean;
  level: number;
  title: string;
  streak: number;
  streak_badge: string;
};

type PlayerData = { level: number; title: string };

// ── Player Pin Component ──
function PlayerPin({ x, y, name, color, isTarget }: {
  x: number; y: number; name: string; color: string; isTarget?: boolean;
}) {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 + Math.random() * 800 }),
        withTiming(0.5, { duration: 1200 + Math.random() * 800 }),
      ),
      -1, true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const size = isTarget ? 38 : 24;
  const fontSize = isTarget ? 14 : 9;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x * SCALE - size / 2,
          top: y * SCALE - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: isTarget ? 3 : 1,
          borderColor: isTarget ? '#FFF' : 'rgba(255,255,255,0.35)',
          zIndex: isTarget ? 100 : 10,
        },
        !isTarget && pulseStyle,
        isTarget && {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 25,
          elevation: 12,
        },
      ]}
    >
      <Text style={{ color: '#FFF', fontSize, fontWeight: '900' }}>
        {name[0]?.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

// ── Main Screen ──
export default function MatchmakingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { category: rawCategory, themeName, rematch, room_id: challengeRoomId, challenge, opponentPseudo: challengeOpponentPseudo } = useLocalSearchParams<{ category: string; themeName: string; rematch: string; room_id: string; challenge: string; opponentPseudo: string }>();
  const category = rawCategory || '';
  const isRematch = rematch === 'true';
  const isChallengeMode = challenge === 'true' && !!challengeRoomId;
  const { send: wsSend, on: wsOn } = useWS();
  const [dots, setDots] = useState('');
  const [message, setMessage] = useState(t('matchmaking.searching_opponent'));
  const [phase, setPhase] = useState<'searching' | 'found' | 'versus'>('searching');
  const [opponent, setOpponent] = useState<OpponentData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerData | null>(null);
  const [pseudo, setPseudo] = useState(t('matchmaking.player'));
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  const mapX = useSharedValue(INIT_X);
  const mapY = useSharedValue(INIT_Y);
  const mapScaleAnim = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);

  const vsOpacity = useSharedValue(0);
  const vsScale = useSharedValue(0.5);
  const playerSlideX = useSharedValue(-SW);
  const opponentSlideX = useSharedValue(SW);

  const [targetPin, setTargetPin] = useState<{ x: number; y: number } | null>(null);

  const playerPins = useMemo(() => {
    return PIN_POSITIONS.map((pos, i) => ({
      x: pos.x + (Math.random() - 0.5) * 4,
      y: pos.y + (Math.random() - 0.5) * 4,
      name: PLAYER_NAMES[i % PLAYER_NAMES.length],
      color: PIN_COLORS[i % PIN_COLORS.length],
    }));
  }, []);

  const SEARCH_MESSAGES = [
    t('matchmaking.searching_opponent'),
    t('matchmaking.scanning_players'),
    t('matchmaking.exploring_globe'),
    t('matchmaking.connecting_network'),
  ];

  useEffect(() => {
    if (!category && !isChallengeMode) {
      router.replace('/(tabs)/play');
      return;
    }
    loadPseudo();
    if (isRematch) {
      fetchBotOpponent();
    } else if (isChallengeMode) {
      // Challenge mode: join the private room instead of the matchmaking queue
      wsSend({ action: 'challenge_join', room_id: challengeRoomId });
    } else {
      wsSend({ action: 'matchmaking_join', theme_id: category });
    }
    return () => {
      if (!isRematch && !isChallengeMode) wsSend({ action: 'matchmaking_leave' });
    };
  }, []);

  useEffect(() => {
    const unsubs = [
      wsOn('match_found', (msg) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const opp = msg.data?.opponent;
        const rid = msg.data?.room_id;
        setRoomId(rid);
        const oppData: OpponentData = {
          id: opp.id || '',
          pseudo: opp.pseudo,
          avatar_seed: opp.avatar_seed,
          is_bot: false,
          level: opp.level || 1,
          title: opp.selected_title || '',
          streak: opp.streak || 0,
          streak_badge: opp.streak_badge || '',
        };
        setOpponent(oppData);
        setPlayerInfo({ level: 1, title: '' });
        handleMatchFound(oppData, rid);
      }),
      wsOn('matchmaking_timeout', () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchBotOpponent();
      }),
      wsOn('challenge_timeout', () => {
        // Challenger didn't join in time — show choice modal
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setShowTimeoutModal(true);
      }),
      wsOn('challenge_room_expired', () => {
        // Room no longer exists — fall back to regular matchmaking
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (category) {
          wsSend({ action: 'matchmaking_join', theme_id: category });
        } else {
          router.back();
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const loadPseudo = async () => {
    const p = await AsyncStorage.getItem('duelo_pseudo');
    if (p) setPseudo(p);
  };

  useEffect(() => {
    if (phase !== 'searching') return;

    const targets = [
      { x: -(REAL_W * 0.38 - SW / 2), y: -(REAL_H * 0.25 - SH / 2) },
      { x: -(REAL_W * 0.55 - SW / 2), y: -(REAL_H * 0.28 - SH / 2) },
      { x: -(REAL_W * 0.15 - SW / 2), y: -(REAL_H * 0.22 - SH / 2) },
      { x: -(REAL_W * 0.45 - SW / 2), y: -(REAL_H * 0.45 - SH / 2) },
      { x: -(REAL_W * 0.62 - SW / 2), y: -(REAL_H * 0.32 - SH / 2) },
    ];
    let i = 0;
    const next = () => {
      const t = targets[i % targets.length];
      mapX.value = withTiming(t.x, { duration: 5000, easing: Easing.inOut(Easing.ease) });
      mapY.value = withTiming(t.y, { duration: 5000, easing: Easing.inOut(Easing.ease) });
      i++;
    };
    next();
    const panInterval = setInterval(next, 5500);

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % SEARCH_MESSAGES.length;
      setMessage(SEARCH_MESSAGES[msgIdx]);
    }, 3000);

    return () => {
      clearInterval(panInterval);
      clearInterval(dotsInterval);
      clearInterval(msgInterval);
    };
  }, [phase]);

  const fetchBotOpponent = async () => {
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const res = await authFetch(`${API_URL}/api/game/matchmaking-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_id: category, player_id: userId }),
      });
      const data = await res.json();
      setOpponent(data.opponent);
      setPlayerInfo(data.player);
      handleMatchFound(data.opponent);
    } catch {
      router.back();
    }
  };

  const handleMatchFound = (opp: OpponentData, matchRoomId?: string) => {
    const pin = PIN_POSITIONS[Math.floor(Math.random() * PIN_POSITIONS.length)];
    setTargetPin(pin);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const isBotMatch = !matchRoomId;
    // Rematch: skip map zoom, go straight to VS
    const zoomDuration = isRematch ? 400 : 1500;
    const vsDelay = isRematch ? 500 : 1800;
    const navDelay = isRematch ? 2800 : 4500;

    setPhase('found');

    const targetX = -(pin.x * SCALE - SW / 2);
    const targetY = -(pin.y * SCALE - SH / 2);

    mapX.value = withTiming(targetX, { duration: zoomDuration, easing: Easing.inOut(Easing.cubic) });
    mapY.value = withTiming(targetY, { duration: zoomDuration, easing: Easing.inOut(Easing.cubic) });
    mapScaleAnim.value = withTiming(2, { duration: zoomDuration, easing: Easing.inOut(Easing.cubic) });

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPhase('versus');
      overlayOpacity.value = withTiming(1, { duration: 400 });
      vsOpacity.value = withTiming(1, { duration: 500 });
      vsScale.value = withSpring(1, { damping: 12, stiffness: 100 });
      playerSlideX.value = withSpring(0, { damping: 14, stiffness: 80 });
      opponentSlideX.value = withSpring(0, { damping: 14, stiffness: 80 });
    }, vsDelay);

    setTimeout(() => {
      const skillParam = opp.skill_level != null ? `&botSkill=${opp.skill_level}` : '';
      const speedParam = opp.avg_speed   != null ? `&botSpeed=${opp.avg_speed}`   : '';
      router.replace(
        `/game?category=${category}&opponentPseudo=${opp.pseudo}&opponentSeed=${opp.avatar_seed}&isBot=${isBotMatch}&opponentLevel=${opp.level}&opponentStreak=${opp.streak}&opponentId=${opp.id || ''}${matchRoomId ? `&roomId=${matchRoomId}` : ''}${skillParam}${speedParam}`
      );
    }, navDelay);
  };

  const mapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mapX.value },
      { translateY: mapY.value },
      { scale: mapScaleAnim.value },
    ],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const vsAnimStyle = useAnimatedStyle(() => ({
    opacity: vsOpacity.value,
    transform: [{ scale: vsScale.value }],
  }));

  const playerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerSlideX.value }],
  }));

  const opponentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: opponentSlideX.value }],
  }));

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isRematch && !isChallengeMode) wsSend({ action: 'matchmaking_leave' });
    router.back();
  };

  const getCategoryLabel = () => {
    const name = themeName ? decodeURIComponent(themeName) : category;
    return name || 'Quiz';
  };

  const oppBadgeIcon = opponent ? (BADGE_ICON_MAP[opponent.streak_badge] || '') : '';
  const oppIsGlow = opponent?.streak_badge === 'glow';

  return (
    <SwipeBackPage>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DueloHeader />

        {/* ── World Map Layer ── */}
        <View style={styles.mapViewport}>
          <Animated.View style={[styles.mapContainer, mapStyle]}>
            <Svg
              width={REAL_W}
              height={REAL_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              {/* Subtle grid */}
              {Array.from({ length: 9 }).map((_, i) => (
                <Path key={`h-${i}`} d={`M0,${(i+1)*50} L1000,${(i+1)*50}`}
                  stroke="rgba(138,43,226,0.05)" strokeWidth={0.4} />
              ))}
              {Array.from({ length: 19 }).map((_, i) => (
                <Path key={`v-${i}`} d={`M${(i+1)*50},0 L${(i+1)*50},500`}
                  stroke="rgba(138,43,226,0.05)" strokeWidth={0.4} />
              ))}
              {/* Equator */}
              <Path d="M0,250 L1000,250" stroke="rgba(138,43,226,0.1)"
                strokeWidth={0.5} strokeDasharray="6,4" />

              {/* Real continent shapes - outer glow */}
              {(MAP_PATHS as string[]).map((d, i) => (
                <Path key={`g-${i}`} d={d}
                  fill="none"
                  stroke="rgba(0,255,255,0.12)"
                  strokeWidth={4}
                  strokeLinejoin="round" />
              ))}
              {/* Real continent shapes - fill + border */}
              {(MAP_PATHS as string[]).map((d, i) => (
                <Path key={`f-${i}`} d={d}
                  fill="rgba(0,255,255,0.06)"
                  stroke="rgba(0,255,255,0.5)"
                  strokeWidth={0.8}
                  strokeLinejoin="round" />
              ))}
            </Svg>

            {/* Player pins */}
            {playerPins.map((pin, i) => (
              <PlayerPin key={`pin-${i}`} x={pin.x} y={pin.y}
                name={pin.name} color={pin.color} />
            ))}

            {/* Target opponent pin */}
            {targetPin && opponent && (
              <PlayerPin x={targetPin.x} y={targetPin.y}
                name={opponent.pseudo}
                color={oppIsGlow ? '#00FFFF' : '#FF3B5C'}
                isTarget />
            )}
          </Animated.View>

          {/* Vignette edges */}
          <LinearGradient
            colors={['#050510', 'transparent', 'transparent', '#050510']}
            locations={[0, 0.12, 0.88, 1]}
            style={styles.vignetteV} />
          <LinearGradient
            colors={['#050510', 'transparent', 'transparent', '#050510']}
            locations={[0, 0.12, 0.88, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.vignetteH} />
        </View>

        {/* ── Search UI overlay ── */}
        {phase === 'searching' && (
          <View style={styles.searchOverlay}>
            <View style={styles.searchCard}>
              <LinearGradient
                colors={isChallengeMode ? ['rgba(191,95,255,0.15)', 'rgba(5,5,16,0.95)'] : ['rgba(138,43,226,0.12)', 'rgba(5,5,16,0.95)']}
                style={styles.searchCardGradient}>
                <View style={styles.categoryChip}>
                  <MaterialCommunityIcons name="sword-cross" size={14} color={isChallengeMode ? '#BF5FFF' : '#8A2BE2'} />
                  <Text style={[styles.categoryLabel, isChallengeMode && { color: '#BF5FFF' }]}>{getCategoryLabel()}</Text>
                </View>
                <View style={styles.scannerRow}>
                  <View style={[styles.scannerDot, isChallengeMode && { backgroundColor: '#BF5FFF' }]} />
                  <Text style={styles.searchMessage}>
                    {isChallengeMode
                      ? `${t('challenge.waiting_for')} ${challengeOpponentPseudo ? decodeURIComponent(challengeOpponentPseudo) : '...'}${dots}`
                      : `${message}${dots}`}
                  </Text>
                </View>
                <View style={styles.hintRow}>
                  <MaterialCommunityIcons name={isChallengeMode ? 'shield-sword' : 'earth'} size={14} color="#525252" />
                  <Text style={styles.hint}>
                    {isChallengeMode ? t('challenge.ready_title') : t('matchmaking.scanning_active')}
                  </Text>
                </View>
              </LinearGradient>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.75}>
              <MaterialCommunityIcons name="close-circle-outline" size={18} color="#FF3B30" />
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── "Found" indicator ── */}
        {phase === 'found' && opponent && (
          <View style={styles.foundOverlay}>
            <View style={styles.foundCard}>
              <LinearGradient
                colors={['rgba(0,255,157,0.15)', 'rgba(5,5,16,0.9)']}
                style={styles.foundCardGradient}>
                <MaterialCommunityIcons name="target-account" size={24} color="#00FF9D" />
                <Text style={styles.foundText}>{t('matchmaking.opponent_located')}</Text>
                <Text style={styles.foundName}>{opponent.pseudo}</Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* ── Versus overlay ── */}
        {phase === 'versus' && opponent && (
          <>
            <Animated.View style={[styles.versusBackdrop, overlayStyle]} />
            <View style={styles.versusOverlay}>
              <View style={styles.versusContent}>
                <View style={styles.versusCategoryRow}>
                  <MaterialCommunityIcons name="sword-cross" size={16} color="#8A2BE2" />
                  <Text style={styles.versusCategory}>{getCategoryLabel()}</Text>
                </View>
                <View style={styles.versusPlayers}>
                  <Animated.View style={[styles.versusPlayer, playerStyle]}>
                    <LinearGradient colors={['#8A2BE2', '#6A1FCE']} style={styles.versusAvatar}>
                      <Text style={styles.versusAvatarText}>{pseudo[0]?.toUpperCase()}</Text>
                    </LinearGradient>
                    <Text style={styles.versusPseudo} numberOfLines={1}>{pseudo}</Text>
                    <View style={styles.versusLevelRow}>
                      <MaterialCommunityIcons name="star-outline" size={12} color="#525252" />
                      <Text style={styles.versusLevel}>{t('matchmaking.level_short')} {playerInfo?.level || 1}</Text>
                    </View>
                  </Animated.View>

                  <Animated.View style={[styles.vsBadge, vsAnimStyle]}>
                    <LinearGradient colors={['#8A2BE2', '#B24BF3']} style={styles.vsBadgeInner}>
                      <Text style={styles.vsBadgeText}>VS</Text>
                    </LinearGradient>
                  </Animated.View>

                  <Animated.View style={[styles.versusPlayer, opponentStyle]}>
                    <LinearGradient
                      colors={oppIsGlow ? ['#00CCCC', '#00FFFF'] : ['#FF3B30', '#CC2200']}
                      style={[styles.versusAvatar, oppIsGlow && styles.versusAvatarGlow]}>
                      <Text style={styles.versusAvatarText}>{opponent.pseudo[0]?.toUpperCase()}</Text>
                    </LinearGradient>
                    <View style={styles.versusPseudoRow}>
                      <Text style={[styles.versusPseudo, oppIsGlow && styles.glowPseudo]} numberOfLines={1}>
                        {opponent.pseudo}
                      </Text>
                      {oppBadgeIcon ? (
                        <MaterialCommunityIcons name={oppBadgeIcon as any} size={14}
                          color={oppIsGlow ? '#00FFFF' : '#FFA500'} />
                      ) : null}
                    </View>
                    <View style={styles.versusLevelRow}>
                      <MaterialCommunityIcons name="star-outline" size={12} color="#525252" />
                      <Text style={styles.versusLevel}>{t('matchmaking.level_short')} {opponent.level}</Text>
                    </View>
                    {opponent.title ? <Text style={styles.versusTitle}>{opponent.title}</Text> : null}
                    {opponent.streak >= 3 && (
                      <View style={[styles.streakTag, oppIsGlow && styles.streakTagGlow]}>
                        <MaterialCommunityIcons name={(oppBadgeIcon || 'fire') as any} size={12}
                          color={oppIsGlow ? '#00FFFF' : '#FFA500'} />
                        <Text style={[styles.streakText, oppIsGlow && { color: '#00FFFF' }]}>
                          {opponent.streak} {t('matchmaking.wins')}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                </View>
                <View style={styles.versusHintRow}>
                  <MaterialCommunityIcons name="gamepad-variant" size={16} color="#525252" />
                  <Text style={styles.versusHint}>{t('matchmaking.duel_starting')}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ── Challenge Timeout Modal ── */}
      {showTimeoutModal && (
        <View style={styles.timeoutOverlay}>
          <View style={styles.timeoutCard}>
            <MaterialCommunityIcons name="clock-alert-outline" size={40} color="#FF9F0A" style={{ marginBottom: 12 }} />
            <Text style={styles.timeoutTitle}>{t('challenge.timeout_title')}</Text>
            <Text style={styles.timeoutBody}>{t('challenge.timeout_body')}</Text>
            <View style={styles.timeoutButtons}>
              <TouchableOpacity
                style={styles.timeoutCancelBtn}
                onPress={() => { setShowTimeoutModal(false); router.replace('/(tabs)/accueil'); }}
                activeOpacity={0.8}
              >
                <Text style={styles.timeoutCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timeoutPlayBtn}
                onPress={() => { setShowTimeoutModal(false); fetchBotOpponent(); }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8A2BE2', '#00FFFF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.timeoutPlayGradient}
                >
                  <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFF" />
                  <Text style={styles.timeoutPlayText}>{t('challenge.play_now')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  mapViewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  mapContainer: { width: REAL_W, height: REAL_H, position: 'absolute' },
  vignetteV: { ...StyleSheet.absoluteFillObject },
  vignetteH: { ...StyleSheet.absoluteFillObject },

  searchOverlay: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  searchCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)' },
  searchCardGradient: { paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', minWidth: SW * 0.8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(138,43,226,0.15)', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.25)',
  },
  categoryLabel: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  scannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  scannerDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FF9D',
    shadowColor: '#00FF9D', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6,
  },
  searchMessage: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { fontSize: 12, color: '#525252' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
    backgroundColor: 'rgba(255,59,48,0.12)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.35)',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#FF3B30' },

  foundOverlay: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  foundCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,255,157,0.3)' },
  foundCardGradient: { paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', minWidth: SW * 0.7, gap: 6 },
  foundText: { fontSize: 16, fontWeight: '800', color: '#00FF9D' },
  foundName: { fontSize: 20, fontWeight: '900', color: '#FFF' },

  versusBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,16,0.85)' },
  versusOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  versusContent: { alignItems: 'center', paddingHorizontal: 24 },
  versusCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 48 },
  versusCategory: { fontSize: 16, fontWeight: '700', color: '#A3A3A3' },
  versusPlayers: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', width: '100%' },
  versusPlayer: { alignItems: 'center', flex: 1 },
  versusAvatar: {
    width: 72, height: 72, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12,
  },
  versusAvatarGlow: {
    shadowColor: '#00FFFF', shadowOpacity: 0.8, shadowRadius: 20,
    borderWidth: 2, borderColor: 'rgba(0,255,255,0.5)',
  },
  versusAvatarText: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  versusPseudoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  versusPseudo: { color: '#FFF', fontSize: 16, fontWeight: '800', maxWidth: 120 },
  glowPseudo: {
    color: '#00FFFF', textShadowColor: '#00FFFF',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  versusLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  versusLevel: { color: '#525252', fontSize: 12, fontWeight: '600' },
  versusTitle: { color: '#8A2BE2', fontSize: 11, fontWeight: '700', marginTop: 3 },
  streakTag: {
    marginTop: 8, backgroundColor: 'rgba(255,100,0,0.12)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
    borderColor: 'rgba(255,100,0,0.25)', flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  streakTagGlow: { backgroundColor: 'rgba(0,255,255,0.1)', borderColor: 'rgba(0,255,255,0.3)' },
  streakText: { color: '#FFA500', fontSize: 11, fontWeight: '700' },

  vsBadge: {
    width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
    marginHorizontal: 12, marginTop: 8,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  vsBadgeInner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 28 },
  vsBadgeText: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  versusHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 48 },
  versusHint: { color: '#525252', fontSize: 14, fontWeight: '600' },

  timeoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 200,
  },
  timeoutCard: {
    width: '100%',
    backgroundColor: '#0D0D1A',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.3)',
  },
  timeoutTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  timeoutBody: {
    fontSize: 14,
    color: '#A3A3A3',
    textAlign: 'center',
    marginBottom: 24,
  },
  timeoutButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  timeoutCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  timeoutCancelText: {
    color: '#A3A3A3',
    fontSize: 14,
    fontWeight: '700',
  },
  timeoutPlayBtn: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  timeoutPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 14,
  },
  timeoutPlayText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

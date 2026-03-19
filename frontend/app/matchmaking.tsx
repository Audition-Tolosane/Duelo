import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';
import { useWS } from '../contexts/WebSocketContext';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const BADGE_MAP: Record<string, string> = { fire: '🔥', bolt: '⚡', glow: '✨' };

const SEARCH_MESSAGES = [
  'Recherche d\'un adversaire...',
  'Scan du réseau...',
  'Analyse des joueurs en ligne...',
  'Connexion au serveur de combat...',
];

type OpponentData = {
  pseudo: string;
  avatar_seed: string;
  is_bot: boolean;
  level: number;
  title: string;
  streak: number;
  streak_badge: string;
};

type PlayerData = {
  level: number;
  title: string;
};

export default function MatchmakingScreen() {
  const router = useRouter();
  const { category, themeName } = useLocalSearchParams<{ category: string; themeName: string }>();
  const { send: wsSend, on: wsOn } = useWS();
  const [message, setMessage] = useState(SEARCH_MESSAGES[0]);
  const [dots, setDots] = useState('');
  const [phase, setPhase] = useState<'searching' | 'versus'>('searching');
  const [opponent, setOpponent] = useState<OpponentData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerData | null>(null);
  const [pseudo, setPseudo] = useState('Joueur');
  const [roomId, setRoomId] = useState<string | null>(null);

  const radarAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const ringAnim1 = useRef(new Animated.Value(0)).current;
  const ringAnim2 = useRef(new Animated.Value(0)).current;

  // Versus screen anims
  const playerSlide = useRef(new Animated.Value(-width)).current;
  const opponentSlide = useRef(new Animated.Value(width)).current;
  const vsFade = useRef(new Animated.Value(0)).current;
  const vsScale = useRef(new Animated.Value(0.3)).current;
  const vsGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPseudo();
    // Join matchmaking queue via WebSocket
    wsSend({ action: 'matchmaking_join', theme_id: category });

    return () => {
      // Leave queue on unmount
      wsSend({ action: 'matchmaking_leave' });
    };
  }, []);

  // Listen for match_found or matchmaking_timeout via WebSocket
  useEffect(() => {
    const unsubs = [
      wsOn('match_found', (msg) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const opp = msg.data?.opponent;
        setRoomId(msg.data?.room_id);
        setOpponent({
          pseudo: opp.pseudo,
          avatar_seed: opp.avatar_seed,
          is_bot: false,
          level: opp.level || 1,
          title: opp.selected_title || '',
          streak: opp.streak || 0,
          streak_badge: opp.streak_badge || '',
        });
        setPlayerInfo({ level: 1, title: '' }); // Will be updated from game_start
        setPhase('versus');
        showVersusScreen({
          pseudo: opp.pseudo,
          avatar_seed: opp.avatar_seed,
          is_bot: false,
          level: opp.level || 1,
          title: opp.selected_title || '',
          streak: opp.streak || 0,
          streak_badge: opp.streak_badge || '',
        }, msg.data?.room_id);
      }),
      // Timeout: no real player found, fall back to bot
      wsOn('matchmaking_timeout', () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchBotOpponent();
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

    // Radar rotation
    const radar = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true,
      })
    );
    radar.start();

    // Pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Rings
    const ring1 = Animated.loop(
      Animated.timing(ringAnim1, { toValue: 1, duration: 2500, useNativeDriver: true })
    );
    const ring2 = Animated.loop(
      Animated.timing(ringAnim2, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    ring1.start();
    ring2.start();

    // Dots animation
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    // Message rotation
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % SEARCH_MESSAGES.length;
      setMessage(SEARCH_MESSAGES[msgIndex]);
    }, 2000);

    return () => {
      radar.stop();
      pulse.stop();
      ring1.stop();
      ring2.stop();
      clearInterval(dotsInterval);
      clearInterval(msgInterval);
    };
  }, [phase]);

  /** Fallback: fetch a bot opponent via HTTP when no real player is found */
  const fetchBotOpponent = async () => {
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const res = await fetch(`${API_URL}/api/game/matchmaking-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_id: category, player_id: userId }),
      });
      const data = await res.json();
      setOpponent(data.opponent);
      setPlayerInfo(data.player);
      setPhase('versus');
      showVersusScreen(data.opponent);
    } catch {
      router.back();
    }
  };

  const showVersusScreen = (opp: OpponentData, matchRoomId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Players slide in from sides
    Animated.parallel([
      Animated.spring(playerSlide, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.spring(opponentSlide, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
    ]).start();

    // VS badge appears
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(vsScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(vsFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      // Glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(vsGlow, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(vsGlow, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }, 400);

    // Navigate to game after 3 seconds
    const isBot = !matchRoomId;
    setTimeout(() => {
      router.replace(
        `/game?category=${category}&opponentPseudo=${opp.pseudo}&opponentSeed=${opp.avatar_seed}&isBot=${isBot}&opponentLevel=${opp.level}&opponentStreak=${opp.streak}${matchRoomId ? `&roomId=${matchRoomId}` : ''}`
      );
    }, 3000);
  };

  const spin = radarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const getCategoryLabel = () => {
    const name = themeName ? decodeURIComponent(themeName) : category;
    return name || 'Quiz';
  };

  // ── VERSUS SCREEN ──
  if (phase === 'versus' && opponent) {
    const oppBadge = BADGE_MAP[opponent.streak_badge] || '';
    const oppIsGlow = opponent.streak_badge === 'glow';
    const pLevel = playerInfo?.level || 1;
    const pTitle = playerInfo?.title || '';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.versusContent}>
          <Text style={styles.versusCategory}>{getCategoryLabel()}</Text>

          <View style={styles.versusPlayers}>
            {/* Player */}
            <Animated.View style={[styles.versusPlayer, { transform: [{ translateX: playerSlide }] }]}>
              <View style={styles.versusAvatar}>
                <Text style={styles.versusAvatarText}>{pseudo[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.versusPseudo} numberOfLines={1}>{pseudo}</Text>
              <Text style={styles.versusLevel}>Niv. {pLevel}</Text>
              {pTitle ? <Text style={styles.versusTitle}>{pTitle}</Text> : null}
            </Animated.View>

            {/* VS Badge */}
            <Animated.View style={[styles.vsBadge, {
              opacity: vsFade,
              transform: [{ scale: vsScale }],
            }]}>
              <Animated.Text style={[styles.vsBadgeText, { opacity: vsGlow }]}>VS</Animated.Text>
            </Animated.View>

            {/* Opponent */}
            <Animated.View style={[styles.versusPlayer, { transform: [{ translateX: opponentSlide }] }]}>
              <View style={[styles.versusAvatar, styles.versusAvatarOpp, oppIsGlow && styles.versusAvatarGlow]}>
                <Text style={styles.versusAvatarText}>{opponent.pseudo[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.versusPseudoRow}>
                <Text style={[styles.versusPseudo, oppIsGlow && styles.versusGlowPseudo]} numberOfLines={1}>
                  {opponent.pseudo}
                </Text>
                {oppBadge ? <Text style={styles.versusBadgeEmoji}>{oppBadge}</Text> : null}
              </View>
              <Text style={styles.versusLevel}>Niv. {opponent.level}</Text>
              <Text style={styles.versusTitle}>{opponent.title}</Text>
              {opponent.streak >= 3 && (
                <View style={[styles.versusStreakTag, oppIsGlow && styles.versusStreakGlow]}>
                  <Text style={styles.versusStreakText}>
                    {oppBadge} {opponent.streak} victoires
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>

          <Text style={styles.versusHint}>Le duel commence...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── SEARCHING SCREEN ──
  return (
    <SwipeBackPage>
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>RECHERCHE</Text>
        <Text style={styles.categoryLabel}>{getCategoryLabel()}</Text>

        <View style={styles.radarContainer}>
          <Animated.View style={[styles.ring, {
            opacity: ringAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: ringAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }) }],
          }]} />
          <Animated.View style={[styles.ring, {
            opacity: ringAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
            transform: [{ scale: ringAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] }) }],
          }]} />

          <Animated.View style={[styles.radarSweep, { transform: [{ rotate: spin }] }]}>
            <View style={styles.sweepLine} />
          </Animated.View>

          <Animated.View style={[styles.radarCenter, { opacity: pulseAnim }]}>
            <Text style={styles.radarIcon}>⚡</Text>
          </Animated.View>
        </View>

        <Text style={styles.searchMessage}>{message}{dots}</Text>
        <Text style={styles.hint}>Un adversaire sera trouvé sous peu...</Text>
      </View>
    </SafeAreaView>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 14, fontWeight: '800', color: '#525252', letterSpacing: 4, marginBottom: 8 },
  categoryLabel: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 48 },
  radarContainer: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 48 },
  ring: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 1, borderColor: '#8A2BE2',
  },
  radarSweep: { position: 'absolute', width: 200, height: 200, justifyContent: 'center', alignItems: 'flex-start' },
  sweepLine: {
    width: 100, height: 2, backgroundColor: '#00FFFF',
    marginLeft: 100, shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8,
  },
  radarCenter: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16,
  },
  radarIcon: { fontSize: 28 },
  searchMessage: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 8 },
  hint: { fontSize: 13, color: '#525252' },

  // ── Versus Screen ──
  versusContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  versusCategory: { fontSize: 16, fontWeight: '700', color: '#A3A3A3', marginBottom: 48 },
  versusPlayers: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', width: '100%' },
  versusPlayer: { alignItems: 'center', flex: 1 },
  versusAvatar: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12,
  },
  versusAvatarOpp: { backgroundColor: '#FF3B30', shadowColor: '#FF3B30' },
  versusAvatarGlow: {
    shadowColor: '#00FFFF', shadowOpacity: 0.8, shadowRadius: 20,
    borderWidth: 2, borderColor: 'rgba(0,255,255,0.5)',
  },
  versusAvatarText: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  versusPseudoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  versusPseudo: { color: '#FFF', fontSize: 16, fontWeight: '800', maxWidth: 120 },
  versusGlowPseudo: {
    color: '#00FFFF', textShadowColor: '#00FFFF',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  versusBadgeEmoji: { fontSize: 16 },
  versusLevel: { color: '#525252', fontSize: 12, fontWeight: '600', marginTop: 2 },
  versusTitle: { color: '#8A2BE2', fontSize: 11, fontWeight: '700', marginTop: 3 },
  versusStreakTag: {
    marginTop: 8, backgroundColor: 'rgba(255,100,0,0.12)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,100,0,0.25)',
  },
  versusStreakGlow: {
    backgroundColor: 'rgba(0,255,255,0.1)', borderColor: 'rgba(0,255,255,0.3)',
  },
  versusStreakText: { color: '#FFA500', fontSize: 11, fontWeight: '700' },

  // VS Badge
  vsBadge: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 12,
    marginTop: 8,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  vsBadgeText: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  versusHint: { color: '#525252', fontSize: 14, fontWeight: '600', marginTop: 48 },
});

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import UserAvatar from '../components/UserAvatar';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type TournamentEntry = {
  rank: number;
  user_id: string;
  pseudo: string;
  avatar_seed: string;
  avatar_url?: string;
  score: number;
  games_played: number;
};

type TournamentInfo = {
  active: boolean;
  id: string;
  theme_id: string;
  theme_name: string;
  end_at: string;
  games_played: number;
  score: number;
  games_remaining: number;
  rank: number | null;
  total_players: number;
  max_games: number;
};

function formatCountdown(endAt: string): string {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TournamentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();

  const [info, setInfo] = useState<TournamentInfo | null>(null);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!info?.end_at) return;
    setCountdown(formatCountdown(info.end_at));
    const iv = setInterval(() => setCountdown(formatCountdown(info.end_at)), 1000);
    return () => clearInterval(iv);
  }, [info?.end_at]);

  const load = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/tournaments/current`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!data.active) { setLoading(false); return; }
      setInfo(data);
      const lbRes = await authFetch(`${API_URL}/api/tournaments/${data.id}/leaderboard?limit=50`);
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        setEntries(lbData.leaderboard || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handlePlay = () => {
    if (!info) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${info.theme_id}&themeName=${encodeURIComponent(info.theme_name)}`);
  };

  const RANK_GRADIENTS: [string, string][] = [['#FFD700', '#FFA500'], ['#C0C0C0', '#8A8A8A'], ['#CD7F32', '#8B4513']];

  const renderEntry = ({ item, index }: { item: TournamentEntry; index: number }) => {
    const isTop3 = item.rank <= 3;
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(400)}>
        <TouchableOpacity
          style={[st.entry, isTop3 && st.entryTop]}
          onPress={() => router.push(`/player-profile?id=${item.user_id}`)}
          activeOpacity={0.8}
        >
          {isTop3 ? (
            <LinearGradient colors={RANK_GRADIENTS[item.rank - 1]} style={st.rankBadge}>
              <MaterialCommunityIcons name={item.rank === 1 ? 'trophy' : 'medal'} size={16} color="#FFF" />
            </LinearGradient>
          ) : (
            <View style={st.rankBadge}><Text style={st.rankText}>{item.rank}</Text></View>
          )}
          <UserAvatar avatarUrl={item.avatar_url} avatarSeed={item.avatar_seed} pseudo={item.pseudo} size={36} />
          <View style={st.entryInfo}>
            <Text style={st.entryPseudo}>{item.pseudo}</Text>
            <Text style={st.entryGames}>{item.games_played}/{3} {t('tournament.games')}</Text>
          </View>
          <View style={st.scoreBox}>
            <Text style={st.scoreVal}>{item.score}</Text>
            <Text style={st.scoreLabel}>pts</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SwipeBackPage>
      <View style={[st.container, { paddingTop: insets.top }]}>
        <DueloHeader />
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']} style={st.backCircle}>
            <MaterialCommunityIcons name="chevron-left" size={22} color="#A3A3A3" />
          </LinearGradient>
        </TouchableOpacity>

        {loading ? (
          <View style={st.center}><ActivityIndicator size="large" color="#FFD700" /></View>
        ) : !info ? (
          <View style={st.center}>
            <MaterialCommunityIcons name="trophy-outline" size={56} color="#525252" />
            <Text style={st.noTournamentText}>{t('tournament.no_active')}</Text>
            <Text style={st.noTournamentSub}>{t('tournament.weekend_hint')}</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            renderItem={renderEntry}
            keyExtractor={item => item.user_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.listContent}
            ListHeaderComponent={() => (
              <>
                {/* Tournament Header Card */}
                <LinearGradient
                  colors={['rgba(255,215,0,0.15)', 'rgba(255,159,10,0.05)']}
                  style={st.headerCard}
                >
                  <View style={st.headerTop}>
                    <View style={st.trophyCircle}>
                      <MaterialCommunityIcons name="trophy" size={32} color="#FFD700" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.tourneyLabel}>{t('tournament.weekend_title')}</Text>
                      <Text style={st.themeName}>{info.theme_name}</Text>
                    </View>
                    <View style={st.countdownBox}>
                      <MaterialCommunityIcons name="clock-outline" size={13} color="#FFD700" />
                      <Text style={st.countdownText}>{countdown}</Text>
                    </View>
                  </View>

                  {/* User stats row */}
                  <View style={st.statsRow}>
                    <View style={st.statItem}>
                      <Text style={st.statVal}>{info.rank ?? '—'}</Text>
                      <Text style={st.statLabel}>{t('tournament.rank')}</Text>
                    </View>
                    <View style={st.statDivider} />
                    <View style={st.statItem}>
                      <Text style={st.statVal}>{info.score}</Text>
                      <Text style={st.statLabel}>{t('tournament.score')}</Text>
                    </View>
                    <View style={st.statDivider} />
                    <View style={st.statItem}>
                      <Text style={[st.statVal, info.games_remaining === 0 && { color: '#525252' }]}>{info.games_remaining}</Text>
                      <Text style={st.statLabel}>{t('tournament.remaining')}</Text>
                    </View>
                    <View style={st.statDivider} />
                    <View style={st.statItem}>
                      <Text style={st.statVal}>{info.total_players}</Text>
                      <Text style={st.statLabel}>{t('tournament.players')}</Text>
                    </View>
                  </View>

                  {/* Play button */}
                  {info.games_remaining > 0 ? (
                    <TouchableOpacity style={st.playBtn} onPress={handlePlay} activeOpacity={0.8}>
                      <LinearGradient colors={['#FFD700', '#FF9F0A']} style={st.playGrad}>
                        <MaterialCommunityIcons name="play" size={18} color="#000" />
                        <Text style={st.playText}>{t('tournament.play_now')} ({info.games_remaining} {t('tournament.left')})</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <View style={st.doneRow}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#00FF9D" />
                      <Text style={st.doneText}>{t('tournament.done')}</Text>
                    </View>
                  )}
                </LinearGradient>

                <Text style={st.lbTitle}>{t('tournament.leaderboard')}</Text>
              </>
            )}
          />
        )}
      </View>
    </SwipeBackPage>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  backCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  noTournamentText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  noTournamentSub: { color: '#525252', fontSize: 13 },

  listContent: { paddingBottom: 40 },

  headerCard: {
    marginHorizontal: 16, marginBottom: 20, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)', padding: 18,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  trophyCircle: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,215,0,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  tourneyLabel: { fontSize: 10, color: '#FFD700', fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 },
  themeName: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  countdownBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  countdownText: { color: '#FFD700', fontSize: 13, fontWeight: '800' },

  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  statLabel: { fontSize: 9, color: '#525252', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },

  playBtn: { borderRadius: 14, overflow: 'hidden' },
  playGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  playText: { fontSize: 15, fontWeight: '900', color: '#000' },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  doneText: { color: '#00FF9D', fontSize: 14, fontWeight: '700' },

  lbTitle: { fontSize: 14, fontWeight: '800', color: '#525252', letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8 },

  entry: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  entryTop: { backgroundColor: 'rgba(255,215,0,0.04)' },
  rankBadge: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rankText: { color: '#A3A3A3', fontSize: 13, fontWeight: '800' },
  entryInfo: { flex: 1 },
  entryPseudo: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  entryGames: { color: '#525252', fontSize: 11, fontWeight: '600', marginTop: 2 },
  scoreBox: { alignItems: 'flex-end' },
  scoreVal: { color: '#FFD700', fontSize: 18, fontWeight: '900' },
  scoreLabel: { color: '#525252', fontSize: 10, fontWeight: '600' },
});

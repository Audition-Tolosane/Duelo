import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const SCOPES = [
  { id: 'world', label: 'Monde', icon: 'earth' as const },
  { id: 'continent', label: 'Continent', icon: 'map' as const },
  { id: 'country', label: 'Pays', icon: 'flag' as const },
  { id: 'region', label: 'Region', icon: 'map-marker' as const },
  { id: 'city', label: 'Ville', icon: 'city' as const },
];

const VIEWS = [
  { id: 'alltime', label: 'All-Time' },
  { id: 'seasonal', label: 'Saison' },
];

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_GRADIENTS: [string, string][] = [
  ['#FFD700', '#FFA500'],
  ['#C0C0C0', '#8A8A8A'],
  ['#CD7F32', '#8B4513'],
];

const BADGE_ICON_MAP: Record<string, { name: string; color: string }> = {
  fire: { name: 'fire', color: '#FF6B35' },
  bolt: { name: 'lightning-bolt', color: '#FFD700' },
  glow: { name: 'shimmer', color: '#00FFFF' },
};

type LeaderEntry = {
  id?: string;
  pseudo: string;
  avatar_seed: string;
  total_xp?: number;
  xp?: number;
  matches_won?: number;
  current_streak?: number;
  streak_badge?: string;
  level: number;
  title: string;
  rank: number;
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeId, themeName } = useLocalSearchParams<{ themeId?: string; themeName?: string }>();

  const isThemeMode = !!themeId;

  const [scope, setScope] = useState('world');
  const [view, setView] = useState('alltime');
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [scope, view, themeId]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const url = isThemeMode
        ? `${API_URL}/api/theme/${themeId}/leaderboard`
        : `${API_URL}/api/leaderboard?scope=${scope}&view=${view}&limit=50`;
      const res = await fetch(url);
      const data = await res.json();
      setEntries(data);
    } catch {}
    setLoading(false);
  };

  const getXp = (item: LeaderEntry) => item.total_xp ?? item.xp ?? 0;

  const renderEntry = ({ item, index }: { item: LeaderEntry; index: number }) => {
    const isTop3 = item.rank <= 3 && item.rank >= 1;
    const top3Index = item.rank - 1;
    const badgeInfo = item.streak_badge ? BADGE_ICON_MAP[item.streak_badge] : null;
    const isGlow = item.streak_badge === 'glow';

    return (
      <TouchableOpacity
        testID={`leaderboard-entry-${index}`}
        style={[styles.entry, isTop3 && styles.entryTop]}
        onPress={() => {
          if (item.id) router.push(`/player-profile?id=${item.id}`);
        }}
        activeOpacity={item.id ? 0.7 : 1}
      >
        {isTop3 ? (
          <LinearGradient
            colors={RANK_GRADIENTS[top3Index]}
            style={styles.rankBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons
              name={top3Index === 0 ? 'trophy' : top3Index === 1 ? 'medal' : 'medal-outline'}
              size={18}
              color="#FFF"
            />
          </LinearGradient>
        ) : (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{item.rank}</Text>
          </View>
        )}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.pseudo[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.entryInfo}>
          <View style={styles.pseudoRow}>
            <Text style={[styles.entryPseudo, isGlow && styles.glowText]}>{item.pseudo}</Text>
            {badgeInfo ? (
              <MaterialCommunityIcons
                name={badgeInfo.name as any}
                size={16}
                color={badgeInfo.color}
              />
            ) : null}
          </View>
          <Text style={styles.entryStats}>
            Niv. {item.level} {item.title ? `\u2022 ${item.title}` : ''}
            {item.matches_won != null ? ` \u2022 ${item.matches_won} V` : ''}
          </Text>
        </View>
        <View style={styles.xpContainer}>
          <Text style={styles.xpValue}>{getXp(item).toLocaleString()}</Text>
          <Text style={styles.xpLabel}>XP</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const headerTitle = isThemeMode
    ? `Classement ${themeName ? decodeURIComponent(themeName) : ''}`
    : 'Classement';

  return (
    <SwipeBackPage>
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top, backgroundColor: '#050510' }}>
          <DueloHeader />
        </View>

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#A3A3A3" />
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{headerTitle}</Text>

        {/* Global mode: View Toggle + Scope Filters */}
        {!isThemeMode && (
          <>
            <View style={styles.viewToggle}>
              {VIEWS.map((v) => (
                <TouchableOpacity
                  testID={`view-${v.id}`}
                  key={v.id}
                  style={[styles.viewBtn, view === v.id && styles.viewBtnActive]}
                  onPress={() => setView(v.id)}
                >
                  <Text style={[styles.viewText, view === v.id && styles.viewTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scopeScroll} contentContainerStyle={styles.scopeContainer}>
              {SCOPES.map((s) => (
                <TouchableOpacity
                  testID={`scope-${s.id}`}
                  key={s.id}
                  style={[styles.scopeBtn, scope === s.id && styles.scopeBtnActive]}
                  onPress={() => setScope(s.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.scopeInner}>
                    <MaterialCommunityIcons
                      name={s.icon}
                      size={16}
                      color={scope === s.id ? '#FFF' : '#525252'}
                    />
                    <Text style={[styles.scopeText, scope === s.id && styles.scopeTextActive]}>{s.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {view === 'seasonal' && (
              <View style={styles.seasonInfo}>
                <Text style={styles.seasonText}>
                  Saison en cours {'\u2022'} Reset le 1er du mois
                </Text>
              </View>
            )}
          </>
        )}

        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#8A2BE2" /></View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="trophy-outline" size={56} color="#525252" />
            <Text style={styles.emptyText}>Aucun joueur pour le moment</Text>
            <Text style={styles.emptySubtext}>Sois le premier a jouer !</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            renderItem={renderEntry}
            keyExtractor={(item) => item.pseudo + item.rank}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },

  // Back
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  backBtnText: { color: '#A3A3A3', fontSize: 15, fontWeight: '600', marginLeft: 2 },

  // View Toggle
  viewToggle: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 3,
  },
  viewBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  viewBtnActive: { backgroundColor: '#8A2BE2' },
  viewText: { color: '#525252', fontSize: 14, fontWeight: '700' },
  viewTextActive: { color: '#FFF' },

  // Season info
  seasonInfo: { paddingHorizontal: 20, paddingTop: 8 },
  seasonText: { color: '#525252', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },

  // Scope
  scopeScroll: { maxHeight: 50, marginVertical: 12 },
  scopeContainer: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  scopeBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  scopeBtnActive: { backgroundColor: '#8A2BE2', borderColor: '#8A2BE2' },
  scopeInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scopeText: { color: '#525252', fontSize: 13, fontWeight: '600' },
  scopeTextActive: { color: '#FFF' },

  // States
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  emptySubtext: { fontSize: 14, color: '#525252', marginTop: 4 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },
  entry: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  entryTop: { borderColor: 'rgba(138,43,226,0.2)', backgroundColor: 'rgba(138,43,226,0.06)' },
  rankBadge: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 12, overflow: 'hidden',
  },
  rankText: { fontSize: 16, fontWeight: '800', color: '#A3A3A3' },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  entryInfo: { flex: 1 },
  pseudoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryPseudo: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  glowText: { color: '#00FFFF', textShadowColor: '#00FFFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  entryStats: { fontSize: 11, color: '#525252', marginTop: 2 },
  xpContainer: { alignItems: 'flex-end' },
  xpValue: { fontSize: 16, fontWeight: '800', color: '#00FFFF' },
  xpLabel: { fontSize: 10, color: '#525252', fontWeight: '600' },
});

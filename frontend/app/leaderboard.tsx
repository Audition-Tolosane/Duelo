import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import UserAvatar from '../components/UserAvatar';
import ScalePressable from '../components/ScalePressable';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const SCOPES = [
  { id: 'world', labelKey: 'leaderboard.scope_world', icon: 'earth' as const },
  { id: 'continent', labelKey: 'leaderboard.scope_continent', icon: 'map' as const },
  { id: 'country', labelKey: 'leaderboard.scope_country', icon: 'flag' as const },
  { id: 'region', labelKey: 'leaderboard.scope_region', icon: 'map-marker' as const },
  { id: 'city', labelKey: 'leaderboard.scope_city', icon: 'city' as const },
];

const VIEWS = [
  { id: 'alltime', labelKey: 'leaderboard.view_alltime' },
  { id: 'seasonal', labelKey: 'leaderboard.view_seasonal' },
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
  avatar_url?: string;
  total_xp?: number;
  xp?: number;
  matches_won?: number;
  current_streak?: number;
  streak_badge?: string;
  level: number;
  title: string;
  rank: number;
};

type CitySuggestion = {
  city: string;
  player_count: number;
  distance_km: number;
};

type LeaderMeta = {
  scope_used: string;
  city_name?: string;
  country_name?: string;
  too_small?: boolean;
  city_player_count?: number;
  fallback?: boolean;
  missing?: boolean;
  suggestions?: CitySuggestion[];
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeId, themeName } = useLocalSearchParams<{ themeId?: string; themeName?: string }>();

  const isThemeMode = !!themeId;

  const [scope, setScope] = useState('world');
  const [view, setView] = useState('alltime');
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [meta, setMeta] = useState<LeaderMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [noLocation, setNoLocation] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, [scope, view, themeId]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setNoLocation(false);
    setMeta(null);
    try {
      const url = isThemeMode
        ? `${API_URL}/api/theme/${themeId}/leaderboard?scope=${scope}&limit=50`
        : `${API_URL}/api/leaderboard?scope=${scope}&view=${view}&limit=50`;
      const res = await authFetch(url);
      const data = await res.json();

      const responseEntries = data.entries ?? data;
      const responseMeta: LeaderMeta = data.meta ?? { scope_used: scope };
      setEntries(Array.isArray(responseEntries) ? responseEntries : []);
      setMeta(responseMeta);
      const locationScopes = ['country', 'city', 'continent', 'region'];
      if (locationScopes.includes(scope) && responseMeta.missing) {
        setNoLocation(true);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchCityLeaderboard = async (cityName: string) => {
    setLoading(true);
    setMeta(null);
    try {
      const url = isThemeMode
        ? `${API_URL}/api/theme/${themeId}/leaderboard?scope=city&city_override=${encodeURIComponent(cityName)}&limit=50`
        : `${API_URL}/api/leaderboard?scope=city&city_override=${encodeURIComponent(cityName)}&limit=50`;
      const res = await authFetch(url);
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setMeta(data.meta ?? { scope_used: 'city', city_name: cityName });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getXp = (item: LeaderEntry) => item.total_xp ?? item.xp ?? 0;

  const renderEntry = useCallback(({ item, index }: { item: LeaderEntry; index: number }) => {
    const isTop3 = item.rank <= 3 && item.rank >= 1;
    const top3Index = item.rank - 1;
    const badgeInfo = item.streak_badge ? BADGE_ICON_MAP[item.streak_badge] : null;
    const isGlow = item.streak_badge === 'glow';

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      <ScalePressable
        testID={`leaderboard-entry-${index}`}
        style={[styles.entry, isTop3 && styles.entryTop]}
        onPress={() => {
          if (item.id) router.push(`/player-profile?id=${item.id}`);
        }}
        activeOpacity={item.id ? 1 : 1}
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
          <UserAvatar avatarUrl={item.avatar_url} avatarSeed={item.avatar_seed} pseudo={item.pseudo} size={40} />
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
            {t('leaderboard.level_short')} {item.level} {item.title ? `\u2022 ${item.title}` : ''}
            {item.matches_won != null ? ` \u2022 ${item.matches_won} ${t('leaderboard.wins_short')}` : ''}
          </Text>
        </View>
        <View style={styles.xpContainer}>
          <Text style={styles.xpValue}>{getXp(item).toLocaleString()}</Text>
          <Text style={styles.xpLabel}>XP</Text>
        </View>
      </ScalePressable>
      </Animated.View>
    );
  }, [router]);

  const headerTitle = isThemeMode
    ? `${t('leaderboard.theme_ranking')} ${themeName ? decodeURIComponent(themeName) : ''}`
    : t('leaderboard.title');

  return (
    <SwipeBackPage>
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top, backgroundColor: '#050510' }}>
          <DueloHeader />
        </View>

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#A3A3A3" />
          <Text style={styles.backBtnText}>{t('leaderboard.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{headerTitle}</Text>

        {/* View Toggle — global mode only */}
        {!isThemeMode && (
          <View style={styles.viewToggle}>
            {VIEWS.map((v) => (
              <TouchableOpacity
                testID={`view-${v.id}`}
                key={v.id}
                style={[styles.viewBtn, view === v.id && styles.viewBtnActive]}
                onPress={() => setView(v.id)}
              >
                <Text style={[styles.viewText, view === v.id && styles.viewTextActive]}>{t(v.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Scope Filters — always visible */}
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
                <Text style={[styles.scopeText, scope === s.id && styles.scopeTextActive]}>{t(s.labelKey)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!isThemeMode && view === 'seasonal' && (
          <View style={styles.seasonInfo}>
            <Text style={styles.seasonText}>{t('leaderboard.season_info')}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#8A2BE2" /></View>
        ) : noLocation ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="map-marker-off" size={56} color="#525252" />
            <Text style={styles.emptyText}>{t('leaderboard.no_location')}</Text>
            <Text style={styles.emptySubtext}>{t('leaderboard.set_location_hint')}</Text>
          </View>
        ) : meta?.too_small && meta.suggestions && meta.suggestions.length > 0 ? (
          <View style={styles.suggestionsContainer}>
            <MaterialCommunityIcons name="map-marker-question" size={40} color="#525252" />
            <Text style={styles.emptyText}>{t('leaderboard.city_too_small', { city: meta.city_name ?? '', count: String(meta.city_player_count ?? 0) })}</Text>
            <Text style={styles.emptySubtext}>{t('leaderboard.nearby_cities')}</Text>
            {meta.suggestions.map((s) => (
              <TouchableOpacity
                key={s.city}
                style={styles.suggestionBtn}
                onPress={() => fetchCityLeaderboard(s.city)}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionLeft}>
                  <MaterialCommunityIcons name="city" size={18} color="#00E5FF" />
                  <Text style={styles.suggestionCity}>{s.city}</Text>
                </View>
                <View style={styles.suggestionRight}>
                  <Text style={styles.suggestionCount}>{s.player_count} joueurs</Text>
                  <Text style={styles.suggestionDist}>{s.distance_km} km</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : meta?.too_small && meta.fallback ? (
          <View style={styles.fallbackBanner}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#A3A3A3" />
            <Text style={styles.fallbackText}>{t('leaderboard.city_fallback', { city: meta.city_name ?? '', country: meta.country_name ?? '' })}</Text>
          </View>
        ) : null}

        {!loading && entries.length > 0 && (
          <FlatList
            data={entries}
            renderItem={renderEntry}
            keyExtractor={(item) => item.pseudo + item.rank}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {!loading && entries.length === 0 && !noLocation && !meta?.too_small && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="trophy-outline" size={56} color="#525252" />
            <Text style={styles.emptyText}>{t('leaderboard.empty')}</Text>
            <Text style={styles.emptySubtext}>{t('leaderboard.be_first')}</Text>
          </View>
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

  // Suggestions
  suggestionsContainer: {
    flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, gap: 10,
  },
  suggestionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', backgroundColor: 'rgba(0,229,255,0.06)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,229,255,0.15)',
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 4,
  },
  suggestionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionCity: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  suggestionRight: { alignItems: 'flex-end' },
  suggestionCount: { color: '#00E5FF', fontSize: 13, fontWeight: '700' },
  suggestionDist: { color: '#525252', fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Fallback banner
  fallbackBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  fallbackText: { color: '#A3A3A3', fontSize: 12, fontWeight: '600', flex: 1 },
});

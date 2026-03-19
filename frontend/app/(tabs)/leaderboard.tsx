import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const SCOPES = [
  { id: 'world', label: '🌍 Monde' },
  { id: 'continent', label: '🗺️ Continent' },
  { id: 'country', label: '🇫🇷 Pays' },
  { id: 'region', label: '📍 Région' },
  { id: 'city', label: '🏙️ Ville' },
];

const VIEWS = [
  { id: 'alltime', label: 'All-Time' },
  { id: 'seasonal', label: 'Saison' },
];

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const BADGE_MAP: Record<string, string> = {
  fire: '🔥',
  bolt: '⚡',
  glow: '✨',
};

type LeaderEntry = {
  pseudo: string;
  avatar_seed: string;
  total_xp: number;
  matches_won: number;
  current_streak: number;
  streak_badge: string;
  level: number;
  title: string;
  rank: number;
};

export default function LeaderboardScreen() {
  const [scope, setScope] = useState('world');
  const [view, setView] = useState('alltime');
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [scope, view]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leaderboard?scope=${scope}&view=${view}&limit=50`);
      const data = await res.json();
      setEntries(data);
    } catch {}
    setLoading(false);
  };

  const renderEntry = ({ item, index }: { item: LeaderEntry; index: number }) => {
    const isTop3 = index < 3;
    const badge = BADGE_MAP[item.streak_badge] || '';
    const isGlow = item.streak_badge === 'glow';

    return (
      <View
        testID={`leaderboard-entry-${index}`}
        style={[styles.entry, isTop3 && styles.entryTop]}
      >
        <View style={[styles.rankBadge, isTop3 && { backgroundColor: (RANK_COLORS[index] || '#8A2BE2') + '20' }]}>
          <Text style={[styles.rankText, isTop3 && { color: RANK_COLORS[index] }]}>{item.rank}</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.pseudo[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.entryInfo}>
          <View style={styles.pseudoRow}>
            <Text style={[styles.entryPseudo, isGlow && styles.glowText]}>{item.pseudo}</Text>
            {badge ? <Text style={styles.streakBadge}>{badge}</Text> : null}
          </View>
          <Text style={styles.entryStats}>Niv. {item.level} • {item.title} • {item.matches_won} V</Text>
        </View>
        <View style={styles.xpContainer}>
          <Text style={styles.xpValue}>{item.total_xp.toLocaleString()}</Text>
          <Text style={styles.xpLabel}>XP</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Classement</Text>

      {/* View Toggle (All-Time / Seasonal) */}
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

      {/* Scope Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scopeScroll} contentContainerStyle={styles.scopeContainer}>
        {SCOPES.map((s) => (
          <TouchableOpacity
            testID={`scope-${s.id}`}
            key={s.id}
            style={[styles.scopeBtn, scope === s.id && styles.scopeBtnActive]}
            onPress={() => setScope(s.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.scopeText, scope === s.id && styles.scopeTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Season info */}
      {view === 'seasonal' && (
        <View style={styles.seasonInfo}>
          <Text style={styles.seasonText}>
            Saison en cours • Reset le 1er du mois
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#8A2BE2" /></View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyText}>Aucun joueur pour le moment</Text>
          <Text style={styles.emptySubtext}>Sois le premier à jouer !</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.pseudo}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF', paddingHorizontal: 20, paddingTop: 16 },
  // View Toggle
  viewToggle: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 14,
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
  scopeText: { color: '#525252', fontSize: 13, fontWeight: '600' },
  scopeTextActive: { color: '#FFF' },
  // States
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
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
    backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 12,
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
  streakBadge: { fontSize: 14 },
  entryStats: { fontSize: 11, color: '#525252', marginTop: 2 },
  xpContainer: { alignItems: 'flex-end' },
  xpValue: { fontSize: 16, fontWeight: '800', color: '#00FFFF' },
  xpLabel: { fontSize: 10, color: '#525252', fontWeight: '600' },
});

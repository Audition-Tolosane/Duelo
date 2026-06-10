import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../theme/glassTheme';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import UserAvatar from '../components/UserAvatar';
import SwipeBackPage from '../components/SwipeBackPage';
import EmptyState from '../components/EmptyState';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type PlayerItem = {
  id: string;
  pseudo: string;
  avatar_seed: string;
  avatar_url?: string | null;
  selected_title: string;
  matches_played: number;
};

type TabType = 'followers' | 'following';

export default function FollowersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, type } = useLocalSearchParams<{ userId: string; type: TabType }>();
  const [activeTab, setActiveTab] = useState<TabType>(type === 'following' ? 'following' : 'followers');
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isFollowing = activeTab === 'following';

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    authFetch(`${API_URL}/api/player/${userId}/followers?type=${activeTab}`)
      .then(r => r.json())
      .then(data => { setPlayers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId, activeTab]);

  return (
    <SwipeBackPage>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.title}>{t('followers.community_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs Abonnés / Abonnements */}
        <View style={s.tabsWrap}>
          {(['followers', 'following'] as TabType[]).map((tab) => {
            const active = activeTab === tab;
            const label = tab === 'followers' ? t('player.followers') : t('player.following_label');
            return (
              <TouchableOpacity
                key={tab}
                style={s.tab}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab);
                }}
              >
                {/* Gradient en fond absolu : le layout est porté par le TouchableOpacity */}
                {active && (
                  <LinearGradient
                    colors={['#00E5FF', '#B366FF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={active ? s.tabActiveText : s.tabText}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color="#00E5FF" style={{ marginTop: 40 }} />
        ) : players.length === 0 ? (
          <EmptyState
            icon="👥"
            title={isFollowing ? t('followers.no_following') : t('followers.no_followers')}
            body=""
            accent="#B366FF"
          />
        ) : (
          <FlatList
            data={players}
            keyExtractor={item => item.id}
            contentContainerStyle={s.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.8}
                onPress={() => router.push(`/player-profile?id=${item.id}`)}
              >
                <UserAvatar
                  avatarUrl={item.avatar_url}
                  avatarSeed={item.avatar_seed || item.pseudo}
                  pseudo={item.pseudo}
                  size={46}
                />
                <View style={s.info}>
                  <Text style={s.pseudo}>{item.pseudo}</Text>
                  {item.selected_title ? (
                    <Text style={s.title2} numberOfLines={1}>{item.selected_title}</Text>
                  ) : null}
                </View>
                <Text style={s.matches}>{item.matches_played} {t('player.games')}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: GLASS.borderSubtle,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: {
    fontSize: 18, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF', letterSpacing: -0.5,
  },
  tabsWrap: {
    flexDirection: 'row', gap: 6, margin: 16, marginBottom: 6, padding: 3,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9, overflow: 'hidden' },
  tabText: {
    color: 'rgba(255,255,255,0.60)', fontSize: 12, fontWeight: '800',
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  tabActiveText: {
    color: '#000', fontSize: 12, fontWeight: '800',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: GLASS.bg, borderRadius: GLASS.radius,
    padding: 12, borderWidth: 1, borderColor: GLASS.borderSubtle,
  },
  info: { flex: 1 },
  pseudo: { fontSize: 14, fontWeight: '800', fontFamily: 'SpaceGrotesk_600SemiBold', color: '#FFF' },
  title2: {
    fontSize: 10, color: 'rgba(255,255,255,0.40)', fontFamily: 'JetBrainsMono_400Regular',
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 2,
  },
  matches: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrainsMono_400Regular' },
});

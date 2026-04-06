import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GLASS } from '../theme/glassTheme';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import UserAvatar from '../components/UserAvatar';
import SwipeBackPage from '../components/SwipeBackPage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type PlayerItem = {
  id: string;
  pseudo: string;
  avatar_seed: string;
  avatar_url?: string | null;
  selected_title: string;
  matches_played: number;
};

export default function FollowersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, type } = useLocalSearchParams<{ userId: string; type: 'followers' | 'following' }>();
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isFollowing = type === 'following';

  useEffect(() => {
    if (!userId) return;
    authFetch(`${API_URL}/api/player/${userId}/followers?type=${type || 'followers'}`)
      .then(r => r.json())
      .then(data => { setPlayers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId, type]);

  return (
    <SwipeBackPage>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.title}>
            {isFollowing ? t('player.following_label') : t('player.followers')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator color="#8A2BE2" style={{ marginTop: 40 }} />
        ) : players.length === 0 ? (
          <Text style={s.empty}>
            {isFollowing ? t('followers.no_following') : t('followers.no_followers')}
          </Text>
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
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: GLASS.borderSubtle,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  empty: { color: '#525252', textAlign: 'center', marginTop: 60, fontSize: 14 },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: GLASS.bg, borderRadius: GLASS.radius,
    padding: 12, borderWidth: 1, borderColor: GLASS.borderSubtle,
  },
  info: { flex: 1 },
  pseudo: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  title2: { fontSize: 11, color: '#8A2BE2', fontWeight: '600', marginTop: 2 },
  matches: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
});

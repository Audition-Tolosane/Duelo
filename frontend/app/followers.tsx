import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { authFetch } from '../utils/api';
import { t, pluralKey, getLocale } from '../utils/i18n';
import UserAvatar from '../components/UserAvatar';
import SwipeBackPage from '../components/SwipeBackPage';
import { Txt, Chip, ListRow, ScreenContainer, ScreenHeader, EmptyState, Loader } from '../components/ui';
import { COLOR, SPACE, BORDER } from '../theme/tokens';

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

// Abonnés / abonnements d'un joueur : deux puces de choix (actif = jaune), puis une liste scannable.
export default function FollowersScreen() {
  const router = useRouter();
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

  const gamesLabel = (n: number) =>
    t(pluralKey('pilot.social.games', n), { n: n.toLocaleString(getLocale()) });

  return (
    <SwipeBackPage>
      <ScreenContainer>
        <ScreenHeader title={t('followers.community_title')} />

        {/* Abonnés / Abonnements */}
        <View style={s.tabs}>
          {(['followers', 'following'] as TabType[]).map((tab) => (
            <Chip
              key={tab}
              label={tab === 'followers' ? t('pilot.social.followers') : t('pilot.social.following')}
              icon={tab === 'followers' ? 'users' : 'userPlus'}
              selected={activeTab === tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
              style={s.tab}
            />
          ))}
        </View>

        {loading ? (
          <Loader fill />
        ) : players.length === 0 ? (
          <EmptyState
            icon="users"
            title={isFollowing ? t('followers.no_following') : t('followers.no_followers')}
          />
        ) : (
          <FlatList
            data={players}
            keyExtractor={item => item.id}
            contentContainerStyle={s.list}
            renderItem={({ item, index }) => (
              <ListRow
                title={item.pseudo}
                subtitle={item.selected_title || undefined}
                leading={
                  <UserAvatar
                    avatarUrl={item.avatar_url}
                    avatarSeed={item.avatar_seed || item.pseudo}
                    pseudo={item.pseudo}
                    size={44}
                  />
                }
                trailing={<Txt variant="caption" numberOfLines={1}>{gamesLabel(item.matches_played || 0)}</Txt>}
                chevron
                onPress={() => router.push(`/player-profile?id=${item.id}`)}
                style={index > 0 ? s.rowDivider : undefined}
              />
            )}
          />
        )}
      </ScreenContainer>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.screenX, paddingVertical: SPACE.md },
  tab: { flex: 1, justifyContent: 'center' },
  list: { paddingHorizontal: SPACE.screenX, paddingBottom: SPACE.xxxl },
  rowDivider: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { t, getLocale } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import { useWS } from '../contexts/WebSocketContext';
import { Txt, Badge, ListRow, SearchField, ScreenContainer, ScreenHeader, EmptyState, Loader } from '../components/ui';
import { COLOR, SPACE, BORDER } from '../theme/tokens';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Conversation = {
  partner_id: string;
  partner_pseudo: string;
  partner_avatar_seed: string;
  partner_avatar_url?: string;
  last_message: string;
  last_message_type: string;
  last_message_time: string;
  unread_count: number;
  is_sender: boolean;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('conversations.just_now');
  if (m < 60) return `${m} min`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(diff / 86400000);
  if (d === 1) return t('conversations.yesterday');
  if (d < 7) return `${d}${t('conversations.days_short')}`;
  return new Date(dateStr).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
}

// Aperçu du dernier message (photo et carte de match nommées en toutes lettres)
function getMessagePreview(conv: Conversation): string {
  const prefix = conv.is_sender ? t('conversations.you_prefix') : '';
  if (conv.last_message_type === 'image') return `${prefix}${t('conversations.photo')}`;
  if (conv.last_message_type === 'game_card') return `${prefix}${t('conversations.match_result')}`;
  return `${prefix}${conv.last_message}`;
}

export default function ConversationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { on } = useWS();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [myPseudo, setMyPseudo] = useState('');

  useEffect(() => {
    loadConversations();
    // Refresh list when a new message is received or sent via WS
    const unsub1 = on('chat_message', () => loadConversations());
    const unsub2 = on('chat_sent', () => loadConversations());
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(conversations);
    } else {
      const q = search.toLowerCase();
      setFiltered(conversations.filter(c => c.partner_pseudo.toLowerCase().includes(q)));
    }
  }, [search, conversations]);

  const loadConversations = async () => {
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      const pseudo = await AsyncStorage.getItem('duelo_pseudo');
      if (pseudo) setMyPseudo(pseudo);
      if (!uid) { setLoading(false); return; }
      const res = await fetch(`${API_URL}/api/chat/conversations/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Load conversations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, []);

  const openChat = (conv: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat?partnerId=${conv.partner_id}&partnerPseudo=${encodeURIComponent(conv.partner_pseudo)}&partnerAvatarSeed=${encodeURIComponent(conv.partner_avatar_seed || '')}&partnerAvatarUrl=${encodeURIComponent(conv.partner_avatar_url || '')}`);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const renderConversation = ({ item }: { item: Conversation; index: number }) => {
    const hasUnread = item.unread_count > 0;
    return (
      <ListRow
        testID={`conversation-${item.partner_id}`}
        onPress={() => openChat(item)}
        leading={<UserAvatar avatarUrl={item.partner_avatar_url} avatarSeed={item.partner_avatar_seed || item.partner_id} pseudo={item.partner_pseudo} size={48} />}
        title={item.partner_pseudo}
        subtitle={getMessagePreview(item)}
        trailing={
          <View style={styles.trailing}>
            <Txt variant="caption" color={hasUnread ? COLOR.text.primary : COLOR.text.tertiary}>{timeAgo(item.last_message_time)}</Txt>
            {hasUnread ? <Badge count={item.unread_count} /> : null}
          </View>
        }
        chevron
      />
    );
  };

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader
        overline={conversations.length ? `${conversations.length} ${t('conversations.count_label')}` : undefined}
        title={t('conversations.title')}
        right={totalUnread > 0 ? <Badge count={totalUnread} /> : undefined}
      />

      <SearchField
        testID="conversations-search"
        placeholder={t('conversations.search')}
        value={search}
        onChangeText={setSearch}
        inputProps={{ autoCorrect: false }}
        style={styles.search}
      />

      {loading ? (
        <Loader fill />
      ) : filtered.length === 0 && !search ? (
        <EmptyState
          icon="message"
          title={t('conversations.your_messages')}
          message={t('conversations.empty_text')}
          actionLabel={t('conversations.find_player')}
          onAction={() => router.push('/search?tab=joueurs')}
        />
      ) : filtered.length === 0 && search ? (
        <EmptyState
          icon="search"
          title={t('conversations.no_results')}
          message={`${t('conversations.no_match')} « ${search} »`}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.partner_id}
          renderItem={renderConversation}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACE.xl }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.text.primary} />
          }
        />
      )}
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: SPACE.screenX, marginTop: SPACE.md, marginBottom: SPACE.sm },
  list: { paddingHorizontal: SPACE.screenX },
  separator: { height: BORDER.hair, backgroundColor: COLOR.border.subtle },
  trailing: { alignItems: 'flex-end', gap: SPACE.xs },
});

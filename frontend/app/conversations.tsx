import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  ActivityIndicator, RefreshControl, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CosmicBackground from '../components/CosmicBackground';
import { GLASS } from '../theme/glassTheme';
import { t, getLocale } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import { useWS } from '../contexts/WebSocketContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_W } = Dimensions.get('window');

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

const AVATAR_COLORS: [string, string][] = [
  ['#8A2BE2', '#00BFFF'],
  ['#FF6B6B', '#FFD93D'],
  ['#00FF9D', '#00BFFF'],
  ['#E040FB', '#8A2BE2'],
  ['#FF8C00', '#FF3B5C'],
  ['#00FFFF', '#8A2BE2'],
  ['#FFD700', '#FF6B35'],
  ['#4ECDC4', '#44AF69'],
];

function getAvatarColors(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(pseudo: string): string {
  return pseudo && pseudo.length > 0 ? pseudo[0].toUpperCase() : '?';
}

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

function getMessagePreview(conv: Conversation): { text: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'] } {
  const prefix = conv.is_sender ? t('conversations.you_prefix') : '';
  if (conv.last_message_type === 'image') return { text: `${prefix}${t('conversations.photo')}`, icon: 'camera' };
  if (conv.last_message_type === 'game_card') return { text: `${prefix}${t('conversations.match_result')}`, icon: 'gamepad-variant' };
  return { text: `${prefix}${conv.last_message}` };
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
    const preview = getMessagePreview(item);

    return (
      <TouchableOpacity
        data-testid={`conversation-${item.partner_id}`}
        style={[styles.convRow, hasUnread && styles.convRowUnread]}
        onPress={() => openChat(item)}
        activeOpacity={0.6}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {hasUnread && (
            <View style={styles.avatarRing}>
              <LinearGradient colors={['#00E5FF', '#B366FF']} style={styles.avatarRingGradient} />
            </View>
          )}
          <View style={styles.avatar}>
            <UserAvatar avatarUrl={item.partner_avatar_url} avatarSeed={item.partner_avatar_seed || item.partner_id} pseudo={item.partner_pseudo} size={50} />
          </View>
        </View>

        {/* Message info */}
        <View style={styles.convInfo}>
          <View style={styles.convTopRow}>
            <Text style={[styles.convName, hasUnread && styles.convNameUnread]} numberOfLines={1}>
              {item.partner_pseudo}
            </Text>
            <Text style={[styles.convTime, hasUnread && styles.convTimeUnread]}>
              {timeAgo(item.last_message_time)}
            </Text>
          </View>
          <View style={styles.convBottomRow}>
            <View style={styles.previewRow}>
              {preview.icon && (
                <MaterialCommunityIcons
                  name={preview.icon}
                  size={13}
                  color={hasUnread ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)'}
                  style={{ marginRight: 4 }}
                />
              )}
              {item.is_sender && !hasUnread && (
                <MaterialCommunityIcons
                  name="check-all"
                  size={13}
                  color="rgba(255,255,255,0.3)"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={[styles.convPreview, hasUnread && styles.convPreviewUnread]} numberOfLines={1}>
                {preview.text}
              </Text>
            </View>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <MaterialCommunityIcons name="chevron-right" size={16} color="rgba(255,255,255,0.15)" />
      </TouchableOpacity>
    );
  };

  return (
    <SwipeBackPage>
    <CosmicBackground>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DueloHeader />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity data-testid="conversations-back-btn" onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>◆ {conversations.length} {t('conversations.count_label')}</Text>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{t('conversations.title')}</Text>
              {totalUnread > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.3)" />
            <TextInput
              data-testid="conversations-search"
              style={styles.searchInput}
              placeholder={t('conversations.search')}
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#B366FF" />
          </View>
        ) : filtered.length === 0 && !search ? (
          <EmptyState
            iconName="chat-outline"
            title={t('conversations.your_messages')}
            body={t('conversations.empty_text')}
            ctaLabel={t('conversations.find_player')}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/search?tab=joueurs');
            }}
            accent="#B366FF"
          />
        ) : filtered.length === 0 && search ? (
          <EmptyState
            iconName="magnify"
            title={t('conversations.no_results')}
            body={`${t('conversations.no_match')} « ${search} »`}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.partner_id}
            renderItem={renderConversation}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2BE2" />
            }
          />
        )}
      </View>
    </CosmicBackground>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(138, 43, 226, 0.15)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerEyebrow: {
    fontSize: 9,
    fontFamily: 'JetBrainsMono_400Regular',
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    letterSpacing: -0.8,
  },
  headerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    paddingVertical: 0,
  },

  // Conversation row
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 14,
  },
  convRowUnread: {
    backgroundColor: 'rgba(0,229,255,0.06)',
  },

  // Avatar
  avatarWrap: {
    width: 52,
    height: 52,
    position: 'relative',
  },
  avatarRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatarRingGradient: {
    width: '100%' as any,
    height: '100%' as any,
    borderRadius: 28,
  },
  avatar: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#050510',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },

  // Conversation info
  convInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#FFF',
    flex: 1,
    marginRight: 8,
  },
  convNameUnread: {
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  convTime: {
    fontSize: 10,
    fontFamily: 'JetBrainsMono_400Regular',
    color: 'rgba(255,255,255,0.35)',
  },
  convTimeUnread: {
    color: '#00E5FF',
  },
  convBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  convPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
  },
  convPreviewUnread: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
});

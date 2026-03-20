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
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_W } = Dimensions.get('window');

type Conversation = {
  partner_id: string;
  partner_pseudo: string;
  partner_avatar_seed: string;
  last_message: string;
  last_message_type: string;
  last_message_time: string;
  unread_count: number;
  is_sender: boolean;
};

const AVATAR_COLORS = [
  ['#8A2BE2', '#00BFFF'],
  ['#FF6B6B', '#FFD93D'],
  ['#00FF9D', '#00BFFF'],
  ['#E040FB', '#8A2BE2'],
  ['#FF8C00', '#FF3B5C'],
  ['#00FFFF', '#8A2BE2'],
  ['#FFD700', '#FF6B35'],
  ['#4ECDC4', '#44AF69'],
];

function getAvatarColors(seed: string): string[] {
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
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(diff / 86400000);
  if (d === 1) return 'hier';
  if (d < 7) return `${d}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getMessagePreview(conv: Conversation): { text: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'] } {
  const prefix = conv.is_sender ? 'Vous : ' : '';
  if (conv.last_message_type === 'image') return { text: `${prefix}Photo`, icon: 'camera' };
  if (conv.last_message_type === 'game_card') return { text: `${prefix}Résultat de match`, icon: 'gamepad-variant' };
  return { text: `${prefix}${conv.last_message}` };
}

export default function ConversationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [myPseudo, setMyPseudo] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadConversations();
    pollRef.current = setInterval(loadConversations, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
    router.push(`/chat?partnerId=${conv.partner_id}&partnerPseudo=${encodeURIComponent(conv.partner_pseudo)}`);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const renderConversation = ({ item }: { item: Conversation; index: number }) => {
    const colors = getAvatarColors(item.partner_avatar_seed || item.partner_id);
    const hasUnread = item.unread_count > 0;
    const preview = getMessagePreview(item);

    return (
      <TouchableOpacity
        data-testid={`conversation-${item.partner_id}`}
        style={[styles.convRow, hasUnread && styles.convRowUnread]}
        onPress={() => openChat(item)}
        activeOpacity={0.6}
      >
        {/* Avatar with gradient */}
        <View style={styles.avatarWrap}>
          {hasUnread && (
            <View style={styles.avatarRing}>
              <LinearGradient colors={['#8A2BE2', '#00FFFF']} style={styles.avatarRingGradient} />
            </View>
          )}
          <LinearGradient colors={colors} style={styles.avatar}>
            <Text style={styles.avatarLetter}>{getInitial(item.partner_pseudo)}</Text>
          </LinearGradient>
          <View style={styles.onlineDot} />
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
            <MaterialCommunityIcons name="chat" size={16} color="#8A2BE2" />
            <Text style={styles.headerTitle}>Messages</Text>
            {totalUnread > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.3)" />
            <TextInput
              data-testid="conversations-search"
              style={styles.searchInput}
              placeholder="Rechercher une conversation..."
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
            <ActivityIndicator size="large" color="#8A2BE2" />
          </View>
        ) : filtered.length === 0 && !search ? (
          <View style={styles.emptyWrap}>
            <LinearGradient colors={['#8A2BE2', '#00BFFF']} style={styles.emptyCircle}>
              <MaterialCommunityIcons name="chat-outline" size={36} color="#FFF" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Vos messages</Text>
            <Text style={styles.emptyText}>
              Défiez un joueur pour commencer une conversation !
            </Text>
            <TouchableOpacity
              data-testid="start-conversation-btn"
              style={styles.emptyBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/search?tab=joueurs');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#8A2BE2', '#00BFFF']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.emptyBtnGradient}>
                <MaterialCommunityIcons name="magnify" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyBtnText}>Trouver un joueur</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 && search ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="magnify" size={48} color="#525252" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>Aucune conversation ne correspond à "{search}"</Text>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  headerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: '#FFF',
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
    backgroundColor: 'rgba(138, 43, 226, 0.05)',
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
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#00FF9D',
    borderWidth: 2.5,
    borderColor: '#050510',
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
    color: '#FFF',
    flex: 1,
    marginRight: 8,
  },
  convNameUnread: {
    fontWeight: '800',
  },
  convTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  convTimeUnread: {
    color: '#8A2BE2',
    fontWeight: '700',
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
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
  },
  emptyBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

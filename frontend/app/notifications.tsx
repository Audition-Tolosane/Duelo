import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import ScalePressable from '../components/ScalePressable';
import { t, getLocale } from '../utils/i18n';
import UserAvatar from '../components/UserAvatar';
import { authFetch } from '../utils/api';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  data: { screen?: string; params?: Record<string, string> } | null;
  actor_id: string | null;
  actor_pseudo: string | null;
  actor_avatar_seed: string | null;
  actor_avatar_url?: string | null;
  read: boolean;
  created_at: string;
}

// MCI icon + gradient for each notification type
const TYPE_META: Record<string, { icon: string; colors: [string, string]; color: string }> = {
  challenge:    { icon: 'sword-cross',    colors: ['#FF6B35', '#FF8F60'], color: '#FF6B35' },
  match_result: { icon: 'trophy',         colors: ['#8A2BE2', '#A855F7'], color: '#8A2BE2' },
  follow:       { icon: 'account-plus',   colors: ['#00D4FF', '#38BDF8'], color: '#00D4FF' },
  message:      { icon: 'chat',           colors: ['#4CAF50', '#66BB6A'], color: '#4CAF50' },
  like:         { icon: 'heart',          colors: ['#FF3B5C', '#FF6B81'], color: '#FF3B5C' },
  comment:      { icon: 'comment-text',   colors: ['#FFB800', '#FFC933'], color: '#FFB800' },
  system:       { icon: 'bell',           colors: ['#6B7280', '#9CA3AF'], color: '#888' },
};

const DEFAULT_META = { icon: 'bell-outline', colors: ['#6B7280', '#9CA3AF'] as [string, string], color: '#888' };

function translateNotif(text: string): string {
  // Format: "notif.key:actorName" or just "notif.key"
  if (text.startsWith('notif.')) {
    const colonIdx = text.indexOf(':');
    if (colonIdx > -1) {
      const key = text.substring(0, colonIdx);
      const actor = text.substring(colonIdx + 1);
      const template = t(key);
      return template.replace('{name}', actor);
    }
    return t(text);
  }
  // Fallback for old notifications already stored in French
  return text;
}

function getInitial(pseudo: string | null, seed: string | null): string {
  if (pseudo && pseudo.length > 0) return pseudo[0].toUpperCase();
  if (seed && seed.length > 0) return seed[0].toUpperCase();
  return '?';
}

function getAvatarColor(seed: string | null): string {
  if (!seed) return '#8A2BE2';
  const palette = ['#FF6B35', '#8A2BE2', '#00D4FF', '#4CAF50', '#FF3B5C', '#FFB800', '#00FF9D', '#E53935'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('notifications.just_now');
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}${t('notifications.days_short')}`;
  return date.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return t('notifications.today');
  if (diffDays === 1) return t('notifications.yesterday_label');
  if (diffDays < 7) return t('notifications.this_week');
  return t('notifications.older');
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      if (!uid) return;
      setUserId(uid);

      const res = await fetch(`${API_URL}/api/notifications/${uid}?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, []);

  const markAsRead = async (notifId: string) => {
    if (!userId) return;
    try {
      await authFetch(`${API_URL}/api/notifications/${notifId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, read: true } : n)
      );
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await authFetch(`${API_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { console.error(e); }
  };

  const handleNotificationPress = (notif: NotificationItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notif.read) {
      markAsRead(notif.id);
    }

    if (notif.data?.screen) {
      const screen = notif.data.screen;
      const params = notif.data.params || {};

      if (screen === 'player-profile' && params.id) {
        router.push(`/player-profile?id=${params.id}`);
      } else if (screen === 'chat' && params.userId) {
        router.push(`/chat?userId=${params.userId}&pseudo=${params.pseudo || ''}`);
      } else if (screen === 'category-detail' && params.id) {
        router.push(`/category-detail?id=${params.id}`);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Group notifications by date
  const sections: { title: string; data: NotificationItem[] }[] = [];
  notifications.forEach(notif => {
    const group = getDateGroup(notif.created_at);
    const existing = sections.find(g => g.title === group);
    if (existing) {
      existing.data.push(notif);
    } else {
      sections.push({ title: group, data: [notif] });
    }
  });

  // Flatten sections with headers into a single list
  const flatData: (NotificationItem | { _sectionHeader: string })[] = [];
  sections.forEach(section => {
    flatData.push({ _sectionHeader: section.title });
    section.data.forEach(item => flatData.push(item));
  });

  const renderItem = ({ item, index = 0 }: { item: NotificationItem | { _sectionHeader: string }; index?: number }) => {
    if ('_sectionHeader' in item) {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item._sectionHeader}</Text>
        </View>
      );
    }

    const meta = TYPE_META[item.type] || DEFAULT_META;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      <ScalePressable
        style={[styles.notifCard, !item.read && styles.notifCardUnread]}
        onPress={() => handleNotificationPress(item)}
      >
        {/* Unread indicator line */}
        {!item.read && <View style={[styles.unreadLine, { backgroundColor: meta.color }]} />}

        {/* Avatar or type icon */}
        <View style={styles.avatarWrap}>
          {item.actor_pseudo || item.actor_avatar_seed ? (
            <UserAvatar avatarUrl={item.actor_avatar_url} avatarSeed={item.actor_avatar_seed || ''} pseudo={item.actor_pseudo || '?'} size={46} />
          ) : (
            <LinearGradient colors={meta.colors} style={styles.avatarCircle}>
              <MaterialCommunityIcons name={meta.icon as any} size={22} color="#FFF" />
            </LinearGradient>
          )}
          {/* Small type badge on avatar */}
          <LinearGradient colors={meta.colors} style={styles.typeBadge}>
            <MaterialCommunityIcons name={meta.icon as any} size={10} color="#FFF" />
          </LinearGradient>
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <Text style={[styles.notifBody, !item.read && styles.notifBodyUnread]} numberOfLines={2}>
            {translateNotif(item.body)}
          </Text>
          <View style={styles.notifMeta}>
            <MaterialCommunityIcons name="clock-outline" size={11} color="#555" />
            <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
          </View>
        </View>

        {/* Chevron */}
        <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.2)" />
      </ScalePressable>
      </Animated.View>
    );
  };

  return (
    <SwipeBackPage>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <DueloHeader />

      {/* Sub-header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="bell" size={18} color="#8A2BE2" />
          <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.readAllBtn} onPress={markAllAsRead}>
              <MaterialCommunityIcons name="check-all" size={14} color="#8A2BE2" />
              <Text style={styles.readAllText}>{t('notifications.read_all')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/notification-settings');
            }}
          >
            <MaterialCommunityIcons name="cog-outline" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8A2BE2" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <LinearGradient colors={['#8A2BE2', '#A855F7']} style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="bell-outline" size={40} color="#FFF" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>{t('notifications.empty_title')}</Text>
          <Text style={styles.emptyText}>
            {t('notifications.empty_text')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, idx) => '_sectionHeader' in item ? `section-${item._sectionHeader}` : item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8A2BE2"
              colors={['#8A2BE2']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(138, 43, 226, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(138, 43, 226, 0.25)',
  },
  readAllText: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingBottom: 24,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    position: 'relative',
    overflow: 'hidden',
  },
  notifCardUnread: {
    backgroundColor: 'rgba(138, 43, 226, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(138, 43, 226, 0.12)',
  },
  unreadLine: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#050510',
  },
  notifContent: {
    flex: 1,
    marginRight: 8,
  },
  notifBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
  },
  notifBodyUnread: {
    color: '#FFF',
    fontWeight: '600',
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  notifTime: {
    fontSize: 12,
    color: '#555',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import ScalePressable from '../components/ScalePressable';
import { t, getLocale } from '../utils/i18n';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
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

// Icône MCI + couleur marque par type (tuile carrée teintée, cf. écran 13 du handoff)
const TYPE_META: Record<string, { icon: string; color: string }> = {
  challenge:    { icon: 'sword-cross',  color: '#00E5FF' },
  match_result: { icon: 'trophy',       color: '#FFB547' },
  follow:       { icon: 'account-plus', color: '#B366FF' },
  message:      { icon: 'chat',         color: '#32E7A3' },
  like:         { icon: 'heart',        color: '#FF3D5E' },
  comment:      { icon: 'comment-text', color: '#FFB547' },
  system:       { icon: 'bell',         color: 'rgba(255,255,255,0.5)' },
};

const DEFAULT_META = { icon: 'bell-outline', color: 'rgba(255,255,255,0.5)' };

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
        {/* Avatar ou tuile carrée teintée par type (écran 13) */}
        <View style={styles.avatarWrap}>
          {item.actor_pseudo || item.actor_avatar_seed ? (
            <>
              <UserAvatar avatarUrl={item.actor_avatar_url} avatarSeed={item.actor_avatar_seed || ''} pseudo={item.actor_pseudo || '?'} size={44} />
              <View style={[styles.typeBadge, { backgroundColor: '#050510', borderColor: meta.color + '66' }]}>
                <MaterialCommunityIcons name={meta.icon as any} size={10} color={meta.color} />
              </View>
            </>
          ) : (
            <View style={[styles.iconTile, { backgroundColor: meta.color + '20', borderColor: meta.color + '40' }]}>
              <MaterialCommunityIcons name={meta.icon as any} size={20} color={meta.color} />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <Text style={[styles.notifBody, !item.read && styles.notifBodyUnread]} numberOfLines={2}>
            {translateNotif(item.body)}
          </Text>
          <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
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
          <Text style={styles.headerEyebrow}>◆ {unreadCount} {t('notifications.unread_label')}</Text>
          <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        </View>

        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.readAllBtn} onPress={markAllAsRead}>
              <MaterialCommunityIcons name="check-all" size={14} color="#00E5FF" />
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
          <ActivityIndicator size="large" color="#B366FF" />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          iconName="bell-outline"
          title={t('notifications.empty_title')}
          body={t('notifications.empty_text')}
          accent="#B366FF"
        />
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
              tintColor="#B366FF"
              colors={['#B366FF']}
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
    borderBottomColor: 'rgba(179,102,255,0.15)',
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    letterSpacing: -0.8,
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
    backgroundColor: 'rgba(0,229,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
  },
  readAllText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_600SemiBold',
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
    fontSize: 10,
    fontFamily: 'JetBrainsMono_700Bold',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
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
    backgroundColor: 'rgba(0,229,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.18)',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  // Tuile carrée teintée par type (écran 13 du handoff)
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
  notifTime: {
    fontSize: 9,
    fontFamily: 'JetBrainsMono_400Regular',
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 1,
    marginTop: 4,
  },
});

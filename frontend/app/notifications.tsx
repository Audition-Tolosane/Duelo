import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';

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
  read: boolean;
  created_at: string;
}

function getAvatar(seed: string | null) {
  if (!seed) return '👤';
  const emojis = ['🐯', '🦊', '🐸', '🦄', '🐺', '🦅', '🐲', '🐼', '🦁', '🐙', '🐬', '🦋'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return emojis[Math.abs(hash) % emojis.length];
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `il y a ${minutes}m`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days < 7) return `il y a ${days}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return 'Cette semaine';
  return 'Plus ancien';
}

const TYPE_COLORS: Record<string, string> = {
  challenge: '#FF6B35',
  match_result: '#8A2BE2',
  follow: '#00D4FF',
  message: '#4CAF50',
  like: '#FF3B5C',
  comment: '#FFB800',
  system: '#888',
};

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
      await fetch(`${API_URL}/api/notifications/${notifId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, read: true } : n)
      );
    } catch {}
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const handleNotificationPress = (notif: NotificationItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notif.read) {
      markAsRead(notif.id);
    }

    // Deep linking
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
  const groupedNotifications = notifications.reduce<{ title: string; data: NotificationItem[] }[]>(
    (acc, notif) => {
      const group = getDateGroup(notif.created_at);
      const existing = acc.find(g => g.title === group);
      if (existing) {
        existing.data.push(notif);
      } else {
        acc.push({ title: group, data: [notif] });
      }
      return acc;
    },
    []
  );

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const typeColor = TYPE_COLORS[item.type] || '#888';

    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.notifCardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Unread dot */}
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: typeColor }]} />}

        {/* Avatar / Icon */}
        <View style={[styles.notifIconWrap, { backgroundColor: `${typeColor}20` }]}>
          {item.actor_avatar_seed ? (
            <Text style={styles.notifAvatar}>{getAvatar(item.actor_avatar_seed)}</Text>
          ) : (
            <Text style={styles.notifIcon}>{item.icon}</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <Text style={[styles.notifBody, !item.read && styles.notifBodyUnread]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
        </View>

        {/* Type indicator */}
        <View style={[styles.typeIndicator, { backgroundColor: typeColor }]}>
          <Text style={styles.typeIcon}>{item.icon}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SwipeBackPage>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.readAllBtn} onPress={markAllAsRead}>
              <Text style={styles.readAllText}>Tout lire</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/notification-settings');
            }}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
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
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptyText}>
            Tu recevras des notifications pour les défis, messages, follows et interactions.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8A2BE2"
              colors={['#8A2BE2']}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#FFF',
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
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(138, 43, 226, 0.15)',
  },
  readAllText: {
    color: '#8A2BE2',
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
  },
  settingsIcon: {
    fontSize: 16,
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
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
  listContent: {
    paddingVertical: 8,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginLeft: 72,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
  notifCardUnread: {
    backgroundColor: 'rgba(138, 43, 226, 0.04)',
  },
  unreadDot: {
    position: 'absolute',
    left: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notifIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifAvatar: {
    fontSize: 24,
  },
  notifIcon: {
    fontSize: 22,
  },
  notifContent: {
    flex: 1,
    marginRight: 12,
  },
  notifBody: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 20,
  },
  notifBodyUnread: {
    color: '#FFF',
    fontWeight: '600',
  },
  notifTime: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  typeIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  typeIcon: {
    fontSize: 12,
  },
});

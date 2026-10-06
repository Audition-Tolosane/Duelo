import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import { t, getLocale } from '../utils/i18n';
import UserAvatar from '../components/UserAvatar';
import { authFetch } from '../utils/api';
import { Txt, Icon, IconName, IconButton, ScreenContainer, ScreenHeader, EmptyState, Loader } from '../components/ui';
import { COLOR, SPACE, SIZE, BORDER, ICON_SIZE } from '../theme/tokens';

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

// Pictogramme Lucide par type. Couleur = rôle : défi = corail (événement), résultat = or (récompense),
// le reste en crème neutre (jamais de cyan / violet).
const TYPE_META: Record<string, { icon: IconName; color: string }> = {
  challenge:    { icon: 'duel',     color: COLOR.accent.warm },
  match_result: { icon: 'trophy',   color: COLOR.reward.gold },
  follow:       { icon: 'userPlus', color: COLOR.text.secondary },
  message:      { icon: 'message',  color: COLOR.text.secondary },
  like:         { icon: 'heart',    color: COLOR.text.secondary },
  comment:      { icon: 'message',  color: COLOR.text.secondary },
  system:       { icon: 'bell',     color: COLOR.text.secondary },
};

const DEFAULT_META: { icon: IconName; color: string } = { icon: 'bell', color: COLOR.text.secondary };

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
          <Txt variant="overline">{item._sectionHeader}</Txt>
        </View>
      );
    }

    const meta = TYPE_META[item.type] || DEFAULT_META;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      <Pressable
        style={({ pressed }) => [styles.notifRow, pressed && styles.pressed]}
        onPress={() => handleNotificationPress(item)}
        accessibilityRole="button"
      >
        {/* Avatar de l'auteur + pastille de type, ou pictogramme seul */}
        <View>
          {item.actor_pseudo || item.actor_avatar_seed ? (
            <>
              <UserAvatar avatarUrl={item.actor_avatar_url} avatarSeed={item.actor_avatar_seed || ''} pseudo={item.actor_pseudo || '?'} size={44} />
              <View style={styles.typeBadge}>
                <Icon name={meta.icon} size={12} color={meta.color} />
              </View>
            </>
          ) : (
            <View style={styles.iconTile}>
              <Icon name={meta.icon} size={ICON_SIZE.md} color={meta.color} />
            </View>
          )}
        </View>

        <View style={styles.notifContent}>
          <Txt
            variant={item.read ? 'bodySmall' : 'body'}
            color={item.read ? COLOR.text.secondary : COLOR.text.primary}
            numberOfLines={2}
          >
            {translateNotif(item.body)}
          </Txt>
          <Txt variant="caption" style={styles.tabular}>{getTimeAgo(item.created_at)}</Txt>
        </View>

        {/* Non lu : pastille corail (un événement attend le joueur) */}
        {!item.read ? <View style={styles.unreadDot} accessibilityLabel={t('notifications.unread_label')} /> : null}
        <Icon name="chevronRight" size={18} color={COLOR.text.disabled} />
      </Pressable>
      </Animated.View>
    );
  };

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader
        title={t('notifications.title')}
        overline={unreadCount > 0 ? `${unreadCount} ${t('notifications.unread_label')}` : undefined}
        right={
          <IconButton
            icon="settings"
            accessibilityLabel={t('pilot.settings.title')}
            onPress={() => router.push('/notification-settings')}
          />
        }
      />

      {/* « Tout lire » : action secondaire nommée (pas d'icône seule ambiguë) */}
      {!loading && unreadCount > 0 && (
        <View style={styles.toolbar}>
          <Pressable
            onPress={markAllAsRead}
            accessibilityRole="button"
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [styles.readAllBtn, pressed && styles.pressed]}
          >
            <Icon name="readAll" size={ICON_SIZE.sm} color={COLOR.action.primary} />
            <Txt variant="label" color={COLOR.action.primary}>{t('notifications.read_all')}</Txt>
          </Pressable>
        </View>
      )}

      {loading ? (
        <Loader fill />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title={t('notifications.empty_title')}
          message={t('notifications.empty_text')}
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
              tintColor={COLOR.text.primary}
              colors={[COLOR.text.primary]}
              progressBackgroundColor={COLOR.surface.card}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACE.screenX,
    paddingTop: SPACE.sm,
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    minHeight: SIZE.chip,
  },
  sectionHeader: {
    paddingHorizontal: SPACE.screenX,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xs,
  },
  listContent: {
    paddingBottom: SPACE.xxl,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: SIZE.listRow,
    paddingHorizontal: SPACE.screenX,
    paddingVertical: SPACE.md,
    borderBottomWidth: BORDER.hair,
    borderBottomColor: COLOR.border.subtle,
  },
  pressed: { opacity: 0.7 },
  iconTile: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    backgroundColor: COLOR.surface.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLOR.bg.primary,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
    gap: SPACE.xxs,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLOR.accent.warm,
  },
});

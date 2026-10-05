import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useWS } from '../contexts/WebSocketContext';
import { Wordmark, IconButton } from './ui';
import { SIZE, SPACE } from '../theme/tokens';
import { t } from '../utils/i18n';

// ── En-tête global des onglets ────────────────────────────────────────────────
// Logotype SKILKI à gauche, 4 actions de 44 px à droite, fond transparent (le fond
// nuit pétrole est porté par le conteneur). C'est le SEUL endroit des pastilles de
// notification : la tab bar n'en affiche plus.
// Hauteur fixe SIZE.header (46 px) : synchronisée avec HEADER_ROW_H du layout des onglets.

export default function DueloHeader() {
  const router = useRouter();
  const { unreadMessages: unreadCount, unreadNotifs: notifCount } = useWS();

  // L'haptique légère est portée par IconButton.
  const go = (path: string) => router.push(path as any);

  return (
    <View style={styles.header}>
      <Wordmark size="sm" />

      <View style={styles.actions}>
        <IconButton icon="search" accessibilityLabel={t('common.search')} onPress={() => go('/search')} testID="header-search" />
        <IconButton icon="shop" accessibilityLabel={t('pilot.header.shop')} onPress={() => go('/shop')} testID="header-shop" />
        <IconButton
          icon="message"
          accessibilityLabel={t('conversations.title')}
          count={unreadCount > 0 ? unreadCount : undefined}
          onPress={() => go('/conversations')}
          testID="header-messages"
        />
        <IconButton
          icon="bell"
          accessibilityLabel={t('notifications.title')}
          count={notifCount > 0 ? notifCount : undefined}
          onPress={() => go('/notifications')}
          testID="header-notifications"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: SIZE.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.screenX,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../theme/glassTheme';
import { useWS } from '../contexts/WebSocketContext';

// Header icon assets
const HEADER_ICONS = {
  search: require('../assets/header/search.webp'),
  message: require('../assets/header/message.webp'),
  notification: require('../assets/header/notification.webp'),
  logo: require('../assets/header/duelo_logo.webp'),
};

export default function DueloHeader() {
  const router = useRouter();
  const { unreadMessages: unreadCount, unreadNotifs: notifCount } = useWS();

  return (
    <View style={styles.header}>
      {/* Left: Search */}
      <View style={styles.leftSection}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/search');
          }}
          activeOpacity={0.7}
        >
          <Image source={HEADER_ICONS.search} style={styles.headerIcon} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      {/* Center: DUELO Logo (absolutely centered) */}
      <View style={styles.logoContainer}>
        <Image source={HEADER_ICONS.logo} style={styles.logoImage} resizeMode="contain" />
      </View>

      {/* Right: Messages + Notifications */}
      <View style={styles.rightIcons}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/conversations');
          }}
          activeOpacity={0.7}
        >
          <Image source={HEADER_ICONS.message} style={styles.headerIcon} resizeMode="contain" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/notifications');
          }}
          activeOpacity={0.7}
        >
          <Image source={HEADER_ICONS.notification} style={styles.headerIcon} resizeMode="contain" />
          {notifCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.badgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: GLASS.bgDark,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.borderCyan,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any,
      default: {},
    }),
  },
  leftSection: {
    width: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerIcon: {
    width: 40,
    height: 40,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 140,
    height: 36,
  },
  rightIcons: {
    width: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  notifBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});

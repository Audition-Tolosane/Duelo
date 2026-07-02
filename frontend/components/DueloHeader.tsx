import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useWS } from '../contexts/WebSocketContext';

const LOGO = require('../assets/header/duelo_logo.webp');

// Icônes monochromes — la couleur est réservée aux badges (convention charte)
const ICON_COLOR = 'rgba(255,255,255,0.80)';

function SearchIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={ICON_COLOR} strokeWidth="2" />
      <Line x1="15.5" y1="15.5" x2="21" y2="21" stroke={ICON_COLOR} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function MessageIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={ICON_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
      />
    </Svg>
  );
}

function ShopIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
        stroke={ICON_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <Line x1="3" y1="6" x2="21" y2="6" stroke={ICON_COLOR} strokeWidth="2" strokeLinecap="round" />
      <Path d="M16 10a4 4 0 0 1-8 0" stroke={ICON_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BellIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={ICON_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={ICON_COLOR} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
// Header sobre : logo à gauche, actions fantômes à droite, fond transparent
// (l'écran flotte sur le fond cosmique — pas de bandeau plein ni de bordure).

export default function DueloHeader() {
  const router = useRouter();
  const { unreadMessages: unreadCount, unreadNotifs: notifCount } = useWS();

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as any);
  };

  return (
    <View style={styles.header}>

      {/* Logo à gauche */}
      <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />

      {/* Actions à droite — pastilles glass discrètes, icônes monochromes */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => go('/search')} activeOpacity={0.7}>
          <SearchIcon />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={() => go('/shop')} activeOpacity={0.7}>
          <ShopIcon />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={() => go('/conversations')} activeOpacity={0.7}>
          <MessageIcon />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={() => go('/notifications')} activeOpacity={0.7}>
          <BellIcon />
          {notifCount > 0 && (
            <View style={styles.badge}>
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
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  logoImage: { width: 104, height: 28 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  badge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF3D5E',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#050510',
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', lineHeight: 12 },
});

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWS } from '../contexts/WebSocketContext';
import { COLORS, RADIUS, SPACING } from '../theme/tokens';
import { FONTS } from '../theme/fonts';
import { t } from '../utils/i18n';

// Écran 33 — Hors ligne. Overlay plein écran branché sur WebSocketContext.
// N'apparaît que si l'utilisateur est connecté (logué) ET que la socket, déjà
// établie une fois, est retombée. Un délai anti-flicker évite les coupures brèves.
const SHOW_DELAY_MS = 1800;

export default function OfflineOverlay() {
  const { isConnected } = useWS();
  const [loggedIn, setLoggedIn] = useState(false);
  const [visible, setVisible] = useState(false);
  const wasConnectedRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Savoir si on a un utilisateur logué (sinon on est sur onboarding/index).
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('duelo_user_id').then((id) => {
      if (mounted) setLoggedIn(!!id);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isConnected) wasConnectedRef.current = true;

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    const shouldShow = loggedIn && wasConnectedRef.current && !isConnected;
    if (shouldShow) {
      showTimerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    } else {
      setVisible(false);
    }

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, [isConnected, loggedIn]);

  // Pulse du point « Reconnexion… »
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.iconWrap}>
        <View style={styles.iconHalo} />
        <View style={styles.iconTile}>
          <MaterialCommunityIcons name="wifi-off" size={48} color={COLORS.red} />
        </View>
      </View>

      <Text style={styles.eyebrow}>◆ {t('offline.eyebrow')}</Text>
      <Text style={styles.title}>{t('offline.title')}</Text>
      <Text style={styles.body}>{t('offline.body')}</Text>

      <View style={styles.pill}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        <Text style={styles.pillText}>{t('offline.reconnecting')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: COLORS.abyss,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    marginBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: 'rgba(255,61,94,0.14)',
  },
  iconTile: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,61,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FONTS.mono.bold,
    fontSize: 10,
    letterSpacing: 2.5,
    color: COLORS.red,
  },
  title: {
    fontFamily: FONTS.display.bold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: COLORS.white,
    marginTop: 6,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.display.regular,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.dim2,
    maxWidth: 260,
    marginTop: 8,
    textAlign: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  pillText: {
    fontFamily: FONTS.display.bold,
    fontSize: 13,
    color: COLORS.white,
  },
});

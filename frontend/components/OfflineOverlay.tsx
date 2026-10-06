import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWS } from '../contexts/WebSocketContext';
import { Txt, Icon } from './ui';
import { COLOR, SPACE, RADII, BORDER } from '../theme/tokens';
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

  // Une coupure réseau n'est pas une faute du joueur : pictogramme crème, pas de rouge plein écran.
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.iconWrap}><Icon name="offline" size={32} color={COLOR.text.secondary} /></View>

      <Txt variant="overline">{t('offline.eyebrow')}</Txt>
      <Txt variant="h2" align="center">{t('offline.title')}</Txt>
      <Txt variant="body" color={COLOR.text.secondary} align="center" style={styles.body}>{t('offline.body')}</Txt>

      <View style={styles.pill}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        <Txt variant="label" color={COLOR.text.primary}>{t('offline.reconnecting')}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    backgroundColor: COLOR.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.xxxl,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLOR.surface.subtle,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.sm,
  },
  body: { maxWidth: 300 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginTop: SPACE.lg,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADII.pill,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLOR.text.secondary,
  },
});

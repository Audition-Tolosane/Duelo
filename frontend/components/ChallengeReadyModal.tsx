import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWS } from '../contexts/WebSocketContext';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

const TIMEOUT_SECONDS = 30;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// This modal is for Player B (the challenged player) receiving a real-time challenge
export default function ChallengeReadyModal() {
  const { on } = useWS();
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  const [challengerPseudo, setChallengerPseudo] = useState('');
  const [themeName, setThemeName] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [themeId, setThemeId] = useState('');
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);
  const [accepting, setAccepting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const dismiss = () => {
    clearTimer();
    progressAnim.stopAnimation();
    setVisible(false);
    setAccepting(false);
  };

  useEffect(() => {
    const unsubs = [
      // challenge_incoming = Player B receives a real-time challenge from Player A
      on('challenge_incoming', (msg: any) => {
        const data = msg.data || {};
        setChallengerPseudo(data.challenger_pseudo || 'Joueur');
        setThemeName(data.theme_name || '');
        setChallengeId(data.challenge_id || '');
        setThemeId(data.theme_id || '');
        setCountdown(TIMEOUT_SECONDS);
        setVisible(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        progressAnim.setValue(1);
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: TIMEOUT_SECONDS * 1000,
          useNativeDriver: false,
        }).start(() => dismiss());

        clearTimer();
        let remaining = TIMEOUT_SECONDS;
        timerRef.current = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) clearTimer();
        }, 1000);
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      clearTimer();
    };
  }, []);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const res = await authFetch(`${API_URL}/api/challenges/${challengeId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        const data = await res.json();
        dismiss();
        const roomId = data.room_id;
        if (roomId) {
          router.push(
            `/matchmaking?room_id=${roomId}&category=${themeId}&challenge=true&opponentPseudo=${encodeURIComponent(challengerPseudo)}&themeName=${encodeURIComponent(themeName)}`
          );
        } else if (themeId) {
          router.push(`/matchmaking?category=${themeId}&themeName=${encodeURIComponent(themeName)}`);
        } else {
          router.push('/(tabs)/play');
        }
      }
    } catch {}
    setAccepting(false);
  };

  const handleDecline = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismiss();
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      await authFetch(`${API_URL}/api/challenges/${challengeId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
    } catch {}
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDecline}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient colors={['#BF5FFF', '#8A2BE2']} style={styles.iconCircle}>
            <MaterialCommunityIcons name="sword-cross" size={32} color="#FFF" />
          </LinearGradient>

          <Text style={styles.title}>{t('challenge.incoming_title')}</Text>
          <Text style={styles.subtitle}>
            <Text style={styles.pseudo}>{challengerPseudo}</Text>{' '}
            {t('challenge.vs')}
          </Text>

          {themeName ? (
            <View style={styles.themeBadge}>
              <MaterialCommunityIcons name="star" size={12} color="#BF5FFF" />
              <Text style={styles.themeText}>{themeName}</Text>
            </View>
          ) : null}

          <View style={styles.progressBg}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.countdownText}>{countdown}s</Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={18} color="#FF3B30" />
              <Text style={styles.declineText}>{t('challenge.decline')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
              onPress={handleAccept}
              disabled={accepting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#BF5FFF', '#8A2BE2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptGradient}
              >
                {/* #42 — spinner while accept API call is in flight */}
                {accepting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <MaterialCommunityIcons name="sword-cross" size={18} color="#FFF" />}
                <Text style={styles.acceptText}>{accepting ? '...' : t('challenge.accept')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#0D0D1A',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(191,95,255,0.3)',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#BF5FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#A3A3A3',
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  pseudo: {
    color: '#BF5FFF',
    fontWeight: '800',
  },
  themeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(191,95,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  themeText: {
    color: '#BF5FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  progressBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#BF5FFF',
    borderRadius: 2,
  },
  countdownText: {
    fontSize: 12,
    color: '#525252',
    fontWeight: '600',
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  declineText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '700',
  },
  acceptBtn: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 14,
  },
  acceptText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

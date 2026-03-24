import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWS } from '../contexts/WebSocketContext';
import { t } from '../utils/i18n';

const TIMEOUT_SECONDS = 15;

export default function RematchModal() {
  const { on, send } = useWS();
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  const [proposerPseudo, setProposerPseudo] = useState('');
  const [themeId, setThemeId] = useState('');
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);

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
    setVisible(false);
  };

  useEffect(() => {
    const unsubs = [
      on('rematch_proposal', (msg: any) => {
        const data = msg.data || {};
        setProposerPseudo(data.proposer_pseudo || 'Joueur');
        setThemeId(data.theme_id || '');
        setCountdown(TIMEOUT_SECONDS);
        setVisible(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        // Countdown animation
        progressAnim.setValue(1);
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: TIMEOUT_SECONDS * 1000,
          useNativeDriver: false,
        }).start();

        // Countdown timer
        clearTimer();
        let t = TIMEOUT_SECONDS;
        timerRef.current = setInterval(() => {
          t -= 1;
          setCountdown(t);
          if (t <= 0) {
            clearTimer();
          }
        }, 1000);
      }),

      on('rematch_expired', () => {
        dismiss();
      }),

      on('rematch_accepted', (msg: any) => {
        // If we're the opponent who just accepted, navigate to matchmaking
        dismiss();
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      clearTimer();
    };
  }, []);

  const handleAccept = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    send({ action: 'rematch_accept' });
    dismiss();
    router.push(`/matchmaking?category=${themeId}`);
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ action: 'rematch_decline' });
    dismiss();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDecline}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Sword icon */}
          <LinearGradient
            colors={['#8A2BE2', '#6A1FB0']}
            style={styles.iconCircle}
          >
            <MaterialCommunityIcons name="sword-cross" size={32} color="#FFF" />
          </LinearGradient>

          <Text style={styles.title}>{t('rematch.title')}</Text>
          <Text style={styles.subtitle}>
            <Text style={styles.pseudo}>{proposerPseudo}</Text> {t('rematch.wants_rematch')}
          </Text>

          {/* Countdown bar */}
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

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={18} color="#FF3B30" />
              <Text style={styles.declineText}>{t('rematch.decline')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
              <LinearGradient
                colors={['#00FF9D', '#00C97A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptGradient}
              >
                <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                <Text style={styles.acceptText}>{t('rematch.accept')}</Text>
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
    borderColor: 'rgba(138,43,226,0.3)',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#A3A3A3',
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  pseudo: {
    color: '#8A2BE2',
    fontWeight: '800',
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
    backgroundColor: '#8A2BE2',
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

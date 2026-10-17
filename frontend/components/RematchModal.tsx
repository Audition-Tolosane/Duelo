import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWS } from '../contexts/WebSocketContext';
import { getResultsOpponent } from '../utils/rematchState';
import { t } from '../utils/i18n';
import { Txt, Button, Dialog } from './ui';
import { COLOR, SPACE, RADII } from '../theme/tokens';

const TIMEOUT_SECONDS = 15;

export default function RematchModal() {
  const { on, send } = useWS();
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  const [proposerPseudo, setProposerPseudo] = useState('');
  const [themeId, setThemeId] = useState('');
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Vrai entre notre « Accepter » et la réponse du serveur (qui fournit la salle privée).
  const acceptingRef = useRef<{ themeId: string; proposer: string } | null>(null);
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
        // L'écran de résultats contre ce joueur affiche déjà la demande (bouton Accepter).
        if (data.proposer_id && data.proposer_id === getResultsOpponent()) return;
        setProposerPseudo(data.proposer_pseudo || t('pilot.challenge.someone'));
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
        let remaining = TIMEOUT_SECONDS;
        timerRef.current = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) {
            dismiss();
          }
        }, 1000);
      }),

      on('rematch_expired', () => {
        dismiss();
      }),

      on('rematch_accepted', (msg: any) => {
        dismiss();
        // Nous avons accepté : on rejoint la salle privée créée par le serveur pour les deux joueurs.
        const accepting = acceptingRef.current;
        if (!accepting) return;
        acceptingRef.current = null;
        const roomId = msg?.data?.room_id;
        const theme = msg?.data?.theme_id || accepting.themeId;
        router.replace(
          roomId
            ? `/matchmaking?room_id=${roomId}&category=${theme}&challenge=true&rematch=true&opponentPseudo=${encodeURIComponent(accepting.proposer)}`
            : `/matchmaking?category=${theme}`
        );
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      clearTimer();
    };
  }, []);

  const handleAccept = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    acceptingRef.current = { themeId, proposer: proposerPseudo };
    send({ action: 'rematch_accept' });
    dismiss();
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ action: 'rematch_decline' });
    dismiss();
  };

  if (!visible) return null;

  // Revanche proposée = événement (corail), même modale que le défi reçu : un seul CTA jaune.
  // Pas de fermeture en touchant le voile : refuser doit rester un choix explicite.
  return (
    <Dialog
      visible
      onClose={handleDecline}
      dismissable={false}
      icon="replay"
      tone="event"
      title={t('pilot.rematch.title')}
      actions={
        <>
          <Button label={t('rematch.accept')} icon="duel" fullWidth haptic={false} onPress={handleAccept} />
          <Button label={t('rematch.decline')} variant="ghost" fullWidth haptic={false} onPress={handleDecline} />
        </>
      }
    >
      <Txt variant="body" color={COLOR.text.secondary} align="center">
        <Txt variant="body" color={COLOR.player.opponentText}>{proposerPseudo}</Txt>
        {' '}{t('rematch.wants_rematch')}
      </Txt>

      {/* Temps restant pour répondre */}
      <View style={styles.timer}>
        <View style={styles.progressBg}>
          <Animated.View
            style={[
              styles.progressBar,
              { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
        <Txt variant="caption" align="center">{t('pilot.challenge.seconds_left', { n: String(countdown) })}</Txt>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  timer: { gap: SPACE.xs },
  progressBg: {
    width: '100%',
    height: 4,
    backgroundColor: COLOR.track,
    borderRadius: RADII.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLOR.accent.warm,
    borderRadius: RADII.xs,
  },
});

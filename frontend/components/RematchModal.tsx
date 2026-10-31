import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWS } from '../contexts/WebSocketContext';
import { getResultsOpponent } from '../utils/rematchState';
import { t } from '../utils/i18n';
import { Txt, Button, Dialog } from './ui';
import { COLOR, SPACE, RADII } from '../theme/tokens';

const TIMEOUT_SECONDS = 30;

// Fenêtre « X veut une revanche » : la même que pour un défi reçu. Utilisée par la pop-up
// globale ci-dessous et par l'écran de résultats (qui gère lui-même son adversaire).
// `receivedAt` : instant de la proposition, pour que le décompte reste juste même si la
// fenêtre s'ouvre en retard (après la fenêtre des récompenses).
export function RematchDialog({ pseudo, receivedAt, onAccept, onDecline, onExpire }: {
  pseudo: string; receivedAt: number; onAccept: () => void; onDecline: () => void; onExpire: () => void;
}) {
  const remainingAt = () => Math.max(0, TIMEOUT_SECONDS - Math.floor((Date.now() - receivedAt) / 1000));
  const [countdown, setCountdown] = useState(remainingAt);
  const progressAnim = useRef(new Animated.Value(remainingAt() / TIMEOUT_SECONDS)).current;
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const leftMs = Math.max(0, TIMEOUT_SECONDS * 1000 - (Date.now() - receivedAt));
    Animated.timing(progressAnim, { toValue: 0, duration: leftMs, useNativeDriver: false }).start();
    const timer = setInterval(() => {
      const left = remainingAt();
      setCountdown(left);
      if (left <= 0) {
        clearInterval(timer);
        onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [receivedAt]);

  // Revanche proposée = événement (corail), même modale que le défi reçu : un seul CTA jaune.
  // Pas de fermeture en touchant le voile : refuser doit rester un choix explicite.
  return (
    <Dialog
      visible
      fullWindow
      onClose={onDecline}
      dismissable={false}
      icon="replay"
      tone="event"
      title={t('pilot.rematch.title')}
      actions={
        <>
          <Button label={t('rematch.accept')} icon="duel" fullWidth haptic={false} onPress={onAccept} />
          <Button label={t('rematch.decline')} variant="ghost" fullWidth haptic={false} onPress={onDecline} />
        </>
      }
    >
      <Txt variant="body" color={COLOR.text.secondary} align="center">
        <Txt variant="body" color={COLOR.player.opponentText}>{pseudo}</Txt>
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

export default function RematchModal() {
  const { on, send } = useWS();
  const router = useRouter();

  const [proposal, setProposal] = useState<{ pseudo: string; themeId: string; receivedAt: number } | null>(null);
  // Vrai entre notre « Accepter » et la réponse du serveur (qui fournit la salle privée).
  const acceptingRef = useRef<{ themeId: string; proposer: string } | null>(null);

  useEffect(() => {
    const unsubs = [
      on('rematch_proposal', (msg: any) => {
        const data = msg.data || {};
        // L'écran de résultats contre ce joueur affiche lui-même la même fenêtre.
        if (data.proposer_id && data.proposer_id === getResultsOpponent()) return;
        setProposal({
          pseudo: data.proposer_pseudo || t('pilot.challenge.someone'),
          themeId: data.theme_id || '',
          receivedAt: Date.now(),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }),

      on('rematch_expired', () => {
        setProposal(null);
      }),

      on('rematch_accepted', (msg: any) => {
        setProposal(null);
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

    return () => unsubs.forEach((u) => u());
  }, []);

  if (!proposal) return null;

  const handleAccept = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    acceptingRef.current = { themeId: proposal.themeId, proposer: proposal.pseudo };
    send({ action: 'rematch_accept' });
    setProposal(null);
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ action: 'rematch_decline' });
    setProposal(null);
  };

  return (
    <RematchDialog
      pseudo={proposal.pseudo}
      receivedAt={proposal.receivedAt}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onExpire={() => setProposal(null)}
    />
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

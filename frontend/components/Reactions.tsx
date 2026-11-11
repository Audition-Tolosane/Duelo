import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Dialog, Button, Icon, Txt } from './ui';
import { COLOR, SPACE, RADII, BORDER, ELEVATION, PALETTE } from '../theme/tokens';
import { t } from '../utils/i18n';
import {
  DUEL_REACTIONS, FREE_EMOJIS, FREE_PHRASES, LOCKED_EMOJIS, LOCKED_PHRASES,
  REACTION_EMOJI, isEmojiReaction, reactionLabel,
} from '../utils/reactions';

// Réactions entre joueurs : bulle affichée près d'un joueur, bouton + éventail pendant le duel,
// panneau émojis + phrases sur l'écran de résultats.

/** `at` (ms) : une bulle remontée plus tard (changement d'endroit) ne rejoue pas une vieille réaction. */
export type ShownReaction = { key: string; id: number; at?: number };

/** Bulle qui apparaît (ressort), flotte un peu puis s'efface. Change d'`id` pour rejouer. */
export function ReactionBubble({ reaction, side, style }: {
  reaction: ShownReaction | null;
  side: 'self' | 'opponent';
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<ShownReaction | null>(null);

  useEffect(() => {
    if (!reaction) return;
    if (reaction.at && Date.now() - reaction.at > 1500) return;
    setShown(reaction);
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setShown(null); });
  }, [reaction?.id]);

  if (!shown) return null;
  const emoji = isEmojiReaction(shown.key);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.bubble,
        side === 'self' ? s.bubbleSelf : s.bubbleOpponent,
        { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        style,
      ]}
    >
      <Txt variant={emoji ? 'h1' : 'cardTitle'} color={PALETTE.night} style={emoji ? s.emojiBig : undefined}>
        {reactionLabel(shown.key)}
      </Txt>
    </Animated.View>
  );
}

/** Bouton 😀 du duel : un toucher ouvre 4 émojis, un deuxième envoie. */
export function DuelReactionButton({ onSend }: { onSend: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.duelWrap}>
      {open ? (
        <View style={s.fan}>
          {DUEL_REACTIONS.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={k}
              hitSlop={4}
              onPress={() => { Haptics.selectionAsync(); setOpen(false); onSend(k); }}
              style={({ pressed }) => [s.fanItem, pressed && s.pressed]}
              testID={`duel-reaction-${k}`}
            >
              <Txt variant="h2" style={s.emojiMid}>{REACTION_EMOJI[k]}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('reaction.open')}
        hitSlop={8}
        onPress={() => { Haptics.selectionAsync(); setOpen((v) => !v); }}
        style={({ pressed }) => [s.duelBtn, open && s.duelBtnOpen, pressed && s.pressed]}
        testID="duel-reaction-btn"
      >
        {open ? <Icon name="close" size={16} color={COLOR.text.primary} /> : <Txt variant="cardTitle" style={s.emojiSmall}>😀</Txt>}
      </Pressable>
    </View>
  );
}

/** Panneau des résultats : émojis + phrases ; les verrouillées expliquent comment les gagner. */
export function ReactionPanel({ unlocked, sentCount, maxSent = 3, onSend }: {
  unlocked: string[];
  sentCount: number;
  maxSent?: number;
  onSend: (key: string) => void;
}) {
  const [lockedAsk, setLockedAsk] = useState(false);
  const done = sentCount >= maxSent;
  const isOpen = (k: string) => FREE_EMOJIS.includes(k) || FREE_PHRASES.includes(k) || unlocked.includes(k);

  const tap = (k: string) => {
    if (!isOpen(k)) { Haptics.selectionAsync(); setLockedAsk(true); return; }
    if (done) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(k);
  };

  const emojis = [...FREE_EMOJIS, ...LOCKED_EMOJIS];
  const phrases = [...FREE_PHRASES, ...LOCKED_PHRASES];
  return (
    <View style={[s.panel, done && s.panelDone]}>
      <View style={s.emojiRow}>
        {emojis.map((k) => {
          const open = isOpen(k);
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={open ? k : `${k} 🔒`}
              accessibilityState={{ disabled: done && open }}
              onPress={() => tap(k)}
              style={({ pressed }) => [s.emojiBtn, !open && s.locked, pressed && s.pressed]}
              testID={`reaction-${k}`}
            >
              <Txt variant="h2" style={[s.emojiMid, !open && s.lockedText]}>{REACTION_EMOJI[k]}</Txt>
              {!open ? <View style={s.lockBadge}><Icon name="lock" size={10} color={COLOR.text.primary} /></View> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={s.phraseWrap}>
        {phrases.map((k) => {
          const open = isOpen(k);
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              onPress={() => tap(k)}
              style={({ pressed }) => [s.phrase, !open && s.locked, pressed && s.pressed]}
              testID={`reaction-${k}`}
            >
              {!open ? <Icon name="lock" size={12} color={COLOR.text.tertiary} /> : null}
              <Txt variant="label" color={open ? COLOR.text.primary : COLOR.text.tertiary} numberOfLines={1}>{reactionLabel(k)}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="caption" align="center">{t('reaction.locked_hint')}</Txt>
      <Dialog
        visible={lockedAsk}
        onClose={() => setLockedAsk(false)}
        icon="lock"
        tone="reward"
        title={t('reaction.locked_title')}
        message={t('reaction.locked_body')}
        actions={<Button label={t('common.close')} variant="secondary" fullWidth onPress={() => setLockedAsk(false)} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    position: 'absolute',
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs,
    borderRadius: RADII.pill,
    backgroundColor: PALETTE.cream,
    maxWidth: 220,
    zIndex: 50,
    ...ELEVATION.e2,
  },
  bubbleSelf: { borderBottomLeftRadius: RADII.xs },
  bubbleOpponent: { borderBottomRightRadius: RADII.xs },
  emojiBig: { fontSize: 30, lineHeight: 38 },
  emojiMid: { fontSize: 24, lineHeight: 30 },
  emojiSmall: { fontSize: 18, lineHeight: 22 },
  duelWrap: { position: 'relative', zIndex: 60 },
  // L'éventail s'ouvre à gauche du bouton, par-dessus la barre de progression (n'en décale rien).
  fan: {
    position: 'absolute', right: 42, top: -4,
    flexDirection: 'row', gap: SPACE.xxs, ...ELEVATION.e2,
    paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xxs,
    borderRadius: RADII.pill, backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair, borderColor: COLOR.border.strong,
  },
  fanItem: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  duelBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR.surface.card, borderWidth: BORDER.hair, borderColor: COLOR.border.default,
  },
  duelBtnOpen: { borderColor: COLOR.border.strong },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  panel: { gap: SPACE.md },
  panelDone: { opacity: 0.5 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACE.xs },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR.surface.subtle, borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
  },
  locked: { opacity: 0.55 },
  lockedText: { opacity: 0.5 },
  lockBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface.elevated,
  },
  phraseWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACE.xs },
  phrase: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    height: 32, paddingHorizontal: SPACE.md, borderRadius: RADII.pill,
    backgroundColor: COLOR.surface.card, borderWidth: BORDER.hair, borderColor: COLOR.border.default,
  },
});

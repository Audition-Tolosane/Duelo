import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Txt from './Txt';
import Icon from './Icon';
import { COLOR, RADII, SPACE, BORDER, GLOW } from '../../theme/tokens';

// États d'une réponse — UNE couleur, UN sens :
// idle = neutre · selected = ma sélection (jaune) · correct = vert + ✓ · wrong = ma mauvaise réponse (rouge + ✕)
// · dimmed = autres réponses après révélation. Le corail ne sert qu'au marqueur du rival.
export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

type Props = {
  letter: string;
  text: string;
  state: AnswerState;
  /** Le rival a choisi cette réponse (révélation). */
  opponentPick?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Taille par paliers selon la longueur : la réponse est toujours lisible en entier.
const answerSize = (len: number) => (len > 60 ? 13 : len > 32 ? 14 : 16);

export default function AnswerButton({ letter, text, state, opponentPick, onPress, disabled, testID, style }: Props) {
  const fs = answerSize(text.length);
  const fg = state === 'correct' ? COLOR.text.onAction : state === 'dimmed' ? COLOR.text.disabled : COLOR.text.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${letter}. ${text}`}
      accessibilityState={{ selected: state === 'selected', disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[state],
        state === 'correct' && GLOW.success,
        pressed && state === 'idle' && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.letter, state === 'selected' && styles.letterSelected, state === 'correct' && styles.letterCorrect]}>
        <Txt variant="buttonSmall" color={state === 'selected' || state === 'correct' ? COLOR.text.onAction : COLOR.text.secondary}>{letter}</Txt>
      </View>
      <Txt variant="cardTitle" color={fg} numberOfLines={5} style={[styles.text, { fontSize: fs, lineHeight: fs + 5 }]}>{text}</Txt>
      <View style={styles.markers}>
        {opponentPick ? <View style={styles.opponentDot} accessibilityLabel="opponent" /> : null}
        {state === 'correct' ? <Icon name="success" size={20} color={COLOR.text.onAction} /> : null}
        {state === 'wrong' ? <Icon name="error" size={20} color={COLOR.status.error} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    borderRadius: RADII.lg,
    borderWidth: BORDER.default,
    padding: SPACE.md,
    gap: SPACE.sm,
    justifyContent: 'space-between',
  },
  idle: { backgroundColor: COLOR.surface.card, borderColor: COLOR.border.default },
  selected: { backgroundColor: COLOR.action.selectedFill, borderColor: COLOR.border.active, borderWidth: BORDER.selected },
  correct: { backgroundColor: COLOR.status.success, borderColor: COLOR.status.success },
  wrong: { backgroundColor: COLOR.status.errorFill, borderColor: COLOR.status.error, borderWidth: BORDER.strong },
  dimmed: { backgroundColor: COLOR.surface.subtle, borderColor: COLOR.border.subtle },
  pressed: { backgroundColor: COLOR.surface.elevated, transform: [{ scale: 0.98 }] },
  letter: { width: 24, height: 24, borderRadius: RADII.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface.subtle },
  letterSelected: { backgroundColor: COLOR.action.primary },
  letterCorrect: { backgroundColor: COLOR.onAccentTint },
  text: { flex: 1 },
  markers: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: SPACE.sm, minHeight: 20 },
  opponentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR.player.opponent },
});

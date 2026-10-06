import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Txt from './Txt';
import Icon from './Icon';
import { COLOR, RADII, SPACE, BORDER, GLOW } from '../../theme/tokens';

// États d'une réponse — UNE couleur, UN sens :
// idle = neutre · selected = ma sélection (jaune) · correct = vert + ✓ · wrong = ma mauvaise réponse (rouge + ✕)
// · dimmed = autres réponses après révélation. Le corail ne sert qu'au marqueur du rival.
export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

/**
 * Mise en page :
 * - 'tile' (défaut) : tuile de grille 2×2 — lettre en haut, texte au milieu, marqueurs en bas ;
 * - 'row' : ligne pleine largeur pour la liste 1×4 — lettre à gauche, texte multiligne (≤ 4 lignes)
 *   au centre, marqueurs (rival, ✓/✕) à droite. Hauteur minimale 56 px.
 * Les états et le marqueur rival ont exactement la même sémantique dans les deux cas.
 */
export type AnswerLayout = 'tile' | 'row';

type Props = {
  letter: string;
  text: string;
  state: AnswerState;
  /** Le rival a choisi cette réponse (révélation). */
  opponentPick?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  layout?: AnswerLayout;
  style?: StyleProp<ViewStyle>;
};

// Taille par paliers selon la longueur : la réponse est toujours lisible en entier.
const answerSize = (len: number) => (len > 60 ? 13 : len > 32 ? 14 : 16);
// En ligne (1×4), la largeur est ~2× celle d'une tuile : on garde 16/15 et jamais moins de 14.
const rowAnswerSize = (len: number) => (len > 90 ? 14 : len > 50 ? 15 : 16);
/** Hauteur minimale d'une réponse en ligne (cible tactile confortable). */
export const ANSWER_ROW_MIN_HEIGHT = 56;

export default function AnswerButton({ letter, text, state, opponentPick, onPress, disabled, testID, layout = 'tile', style }: Props) {
  const isRow = layout === 'row';
  const fs = isRow ? rowAnswerSize(text.length) : answerSize(text.length);
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
        isRow ? styles.row : styles.tile,
        styles[state],
        state === 'correct' && GLOW.success,
        pressed && state === 'idle' && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.letter, state === 'selected' && styles.letterSelected, state === 'correct' && styles.letterCorrect]}>
        <Txt variant="buttonSmall" color={state === 'selected' || state === 'correct' ? COLOR.text.onAction : COLOR.text.secondary}>{letter}</Txt>
      </View>
      <Txt variant="cardTitle" color={fg} numberOfLines={isRow ? 4 : 5} style={[styles.text, { fontSize: fs, lineHeight: fs + 5 }]}>{text}</Txt>
      <View style={[styles.markers, isRow && styles.markersRow]}>
        {opponentPick ? <View style={styles.opponentDot} accessibilityLabel="opponent" /> : null}
        {state === 'correct' ? <Icon name="success" size={20} color={COLOR.text.onAction} /> : null}
        {state === 'wrong' ? <Icon name="error" size={20} color={COLOR.status.error} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADII.lg,
    borderWidth: BORDER.default,
    padding: SPACE.md,
  },
  tile: { flex: 1, gap: SPACE.sm, justifyContent: 'space-between' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    minHeight: ANSWER_ROW_MIN_HEIGHT, paddingVertical: SPACE.sm,
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
  // En ligne : colonne réservée à droite (20 px = icône ✓/✕) pour limiter le reflux du texte à la révélation.
  markersRow: { minWidth: 20, minHeight: 0 },
  opponentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR.player.opponent },
});

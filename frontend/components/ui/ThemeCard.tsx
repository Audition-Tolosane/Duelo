import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Txt from './Txt';
import ThemeIcon from './ThemeIcon';
import { COLOR, RADII, SPACE, BORDER } from '../../theme/tokens';

type Props = {
  name: string;
  cluster?: string | null;
  superCategory?: string | null;
  /** Ligne secondaire : « Niv. 12 », « 500 questions »… */
  meta?: string;
  /** Mon niveau sur le thème (affiché en jaune). */
  level?: number;
  /** 'tile' = carte verticale de carrousel/grille ; 'row' = ligne de liste. */
  layout?: 'tile' | 'row';
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Carte de thème : icône sur plaque crème, nom, une seule méta. Pas de cartouche dans la carte.
export default function ThemeCard({ name, cluster, superCategory, meta, level, layout = 'tile', onPress, testID, style }: Props) {
  const tile = layout === 'tile';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
      style={({ pressed }) => [tile ? styles.tile : styles.row, pressed && styles.pressed, style]}
    >
      <ThemeIcon themeName={name} cluster={cluster} superCategory={superCategory} size={tile ? 64 : 44} />
      <View style={tile ? styles.tileTexts : styles.rowTexts}>
        <Txt variant="cardTitle" numberOfLines={2} align={tile ? 'center' : 'left'}>{name}</Txt>
        {level !== undefined || meta ? (
          <Txt variant="caption" numberOfLines={1} align={tile ? 'center' : 'left'}>
            {level !== undefined ? <Txt variant="caption" color={COLOR.action.primary}>{`Niv. ${level}`}</Txt> : null}
            {level !== undefined && meta ? ' · ' : ''}
            {meta ?? ''}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 140,
    minHeight: 168,
    padding: SPACE.md,
    borderRadius: RADII.lg,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    alignItems: 'center',
    gap: SPACE.md,
  },
  tileTexts: { gap: SPACE.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 60 },
  rowTexts: { flex: 1, gap: 2 },
  pressed: { opacity: 0.75 },
});

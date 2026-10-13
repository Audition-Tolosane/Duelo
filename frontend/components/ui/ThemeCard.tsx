import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Txt from './Txt';
import ThemeIcon from './ThemeIcon';
import SatinSurface from './SatinSurface';
import { COLOR, RADII, SPACE, BORDER, TYPO } from '../../theme/tokens';
import { t } from '../../utils/i18n';

type Props = {
  name: string;
  /** Id du thème : clé de son icône personnalisée (deux thèmes peuvent porter le même nom). */
  themeId?: string | null;
  cluster?: string | null;
  superCategory?: string | null;
  /** Ligne secondaire : « Niv. 12 », « 500 questions »… */
  meta?: string;
  /** Mon niveau sur le thème (affiché en jaune). */
  level?: number;
  /**
   * 'tile' = carte verticale de carrousel/grille (140 px) ;
   * 'compact' = petite carte de carrousel dense (108 px, plaque 48, nom en 2 lignes) ;
   * 'row' = ligne de liste.
   */
  layout?: 'tile' | 'compact' | 'row';
  onPress?: () => void;
  /** 'satin' : même matière que les cartes de l'Accueil (tuile uniquement) */
  finish?: 'flat' | 'satin';
  /** Coins chauds du liseré satiné */
  warm?: 'none' | 'tr' | 'tr-bl';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Carte de thème : icône sur plaque crème, nom, une seule méta. Pas de cartouche dans la carte.
export default function ThemeCard({ name, themeId, cluster, superCategory, meta, level, layout = 'tile', onPress, finish = 'flat', warm = 'tr', testID, style }: Props) {
  const compact = layout === 'compact';
  const tile = layout === 'tile' || compact;
  const containerStyle = compact ? styles.compact : tile ? styles.tile : styles.row;
  const iconSize = compact ? COMPACT_ICON : tile ? 64 : 44;
  const satin = finish === 'satin' && layout === 'tile';
  const body = (
    <>
      <ThemeIcon themeId={themeId} themeName={name} cluster={cluster} superCategory={superCategory} size={iconSize} />
      <View style={compact ? styles.compactTexts : tile ? styles.tileTexts : styles.rowTexts}>
        <Txt
          variant={compact ? 'label' : 'cardTitle'}
          color={compact ? COLOR.text.primary : undefined}
          numberOfLines={2}
          align={tile ? 'center' : 'left'}
          style={compact ? styles.compactName : undefined}
        >
          {name}
        </Txt>
        {level !== undefined || meta ? (
          <Txt variant="caption" numberOfLines={1} align={tile ? 'center' : 'left'}>
            {level !== undefined ? <Txt variant="caption" color={COLOR.action.primary}>{t('common.level_short', { n: String(level) })}</Txt> : null}
            {level !== undefined && meta ? ' · ' : ''}
            {meta ?? ''}
          </Txt>
        ) : null}
      </View>
    </>
  );
  const press = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); };
  if (satin) {
    return (
      <SatinSurface variant="card" warm={warm} testID={testID} onPress={press} accessibilityLabel={name} style={style} contentStyle={styles.tileSatin}>
        {body}
      </SatinSurface>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={press}
      style={({ pressed }) => [containerStyle, pressed && styles.pressed, style]}
    >
      {body}
    </Pressable>
  );
}

// Variante compacte : hauteur fixe pour que le carrousel reste aligné quel que soit le nom.
const COMPACT_ICON = 48;
const COMPACT_NAME_H = TYPO.label.lineHeight * 2;

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
  // Le liseré satiné (1 px) entoure la tuile : même encombrement que 'tile'
  tileSatin: { width: 140 - 2 * BORDER.hair, minHeight: 168 - 2 * BORDER.hair, padding: SPACE.md, alignItems: 'center', gap: SPACE.md },
  tileTexts: { gap: SPACE.xs, alignItems: 'center' },
  compact: {
    width: 108,
    padding: SPACE.sm,
    paddingTop: SPACE.md,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    alignItems: 'center',
    gap: SPACE.sm,
  },
  compactTexts: { alignSelf: 'stretch', alignItems: 'center', gap: SPACE.xxs },
  compactName: { minHeight: COMPACT_NAME_H },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 60 },
  rowTexts: { flex: 1, gap: 2 },
  pressed: { opacity: 0.75 },
});

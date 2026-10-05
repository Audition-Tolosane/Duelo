import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Txt from './Txt';
import Icon from './Icon';
import { COLOR, SPACE } from '../../theme/tokens';
import { t } from '../../utils/i18n';

type Props = {
  title: string;
  overline?: string;
  /** Affiche « Voir tout › » — seulement quand la liste est réellement tronquée. */
  onSeeAll?: () => void;
  seeAllLabel?: string;
  children?: React.ReactNode;
  /** Marge latérale sur le titre seulement (pour les carrousels pleine largeur). */
  insetTitle?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Section({ title, overline, onSeeAll, seeAllLabel, children, insetTitle = false, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      <View style={[styles.head, insetTitle && styles.inset]}>
        <View style={styles.titles}>
          {overline ? <Txt variant="overline">{overline}</Txt> : null}
          <Txt variant="h2" numberOfLines={1}>{title}</Txt>
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="link" style={styles.seeAll}>
            <Txt variant="label" color={COLOR.action.primary}>{seeAllLabel ?? t('common.see_all')}</Txt>
            <Icon name="chevronRight" size={16} color={COLOR.action.primary} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.md },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.md },
  inset: { paddingHorizontal: SPACE.screenX },
  titles: { flex: 1, gap: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
});

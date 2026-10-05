import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Txt from './Txt';
import Icon, { IconName } from './Icon';
import { COLOR, SIZE, SPACE } from '../../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  /** Élément de gauche : icône UI, ThemeIcon, avatar… */
  leading?: React.ReactNode;
  leadingIcon?: IconName;
  /** Valeur à droite (niveau, rang, score). */
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Ligne de liste scannable (thèmes, réglages, joueurs). Hauteur ≥ 60 px.
export default function ListRow({ title, subtitle, leading, leadingIcon, trailing, chevron, onPress, destructive, testID, style }: Props) {
  const showChevron = chevron || (!!onPress && trailing === undefined);
  const titleColor = destructive ? COLOR.status.error : COLOR.text.primary;
  const body = (
    <>
      {leading ?? (leadingIcon ? <Icon name={leadingIcon} size={22} color={destructive ? COLOR.status.error : COLOR.text.secondary} /> : null)}
      <View style={styles.texts}>
        <Txt variant="cardTitle" color={titleColor} numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt variant="caption" numberOfLines={1}>{subtitle}</Txt> : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={18} color={COLOR.text.disabled} /> : null}
    </>
  );
  if (!onPress) return <View testID={testID} style={[styles.base, style]}>{body}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: SIZE.listRow, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  texts: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});

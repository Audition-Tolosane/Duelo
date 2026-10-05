import React from 'react';
import { View, StyleSheet } from 'react-native';
import Txt from './Txt';
import Icon, { IconName } from './Icon';
import Button from './Button';
import { COLOR, SPACE } from '../../theme/tokens';

type Props = {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// État vide unique : pictogramme Lucide crème (jamais d'emoji), titre, une action jaune.
export default function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}><Icon name={icon} size={32} color={COLOR.text.secondary} /></View>
      <Txt variant="h3" align="center">{title}</Txt>
      {message ? <Txt variant="bodySmall" align="center">{message}</Txt> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="sm" style={styles.cta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.xxl },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLOR.surface.subtle, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.xs },
  cta: { marginTop: SPACE.md },
});

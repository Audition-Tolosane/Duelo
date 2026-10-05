import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Txt from './Txt';
import Wordmark from './Wordmark';
import BackButton from './BackButton';
import { COLOR, SIZE, SPACE } from '../../theme/tokens';

// ── AppHeader : en-tête des onglets (logo + 3 actions au plus). Seul endroit des badges globaux.
export function AppHeader({ actions, safeTop = true }: { actions?: React.ReactNode; safeTop?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.app, safeTop && { paddingTop: insets.top }]}>
      <View style={styles.appRow}>
        <Wordmark size="sm" />
        <View style={styles.actions}>{actions}</View>
      </View>
    </View>
  );
}

// ── ScreenHeader : pages empilées (retour + surtitre + titre). Remplace les 6 variantes de retour.
type ScreenHeaderProps = {
  title?: string;
  overline?: string;
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  right?: React.ReactNode;
  safeTop?: boolean;
};

export function ScreenHeader({ title, overline, onBack, backIcon = 'back', right, safeTop = true }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, safeTop && { paddingTop: insets.top }]}>
      <View style={styles.screenRow}>
        <BackButton onPress={onBack} icon={backIcon} />
        <View style={styles.titles}>
          {overline ? <Txt variant="overline" numberOfLines={1}>{overline}</Txt> : null}
          {title ? <Txt variant="h3" numberOfLines={1}>{title}</Txt> : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { paddingHorizontal: SPACE.screenX },
  appRow: { height: SIZE.header + 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  screen: { paddingHorizontal: SPACE.md, borderBottomWidth: 1, borderBottomColor: COLOR.border.subtle },
  screenRow: { minHeight: SIZE.header + 10, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  titles: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});

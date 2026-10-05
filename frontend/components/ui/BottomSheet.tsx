import React from 'react';
import { Modal as RNModal, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Txt from './Txt';
import IconButton from './IconButton';
import { COLOR, RADII, SPACE, ELEVATION } from '../../theme/tokens';
import { t } from '../../utils/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Pied collant (bouton principal). */
  footer?: React.ReactNode;
};

// Feuille du bas (choix d'un thème, défier un ami…). Préférer une navigation plein écran
// dès que le contenu dépasse une hauteur d'écran.
export default function BottomSheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACE.lg }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          {(title || subtitle) ? (
            <View style={styles.head}>
              <View style={styles.titles}>
                {title ? <Txt variant="h2" numberOfLines={2}>{title}</Txt> : null}
                {subtitle ? <Txt variant="bodySmall">{subtitle}</Txt> : null}
              </View>
              <IconButton icon="close" accessibilityLabel={t('common.close')} onPress={onClose} />
            </View>
          ) : null}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLOR.overlay.soft },
  sheet: {
    backgroundColor: COLOR.surface.card,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    borderWidth: 1, borderColor: COLOR.border.subtle,
    paddingHorizontal: SPACE.screenX,
    maxHeight: '85%',
    ...ELEVATION.e3,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLOR.border.strong, marginTop: SPACE.sm, marginBottom: SPACE.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, marginBottom: SPACE.md },
  titles: { flex: 1, gap: SPACE.xs },
  scroll: { flexGrow: 0 },
  content: { gap: SPACE.sm, paddingBottom: SPACE.md },
  footer: { paddingTop: SPACE.md },
});

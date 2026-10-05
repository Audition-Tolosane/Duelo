import React from 'react';
import { Modal as RNModal, View, Pressable, StyleSheet } from 'react-native';
import Txt from './Txt';
import Icon, { IconName } from './Icon';
import { COLOR, RADII, SPACE, ELEVATION } from '../../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  icon?: IconName;
  /** Ton de l'en-tête : 'event' (corail : défi, revanche), 'reward' (or), 'neutral'. */
  tone?: 'neutral' | 'event' | 'reward' | 'rare';
  /** Boutons (Button) empilés ou en ligne. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  dismissable?: boolean;
};

const ICON_TONE = {
  neutral: COLOR.text.primary,
  event: COLOR.accent.warm,
  reward: COLOR.reward.gold,
  rare: COLOR.accent.rare,
};

// Modale centrée unique : voile nuit 85 %, surface pétrole, rayon 24.
export default function Dialog({ visible, onClose, title, message, icon, tone = 'neutral', actions, children, dismissable = true }: Props) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={dismissable ? onClose : undefined} accessibilityLabel="close">
        <Pressable style={styles.card} onPress={() => {}} accessibilityViewIsModal>
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: COLOR.surface.subtle }]}>
              <Icon name={icon} size={28} color={ICON_TONE[tone]} />
            </View>
          ) : null}
          {title ? <Txt variant="h2" align="center">{title}</Txt> : null}
          {message ? <Txt variant="body" color={COLOR.text.secondary} align="center">{message}</Txt> : null}
          {children}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: COLOR.overlay.scrim, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: COLOR.surface.card,
    borderRadius: RADII.xl,
    borderWidth: 1, borderColor: COLOR.border.subtle,
    padding: SPACE.xxl,
    gap: SPACE.md,
    alignItems: 'stretch',
    ...ELEVATION.e3,
  },
  iconWrap: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: SPACE.sm, marginTop: SPACE.sm },
});

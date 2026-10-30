import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet, ListRow, Dialog, Button, Txt } from './ui';
import { t } from '../utils/i18n';
import { reportContent, setBlocked, REPORT_REASONS, ReportReason, ReportTarget } from '../utils/moderation';
import { COLOR, SPACE } from '../theme/tokens';

// ── Feuille « Plus d'options » d'un contenu joueur ────────────────────────────
// Signaler (toujours), Bloquer / Débloquer l'auteur (si ce n'est pas soi), Supprimer
// (si c'est son propre contenu). Exigé par l'App Store (règle 1.2) pour tout contenu
// généré par les joueurs : profil, post, commentaire, message, thème de la Forge.

type Props = {
  visible: boolean;
  onClose: () => void;
  target: { type: ReportTarget; id: string } | null;
  /** Author of the content — enables Block when it isn't the viewer. */
  authorId?: string;
  isOwn?: boolean;
  isBlocked?: boolean;
  onBlockedChange?: (blocked: boolean) => void;
  onDelete?: () => void;
};

type Step = 'menu' | 'reasons' | 'done';

export default function ModerationSheet({ visible, onClose, target, authorId, isOwn, isBlocked, onBlockedChange, onDelete }: Props) {
  const [step, setStep] = useState<Step>('menu');
  const [blockAsk, setBlockAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) setStep('menu'); }, [visible]);

  const sendReport = async (reason: ReportReason) => {
    if (!target || busy) return;
    setBusy(true);
    await reportContent(target.type, target.id, reason);
    setBusy(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('done');
  };

  const toggleBlock = async () => {
    if (!authorId) return;
    setBlockAsk(false);
    const next = !isBlocked;
    if (await setBlocked(authorId, next)) {
      onBlockedChange?.(next);
      onClose();
    }
  };

  const title = step === 'reasons' ? t('mod.report_title') : step === 'done' ? undefined : t('mod.more');

  return (
    <>
      <BottomSheet visible={visible && !blockAsk} onClose={onClose} title={title}>
        {step === 'menu' && (
          <View>
            {!isOwn && (
              <ListRow leadingIcon="flag" title={target?.type === 'user' ? t('mod.report_user') : t('mod.report')} onPress={() => setStep('reasons')} />
            )}
            {!isOwn && authorId ? (
              <ListRow
                leadingIcon="ban"
                title={isBlocked ? t('mod.unblock') : t('mod.block')}
                destructive={!isBlocked}
                onPress={() => (isBlocked ? toggleBlock() : setBlockAsk(true))}
              />
            ) : null}
            {isOwn && onDelete ? (
              <ListRow leadingIcon="trash" title={t('mod.delete')} destructive onPress={() => { onClose(); onDelete(); }} />
            ) : null}
          </View>
        )}
        {step === 'reasons' && (
          <View>
            {REPORT_REASONS.map((r) => (
              <ListRow key={r} title={t(`mod.reason_${r}`)} onPress={() => sendReport(r)} />
            ))}
          </View>
        )}
        {step === 'done' && (
          <View style={styles.done}>
            <Txt variant="body" color={COLOR.text.secondary} align="center">{t('mod.reported')}</Txt>
            {!isOwn && authorId && !isBlocked ? (
              <Button label={t('mod.block')} icon="ban" variant="secondary" fullWidth onPress={() => setBlockAsk(true)} />
            ) : null}
            <Button label={t('common.close')} variant="ghost" fullWidth onPress={onClose} />
          </View>
        )}
      </BottomSheet>

      <Dialog
        visible={blockAsk}
        onClose={() => setBlockAsk(false)}
        icon="ban"
        title={t('mod.block_title')}
        message={t('mod.block_message')}
        actions={
          <>
            <Button label={t('mod.block')} variant="primary" fullWidth onPress={toggleBlock} />
            <Button label={t('common.cancel')} variant="ghost" fullWidth onPress={() => setBlockAsk(false)} />
          </>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  done: { gap: SPACE.md, paddingVertical: SPACE.md },
});

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet, Button, Icon, Txt } from './ui';
import { COLOR, SPACE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';
import { t } from '../utils/i18n';
import { showRewardedAd } from '../utils/ads';
import {
  EconomyStatus, claimCreditsAd, claimThemesAd, formatWait, refreshEconomy, useEconomy,
} from '../utils/economy';

// Feuilles de l'économie de jeu : crédits (depuis l'en-tête, ou quand on n'en a plus) et
// limite de thèmes (quand on lance un thème jamais joué au-delà de sa limite).

/** Re-rendu toutes les 30 s pour le compte à rebours ; relit le serveur quand un crédit est dû. */
function useTicker(status: EconomyStatus | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (status?.next_credit_at && new Date(status.next_credit_at).getTime() <= n) refreshEconomy();
    }, 30000);
    return () => clearInterval(id);
  }, [status?.next_credit_at]);
  return now;
}

type CreditsSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Ouvert parce que le joueur n'a plus de crédit pour lancer une partie */
  blocked?: boolean;
  /** Appelé quand des crédits viennent d'être gagnés (pub vue) */
  onCredited?: () => void;
};

export function CreditsSheet({ visible, onClose, blocked, onCredited }: CreditsSheetProps) {
  const status = useEconomy();
  const now = useTicker(status);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) refreshEconomy(); }, [visible]);

  const watchAd = async () => {
    if (busy) return;
    setBusy(true);
    const watched = await showRewardedAd();
    const res = watched ? await claimCreditsAd() : null;
    setBusy(false);
    if (res) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCredited?.();
    }
  };

  const adsLeft = status?.credit_ads_left ?? 0;
  const full = !!status && status.credits >= status.credits_max;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={blocked ? t('economy.no_credits_title') : t('economy.credits_title')}
      subtitle={t('economy.credits_rules')}
      footer={
        <View style={s.footer}>
          {status && !status.free_play ? (
            <Button
              label={t('economy.watch_ad_credits', { n: String(status.credits_per_ad) })}
              icon="tv"
              fullWidth
              loading={busy}
              disabled={adsLeft <= 0}
              onPress={watchAd}
              testID="credits-watch-ad"
            />
          ) : null}
          <Button label={blocked ? t('common.back') : t('common.close')} variant="ghost" fullWidth onPress={onClose} />
        </View>
      }
    >
      <View style={s.hero}>
        <Icon name="coins" size={ICON_SIZE.lg} color={COLOR.reward.gold} />
        <Txt variant="statMedium" color={COLOR.reward.gold}>
          {status?.free_play ? '∞' : status ? `${status.credits} / ${status.credits_max}` : '…'}
        </Txt>
      </View>
      {status?.free_play ? (
        <Txt variant="body" align="center">{t('economy.free_play')}</Txt>
      ) : status ? (
        <>
          <Txt variant="body" align="center">
            {full ? t('economy.full') : t('economy.next_credit', { time: formatWait(status.next_credit_at, now) })}
          </Txt>
          <Txt variant="caption" align="center">
            {adsLeft > 0 ? t('economy.ads_left', { n: String(adsLeft) }) : t('economy.ads_cap')}
          </Txt>
        </>
      ) : null}
      <Txt variant="caption" align="center" style={s.note}>{t('economy.challenges_free')}</Txt>
    </BottomSheet>
  );
}

type ThemeLimitSheetProps = {
  visible: boolean;
  onClose: () => void;
  onUnlocked: () => void;
};

export function ThemeLimitSheet({ visible, onClose, onUnlocked }: ThemeLimitSheetProps) {
  const status = useEconomy();
  const [busy, setBusy] = useState(false);

  const watchAd = async () => {
    if (busy) return;
    setBusy(true);
    const watched = await showRewardedAd();
    const res = watched ? await claimThemesAd() : null;
    setBusy(false);
    if (res) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUnlocked();
    }
  };

  const n = String(status?.themes_per_ad ?? 3);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('economy.theme_limit_title')}
      footer={
        <View style={s.footer}>
          <Button label={t('economy.watch_ad_themes', { n })} icon="tv" fullWidth loading={busy} onPress={watchAd} testID="themes-watch-ad" />
          <Button label={t('common.back')} variant="ghost" fullWidth onPress={onClose} />
        </View>
      }
    >
      <View style={s.hero}>
        <Icon name="lock" size={ICON_SIZE.lg} color={COLOR.text.secondary} />
        <Txt variant="statMedium">{status ? `${status.themes_used} / ${status.themes_limit}` : '…'}</Txt>
      </View>
      <Txt variant="body" align="center">
        {t('economy.theme_limit_body', {
          used: String(status?.themes_used ?? 0), limit: String(status?.themes_limit ?? 0), n,
        })}
      </Txt>
    </BottomSheet>
  );
}

/** Compteur de crédits de l'en-tête ; un toucher ouvre la feuille des crédits. */
export function CreditsPill() {
  const status = useEconomy();
  const [open, setOpen] = useState(false);
  useTicker(status);   // relit le serveur quand un crédit est dû
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshEconomy(); });
    return () => sub.remove();
  }, []);
  if (!status) return null;
  const label = status.free_play ? '∞' : String(status.credits);
  const empty = !status.free_play && status.credits <= 0;
  return (
    <>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel={`${t('economy.credits_title')} : ${label}`}
        hitSlop={6}
        style={({ pressed }) => [s.pill, empty && s.pillEmpty, pressed && s.pressed]}
        testID="header-credits"
      >
        <Icon name="coins" size={ICON_SIZE.sm} color={empty ? COLOR.text.secondary : COLOR.reward.gold} />
        <Txt variant="label" color={empty ? COLOR.text.secondary : COLOR.text.primary}>{label}</Txt>
      </Pressable>
      <CreditsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  footer: { gap: SPACE.sm },
  hero: { alignItems: 'center', gap: SPACE.xs, paddingVertical: SPACE.md },
  note: { marginTop: SPACE.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    height: 32, paddingHorizontal: SPACE.md, borderRadius: RADII.pill,
    backgroundColor: COLOR.surface.card, borderWidth: BORDER.hair, borderColor: COLOR.border.default,
  },
  pillEmpty: { borderColor: COLOR.border.subtle },
  pressed: { opacity: 0.7 },
});

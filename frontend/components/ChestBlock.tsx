import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Icon, Txt } from './ui';
import { COLOR, SPACE, ICON_SIZE } from '../theme/tokens';
import { t } from '../utils/i18n';
import { showRewardedAd } from '../utils/ads';
import { ChestReward, openChest, useEconomy } from '../utils/economy';

// Coffre du jour (feuille Bonus de l'Accueil) : 1 ouverture gratuite, une 2e avec une pub.

function rewardText(r: ChestReward): string {
  if (r.type === 'credits') return t('chest.reward_credits', { n: String(r.value) });
  if (r.type === 'boost') return t('chest.reward_boost', { n: String(r.value) });
  return t('chest.reward_xp', { n: String(r.value) });
}

export default function ChestBlock() {
  const status = useEconomy();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ChestReward | null>(null);

  const open = async (withAd: boolean) => {
    if (busy) return;
    setBusy(true);
    if (withAd && !(await showRewardedAd())) { setBusy(false); return; }
    const res = await openChest(withAd);
    setBusy(false);
    if (res?.reward) {
      setLast(res.reward);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  if (!status) return null;
  return (
    <View style={s.wrap}>
      {last ? (
        <View style={s.reward}>
          <Icon name="gift" size={ICON_SIZE.md} color={COLOR.reward.gold} />
          <Txt variant="cardTitle" color={COLOR.reward.gold} style={s.flex}>{rewardText(last)}</Txt>
        </View>
      ) : (
        <Txt variant="bodySmall">{t('chest.sub')}</Txt>
      )}
      {status.chest_free ? (
        <Button label={t('chest.open_free')} icon="gift" fullWidth loading={busy} onPress={() => open(false)} testID="chest-open" />
      ) : status.chest_ad ? (
        <Button label={t('chest.open_ad')} icon="tv" variant="secondary" fullWidth loading={busy} onPress={() => open(true)} testID="chest-open-ad" />
      ) : (
        <Txt variant="caption">{t('chest.done')}</Txt>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  reward: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});

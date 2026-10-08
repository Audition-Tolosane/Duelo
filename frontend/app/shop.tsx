import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import SwipeBackPage from '../components/SwipeBackPage';
import { t } from '../utils/i18n';
import { Txt, Icon, IconName, Button, Badge, Card, Dialog, ScreenContainer, ScreenHeader } from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, GRADIENTS } from '../theme/tokens';

// Boutique SKILKI : pièces, boosts, Premium. Les achats ne sont pas encore actifs : chaque achat
// ouvre une modale « disponible prochainement ». Prix = or (récompense) ; Premium = violet rare,
// seul moment « rare » de l'écran ; un CTA jaune par article.

interface ShopItem {
  id: string;
  /** Clés i18n pilot.shop.<id>_title / _desc */
  icon: IconName;
  price: string;
  badgeKey?: string;
}

// ── Données produits (prix affichés tels quels) ───────────────────────────────

const COIN_PACKS: ShopItem[] = [
  { id: 'coins_small', icon: 'coins', price: '0,99 €' },
  { id: 'coins_medium', icon: 'coins', price: '1,99 €', badgeKey: 'pilot.shop.badge_popular' },
  { id: 'coins_large', icon: 'coins', price: '3,99 €', badgeKey: 'pilot.shop.badge_best' },
];

const BOOSTS: ShopItem[] = [
  { id: 'boost_xp_2x', icon: 'bolt', price: '1,99 €' },
  { id: 'boost_shield', icon: 'shield', price: '0,99 €' },
  { id: 'boost_reroll', icon: 'refresh', price: '0,99 €' },
];

const PREMIUM: ShopItem = { id: 'premium_monthly', icon: 'crown', price: '4,99 € / mois', badgeKey: 'pilot.shop.badge_value' };

const title = (it: ShopItem) => t(`pilot.shop.${it.id}_title`);

// ── Ligne d'article : pas cliquable en entier (le bouton d'achat est à l'intérieur) ──

function ShopRow({ item, onBuy, first }: { item: ShopItem; onBuy: () => void; first: boolean }) {
  const { width } = useWindowDimensions();
  const compact = width < 360;   // 320 px : prix et bouton passent sous le texte
  return (
    <View style={[s.row, !first && s.rowDivider, compact && s.rowCompact]}>
      <View style={s.iconDisc}><Icon name={item.icon} size={22} color={COLOR.reward.gold} /></View>
      <View style={s.rowText}>
        {item.badgeKey ? <Badge label={t(item.badgeKey)} tone="reward" /> : null}
        <Txt variant="cardTitle" numberOfLines={2}>{title(item)}</Txt>
        <Txt variant="caption" numberOfLines={2}>{t(`pilot.shop.${item.id}_desc`)}</Txt>
      </View>
      <View style={[s.buy, compact && s.buyCompact]}>
        <Txt variant="cardTitle" color={COLOR.reward.gold} align="right" numberOfLines={1}>{item.price}</Txt>
        {/* Achat en secondaire : un seul CTA jaune par écran (l'abonnement Premium) */}
        <Button label={t('pilot.shop.buy')} variant="secondary" size="sm" haptic={false} onPress={onBuy} />
      </View>
    </View>
  );
}

function Group({ titleKey, hintKey, children }: { titleKey: string; hintKey?: string; children: React.ReactNode }) {
  return (
    <View style={s.group}>
      <Txt variant="overline">{t(titleKey)}</Txt>
      {hintKey ? <Txt variant="caption">{t(hintKey)}</Txt> : null}
      <Card padded={false} style={s.groupCard}>{children}</Card>
    </View>
  );
}

// ── Écran ─────────────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const [pending, setPending] = useState<ShopItem | null>(null);

  const handlePurchase = (item: ShopItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPending(item);
  };

  return (
    <SwipeBackPage>
      <ScreenContainer>
        <ScreenHeader title={t('pilot.shop.title')} />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Intro sobre (écran de navigation : pas de dégradé) */}
          <Card style={s.intro}>
            <View style={s.introDisc}><Icon name="shop" size={26} color={COLOR.action.primary} /></View>
            <View style={s.flex}>
              <Txt variant="h2">{t('pilot.shop.hero_title')}</Txt>
              <Txt variant="bodySmall">{t('pilot.shop.hero_sub')}</Txt>
            </View>
          </Card>

          <Group titleKey="pilot.shop.section_coins" hintKey="pilot.shop.coins_hint">
            {COIN_PACKS.map((item, i) => (
              <ShopRow key={item.id} item={item} first={i === 0} onBuy={() => handlePurchase(item)} />
            ))}
          </Group>

          <Group titleKey="pilot.shop.section_boosts">
            {BOOSTS.map((item, i) => (
              <ShopRow key={item.id} item={item} first={i === 0} onBuy={() => handlePurchase(item)} />
            ))}
          </Group>

          {/* Premium : seul moment « rare » (violet) */}
          <View style={s.group}>
            <Txt variant="overline">{t('pilot.shop.section_premium')}</Txt>
            <View style={s.premium}>
              <LinearGradient colors={GRADIENTS.rare.colors} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={s.premiumHead}>
                <View style={s.premiumDisc}><Icon name="crown" size={26} color={COLOR.accent.rare} /></View>
                <View style={s.flex}>
                  <Badge label={t(PREMIUM.badgeKey!)} tone="rare" />
                  <Txt variant="h3">{title(PREMIUM)}</Txt>
                </View>
              </View>
              <Txt variant="bodySmall" color={COLOR.text.secondary}>{t('pilot.shop.premium_monthly_desc')}</Txt>
              <View style={s.premiumFoot}>
                <Txt variant="statMedium" color={COLOR.reward.gold} numberOfLines={1} style={s.flexShrink}>{PREMIUM.price}</Txt>
                <Button label={t('pilot.shop.subscribe')} haptic={false} onPress={() => handlePurchase(PREMIUM)} />
              </View>
            </View>
          </View>

          <Txt variant="caption" align="center" style={s.legal}>{t('pilot.shop.legal')}</Txt>
        </ScrollView>

        {/* Achat factice : même message qu'avant, dans la modale du kit */}
        <Dialog
          visible={!!pending}
          onClose={() => setPending(null)}
          icon="shop"
          tone="reward"
          title={t('pilot.shop.purchase_title')}
          message={pending ? t('pilot.shop.purchase_body', { item: title(pending), price: pending.price }) : undefined}
          actions={<Button label={t('pilot.shop.got_it')} onPress={() => setPending(null)} />}
        />
      </ScreenContainer>
    </SwipeBackPage>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.lg, paddingBottom: SPACE.huge, gap: SPACE.xl },
  flex: { flex: 1, gap: SPACE.xxs },
  flexShrink: { flexShrink: 1 },

  intro: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  introDisc: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLOR.surface.subtle,
    alignItems: 'center', justifyContent: 'center',
  },

  group: { gap: SPACE.sm },
  groupCard: { paddingHorizontal: SPACE.cardPad },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  rowDivider: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
  iconDisc: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLOR.tint.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  rowCompact: { flexWrap: 'wrap' },
  rowText: { flex: 1, gap: SPACE.xxs },
  buy: { alignItems: 'flex-end', gap: SPACE.xs },
  buyCompact: { flexBasis: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 44 + SPACE.md },

  premium: {
    backgroundColor: COLOR.surface.card,
    borderRadius: RADII.lg,
    borderWidth: BORDER.default,
    borderColor: COLOR.accent.rare,
    padding: SPACE.cardPad,
    gap: SPACE.md,
    overflow: 'hidden',
  },
  premiumHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  premiumDisc: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLOR.tint.rare,
    alignItems: 'center', justifyContent: 'center',
  },
  premiumFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, flexWrap: 'wrap' },

  legal: { marginTop: SPACE.sm },
});

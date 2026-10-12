import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { startQuickMatch } from '../../utils/quickMatch';
import { useTabBar } from '../../contexts/TabBarContext';
import SwordMark from '../../components/SwordMark';
import { t } from '../../utils/i18n';
import { Txt, Icon, IconName, Button, Badge, Card, ListRow, ThemeIconBackdrop } from '../../components/ui';
import { COLOR, SPACE, RADII, BORDER, ELEVATION, GRADIENTS, PALETTE, alpha } from '../../theme/tokens';

// Onglet central « Jouer » : modes de jeu. Même carte « Duel rapide » que l'Accueil (même action),
// puis les autres modes en lignes de liste. Les univers et thèmes vivent dans l'onglet Thèmes.

type Mode = { key: string; icon: IconName; iconColor: string; title: string; subtitle: string; live?: boolean; onPress: () => void };

export default function PlayScreen() {
  const router = useRouter();
  const { onScroll: onTabScroll } = useTabBar();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [quickLoading, setQuickLoading] = useState(false);
  // Taille réelle de la page (varie quand l'en-tête se replie) : le fond d'icônes la couvre exactement
  const [area, setArea] = useState({ w: 0, h: 0 });

  // Les tournois ont lieu du vendredi au dimanche (cf. crons backend)
  const day = new Date().getDay();
  const isTournamentLive = day === 5 || day === 6 || day === 0;

  // Quick Match partagé avec l'Accueil (utils/quickMatch.ts).
  const handleQuickMatch = async () => {
    if (quickLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setQuickLoading(true);
    await startQuickMatch(router);
    setQuickLoading(false);
  };

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(path as any);
  };

  const modes: Mode[] = [
    {
      key: 'friend', icon: 'duel', iconColor: COLOR.text.primary,
      title: t('play.challenge_friend'), subtitle: t('play.challenge_friend_sub'),
      onPress: () => go('/(tabs)/players'),
    },
    {
      key: 'tournament', icon: 'trophy', iconColor: COLOR.reward.gold,
      title: t('pilot.play.tournament'), subtitle: t('tournament.weekend_hint'),
      live: isTournamentLive, onPress: () => go('/tournament'),
    },
    {
      // Renvoi vers l'onglet Thèmes : même intitulé que sa destination
      key: 'themes', icon: 'compass', iconColor: COLOR.text.primary,
      title: t('themes.arena_title'), subtitle: t('play.arena_sub'),
      onPress: () => go('/(tabs)/themes'),
    },
  ];

  return (
    <View style={s.root} onLayout={(e) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (Math.round(w) !== area.w || Math.round(h) !== area.h) setArea({ w: Math.round(w), h: Math.round(h) });
    }}>
    <ThemeIconBackdrop width={area.w} height={area.h} />
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} onScroll={onTabScroll} scrollEventThrottle={16}>
      <View style={s.pageHeader}>
        <Txt variant="overline">{t('play.modes_eyebrow')}</Txt>
        <Txt variant="h1">{t('play.modes_title')}</Txt>
      </View>

      {/* Duel rapide : un seul CTA jaune (même carte que l'Accueil) */}
      <Animated.View entering={FadeInDown.duration(400)} style={s.heroShell}>
        <LinearGradient
          colors={GRADIENTS.hero.colors}
          start={GRADIENTS.hero.start}
          end={GRADIENTS.hero.end}
          style={[s.hero, compact && s.heroCompact]}
        >
          <View style={s.heroMark} pointerEvents="none">
            <SwordMark size={160} color={PALETTE.cream} />
          </View>
          <View style={s.heroHead}>
            <SwordMark size={compact ? 36 : 48} color={COLOR.text.primary} />
            <View style={s.flex}>
              <Txt variant="overline" color={COLOR.text.secondary}>{t('pilot.home.hero_overline')}</Txt>
              <Txt variant="h1">{t('pilot.home.hero_title')}</Txt>
            </View>
          </View>
          <Txt variant="bodySmall">{t('pilot.home.hero_subtitle')}</Txt>
          <Button
            label={t('challenge.find_opponent')}
            icon={compact ? undefined : 'duel'}
            size="lg"
            fullWidth
            loading={quickLoading}
            haptic={false}
            onPress={handleQuickMatch}
            testID="play-quick-match"
          />
        </LinearGradient>
      </Animated.View>

      {/* Autres modes */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Card padded={false} style={s.modes}>
          {modes.map((m, i) => (
            <ListRow
              key={m.key}
              title={m.title}
              subtitle={m.subtitle}
              leading={<View style={s.modeIcon}><Icon name={m.icon} size={22} color={m.iconColor} /></View>}
              trailing={m.live ? <Badge label={t('home.live')} tone="warm" /> : undefined}
              chevron
              onPress={m.onPress}
              style={[s.modeRow, i > 0 && s.rowDivider]}
            />
          ))}
        </Card>
      </Animated.View>
    </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Bas : place réservée à la barre d'onglets flottante
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.lg, paddingBottom: 120, gap: SPACE.lg },
  flex: { flex: 1, gap: SPACE.xxs },
  pageHeader: { gap: SPACE.xs },

  // Coque : porte l'ombre (la carte rogne son filigrane, ce qui couperait l'ombre sur iOS)
  heroShell: { borderRadius: RADII.xl, backgroundColor: COLOR.surface.card, ...ELEVATION.e2 },
  hero: {
    borderRadius: RADII.xl,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    borderTopColor: alpha(PALETTE.cream, 0.10),
    padding: SPACE.xl,
    gap: SPACE.lg,
    overflow: 'hidden',
  },
  heroCompact: { padding: SPACE.lg },
  heroMark: { position: 'absolute', top: -SPACE.huge, right: -SPACE.giant, opacity: 0.06, transform: [{ rotate: '-14deg' }] },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },

  modes: { paddingHorizontal: SPACE.cardPad },
  modeRow: { paddingVertical: SPACE.md },
  rowDivider: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
  modeIcon: {
    width: 44, height: 44, borderRadius: RADII.md,
    backgroundColor: COLOR.surface.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
});

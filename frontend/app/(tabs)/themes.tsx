import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Txt, Icon, Button, Card, Section, SearchField, ThemeIcon, ThemeCard, ListRow, Loader, EmptyState,
} from '../../components/ui';
import { useTabBar } from '../../contexts/TabBarContext';
import { COLOR, SPACE, RADII, BORDER, SIZE, ICON_SIZE } from '../../theme/tokens';
import { authFetch } from '../../utils/api';
import { t } from '../../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// « Tes thèmes » : 5 cartes en carrousel, « Voir tout » au-delà
const MY_THEMES_SHOWN = 5;
// `as Href` sur /theme-list : route nouvelle, absente des types générés jusqu'au prochain `expo start`.

type ClusterInfo = { name: string; icon: string; theme_count: number };

type SuperCategory = {
  id: string; label: string; icon: string; color: string;
  clusters: ClusterInfo[]; total_themes: number;
};

// Thème joué, tel que renvoyé par GET /api/player/{id}/profile (champ themes)
type PlayedTheme = {
  id: string; name: string; level: number; xp: number;
  cluster?: string; super_category?: string;
};

// Univers teasés verrouillés : une ligne de pied de page (noms de marque, pas de traduction)
const UPCOMING_CATS = [
  { id: 'SOUND', label: 'Sound' },
  { id: 'ARENA', label: 'Arena' },
  { id: 'LEGENDS', label: 'Legends' },
  { id: 'LAB', label: 'Lab' },
  { id: 'TASTE', label: 'Taste' },
  { id: 'GLOBE', label: 'Globe' },
  { id: 'PIXEL', label: 'Pixel' },
  { id: 'STYLE', label: 'Style' },
];

export default function ThemesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { onScroll: onTabScroll } = useTabBar();
  const [cats, setCats] = useState<SuperCategory[]>([]);
  const [myThemes, setMyThemes] = useState<PlayedTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { loadCategories(); loadMyThemes(); }, []);

  const loadCategories = async () => {
    setLoadError(false);
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      const url = uid
        ? `${API_URL}/api/explore/super-categories?user_id=${uid}`
        : `${API_URL}/api/explore/super-categories`;
      const res = await fetch(url);
      const data = await res.json();
      setCats(Array.isArray(data) ? data : []);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  };

  // Thèmes joués du joueur (profil public) — en cas d'échec, le bloc reste simplement masqué
  const loadMyThemes = async () => {
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      if (!uid) return;
      const res = await authFetch(`${API_URL}/api/player/${uid}/profile?viewer_id=${uid}&posts_limit=0`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, Omit<PlayedTheme, 'id'>> = data?.themes ?? {};
      const list = Object.entries(map)
        .map(([id, th]) => ({ id, ...th }))
        .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
      setMyThemes(list);
    } catch { /* bloc masqué */ }
  };

  const openUniverse = (cat: SuperCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/super-category?id=${cat.id}`);
  };

  const loadedIds = new Set(cats.map(c => c.id));
  const upcomingFiltered = UPCOMING_CATS.filter(c => !loadedIds.has(c.id));

  if (loading) {
    return <View style={s.container}><Loader fill /></View>;
  }

  if (loadError) {
    return (
      <View style={s.container}>
        <View style={s.center}>
          <EmptyState
            icon="info"
            title={t('common.error_loading')}
            actionLabel={t('common.retry')}
            onAction={() => { setLoadError(false); setLoading(true); loadCategories(); }}
          />
        </View>
      </View>
    );
  }

  // Vedette = l'univers le plus fourni ; le reste part en grille
  const featured = cats.reduce<SuperCategory | null>(
    (best, c) => (!best || c.total_themes > best.total_themes ? c : best), null);
  const rest = cats.filter(c => c.id !== featured?.id);
  const tileW = (width - SPACE.screenX * 2 - SPACE.md) / 2;
  const themesLabel = t('themes.themes_count');

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onTabScroll}
        scrollEventThrottle={16}
      >
        {/* ── Titre compact + recherche pleine largeur ── */}
        <View style={s.head}>
          <View style={s.titles}>
            <Txt variant="overline">{t('themes.arena_eyebrow')}</Txt>
            <Txt variant="h1">{t('themes.arena_title')}</Txt>
          </View>
          <SearchField
            testID="explorer-search"
            placeholder={t('search.placeholder_themes')}
            onPressTrigger={() => router.push('/search')}
          />
        </View>

        {/* ── Tes thèmes (masqué tant que le joueur n'a rien joué) ── */}
        {myThemes.length > 0 && (
          <Section
            title={t('pilot.explorer.your_themes')}
            insetTitle
            onSeeAll={myThemes.length > MY_THEMES_SHOWN ? () => router.push('/theme-list?mine=1' as Href) : undefined}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {myThemes.slice(0, MY_THEMES_SHOWN).map((th) => (
                <ThemeCard
                  key={th.id}
                  name={th.name}
                  cluster={th.cluster}
                  superCategory={th.super_category}
                  level={th.level}
                  meta={th.cluster || undefined}
                  onPress={() => router.push(`/category-detail?id=${th.id}`)}
                />
              ))}
            </ScrollView>
          </Section>
        )}

        {/* ── À la une : aplat pétrole, une seule action jaune ── */}
        {featured && (
          <Animated.View entering={FadeInDown.duration(450)} style={s.inset}>
            <Section title={t('pilot.explorer.featured')}>
              <Card testID="explorer-featured">
                <View style={s.featuredRow}>
                  <ThemeIcon superCategory={featured.id} size={ICON_SIZE.theme.lg} />
                  <View style={s.featuredTexts}>
                    <Txt variant="h2" numberOfLines={1}>{featured.label.toUpperCase()}</Txt>
                    <Txt variant="label" color={COLOR.text.secondary}>
                      {`${featured.total_themes} ${themesLabel}`}
                    </Txt>
                    {featured.clusters.length > 0 && (
                      <Txt variant="caption" numberOfLines={2}>
                        {featured.clusters.slice(0, 3).map(cl => cl.name).join(' · ')}
                      </Txt>
                    )}
                  </View>
                </View>
                <Button
                  label={t('pilot.explorer.explore_cta')}
                  icon="compass"
                  fullWidth
                  onPress={() => openUniverse(featured)}
                  style={s.featuredCta}
                />
              </Card>
            </Section>
          </Animated.View>
        )}

        {/* ── Tous les univers : grille 2 colonnes, icône / nom / compteur ── */}
        {rest.length > 0 && (
          <View style={s.inset}>
            <Section title={t('pilot.explorer.all_universes')}>
              <View style={s.grid}>
                {rest.map((cat, index) => (
                  <Animated.View key={cat.id} entering={FadeInDown.delay(Math.min(index, 8) * 70).duration(450)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={cat.label}
                      onPress={() => openUniverse(cat)}
                      style={({ pressed }) => [s.tile, { width: tileW }, pressed && s.tilePressed]}
                    >
                      <ThemeIcon superCategory={cat.id} size={ICON_SIZE.theme.md} />
                      <View style={s.tileTexts}>
                        <Txt variant="cardTitle" numberOfLines={1}>{cat.label.toUpperCase()}</Txt>
                        <Txt variant="caption" numberOfLines={1}>{`${cat.total_themes} ${themesLabel}`}</Txt>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Section>
          </View>
        )}

        {/* ── La Forge : ligne discrète, icône corail ── */}
        <View style={s.inset}>
          <ListRow
            testID="explorer-forge"
            title={t('themes.create_theme')}
            subtitle={t('themes.create_subtitle')}
            leading={
              <View style={s.forgeIcon}>
                <Icon name="forge" size={ICON_SIZE.md} color={COLOR.accent.warm} />
              </View>
            }
            chevron
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push('/create-theme');
            }}
            style={s.forgeRow}
          />
        </View>

        {/* ── Bientôt : une ligne de pied de page ── */}
        {upcomingFiltered.length > 0 && (
          <View style={[s.inset, s.soonRow]}>
            <Icon name="lock" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
            <Txt variant="caption" style={s.soonText}>
              <Txt variant="overline">{t('themes.coming_soon')}</Txt>
              {`  ${upcomingFiltered.map(c => c.label).join(' · ')}`}
            </Txt>
          </View>
        )}

        <View style={s.tabBarSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // Fond : porté par la mise en page des onglets (le header et la tab bar y vivent aussi)
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center' },
  scrollContent: { paddingTop: SPACE.lg, gap: SPACE.sectionGap },
  inset: { paddingHorizontal: SPACE.screenX },

  head: { paddingHorizontal: SPACE.screenX, gap: SPACE.lg },
  titles: { gap: SPACE.xs },

  carousel: { paddingHorizontal: SPACE.screenX, gap: SPACE.md },

  featuredRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  featuredTexts: { flex: 1, gap: SPACE.xs },
  featuredCta: { marginTop: SPACE.lg },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  tile: {
    minHeight: 132,
    padding: SPACE.md,
    gap: SPACE.md,
    borderRadius: RADII.lg,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    justifyContent: 'space-between',
  },
  tilePressed: { backgroundColor: COLOR.surface.elevated },
  tileTexts: { gap: SPACE.xxs },

  forgeRow: { borderTopWidth: BORDER.hair, borderBottomWidth: BORDER.hair, borderColor: COLOR.border.subtle },
  forgeIcon: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2,
    backgroundColor: COLOR.tint.opponent,
    alignItems: 'center', justifyContent: 'center',
  },

  soonRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  soonText: { flex: 1 },

  // Espace sous la tab bar flottante
  tabBarSpacer: { height: 100 },
});

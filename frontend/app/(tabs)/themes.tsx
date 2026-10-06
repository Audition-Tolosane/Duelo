import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Txt, Icon, Card, Section, SearchField, ThemeIcon, ThemeCard, ListRow, Loader, EmptyState,
} from '../../components/ui';
import { useTabBar } from '../../contexts/TabBarContext';
import { COLOR, SPACE, RADII, BORDER, SIZE, ICON_SIZE } from '../../theme/tokens';
import { authFetch } from '../../utils/api';
import { t } from '../../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// « Tes thèmes » : carrousel dense de cartes compactes (3 et demie visibles en 390), « Voir tout » au-delà
const MY_THEMES_SHOWN = 8;
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

// 2 premières sous-catégories d'un univers, sans doublon d'accent (« Litterature » / « Littérature »)
function universeHint(clusters: ClusterInfo[]): string {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const cl of clusters) {
    const key = cl.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(cl.name);
    if (names.length === 2) break;
  }
  return names.join(' · ');
}

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
  const tileW = (width - SPACE.screenX * 2 - SPACE.sm) / 2;
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
            <Txt variant="h2" numberOfLines={2}>{t('themes.arena_title')}</Txt>
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
            style={s.section}
            onSeeAll={myThemes.length > MY_THEMES_SHOWN ? () => router.push('/theme-list?mine=1' as Href) : undefined}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {myThemes.slice(0, MY_THEMES_SHOWN).map((th) => (
                <ThemeCard
                  key={th.id}
                  layout="compact"
                  name={th.name}
                  cluster={th.cluster}
                  superCategory={th.super_category}
                  level={th.level}
                  onPress={() => router.push(`/category-detail?id=${th.id}`)}
                />
              ))}
            </ScrollView>
          </Section>
        )}

        {/* ── À la une : une rangée éditoriale — plaque, nom, compteur, sous-catégories, disque jaune ── */}
        {featured && (
          <Animated.View entering={FadeInDown.duration(450)} style={s.inset}>
            <Section title={t('pilot.explorer.featured')} style={s.section}>
              <Card testID="explorer-featured" onPress={() => openUniverse(featured)} style={s.featuredCard}>
                <View style={s.featuredRow}>
                  <ThemeIcon superCategory={featured.id} size={ICON_SIZE.theme.md} />
                  <View style={s.featuredTexts}>
                    <Txt variant="cardTitle" numberOfLines={1}>
                      {featured.label.toUpperCase()}
                      <Txt variant="caption">{`  ${featured.total_themes} ${themesLabel}`}</Txt>
                    </Txt>
                    {featured.clusters.length > 0 && (
                      <Txt variant="caption" color={COLOR.text.secondary} numberOfLines={2}>
                        {featured.clusters.slice(0, 3).map(cl => cl.name).join(' · ')}
                      </Txt>
                    )}
                  </View>
                  <View style={s.featuredCta}>
                    <Icon name="chevronRight" size={ICON_SIZE.lg} color={COLOR.text.onAction} />
                  </View>
                </View>
              </Card>
            </Section>
          </Animated.View>
        )}

        {/* ── Tous les univers : grille 2 colonnes, icône / nom / compteur ── */}
        {rest.length > 0 && (
          <View style={s.inset}>
            <Section title={t('pilot.explorer.all_universes')} style={s.section}>
              <View style={s.grid}>
                {rest.map((cat, index) => (
                  <Animated.View key={cat.id} entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(400)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={cat.label}
                      onPress={() => openUniverse(cat)}
                      style={({ pressed }) => [s.tile, { width: tileW }, pressed && s.tilePressed]}
                    >
                      <ThemeIcon superCategory={cat.id} size={ICON_SIZE.theme.sm} />
                      <View style={s.tileTexts}>
                        <Txt variant="cardTitle" numberOfLines={1}>{cat.label.toUpperCase()}</Txt>
                        {/* Ce que contient l'univers : les noms (SCREEN, LAB…) ne le disent pas seuls */}
                        <Txt variant="caption" color={COLOR.text.secondary} numberOfLines={1}>{universeHint(cat.clusters)}</Txt>
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
  // Haut de page resserré : 20 px entre blocs (au lieu de 28) pour montrer le catalogue dès le premier écran
  scrollContent: { paddingTop: SPACE.md, gap: SPACE.xl },
  inset: { paddingHorizontal: SPACE.screenX },

  head: { paddingHorizontal: SPACE.screenX, gap: SPACE.md },
  titles: { gap: SPACE.xxs },
  // Titre de section → contenu : 8 px (au lieu de 12) sur cet écran dense
  section: { gap: SPACE.sm },

  carousel: { paddingHorizontal: SPACE.screenX, gap: SPACE.sm },

  featuredCard: { padding: SPACE.md },
  featuredRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  featuredTexts: { flex: 1, gap: SPACE.xxs },
  // Disque jaune : signal d'action ; toute la carte est la cible tactile
  featuredCta: {
    width: SIZE.buttonSm, height: SIZE.buttonSm, borderRadius: SIZE.buttonSm / 2,
    backgroundColor: COLOR.action.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  // Tuile basse (64 px) : plaque 40 à gauche, nom + compteur à droite
  tile: {
    minHeight: SIZE.listRow + SPACE.xs,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    gap: SPACE.sm,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
  },
  tilePressed: { backgroundColor: COLOR.surface.elevated },
  tileTexts: { flex: 1, gap: SPACE.xxs },

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

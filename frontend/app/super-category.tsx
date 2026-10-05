import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Animated, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter, useLocalSearchParams, Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import {
  Txt, Card, Chip, Section, ScreenContainer, ScreenHeader, ThemeIcon, ThemeCard, Loader, EmptyState,
} from '../components/ui';
import { COLOR, SPACE, BORDER, ICON_SIZE } from '../theme/tokens';
import { t, getLanguage } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Au-delà de 4 thèmes : carrousel de 6 cartes au plus ; sinon des lignes
const CAROUSEL_MIN = 5;
const CAROUSEL_MAX = 6;

type ThemeItem = {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  color_hex: string;
  question_count: number;
  user_level: number;
  user_title: string;
};

type Cluster = {
  name: string;
  icon: string;
  themes: ThemeItem[];
};

type ClusterData = {
  super_category: string;
  label: string;
  icon: string;
  color: string;
  clusters: Cluster[];
};

export default function SuperCategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCluster, setActiveCluster] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  // Position verticale de chaque sous-catégorie (puces d'ancrage)
  const sectionY = useRef<Record<string, number>>({});
  const chipsH = useRef(0);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const lang = getLanguage();
      const qs = [userId ? `user_id=${userId}` : '', lang && lang !== 'fr' ? `lang=${lang}` : '']
        .filter(Boolean).join('&');
      const url = `${API_URL}/api/explore/${id}/clusters${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
    } catch (e) { console.error(e); }
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const openThemeDetail = (theme: ThemeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/category-detail?id=${theme.id}`);
  };

  // « Voir tout » : liste plein écran du cluster (remplace la grille dépliée en doublon).
  // `as Href` : route nouvelle, absente des types générés jusqu'au prochain `expo start`.
  const showAllThemes = (clusterName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/theme-list?cluster=${encodeURIComponent(clusterName)}&superCategory=${encodeURIComponent(String(id))}` as Href);
  };

  const jumpTo = (clusterName: string) => {
    setActiveCluster(clusterName);
    const y = sectionY.current[clusterName];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - chipsH.current - SPACE.md), animated: true });
  };

  // Puce active = dernière sous-catégorie passée sous la rangée de puces
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!data) return;
    const y = e.nativeEvent.contentOffset.y + chipsH.current + SPACE.xxl;
    let current: string | null = null;
    for (const cl of data.clusters) {
      const top = sectionY.current[cl.name];
      if (top !== undefined && top <= y) current = cl.name;
    }
    if (current !== activeCluster) setActiveCluster(current);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Loader fill />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <ScreenHeader overline={t('forge.universe_label')} />
        <View style={styles.center}>
          <EmptyState
            icon="info"
            title={t('common.error_loading')}
            actionLabel={t('common.back')}
            onAction={() => router.back()}
          />
        </View>
      </ScreenContainer>
    );
  }

  const totalThemes = data.clusters.reduce((n, cl) => n + cl.themes.length, 0);
  const themesLabel = t('themes.themes_count');

  return (
    <SwipeBackPage>
      <ScreenContainer>
        <ScreenHeader overline={t('forge.universe_label')} title={data.label.toUpperCase()} />

        <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={[1]}
            onScroll={onScroll}
            scrollEventThrottle={32}
          >
            {/* ── Hero à plat ── */}
            <View style={styles.hero}>
              <ThemeIcon superCategory={data.super_category || id} size={ICON_SIZE.theme.lg} />
              <View style={styles.heroTexts}>
                <Txt variant="h1" numberOfLines={2}>{data.label.toUpperCase()}</Txt>
                <Txt variant="label">
                  {`${totalThemes} ${themesLabel} · ${t('pilot.supercat.clusters_count', { n: String(data.clusters.length) })}`}
                </Txt>
              </View>
            </View>

            {/* ── Puces d'ancrage (collantes) ── */}
            <View style={styles.chipsBar} onLayout={(e) => { chipsH.current = e.nativeEvent.layout.height; }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {data.clusters.map((cl) => (
                  <Chip
                    key={cl.name}
                    label={cl.name}
                    selected={activeCluster === cl.name}
                    onPress={() => jumpTo(cl.name)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* ── Une section par sous-catégorie ── */}
            {data.clusters.map((cluster) => {
              const sorted = [...cluster.themes].sort((a, b) => b.question_count - a.question_count);
              const asCarousel = cluster.themes.length >= CAROUSEL_MIN;
              const shown = asCarousel ? sorted.slice(0, CAROUSEL_MAX) : sorted;
              const truncated = cluster.themes.length > shown.length;
              const metaOf = (th: ThemeItem) =>
                th.question_count > 0 ? t('pilot.supercat.questions_count', { n: String(th.question_count) }) : undefined;
              const levelOf = (th: ThemeItem) => (th.user_level > 0 ? th.user_level : undefined);

              return (
                <View
                  key={cluster.name}
                  onLayout={(e) => { sectionY.current[cluster.name] = e.nativeEvent.layout.y; }}
                >
                  <Section
                    overline={`${cluster.themes.length} ${themesLabel}`}
                    title={cluster.name}
                    insetTitle
                    onSeeAll={truncated ? () => showAllThemes(cluster.name) : undefined}
                  >
                    {asCarousel ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                        {shown.map((theme) => (
                          <ThemeCard
                            key={theme.id}
                            name={theme.name}
                            cluster={cluster.name}
                            superCategory={data.super_category || id}
                            level={levelOf(theme)}
                            meta={metaOf(theme)}
                            onPress={() => openThemeDetail(theme)}
                          />
                        ))}
                      </ScrollView>
                    ) : (
                      <Card style={styles.rowsCard}>
                        {shown.map((theme, i) => (
                          <ThemeCard
                            key={theme.id}
                            layout="row"
                            name={theme.name}
                            cluster={cluster.name}
                            superCategory={data.super_category || id}
                            level={levelOf(theme)}
                            meta={metaOf(theme)}
                            onPress={() => openThemeDetail(theme)}
                            style={i > 0 ? styles.rowDivider : undefined}
                          />
                        ))}
                      </Card>
                    )}
                  </Section>
                </View>
              );
            })}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </Animated.View>
      </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  scroll: { paddingTop: SPACE.lg, gap: SPACE.sectionGap },

  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, paddingHorizontal: SPACE.screenX },
  heroTexts: { flex: 1, gap: SPACE.xs },

  // Fond opaque : la rangée reste lisible quand elle colle en haut
  chipsBar: { backgroundColor: COLOR.bg.primary, paddingVertical: SPACE.sm },
  chips: { paddingHorizontal: SPACE.screenX, gap: SPACE.sm },

  carousel: { paddingHorizontal: SPACE.screenX, gap: SPACE.md },
  rowsCard: { marginHorizontal: SPACE.screenX, paddingVertical: SPACE.xs },
  rowDivider: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },

  bottomSpacer: { height: SPACE.huge },
});

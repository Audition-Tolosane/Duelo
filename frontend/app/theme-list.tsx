import SwipeBackPage from '../components/SwipeBackPage';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, SectionList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Txt, ScreenContainer, ScreenHeader, ThemeCard, Loader, EmptyState } from '../components/ui';
import { COLOR, SPACE, BORDER } from '../theme/tokens';
import { authFetch } from '../utils/api';
import { t, getLanguage } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Liste plein écran « Voir tout ».
//   /theme-list?cluster=<nom>&superCategory=<id>  → tous les thèmes d'une sous-catégorie
//   /theme-list?mine=1                            → tous les thèmes joués (depuis Explorer)
// Groupée pour se parcourir vite : d'abord les thèmes déjà joués (par niveau), puis tous les autres (A → Z).

type Row = {
  id: string;
  name: string;
  cluster?: string | null;
  superCategory?: string | null;
  level?: number;
  meta?: string;
};

type Group = { key: string; title: string; data: Row[] };

type ClusterTheme = { id: string; name: string; question_count: number; user_level: number };
type ClusterData = { super_category: string; label: string; clusters: { name: string; themes: ClusterTheme[] }[] };
type PlayedTheme = { name: string; level: number; xp: number; cluster?: string; super_category?: string };

const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export default function ThemeListScreen() {
  const router = useRouter();
  const { cluster, superCategory, mine } = useLocalSearchParams<{ cluster?: string; superCategory?: string; mine?: string }>();
  const isMine = mine === '1';
  const [groups, setGroups] = useState<Group[]>([]);
  const [universe, setUniverse] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => { load(); }, [cluster, superCategory, mine]);

  const load = async () => {
    setError(false);
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      if (isMine) {
        if (!uid) { setGroups([]); return; }
        const res = await authFetch(`${API_URL}/api/player/${uid}/profile?viewer_id=${uid}&posts_limit=0&lang=${getLanguage()}`);
        const data = await res.json();
        const map: Record<string, PlayedTheme> = data?.themes ?? {};
        const rows = Object.entries(map)
          .sort(([, a], [, b]) => (b.level - a.level) || (b.xp - a.xp))
          .map(([id, th]) => ({
            id, name: th.name, cluster: th.cluster, superCategory: th.super_category,
            level: th.level, meta: th.cluster || undefined,
          }));
        setGroups(rows.length ? [{ key: 'mine', title: '', data: rows }] : []);
      } else {
        const lang = getLanguage();
        const qs = [uid ? `user_id=${uid}` : '', lang && lang !== 'fr' ? `lang=${lang}` : '']
          .filter(Boolean).join('&');
        const res = await fetch(`${API_URL}/api/explore/${superCategory}/clusters${qs ? `?${qs}` : ''}`);
        const data: ClusterData = await res.json();
        setUniverse(data?.label ?? '');
        const found = data?.clusters?.find((c) => c.name === cluster);
        const rows: Row[] = (found?.themes ?? []).map((th) => ({
          id: th.id,
          name: th.name,
          cluster: found?.name,
          superCategory: data.super_category || superCategory,
          level: th.user_level > 0 ? th.user_level : undefined,
          meta: th.question_count > 0 ? t('pilot.supercat.questions_count', { n: String(th.question_count) }) : undefined,
        }));
        const played = rows.filter((r) => r.level !== undefined).sort((a, b) => (b.level! - a.level!) || byName(a, b));
        const others = rows.filter((r) => r.level === undefined).sort(byName);
        const next: Group[] = [];
        if (played.length) next.push({ key: 'played', title: t('pilot.theme_list.played'), data: played });
        if (others.length) {
          next.push({ key: 'all', title: played.length ? t('pilot.theme_list.to_discover') : t('search.all_themes'), data: others });
        }
        setGroups(next);
      }
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const openTheme = (row: Row) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/category-detail?id=${row.id}`);
  };

  const total = useMemo(() => groups.reduce((n, g) => n + g.data.length, 0), [groups]);
  const title = isMine ? t('pilot.explorer.your_themes') : (cluster ?? '');
  const overline = isMine
    ? `${total} ${t('themes.themes_count')}`
    : [universe.toUpperCase(), total ? `${total} ${t('themes.themes_count')}` : ''].filter(Boolean).join(' · ');

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader overline={overline} title={title} />
      {loading ? (
        <Loader fill />
      ) : error ? (
        <View style={styles.center}>
          <EmptyState
            icon="info"
            title={t('common.error_loading')}
            actionLabel={t('common.retry')}
            onAction={() => { setLoading(true); load(); }}
          />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon="compass" title={t('pilot.theme_list.empty')} />
        </View>
      ) : (
        <SectionList
          sections={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          initialNumToRender={14}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.groupHead}>
                <Txt variant="overline">{`${section.title} · ${section.data.length}`}</Txt>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <ThemeCard
              layout="row"
              name={item.name}
              themeId={item.id}
              cluster={item.cluster}
              superCategory={item.superCategory}
              level={item.level}
              meta={item.meta}
              onPress={() => openTheme(item)}
              style={[styles.row, index > 0 && styles.rowDivider]}
            />
          )}
        />
      )}
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  list: { paddingBottom: SPACE.giant },
  // Fond opaque : l'en-tête de groupe reste lisible quand il colle en haut
  groupHead: {
    backgroundColor: COLOR.bg.primary,
    paddingHorizontal: SPACE.screenX,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.sm,
  },
  row: { marginHorizontal: SPACE.screenX },
  rowDivider: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
});

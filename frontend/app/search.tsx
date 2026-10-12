import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Platform, KeyboardAvoidingView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import {
  Txt, Icon, IconName, Card, Chip, ListRow, SearchField, ScreenContainer, ScreenHeader, ThemeCard, Loader, EmptyState,
} from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';
import { t, getLanguage } from '../utils/i18n';

// Recherche (thèmes, joueurs, contenu des murs). Ouverte depuis la loupe de l'en-tête ou d'Explorer.
//   /search?tab=joueurs | contenu  → onglet de départ

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Univers filtrables côté joueurs : libellé + pictogramme (plus de pastilles de couleur muettes)
const PLAYER_CATEGORIES: { key: string; labelKey: string; icon: IconName }[] = [
  { key: 'series_tv', labelKey: 'chat.category.series_tv', icon: 'tv' },
  { key: 'geographie', labelKey: 'chat.category.geographie', icon: 'globe' },
  { key: 'histoire', labelKey: 'chat.category.histoire', icon: 'landmark' },
  { key: 'cinema', labelKey: 'chat.category.cinema', icon: 'film' },
  { key: 'sport', labelKey: 'chat.category.sport', icon: 'trophy' },
  { key: 'musique', labelKey: 'chat.category.musique', icon: 'music' },
  { key: 'sciences', labelKey: 'chat.category.sciences', icon: 'flask' },
  { key: 'gastronomie', labelKey: 'chat.category.gastronomie', icon: 'food' },
];

const DIFFICULTY_FILTER_KEYS: { key: string; labelKey: string; icon: IconName }[] = [
  { key: 'all', labelKey: 'search.difficulty_all', icon: 'grid' },
  { key: 'debutant', labelKey: 'search.difficulty_beginner', icon: 'sprout' },
  { key: 'intermediaire', labelKey: 'search.difficulty_intermediate', icon: 'flame' },
  { key: 'avance', labelKey: 'search.difficulty_advanced', icon: 'star' },
  { key: 'expert', labelKey: 'search.difficulty_expert', icon: 'crown' },
];

type ThemeResult = {
  id: string; name: string; description: string;
  total_questions: number; player_count: number; followers_count: number;
  user_level: number; user_title: string; is_following: boolean;
  difficulty_label: string; relevance_score: number;
  color_hex?: string; cluster?: string; super_category?: string;
};

type PlayerResult = {
  id: string; pseudo: string; avatar_seed: string; avatar_url?: string;
  country: string | null; country_flag: string;
  total_xp: number; matches_played: number;
  selected_title: string; best_category: string | null; best_level: number;
  cat_level: number; cat_title: string;
};

type PostResult = {
  id: string; category_id: string; category_name: string;
  user: { id: string; pseudo: string; avatar_seed: string; avatar_url?: string };
  content: string; has_image: boolean;
  likes_count: number; comments_count: number;
  is_liked: boolean; created_at: string;
};

type CommentResult = {
  id: string; post_id: string; category_id: string; category_name: string;
  user: { id: string; pseudo: string; avatar_seed: string; avatar_url?: string };
  content: string; created_at: string;
};

type TrendingTag = { tag: string; icon: string; type: string };

type Tab = 'themes' | 'joueurs' | 'contenu';

const TABS: { key: Tab; labelKey: string; icon: IconName }[] = [
  { key: 'themes', labelKey: 'search.tab_themes', icon: 'book' },
  { key: 'joueurs', labelKey: 'search.tab_players', icon: 'users' },
  { key: 'contenu', labelKey: 'search.tab_content', icon: 'document' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [myId, setMyId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(
    (initialTab === 'joueurs' || initialTab === 'contenu') ? initialTab : 'themes'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Themes
  const [themes, setThemes] = useState<ThemeResult[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  // Players
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [playerCatFilter, setPlayerCatFilter] = useState<string | null>(null);

  // Content
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [comments, setComments] = useState<CommentResult[]>([]);
  const [searchError, setSearchError] = useState(false);

  // Trending
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadInit();
  }, []);

  const loadInit = async () => {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    if (uid) setMyId(uid);
    fetchTrending(uid || '');
    // Load initial themes
    fetchThemes('', 'all', uid || '');
  };

  const fetchTrending = async (uid?: string) => {
    try {
      const uidParam = uid ? `?user_id=${uid}` : '';
      const res = await fetch(`${API_URL}/api/search/trending${uidParam}`);
      const data = await res.json();
      setTrendingTags(data.trending_tags || []);
      setTopPlayers(data.top_players || []);
    } catch (e) {
      console.error('[search] Trending fetch failed:', e);
      // #41 — reset to empty so stale data isn't shown and section stays hidden
      setTrendingTags([]);
      setTopPlayers([]);
    }
  };

  const fetchThemes = async (q: string, diff: string, userId: string) => {
    setIsSearching(true);
    setSearchError(false);
    try {
      let url = `${API_URL}/api/search/themes?lang=${getLanguage()}&`;
      if (q.trim()) url += `q=${encodeURIComponent(q.trim())}&`;
      if (diff !== 'all') url += `difficulty=${diff}&`;
      if (userId) url += `user_id=${userId}`;
      const res = await fetch(url);
      const data = await res.json();
      setThemes(data);
    } catch {
      setSearchError(true);
    }
    setIsSearching(false);
  };

  const fetchPlayers = async (q: string, cat: string | null) => {
    setIsSearching(true);
    setSearchError(false);
    try {
      let url = `${API_URL}/api/search/players?limit=25`;
      if (q.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
      if (cat) url += `&category=${cat}`;
      const res = await fetch(url);
      const data = await res.json();
      setPlayers(data.filter((p: PlayerResult) => p.id !== myId));
    } catch {
      setSearchError(true);
    }
    setIsSearching(false);
  };

  const fetchContent = async (q: string) => {
    if (!q.trim()) {
      setPosts([]);
      setComments([]);
      return;
    }
    setIsSearching(true);
    setSearchError(false);
    try {
      let url = `${API_URL}/api/search/content?q=${encodeURIComponent(q.trim())}`;
      if (myId) url += `&user_id=${myId}`;
      const res = await fetch(url);
      const data = await res.json();
      setPosts(data.posts || []);
      setComments(data.comments || []);
    } catch {
      setSearchError(true);
    }
    setIsSearching(false);
  };

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      performSearch(text);
    }, 400);
  };

  const performSearch = (q: string) => {
    if (activeTab === 'themes') fetchThemes(q, difficultyFilter, myId);
    else if (activeTab === 'joueurs') fetchPlayers(q, playerCatFilter);
    else if (activeTab === 'contenu') fetchContent(q);
  };

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    // Trigger search for new tab
    if (tab === 'themes') fetchThemes(searchQuery, difficultyFilter, myId);
    else if (tab === 'joueurs') fetchPlayers(searchQuery, playerCatFilter);
    else if (tab === 'contenu') fetchContent(searchQuery);
  };

  const handleDifficultyChange = (diff: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDifficultyFilter(diff);
    fetchThemes(searchQuery, diff, myId);
  };

  const handlePlayerCatFilter = (cat: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newCat = playerCatFilter === cat ? null : cat;
    setPlayerCatFilter(newCat);
    fetchPlayers(searchQuery, newCat);
  };

  const handleTrendingTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery(tag);
    setActiveTab('themes');
    fetchThemes(tag, difficultyFilter, myId);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('search.just_now');
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  // ── Renders ──

  const renderThemeItem = ({ item, index = 0 }: { item: ThemeResult; index?: number }) => (
    <ThemeCard
      key={item.id}
      layout="row"
      name={item.name}
      themeId={item.id}
      cluster={item.cluster}
      superCategory={item.super_category}
      level={item.user_level > 0 ? item.user_level : undefined}
      meta={t('pilot.supercat.questions_count', { n: (item.total_questions ?? 0).toLocaleString() })}
      onPress={() => router.push(`/category-detail?id=${item.id}`)}
      style={index > 0 ? st.rowDivider : undefined}
    />
  );

  const renderPlayerItem = ({ item, index = 0 }: { item: PlayerResult; index?: number }) => (
    <ListRow
      title={item.country_flag ? `${item.pseudo} ${item.country_flag}` : item.pseudo}
      subtitle={`${(item.total_xp ?? 0).toLocaleString()} XP · ${(item.matches_played ?? 0).toLocaleString()} ${t('search.matches')}`}
      leading={<UserAvatar avatarUrl={item.avatar_url} avatarSeed={item.avatar_seed} pseudo={item.pseudo} size={44} />}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/player-profile?id=${item.id}`);
      }}
      style={index > 0 ? st.rowDivider : undefined}
    />
  );

  const renderPostItem = ({ item }: { item: PostResult }) => (
    <Card
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/category-detail?id=${item.category_id}`);
      }}
      style={st.post}
    >
      <View style={st.author}>
        <UserAvatar avatarUrl={item.user.avatar_url} avatarSeed={item.user.avatar_seed} pseudo={item.user.pseudo} size={36} />
        <View style={st.flex}>
          <Txt variant="cardTitle" numberOfLines={1}>{item.user.pseudo}</Txt>
          <Txt variant="caption" numberOfLines={1}>{`${item.category_name} · ${timeAgo(item.created_at)}`}</Txt>
        </View>
      </View>
      <Txt variant="body" numberOfLines={3}>{item.content}</Txt>
      <View style={st.stats}>
        <View style={st.stat}>
          <Icon name="heart" size={ICON_SIZE.sm} color={item.is_liked ? COLOR.accent.warm : COLOR.text.tertiary} />
          <Txt variant="caption" color={item.is_liked ? COLOR.accent.warm : COLOR.text.tertiary}>{item.likes_count}</Txt>
        </View>
        <View style={st.stat}>
          <Icon name="message" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
          <Txt variant="caption">{item.comments_count}</Txt>
        </View>
        {item.has_image && <Icon name="camera" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />}
      </View>
    </Card>
  );

  const renderCommentItem = ({ item }: { item: CommentResult }) => (
    <Card style={st.comment}>
      <View style={st.author}>
        <UserAvatar avatarUrl={item.user.avatar_url} avatarSeed={item.user.avatar_seed} pseudo={item.user.pseudo} size={28} />
        <Txt variant="label" color={COLOR.text.primary} numberOfLines={1} style={st.shrink}>{item.user.pseudo}</Txt>
        <Txt variant="caption" numberOfLines={1} style={st.shrink}>{item.category_name}</Txt>
      </View>
      <Txt variant="bodySmall" numberOfLines={2}>{item.content}</Txt>
      <Txt variant="caption">{timeAgo(item.created_at)}</Txt>
    </Card>
  );

  // ── Difficulty filter row (shared) ──

  const renderDifficultyFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow} contentContainerStyle={st.chipsRow}>
      {DIFFICULTY_FILTER_KEYS.map((d) => (
        <Chip
          key={d.key}
          label={t(d.labelKey)}
          icon={d.icon}
          selected={difficultyFilter === d.key}
          onPress={() => handleDifficultyChange(d.key)}
        />
      ))}
    </ScrollView>
  );

  const renderCount = (n: number) =>
    searchQuery.trim() && n > 0 ? (
      <Txt variant="overline" style={st.count}>{`${n} ${t('search.results_label')}`}</Txt>
    ) : null;

  // ── Main Render ──

  const showTrendingSection = !searchQuery.trim() && activeTab === 'themes';

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('search.title')} />

      <View style={st.top}>
        <SearchField
          placeholder={
            activeTab === 'themes' ? t('search.placeholder_themes') :
            activeTab === 'joueurs' ? t('search.placeholder_players') :
            t('search.placeholder_content')
          }
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoFocus
          inputProps={{ onSubmitEditing: () => performSearch(searchQuery) }}
        />

        {/* Onglets : puces de choix (jaune = sélection) */}
        <View style={st.tabs} accessibilityRole="tablist">
          {TABS.map((tab) => (
            <Chip
              key={tab.key}
              label={t(tab.labelKey)}
              icon={tab.icon}
              selected={activeTab === tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={st.tab}
            />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Tendances (onglet Thèmes, sans recherche) */}
        {showTrendingSection && (
          <ScrollView style={st.flex} contentContainerStyle={st.trending} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
            {trendingTags.length > 0 && (
              <View style={st.section}>
                <Txt variant="overline" style={st.inset}>{t('search.trending')}</Txt>
                <View style={[st.tagsWrap, st.inset]}>
                  {trendingTags.map((tag, idx) => (
                    <Chip
                      key={idx}
                      label={tag.tag}
                      icon={tag.type === 'hot' ? 'flame' : undefined}
                      onPress={() => handleTrendingTag(tag.tag)}
                    />
                  ))}
                </View>
              </View>
            )}

            {topPlayers.length > 0 && (
              <View style={st.section}>
                <Txt variant="overline" style={st.inset}>{t('search.top_players')}</Txt>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.topPlayers}>
                  {topPlayers.map((p: any) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={p.pseudo}
                      style={({ pressed }) => [st.topPlayer, pressed && st.pressed]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/player-profile?id=${p.id}`);
                      }}
                    >
                      <UserAvatar avatarUrl={p.avatar_url} avatarSeed={p.avatar_seed || p.id} pseudo={p.pseudo} size={44} />
                      <Txt variant="label" color={COLOR.text.primary} align="center" numberOfLines={1}>{p.pseudo}</Txt>
                      <Txt variant="caption" align="center" numberOfLines={1}>{`${(p.total_xp ?? 0).toLocaleString()} XP`}</Txt>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={st.section}>
              <Txt variant="overline" style={st.inset}>{t('search.all_themes')}</Txt>
              {renderDifficultyFilters()}
              <View style={st.inset}>
                {themes.map((theme, idx) => renderThemeItem({ item: theme, index: idx }))}
              </View>
            </View>
          </ScrollView>
        )}

        {/* Résultats thèmes (avec recherche) */}
        {activeTab === 'themes' && !showTrendingSection && (
          <View style={st.flex}>
            {renderDifficultyFilters()}
            {searchError ? (
              <EmptyState icon="offline" title={t('search.error')} />
            ) : isSearching ? (
              <Loader />
            ) : (
              <FlatList
                data={themes}
                keyExtractor={item => item.id}
                renderItem={renderThemeItem}
                contentContainerStyle={st.list}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={renderCount(themes.length)}
                ListEmptyComponent={
                  <EmptyState
                    icon="search"
                    title={t('search.no_theme_found')}
                    message={searchQuery.trim() ? `« ${searchQuery.trim()} » · ${t('search.try_other_keywords')}` : t('search.try_other_keywords')}
                  />
                }
              />
            )}
          </View>
        )}

        {/* Résultats joueurs */}
        {activeTab === 'joueurs' && (
          <View style={st.flex}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow} contentContainerStyle={st.chipsRow}>
              {PLAYER_CATEGORIES.map((c) => (
                <Chip
                  key={c.key}
                  label={t(c.labelKey)}
                  icon={c.icon}
                  selected={playerCatFilter === c.key}
                  onPress={() => handlePlayerCatFilter(c.key)}
                />
              ))}
            </ScrollView>
            {isSearching ? (
              <Loader />
            ) : (
              <FlatList
                data={players}
                keyExtractor={item => item.id}
                renderItem={renderPlayerItem}
                contentContainerStyle={st.list}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={renderCount(players.length)}
                ListEmptyComponent={
                  <EmptyState
                    icon="users"
                    title={t('search.no_player_found')}
                    message={searchQuery.trim() ? `« ${searchQuery.trim()} » · ${t('search.search_by_pseudo')}` : t('search.search_by_pseudo')}
                  />
                }
              />
            )}
          </View>
        )}

        {/* Résultats contenu */}
        {activeTab === 'contenu' && (
          <ScrollView style={st.flex} contentContainerStyle={st.list} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
            {isSearching ? (
              <Loader />
            ) : !searchQuery.trim() ? (
              <EmptyState icon="document" title={t('search.search_content')} message={t('search.search_content_desc')} />
            ) : posts.length === 0 && comments.length === 0 ? (
              <EmptyState
                icon="search"
                title={t('search.no_results')}
                message={`« ${searchQuery.trim()} » · ${t('search.try_other_terms')}`}
              />
            ) : (
              <View style={st.contentGroups}>
                {posts.length > 0 && (
                  <View style={st.group}>
                    <View style={st.groupHead}>
                      <Icon name="clipboard" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
                      <Txt variant="overline">{`${t('search.publications')} (${posts.length})`}</Txt>
                    </View>
                    {posts.map((post) => (
                      <View key={post.id}>{renderPostItem({ item: post })}</View>
                    ))}
                  </View>
                )}
                {comments.length > 0 && (
                  <View style={st.group}>
                    <View style={st.groupHead}>
                      <Icon name="message" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
                      <Txt variant="overline">{`${t('search.comments')} (${comments.length})`}</Txt>
                    </View>
                    {comments.map((comment) => (
                      <View key={comment.id}>{renderCommentItem({ item: comment })}</View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  inset: { paddingHorizontal: SPACE.screenX },

  top: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.md, gap: SPACE.md },
  tabs: { flexDirection: 'row', gap: SPACE.sm },
  tab: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACE.sm },

  filterRow: { flexGrow: 0 },
  chipsRow: { paddingHorizontal: SPACE.screenX, paddingVertical: SPACE.md, gap: SPACE.sm },

  list: { paddingHorizontal: SPACE.screenX, paddingBottom: SPACE.huge, flexGrow: 1 },
  rowDivider: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
  count: { paddingTop: SPACE.xs, paddingBottom: SPACE.sm },

  // Tendances
  trending: { paddingTop: SPACE.xl, paddingBottom: SPACE.huge, gap: SPACE.sectionGap },
  section: { gap: SPACE.md },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  topPlayers: { paddingHorizontal: SPACE.screenX, gap: SPACE.sm },
  topPlayer: {
    width: 92, alignItems: 'center', gap: SPACE.xs,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm,
    borderRadius: RADII.lg, backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
  },
  pressed: { backgroundColor: COLOR.surface.elevated },

  // Contenu
  contentGroups: { gap: SPACE.sectionGap, paddingTop: SPACE.md },
  group: { gap: SPACE.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  post: { gap: SPACE.md },
  comment: { gap: SPACE.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  stats: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});

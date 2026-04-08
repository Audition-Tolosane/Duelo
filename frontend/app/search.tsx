import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
  ActivityIndicator, ScrollView, Animated, Keyboard, Platform,
  KeyboardAvoidingView, Dimensions
} from 'react-native';
import ReAnimated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import CategoryIcon from '../components/CategoryIcon';
import UserAvatar from '../components/UserAvatar';
import ScalePressable from '../components/ScalePressable';
import { t } from '../utils/i18n';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(hue2rgb(p, q, h/360 + 1/3))}${toHex(hue2rgb(p, q, h/360))}${toHex(hue2rgb(p, q, h/360 - 1/3))}`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return hslToHex(Math.abs(hash) % 360, 65, 55);
}

const CATEGORY_META: Record<string, { color: string; bg: string }> = {
  series_tv: { color: '#E040FB', bg: '#2D1B4E' },
  geographie: { color: '#00FFFF', bg: '#0D2B2B' },
  histoire: { color: '#FFD700', bg: '#2B2510' },
  cinema: { color: '#FF6B6B', bg: '#2B1515' },
  sport: { color: '#00FF9D', bg: '#0D2B1A' },
  musique: { color: '#FF8C00', bg: '#2B1E0D' },
  sciences: { color: '#7B68EE', bg: '#1A1533' },
  gastronomie: { color: '#FF69B4', bg: '#152B2B' },
};

const DIFFICULTY_FILTER_KEYS: { key: string; labelKey: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'all', labelKey: 'search.difficulty_all', icon: 'star-outline' },
  { key: 'debutant', labelKey: 'search.difficulty_beginner', icon: 'sprout' },
  { key: 'intermediaire', labelKey: 'search.difficulty_intermediate', icon: 'fire' },
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

const TAB_ICONS: Record<Tab, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  themes: 'book-open-variant',
  joueurs: 'account-group',
  contenu: 'text-box-outline',
};

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const searchInputRef = useRef<TextInput>(null);
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
      let url = `${API_URL}/api/search/themes?`;
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

  const renderThemeItem = ({ item, index = 0 }: { item: ThemeResult; index?: number }) => {
    const color = hashColor(item.id);
    return (
      <ReAnimated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      <ScalePressable
        style={st.themeCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/category-detail?id=${item.id}`);
        }}
      >
        <View style={[st.themeCardInner, { borderLeftColor: color, borderLeftWidth: 3 }]}>
          <View style={st.themeCardLeft}>
            <View style={[st.themeIconBox, { backgroundColor: color + '20' }]}>
              <CategoryIcon themeId={item.id} emoji={item.cluster || item.super_category} size={24} color={color} type="cluster" />
            </View>
          </View>
          <View style={st.themeCardCenter}>
            {item.cluster ? (
              <Text style={st.themeCluster}>{item.cluster}</Text>
            ) : null}
            <Text style={[st.themeName, { color }]}>{item.name}</Text>
            <Text style={st.themeDesc} numberOfLines={1}>{item.description}</Text>
            <View style={st.themeMetaRow}>
              <Text style={st.themeMeta}>{item.total_questions} {t('search.questions')}</Text>
              <Text style={st.themeMetaDot}>·</Text>
              <Text style={st.themeMeta}>{item.player_count} {t('search.players_count')}</Text>
            </View>
          </View>
          <View style={st.themeCardRight}>
            {item.user_level > 0 ? (
              <View style={[st.themeLevelBadge, { backgroundColor: color + '20' }]}>
                <Text style={[st.themeLevelText, { color }]}>{t('search.level_short')} {item.user_level}</Text>
              </View>
            ) : (
              <View style={[st.themeNewBadge, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                <Text style={[st.themeNewText, { color }]}>{item.cluster || t('search.new_badge')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScalePressable>
      </ReAnimated.View>
    );
  };

  const renderPlayerItem = ({ item, index = 0 }: { item: PlayerResult; index?: number }) => {
    return (
      <ReAnimated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      <ScalePressable
        style={st.playerCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/player-profile?id=${item.id}`);
        }}
      >
        <View style={st.playerAvatar}>
          <UserAvatar avatarUrl={item.avatar_url} avatarSeed={item.avatar_seed} pseudo={item.pseudo} size={48} />
        </View>
        <View style={st.playerInfo}>
          <View style={st.playerNameRow}>
            <Text style={st.playerName}>@{item.pseudo}</Text>
            <Text style={st.playerFlag}>{item.country_flag}</Text>
          </View>
          <Text style={st.playerTitle}>{item.selected_title}</Text>
          <View style={st.playerStatsRow}>
            <Text style={st.playerStat}>{item.total_xp.toLocaleString()} XP</Text>
            <Text style={st.playerStatDot}>·</Text>
            <Text style={st.playerStat}>{item.matches_played} {t('search.matches')}</Text>
            {item.best_category && (
              <>
                <Text style={st.playerStatDot}>·</Text>
                <Text style={[st.playerStat, { color: CATEGORY_META[item.best_category]?.color || '#A3A3A3' }]}>
                  {t('search.level_short')}{item.best_level}
                </Text>
              </>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#525252" />
      </ScalePressable>
      </ReAnimated.View>
    );
  };

  const renderPostItem = ({ item }: { item: PostResult }) => {
    const meta = CATEGORY_META[item.category_id] || { color: '#8A2BE2', bg: '#1A1A2E' };
    return (
      <TouchableOpacity
        style={st.postCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/category-detail?id=${item.category_id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={st.postHeader}>
          <View style={st.postAvatarSmall}>
            <UserAvatar avatarUrl={item.user.avatar_url} avatarSeed={item.user.avatar_seed} pseudo={item.user.pseudo} size={36} />
          </View>
          <View style={st.postHeaderInfo}>
            <Text style={st.postAuthor}>{item.user.pseudo}</Text>
            <View style={st.postCatRow}>
              <Text style={[st.postCatBadge, { color: meta.color }]}>{item.category_name}</Text>
              <Text style={st.postTime}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>
        <Text style={st.postContent} numberOfLines={3}>{item.content}</Text>
        <View style={st.postFooter}>
          <View style={st.postStatRow}>
            <MaterialCommunityIcons
              name={item.is_liked ? 'heart' : 'heart-outline'}
              size={15}
              color={item.is_liked ? '#FF4D6A' : '#525252'}
            />
            <Text style={[st.postStat, item.is_liked && { color: '#FF4D6A' }]}>{item.likes_count}</Text>
          </View>
          <View style={st.postStatRow}>
            <MaterialCommunityIcons name="comment-outline" size={15} color="#525252" />
            <Text style={st.postStat}>{item.comments_count}</Text>
          </View>
          {item.has_image && (
            <View style={st.postStatRow}>
              <MaterialCommunityIcons name="camera" size={15} color="#525252" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCommentItem = ({ item }: { item: CommentResult }) => {
    const meta = CATEGORY_META[item.category_id] || { color: '#8A2BE2', bg: '#1A1A2E' };
    return (
      <View style={st.commentCard}>
        <View style={st.commentHeader}>
          <View style={st.commentAvatarSmall}>
            <UserAvatar avatarUrl={item.user.avatar_url} avatarSeed={item.user.avatar_seed} pseudo={item.user.pseudo} size={28} />
          </View>
          <Text style={st.commentAuthor}>{item.user.pseudo}</Text>
          <Text style={[st.commentCat, { color: meta.color }]}>{item.category_name}</Text>
        </View>
        <Text style={st.commentContent} numberOfLines={2}>{item.content}</Text>
        <Text style={st.commentTime}>{timeAgo(item.created_at)}</Text>
      </View>
    );
  };

  // ── Difficulty filter row (shared) ──

  const renderDifficultyFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.diffFiltersWrap}>
      {DIFFICULTY_FILTER_KEYS.map((d) => (
        <TouchableOpacity
          key={d.key}
          style={[st.diffChip, difficultyFilter === d.key && st.diffChipActive]}
          onPress={() => handleDifficultyChange(d.key)}
        >
          <MaterialCommunityIcons
            name={d.icon}
            size={14}
            color={difficultyFilter === d.key ? '#8A2BE2' : '#A3A3A3'}
          />
          <Text style={[st.diffChipText, difficultyFilter === d.key && st.diffChipTextActive]}>
            {t(d.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── Main Render ──

  const showTrendingSection = !searchQuery.trim() && activeTab === 'themes';

  return (
    <SwipeBackPage>
    <View style={st.container}>
      <View style={{ paddingTop: insets.top, backgroundColor: GLASS.bgDark }}>
        <DueloHeader />
      </View>

      {/* Sub-header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtnCircle} activeOpacity={0.6}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>{t('search.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={st.searchBarWrap}>
        <View style={st.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.3)" style={{ marginRight: 10 }} />
          <TextInput
            ref={searchInputRef}
            style={st.searchInput}
            placeholder={
              activeTab === 'themes' ? t('search.placeholder_themes') :
              activeTab === 'joueurs' ? t('search.placeholder_players') :
              t('search.placeholder_content')
            }
            placeholderTextColor="#525252"
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(searchQuery)}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); performSearch(''); }} style={st.clearBtn}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#525252" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabsRow}>
        {([
          { key: 'themes' as Tab, label: t('search.tab_themes') },
          { key: 'joueurs' as Tab, label: t('search.tab_players') },
          { key: 'contenu' as Tab, label: t('search.tab_content') },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[st.tabBtn, activeTab === tab.key && st.tabBtnActive]}
            onPress={() => handleTabChange(tab.key)}
          >
            <View style={st.tabInner}>
              <MaterialCommunityIcons
                name={TAB_ICONS[tab.key]}
                size={16}
                color={activeTab === tab.key ? '#8A2BE2' : '#A3A3A3'}
              />
              <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Trending Section (visible when no search query + themes tab) */}
        {showTrendingSection && (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
            {/* Trending Tags */}
            {trendingTags.length > 0 && (
              <View style={st.trendingSection}>
                <View style={st.sectionLabelRow}>
                  <MaterialCommunityIcons name="fire" size={14} color="#525252" />
                  <Text style={st.sectionLabel}>{t('search.trending')}</Text>
                </View>
                <View style={st.trendingTagsWrap}>
                  {trendingTags.map((tag, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[st.trendingTag, tag.type === 'hot' && st.trendingTagHot]}
                      onPress={() => handleTrendingTag(tag.tag)}
                    >
                      <MaterialCommunityIcons
                        name={tag.type === 'hot' ? 'fire' : 'tag-outline'}
                        size={16}
                        color={tag.type === 'hot' ? '#FF5722' : 'rgba(255,255,255,0.5)'}
                      />
                      <Text style={[st.trendingTagText, tag.type === 'hot' && st.trendingTagTextHot]}>
                        {tag.tag}
                      </Text>
                      {tag.type === 'hot' && (
                        <View style={st.hotBadge}>
                          <MaterialCommunityIcons name="fire" size={10} color="#FF5722" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Top Players */}
            {topPlayers.length > 0 && (
              <View style={st.trendingSection}>
                <View style={st.sectionLabelRow}>
                  <MaterialCommunityIcons name="trophy" size={14} color="#525252" />
                  <Text style={st.sectionLabel}>{t('search.top_players')}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.topPlayersScroll}>
                  {topPlayers.map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={st.topPlayerCard}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/player-profile?id=${p.id}`);
                      }}
                    >
                      <View style={st.topPlayerAvatar}>
                        <UserAvatar avatarUrl={p.avatar_url} avatarSeed={p.avatar_seed || p.id} pseudo={p.pseudo} size={44} />
                      </View>
                      <Text style={st.topPlayerName} numberOfLines={1}>{p.pseudo}</Text>
                      <Text style={st.topPlayerXp}>{p.total_xp.toLocaleString()} XP</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* All Themes */}
            <View style={st.trendingSection}>
              <View style={st.sectionLabelRow}>
                <MaterialCommunityIcons name="book-open-variant" size={14} color="#525252" />
                <Text style={st.sectionLabel}>{t('search.all_themes')}</Text>
              </View>
              {/* Difficulty filter */}
              {renderDifficultyFilters()}
              {themes.map((theme, idx) => renderThemeItem({ item: theme, index: idx }))}
            </View>
          </ScrollView>
        )}

        {/* Themes Results (with query) */}
        {activeTab === 'themes' && !showTrendingSection && (
          <View style={{ flex: 1 }}>
            {/* Difficulty filter */}
            <View style={st.filterRow}>
              {renderDifficultyFilters()}
            </View>
            {searchError ? (
              <View style={st.emptyState}>
                <MaterialCommunityIcons name="wifi-off" size={40} color="#FF3B30" style={{ marginBottom: 12 }} />
                <Text style={[st.emptyTitle, { color: '#FF3B30' }]}>{t('search.error')}</Text>
              </View>
            ) : isSearching ? (
              <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={themes}
                keyExtractor={item => item.id}
                renderItem={renderThemeItem}
                contentContainerStyle={st.listContent}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={st.emptyState}>
                    <MaterialCommunityIcons name="magnify" size={48} color="#525252" style={{ marginBottom: 12 }} />
                    <Text style={st.emptyTitle}>{t('search.no_theme_found')}</Text>
                    <Text style={st.emptyDesc}>{t('search.try_other_keywords')}</Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        {/* Players Results */}
        {activeTab === 'joueurs' && (
          <View style={{ flex: 1 }}>
            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow} contentContainerStyle={st.catFiltersWrap}>
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <TouchableOpacity
                  key={key}
                  style={[st.catChip, playerCatFilter === key && { backgroundColor: meta.color + '25', borderColor: meta.color + '50' }]}
                  onPress={() => handlePlayerCatFilter(key)}
                >
                  <View style={[st.catChipDot, { backgroundColor: meta.color }]} />
                  {playerCatFilter === key && (
                    <MaterialCommunityIcons name="check" size={14} color={meta.color} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {isSearching ? (
              <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={players}
                keyExtractor={item => item.id}
                renderItem={renderPlayerItem}
                contentContainerStyle={st.listContent}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={st.emptyState}>
                    <MaterialCommunityIcons name="account-group" size={48} color="#525252" style={{ marginBottom: 12 }} />
                    <Text style={st.emptyTitle}>{t('search.no_player_found')}</Text>
                    <Text style={st.emptyDesc}>{t('search.search_by_pseudo')}</Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        {/* Content Results */}
        {activeTab === 'contenu' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false}>
            {isSearching ? (
              <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
            ) : !searchQuery.trim() ? (
              <View style={st.emptyState}>
                <MaterialCommunityIcons name="text-box-outline" size={48} color="#525252" style={{ marginBottom: 12 }} />
                <Text style={st.emptyTitle}>{t('search.search_content')}</Text>
                <Text style={st.emptyDesc}>{t('search.search_content_desc')}</Text>
              </View>
            ) : posts.length === 0 && comments.length === 0 ? (
              <View style={st.emptyState}>
                <MaterialCommunityIcons name="magnify" size={48} color="#525252" style={{ marginBottom: 12 }} />
                <Text style={st.emptyTitle}>{t('search.no_results')}</Text>
                <Text style={st.emptyDesc}>{t('search.try_other_terms')}</Text>
              </View>
            ) : (
              <>
                {posts.length > 0 && (
                  <>
                    <View style={st.contentSectionLabelRow}>
                      <MaterialCommunityIcons name="clipboard-text-outline" size={13} color="#525252" />
                      <Text style={st.contentSectionLabel}>{t('search.publications')} ({posts.length})</Text>
                    </View>
                    {posts.map((post) => (
                      <View key={post.id}>{renderPostItem({ item: post })}</View>
                    ))}
                  </>
                )}
                {comments.length > 0 && (
                  <>
                    <View style={[st.contentSectionLabelRow, { marginTop: 20 }]}>
                      <MaterialCommunityIcons name="comment-outline" size={13} color="#525252" />
                      <Text style={st.contentSectionLabel}>{t('search.comments')} ({comments.length})</Text>
                    </View>
                    {comments.map((comment) => (
                      <View key={comment.id}>{renderCommentItem({ item: comment })}</View>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
    </SwipeBackPage>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtnCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  // Search Bar
  searchBarWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1, color: '#FFF', fontSize: 15, paddingVertical: 14,
  },
  clearBtn: { padding: 8 },

  // Tabs
  tabsRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabBtnActive: { backgroundColor: 'rgba(138,43,226,0.15)', borderColor: 'rgba(138,43,226,0.4)' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { color: '#A3A3A3', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#8A2BE2' },

  // Filter rows
  filterRow: { maxHeight: 52, marginBottom: 4 },
  diffFiltersWrap: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  diffChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  diffChipActive: { backgroundColor: 'rgba(138,43,226,0.2)', borderColor: 'rgba(138,43,226,0.5)' },
  diffChipText: { color: '#A3A3A3', fontSize: 12, fontWeight: '600' },
  diffChipTextActive: { color: '#8A2BE2' },

  catFiltersWrap: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  catChipDot: {
    width: 10, height: 10, borderRadius: 5,
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptyDesc: { color: '#525252', fontSize: 13, textAlign: 'center' },

  // Trending
  trendingSection: { paddingHorizontal: 16, marginTop: 16 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 2,
  },
  trendingTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  trendingTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  trendingTagHot: { borderColor: 'rgba(255,87,34,0.4)', backgroundColor: 'rgba(255,87,34,0.1)' },
  trendingTagText: { color: '#E0E0E0', fontSize: 14, fontWeight: '600' },
  trendingTagTextHot: { color: '#FF5722' },
  hotBadge: {
    backgroundColor: 'rgba(255,87,34,0.2)',
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },

  // Top Players (horizontal scroll)
  topPlayersScroll: { gap: 12, paddingBottom: 8 },
  topPlayerCard: {
    alignItems: 'center', width: 80, paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  topPlayerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  topPlayerAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  topPlayerName: { color: '#FFF', fontSize: 11, fontWeight: '700', textAlign: 'center', paddingHorizontal: 4 },
  topPlayerXp: { color: '#00FFFF', fontSize: 10, fontWeight: '700', marginTop: 2 },

  // Theme Card
  themeCard: { marginBottom: 10 },
  themeCardInner: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  themeCardLeft: { marginRight: 12 },
  themeIconBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  themeCardCenter: { flex: 1 },
  themeCluster: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  themeName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  themeDesc: { color: '#A3A3A3', fontSize: 12, marginBottom: 4 },
  themeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  themeMeta: { color: '#525252', fontSize: 11, fontWeight: '600' },
  themeMetaDot: { color: '#333', fontSize: 10 },
  themeCardRight: { marginLeft: 8, alignItems: 'center' },
  themeLevelBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  themeLevelText: { fontSize: 11, fontWeight: '800' },
  themeNewBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  themeNewText: { color: '#525252', fontSize: 11, fontWeight: '700' },

  // Player Card
  playerCard: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  playerAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  playerAvatarText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  playerInfo: { flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  playerName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  playerFlag: { fontSize: 14 },
  playerTitle: { color: '#B57EDC', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  playerStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerStat: { color: '#525252', fontSize: 12, fontWeight: '600' },
  playerStatDot: { color: '#333', fontSize: 12 },

  // Post Card
  postCard: {
    padding: 14, borderRadius: 14, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postAvatarSmall: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  postAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  postHeaderInfo: { flex: 1 },
  postAuthor: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  postCatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  postCatBadge: { fontSize: 12, fontWeight: '600' },
  postTime: { color: '#525252', fontSize: 11 },
  postContent: { color: '#E0E0E0', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  postFooter: { flexDirection: 'row', gap: 16 },
  postStatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStat: { color: '#525252', fontSize: 13 },

  // Comment Card
  commentCard: {
    padding: 12, borderRadius: 12, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  commentAvatarSmall: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  commentAvatarText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  commentAuthor: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  commentCat: { fontSize: 11, fontWeight: '600' },
  commentContent: { color: '#A3A3A3', fontSize: 13, lineHeight: 18 },
  commentTime: { color: '#333', fontSize: 10, marginTop: 4 },

  // Content section label
  contentSectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: 8,
  },
  contentSectionLabel: {
    fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 2,
  },
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
  ActivityIndicator, ScrollView, Animated, Keyboard, Platform,
  KeyboardAvoidingView, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  series_tv: { icon: '📺', color: '#E040FB', bg: '#2D1B4E' },
  geographie: { icon: '🌍', color: '#00FFFF', bg: '#0D2B2B' },
  histoire: { icon: '🏛️', color: '#FFD700', bg: '#2B2510' },
  cinema: { icon: '🎬', color: '#FF6B6B', bg: '#2B1515' },
  sport: { icon: '⚽', color: '#00FF9D', bg: '#0D2B1A' },
  musique: { icon: '🎵', color: '#FF8C00', bg: '#2B1E0D' },
  sciences: { icon: '🔬', color: '#7B68EE', bg: '#1A1533' },
  gastronomie: { icon: '🍽️', color: '#FF69B4', bg: '#2B152B' },
};

const DIFFICULTY_FILTERS = [
  { key: 'all', label: 'Tous', icon: '🌟' },
  { key: 'debutant', label: 'Débutant', icon: '🌱' },
  { key: 'intermediaire', label: 'Intermédiaire', icon: '🔥' },
  { key: 'avance', label: 'Avancé', icon: '⭐' },
  { key: 'expert', label: 'Expert', icon: '👑' },
];

type ThemeResult = {
  id: string; name: string; description: string;
  total_questions: number; player_count: number; followers_count: number;
  user_level: number; user_title: string; is_following: boolean;
  difficulty_label: string; relevance_score: number;
};

type PlayerResult = {
  id: string; pseudo: string; avatar_seed: string;
  country: string | null; country_flag: string;
  total_xp: number; matches_played: number;
  selected_title: string; best_category: string | null; best_level: number;
  cat_level: number; cat_title: string;
};

type PostResult = {
  id: string; category_id: string; category_name: string;
  user: { id: string; pseudo: string; avatar_seed: string };
  content: string; has_image: boolean;
  likes_count: number; comments_count: number;
  is_liked: boolean; created_at: string;
};

type CommentResult = {
  id: string; post_id: string; category_id: string; category_name: string;
  user: { id: string; pseudo: string; avatar_seed: string };
  content: string; created_at: string;
};

type TrendingTag = { tag: string; icon: string; type: string };

type Tab = 'themes' | 'joueurs' | 'contenu';

export default function SearchScreen() {
  const router = useRouter();
  const [myId, setMyId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('themes');
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
    fetchTrending();
    // Load initial themes
    fetchThemes('', 'all', uid || '');
  };

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${API_URL}/api/search/trending`);
      const data = await res.json();
      setTrendingTags(data.trending_tags || []);
      setTopPlayers(data.top_players || []);
    } catch {}
  };

  const fetchThemes = async (q: string, diff: string, userId: string) => {
    setIsSearching(true);
    try {
      let url = `${API_URL}/api/search/themes?`;
      if (q.trim()) url += `q=${encodeURIComponent(q.trim())}&`;
      if (diff !== 'all') url += `difficulty=${diff}&`;
      if (userId) url += `user_id=${userId}`;
      const res = await fetch(url);
      const data = await res.json();
      setThemes(data);
    } catch {}
    setIsSearching(false);
  };

  const fetchPlayers = async (q: string, cat: string | null) => {
    setIsSearching(true);
    try {
      let url = `${API_URL}/api/search/players?limit=25`;
      if (q.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
      if (cat) url += `&category=${cat}`;
      const res = await fetch(url);
      const data = await res.json();
      setPlayers(data.filter((p: PlayerResult) => p.id !== myId));
    } catch {}
    setIsSearching(false);
  };

  const fetchContent = async (q: string) => {
    if (!q.trim()) {
      setPosts([]);
      setComments([]);
      return;
    }
    setIsSearching(true);
    try {
      let url = `${API_URL}/api/search/content?q=${encodeURIComponent(q.trim())}`;
      if (myId) url += `&user_id=${myId}`;
      const res = await fetch(url);
      const data = await res.json();
      setPosts(data.posts || []);
      setComments(data.comments || []);
    } catch {}
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
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  // ── Renders ──

  const renderThemeItem = ({ item }: { item: ThemeResult }) => {
    const meta = CATEGORY_META[item.id] || { icon: '❓', color: '#8A2BE2', bg: '#1A1A2E' };
    return (
      <TouchableOpacity
        style={st.themeCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/category-detail?id=${item.id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={[st.themeCardInner, { borderLeftColor: meta.color, borderLeftWidth: 3 }]}>
          <View style={st.themeCardLeft}>
            <View style={[st.themeIconBox, { backgroundColor: meta.color + '20' }]}>
              <Text style={st.themeIcon}>{meta.icon}</Text>
            </View>
          </View>
          <View style={st.themeCardCenter}>
            <Text style={[st.themeName, { color: meta.color }]}>{item.name}</Text>
            <Text style={st.themeDesc} numberOfLines={1}>{item.description}</Text>
            <View style={st.themeMetaRow}>
              <Text style={st.themeMeta}>{item.total_questions} questions</Text>
              <Text style={st.themeMetaDot}>·</Text>
              <Text style={st.themeMeta}>{item.player_count} joueurs</Text>
              <Text style={st.themeMetaDot}>·</Text>
              <Text style={st.themeMeta}>{item.followers_count} abonnés</Text>
            </View>
          </View>
          <View style={st.themeCardRight}>
            {item.user_level > 0 ? (
              <View style={[st.themeLevelBadge, { backgroundColor: meta.color + '20' }]}>
                <Text style={[st.themeLevelText, { color: meta.color }]}>Niv. {item.user_level}</Text>
              </View>
            ) : (
              <View style={st.themeNewBadge}>
                <Text style={st.themeNewText}>Nouveau</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPlayerItem = ({ item }: { item: PlayerResult }) => {
    return (
      <TouchableOpacity
        style={st.playerCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/player-profile?id=${item.id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={st.playerAvatar}>
          <Text style={st.playerAvatarText}>{item.pseudo[0]?.toUpperCase()}</Text>
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
            <Text style={st.playerStat}>{item.matches_played} parties</Text>
            {item.best_category && (
              <>
                <Text style={st.playerStatDot}>·</Text>
                <Text style={[st.playerStat, { color: CATEGORY_META[item.best_category]?.color || '#A3A3A3' }]}>
                  {CATEGORY_META[item.best_category]?.icon} Niv.{item.best_level}
                </Text>
              </>
            )}
          </View>
        </View>
        <Text style={st.playerArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderPostItem = ({ item }: { item: PostResult }) => {
    const meta = CATEGORY_META[item.category_id] || { icon: '❓', color: '#8A2BE2', bg: '#1A1A2E' };
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
            <Text style={st.postAvatarText}>{item.user.pseudo[0]?.toUpperCase()}</Text>
          </View>
          <View style={st.postHeaderInfo}>
            <Text style={st.postAuthor}>{item.user.pseudo}</Text>
            <View style={st.postCatRow}>
              <Text style={[st.postCatBadge, { color: meta.color }]}>{meta.icon} {item.category_name}</Text>
              <Text style={st.postTime}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>
        <Text style={st.postContent} numberOfLines={3}>{item.content}</Text>
        <View style={st.postFooter}>
          <Text style={st.postStat}>❤️ {item.likes_count}</Text>
          <Text style={st.postStat}>💬 {item.comments_count}</Text>
          {item.has_image && <Text style={st.postStat}>📷</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCommentItem = ({ item }: { item: CommentResult }) => {
    const meta = CATEGORY_META[item.category_id] || { icon: '❓', color: '#8A2BE2', bg: '#1A1A2E' };
    return (
      <View style={st.commentCard}>
        <View style={st.commentHeader}>
          <View style={st.commentAvatarSmall}>
            <Text style={st.commentAvatarText}>{item.user.pseudo[0]?.toUpperCase()}</Text>
          </View>
          <Text style={st.commentAuthor}>{item.user.pseudo}</Text>
          <Text style={[st.commentCat, { color: meta.color }]}>{meta.icon} {item.category_name}</Text>
        </View>
        <Text style={st.commentContent} numberOfLines={2}>{item.content}</Text>
        <Text style={st.commentTime}>{timeAgo(item.created_at)}</Text>
      </View>
    );
  };

  // ── Main Render ──

  const showTrendingSection = !searchQuery.trim() && activeTab === 'themes';

  return (
    <SwipeBackPage>
    <SafeAreaView style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Text style={st.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Recherche</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={st.searchBarWrap}>
        <View style={st.searchBar}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            ref={searchInputRef}
            style={st.searchInput}
            placeholder={
              activeTab === 'themes' ? 'Chercher un thème (ex: Espace, Star Wars...)' :
              activeTab === 'joueurs' ? 'Chercher un joueur (@pseudo ou titre...)' :
              'Chercher dans les publications...'
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
              <Text style={st.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabsRow}>
        {[
          { key: 'themes' as Tab, label: 'Thèmes', icon: '📚' },
          { key: 'joueurs' as Tab, label: 'Joueurs', icon: '👥' },
          { key: 'contenu' as Tab, label: 'Contenu', icon: '📝' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[st.tabBtn, activeTab === tab.key && st.tabBtnActive]}
            onPress={() => handleTabChange(tab.key)}
          >
            <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>
              {tab.icon} {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Trending Section (visible when no search query + themes tab) */}
        {showTrendingSection && (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Trending Tags */}
            {trendingTags.length > 0 && (
              <View style={st.trendingSection}>
                <Text style={st.sectionLabel}>🔥 TENDANCES DU MOMENT</Text>
                <View style={st.trendingTagsWrap}>
                  {trendingTags.map((tag, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[st.trendingTag, tag.type === 'hot' && st.trendingTagHot]}
                      onPress={() => handleTrendingTag(tag.tag)}
                    >
                      <Text style={st.trendingTagIcon}>{tag.icon}</Text>
                      <Text style={[st.trendingTagText, tag.type === 'hot' && st.trendingTagTextHot]}>
                        {tag.tag}
                      </Text>
                      {tag.type === 'hot' && <Text style={st.hotBadge}>HOT</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Top Players */}
            {topPlayers.length > 0 && (
              <View style={st.trendingSection}>
                <Text style={st.sectionLabel}>🏆 TOP JOUEURS</Text>
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
                        <Text style={st.topPlayerAvatarText}>{p.pseudo[0]?.toUpperCase()}</Text>
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
              <Text style={st.sectionLabel}>📚 TOUS LES THÈMES</Text>
              {/* Difficulty filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.diffFiltersWrap}>
                {DIFFICULTY_FILTERS.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    style={[st.diffChip, difficultyFilter === d.key && st.diffChipActive]}
                    onPress={() => handleDifficultyChange(d.key)}
                  >
                    <Text style={st.diffChipIcon}>{d.icon}</Text>
                    <Text style={[st.diffChipText, difficultyFilter === d.key && st.diffChipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {themes.map((theme) => renderThemeItem({ item: theme }))}
            </View>
          </ScrollView>
        )}

        {/* Themes Results (with query) */}
        {activeTab === 'themes' && !showTrendingSection && (
          <View style={{ flex: 1 }}>
            {/* Difficulty filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow} contentContainerStyle={st.diffFiltersWrap}>
              {DIFFICULTY_FILTERS.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[st.diffChip, difficultyFilter === d.key && st.diffChipActive]}
                  onPress={() => handleDifficultyChange(d.key)}
                >
                  <Text style={st.diffChipIcon}>{d.icon}</Text>
                  <Text style={[st.diffChipText, difficultyFilter === d.key && st.diffChipTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {isSearching ? (
              <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={themes}
                keyExtractor={item => item.id}
                renderItem={renderThemeItem}
                contentContainerStyle={st.listContent}
                ListEmptyComponent={
                  <View style={st.emptyState}>
                    <Text style={st.emptyIcon}>🔍</Text>
                    <Text style={st.emptyTitle}>Aucun thème trouvé</Text>
                    <Text style={st.emptyDesc}>Essayez avec d'autres mots-clés</Text>
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
                  <Text style={st.catChipIcon}>{meta.icon}</Text>
                  {playerCatFilter === key && <Text style={[st.catChipText, { color: meta.color }]}>✓</Text>}
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
                ListEmptyComponent={
                  <View style={st.emptyState}>
                    <Text style={st.emptyIcon}>👥</Text>
                    <Text style={st.emptyTitle}>Aucun joueur trouvé</Text>
                    <Text style={st.emptyDesc}>Cherche par @pseudo ou par titre</Text>
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
                <Text style={st.emptyIcon}>📝</Text>
                <Text style={st.emptyTitle}>Rechercher du contenu</Text>
                <Text style={st.emptyDesc}>Retrouvez des posts et discussions sur les murs sociaux</Text>
              </View>
            ) : posts.length === 0 && comments.length === 0 ? (
              <View style={st.emptyState}>
                <Text style={st.emptyIcon}>🔍</Text>
                <Text style={st.emptyTitle}>Aucun résultat</Text>
                <Text style={st.emptyDesc}>Essayez avec d'autres termes de recherche</Text>
              </View>
            ) : (
              <>
                {posts.length > 0 && (
                  <>
                    <Text style={st.contentSectionLabel}>📋 PUBLICATIONS ({posts.length})</Text>
                    {posts.map((post) => (
                      <View key={post.id}>{renderPostItem({ item: post })}</View>
                    ))}
                  </>
                )}
                {comments.length > 0 && (
                  <>
                    <Text style={[st.contentSectionLabel, { marginTop: 20 }]}>💬 COMMENTAIRES ({comments.length})</Text>
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
    </SafeAreaView>
    </SwipeBackPage>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#A3A3A3', fontSize: 24, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  // Search Bar
  searchBarWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: {
    flex: 1, color: '#FFF', fontSize: 15, paddingVertical: 14,
  },
  clearBtn: { padding: 8 },
  clearBtnText: { color: '#525252', fontSize: 16 },

  // Tabs
  tabsRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabBtnActive: { backgroundColor: 'rgba(138,43,226,0.15)', borderColor: 'rgba(138,43,226,0.4)' },
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
  diffChipIcon: { fontSize: 14 },
  diffChipText: { color: '#A3A3A3', fontSize: 12, fontWeight: '600' },
  diffChipTextActive: { color: '#8A2BE2' },

  catFiltersWrap: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  catChipIcon: { fontSize: 18 },
  catChipText: { fontSize: 14, fontWeight: '700' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptyDesc: { color: '#525252', fontSize: 13, textAlign: 'center' },

  // Trending
  trendingSection: { paddingHorizontal: 16, marginTop: 16 },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 2, marginBottom: 12,
  },
  trendingTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  trendingTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  trendingTagHot: { borderColor: 'rgba(255,87,34,0.4)', backgroundColor: 'rgba(255,87,34,0.1)' },
  trendingTagIcon: { fontSize: 16 },
  trendingTagText: { color: '#E0E0E0', fontSize: 14, fontWeight: '600' },
  trendingTagTextHot: { color: '#FF5722' },
  hotBadge: {
    fontSize: 9, fontWeight: '900', color: '#FF5722', backgroundColor: 'rgba(255,87,34,0.2)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', letterSpacing: 1,
  },

  // Top Players (horizontal scroll)
  topPlayersScroll: { gap: 12, paddingBottom: 8 },
  topPlayerCard: {
    alignItems: 'center', width: 80, paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  topPlayerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#8A2BE2',
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
  themeIcon: { fontSize: 24 },
  themeCardCenter: { flex: 1 },
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
  playerArrow: { color: '#525252', fontSize: 24, fontWeight: '300' },

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
  contentSectionLabel: {
    fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 2, marginBottom: 12, marginTop: 8,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Pressable, StyleSheet, ScrollView, TextInput, Image,
  KeyboardAvoidingView, Platform, Keyboard, RefreshControl, Modal, Alert, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { authFetch } from '../utils/api';
import { t, getLanguage } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import {
  Txt, Icon, Button, IconButton, Badge, Card, Chip, Section, ScreenContainer, ScreenHeader,
  ProgressBar, ListRow, Loader, EmptyState, ThemeIcon, ThemeIllustration, BottomSheet, SearchField,
} from '../components/ui';
import { COLOR, SPACE, RADII, SIZE, BORDER, GRADIENTS, TYPO, ICON_SIZE, PALETTE, alpha } from '../theme/tokens';
import { resolveThemeIcon } from '../theme/themeIconMap';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Liseré d'univers (fin, jamais en aplat) : chaud = corail (accent secondaire), patrimoine = or,
// le reste = crème. Uniquement des couleurs de PALETTE.
const UNIVERSE_ACCENT: Record<string, string> = {
  SCREEN: PALETTE.coral, SOUND: PALETTE.coral, ARENA: PALETTE.coral, ART: PALETTE.coral,
  LEGENDS: PALETTE.gold,
  LAB: PALETTE.cream, GLOBE: PALETTE.cream, LIFE: PALETTE.cream, MIND: PALETTE.cream,
};
// Au-delà, la description est repliée sur 3 lignes avec « Lire la suite ».
const DESC_CLAMP_CHARS = 140;

// Paliers de titres affichés dans « Ta progression ».
const MILESTONES = [1, 10, 20, 35, 50] as const;
// Nombre de posts du mur visibles avant « Voir tout ».
const WALL_PREVIEW = 2;

type TopPlayer = {
  id: string; pseudo: string; avatar_seed: string;
  avatar_url?: string; avatar_frame?: string;
  xp: number; level: number; title: string;
};

type CategoryDetail = {
  id: string; name: string; description: string;
  total_questions: number; followers_count: number;
  user_level: number; user_title: string; user_xp: number;
  xp_progress: { current: number; needed: number; progress: number };
  is_following: boolean; completion_pct: number;
  color_hex?: string; icon_url?: string; question_count?: number;
  super_category?: string; cluster?: string;
  all_titles?: Record<string, string>;
  unlocked_titles?: { level: number; title: string }[];
  top_player?: TopPlayer;
};

type WallPostData = {
  id: string;
  user: { id: string; pseudo: string; avatar_seed: string; avatar_url?: string };
  content: string; image_base64: string | null;
  likes_count: number; comments_count: number;
  is_liked: boolean; created_at: string;
};

type CommentData = {
  id: string;
  user: { id: string; pseudo: string; avatar_seed: string; avatar_url?: string };
  content: string; created_at: string;
};


export default function CategoryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    Alert.alert(t('common.error'), t('category.error_not_found'));
    router.back();
    return null;
  }

  const [userId, setUserId] = useState('');
  // « Défier un ami » : amis (abonnements + abonnés) puis recherche de joueurs.
  type FriendItem = { id: string; pseudo: string; avatar_seed?: string; avatar_url?: string | null; selected_title?: string };
  const [friendSheetVisible, setFriendSheetVisible] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendResults, setFriendResults] = useState<FriendItem[]>([]);
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [posts, setPosts] = useState<WallPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const followInFlightRef = useRef(false); // #21 — ref-based guard prevents race before state re-render
  const [fetchError, setFetchError] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

  // Post creation
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Comments
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommentData[]>>({});
  const [commentText, setCommentText] = useState('');
  const [commentingPost, setCommentingPost] = useState<string | null>(null);

  // VO mode (SCREEN themes only)
  const [voMode, setVoMode] = useState(false);
  const [voGenerating, setVoGenerating] = useState(false);

  // Présentation uniquement : mur replié à 2 posts, bouton collant masqué quand le clavier est ouvert.
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Présentation : description repliable, nom du thème dans l'en-tête quand le hero sort de l'écran.
  const { width: winW, height: winH } = useWindowDimensions();
  const [descExpanded, setDescExpanded] = useState(false);
  const [headerTitleShown, setHeaderTitleShown] = useState(false);
  const headerTitleShownRef = useRef(false);
  const heroYRef = useRef(0);
  const heroTextsYRef = useRef(0);
  const heroTitleBottomRef = useRef(-1); // bas du titre dans heroTexts ; -1 = pas encore mesuré

  // Les mesures arrivent dans un ordre quelconque : on additionne au moment du défilement.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (heroTitleBottomRef.current < 0) return;
    const limit = heroYRef.current + heroTextsYRef.current + heroTitleBottomRef.current;
    const show = e.nativeEvent.contentOffset.y > limit;
    if (show !== headerTitleShownRef.current) {
      headerTitleShownRef.current = show;
      setHeaderTitleShown(show);
    }
  };
  const onTitleLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    heroTitleBottomRef.current = y + height;
  };

  // Leaderboard (navigates to separate screen)

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const init = async () => {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    if (uid) setUserId(uid);
    const storedVo = await AsyncStorage.getItem(`duelo_vo_${id}`);
    if (storedVo === 'true') setVoMode(true);
    await fetchDetail(uid || '');
    await fetchWall(uid || '');
    setLoading(false);
  };

  const fetchDetail = async (uid: string) => {
    try {
      // La langue est transmise pour que le nom du thème, sa description et les
      // titres de niveau reviennent traduits. Le serveur retombe champ par champ sur
      // le français pour tout ce qui n'est pas encore traduit.
      const lang = getLanguage();
      const qs = [uid ? `user_id=${uid}` : '', lang && lang !== 'fr' ? `lang=${lang}` : '']
        .filter(Boolean).join('&');
      const res = await fetch(`${API_URL}/api/theme/${id}/detail${qs ? `?${qs}` : ''}`);
      if (!res.ok) { setFetchError(true); return; }
      const data = await res.json();
      setFetchError(false);
      const xpProg = data.xp_progress || { current: 0, needed: 500, progress: 0 };
      setDetail({
        id: data.id,
        name: data.name,
        description: data.description || '',
        total_questions: data.question_count || 0,
        followers_count: data.followers_count || 0,
        user_level: data.user_level || 0,
        user_title: data.user_title || '',
        user_xp: data.user_xp || 0,
        xp_progress: xpProg,
        is_following: data.is_following || false,
        completion_pct: 0,
        color_hex: data.color_hex,
        icon_url: data.icon_url,
        question_count: data.question_count,
        super_category: data.super_category,
        cluster: data.cluster,
        all_titles: data.all_titles || {},
        unlocked_titles: data.unlocked_titles || [],
        top_player: data.top_player || undefined,
      });
    } catch { setFetchError(true); }
  };

  const fetchWall = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/category/${id}/wall?user_id=${uid}`);
      if (res.ok) setPosts(await res.json());
    } catch (e) { console.error(e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDetail(userId);
    await fetchWall(userId);
    setRefreshing(false);
  };

  const handleFollow = async () => {
    if (!userId || !detail || followInFlightRef.current) return;
    followInFlightRef.current = true;
    setFollowLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const wasFollowing = detail.is_following;
    // Optimistic update
    setDetail(prev => prev ? { ...prev, is_following: !wasFollowing, followers_count: prev.followers_count + (wasFollowing ? -1 : 1) } : null);
    try {
      const res = await authFetch(`${API_URL}/api/theme/${id}/follow`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        // Rollback
        setDetail(prev => prev ? { ...prev, is_following: wasFollowing, followers_count: prev.followers_count + (wasFollowing ? 1 : -1) } : null);
      }
    } catch (e) {
      console.error('Follow toggle error:', e);
      setDetail(prev => prev ? { ...prev, is_following: wasFollowing, followers_count: prev.followers_count + (wasFollowing ? 1 : -1) } : null);
    } finally {
      followInFlightRef.current = false;
      setFollowLoading(false);
    }
  };

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${id}&themeName=${encodeURIComponent(detail?.name || '')}`);
  };

  const openFriendSheet = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFriendSheetVisible(true);
    if (!userId || friends.length > 0) return;
    setFriendsLoading(true);
    try {
      const lists = await Promise.all(['following', 'followers'].map(async (type) => {
        const res = await authFetch(`${API_URL}/api/player/${userId}/followers?type=${type}`);
        const data = res.ok ? await res.json() : [];
        return Array.isArray(data) ? (data as FriendItem[]) : [];
      }));
      const seen = new Set<string>();
      setFriends(lists.flat().filter((f) => f.id !== userId && !seen.has(f.id) && !!seen.add(f.id)));
    } catch (e) { console.error(e); }
    setFriendsLoading(false);
  };

  useEffect(() => {
    const q = friendQuery.trim();
    if (q.length < 2) { setFriendResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/search/players?limit=20&q=${encodeURIComponent(q)}`);
        const data = res.ok ? await res.json() : [];
        setFriendResults((Array.isArray(data) ? data : data.players || []).filter((p: FriendItem) => p.id !== userId));
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [friendQuery]);

  const closeFriendSheet = () => {
    setFriendSheetVisible(false);
    setFriendQuery('');
  };

  // Le défi se confirme sur le profil de l'ami, avec ce thème présélectionné.
  const handleChallengeFriend = (friendId: string) => {
    closeFriendSheet();
    router.push(`/player-profile?id=${friendId}&challenge=1&themeId=${id}&themeName=${encodeURIComponent(detail?.name || '')}` as any);
  };

  const handleLeaderboard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/leaderboard?themeId=${id}&themeName=${encodeURIComponent(detail?.name || '')}`);
  };

  const handleVoToggle = async () => {
    if (voGenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !voMode;
    if (newVal) {
      // Enable VO: trigger generation if needed
      setVoGenerating(true);
      try {
          const res = await authFetch(`${API_URL}/api/game/generate-vo/${id}`, { method: 'POST' });
        if (res.ok) {
          setVoMode(true);
          await AsyncStorage.setItem(`duelo_vo_${id}`, 'true');
        } else {
          Alert.alert(t('common.error'), t('category.vo_unavailable'));
        }
      } catch {
        Alert.alert(t('common.error'), t('category.vo_unavailable'));
      } finally {
        setVoGenerating(false);
      }
    } else {
      setVoMode(false);
      await AsyncStorage.removeItem(`duelo_vo_${id}`);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setNewPostImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() || !userId || posting) return;
    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await authFetch(`${API_URL}/api/category/${id}/wall`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          content: newPostText.trim(),
          image_base64: newPostImage,
        }),
      });
      const data = await res.json();
      setPosts(prev => [data, ...prev]);
      setNewPostText('');
      setNewPostImage(null);
      setShowCreatePost(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);
    } catch {
      Alert.alert(t('common.error'), t('category.error_post_failed'));
    }
    setPosting(false);
  };

  const handleLike = async (postId: string) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await authFetch(`${API_URL}/api/wall/${postId}/like`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        is_liked: data.liked,
        likes_count: p.likes_count + (data.liked ? 1 : -1)
      } : p));
    } catch (e) { console.error(e); }
  };

  const loadComments = async (postId: string) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
      return;
    }
    setExpandedPost(postId);
    try {
      const res = await fetch(`${API_URL}/api/wall/${postId}/comments`);
      const data = await res.json();
      setComments(prev => ({ ...prev, [postId]: data }));
    } catch (e) { console.error(e); }
  };

  const handleComment = async (postId: string) => {
    if (!commentText.trim() || !userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await authFetch(`${API_URL}/api/wall/${postId}/comment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, content: commentText.trim() }),
      });
      const data = await res.json();
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
      setCommentText('');
      setCommentingPost(null);
      Keyboard.dismiss();
    } catch (e) { console.error(e); }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('category.just_now');
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  if (loading) {
    return <ScreenContainer><Loader fill /></ScreenContainer>;
  }

  if (fetchError && !detail) {
    return (
      <ScreenContainer safeTop>
        <View style={styles.centerFill}>
          <EmptyState
            icon="error"
            title={t('common.error_loading')}
            actionLabel={t('common.retry')}
            onAction={() => { setFetchError(false); setLoading(true); init(); }}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (!detail) return null;

  const isMaxLevel = detail.user_level >= 50;
  const hasMilestones = !!detail.all_titles && Object.keys(detail.all_titles).length > 0;
  const visiblePosts = showAllPosts ? posts : posts.slice(0, WALL_PREVIEW);
  const wallTruncated = !showAllPosts && posts.length > WALL_PREVIEW;

  // ── Hero : mesures de la composition ton sur ton ──
  const compact = winH < 700;                       // 320×568 et petits Android
  const plateSize = compact ? 88 : 104;
  const universe = (detail.super_category || '').toUpperCase();
  const accent = UNIVERSE_ACCENT[universe] ?? PALETTE.cream;
  const headerOverline = [detail.super_category, detail.cluster].filter(Boolean).join(' · ') || undefined;
  const descLong = detail.description.length > DESC_CLAMP_CHARS;
  const descClamped = descLong && !descExpanded;
  const heroArt = resolveThemeIcon({ themeName: detail.name, cluster: detail.cluster, superCategory: detail.super_category });
  // Dôme pétrole : un grand disque dont seul l'arc inférieur entre dans l'écran. Il descend
  // jusqu'aux 4/5 de la plaque, jamais derrière le nom ni la description.
  const domeD = winW * 1.6;
  const domeBottom = Math.round(plateSize * 0.8);
  const domeTop = domeBottom - domeD;               // repère : haut du hero
  const domeLeft = (winW - domeD) / 2 - SPACE.screenX;
  // Illustration géante, décalée à droite et rognée par le dôme.
  const artSize = Math.round(winW * 0.9);
  const artLeftInDome = (domeD - winW) / 2 + winW * 0.42;
  const artTopInDome = (-SPACE.xxl - artSize * 0.3) - domeTop;

  return (
    <SwipeBackPage>
    <ScreenContainer>
      {/* En-tête allégé : retour + univers/cluster + favori. Le nom n'y apparaît que lorsque le hero est sorti de l'écran. */}
      <ScreenHeader
        overline={headerOverline}
        title={headerTitleShown ? detail.name : undefined}
        right={
          <Pressable
            testID="follow-button"
            accessibilityRole="button"
            accessibilityLabel={detail.is_following ? t('category.following') : t('category.follow')}
            accessibilityState={{ selected: detail.is_following, busy: followLoading }}
            hitSlop={4}
            onPress={handleFollow}
            style={({ pressed }) => [styles.favBtn, detail.is_following && styles.favBtnActive, pressed && styles.pressed]}
          >
            <Icon
              name="heart"
              size={ICON_SIZE.md}
              color={detail.is_following ? COLOR.accent.warm : COLOR.text.primary}
              strokeWidth={detail.is_following ? 2.5 : 2}
            />
          </Pressable>
        }
      />

      {/* Post success toast */}
      {postSuccess && (
        <View style={styles.successToast} pointerEvents="none">
          <Icon name="success" size={16} color={COLOR.status.success} />
          <Txt variant="label" color={COLOR.status.success}>{t('category.post_published')}</Txt>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={32}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.text.primary} />}
        >
          {/* ── Hero à plat : plaque crème, nom, description, chiffres ── */}
          <View
            style={[styles.hero, compact && styles.heroCompact]}
            onLayout={e => { heroYRef.current = e.nativeEvent.layout.y; }}
          >
            {/* Composition ton sur ton propre au thème (décor pur, ignoré par les lecteurs d'écran).
                Cadre de la largeur exacte de l'écran, débordement coupé : le disque (1,6 × l'écran)
                ne doit jamais élargir la page (glissement horizontal sur le web). */}
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.domeClip, { top: domeTop, left: -SPACE.screenX, width: winW, height: domeD }]}
            >
            <View
              style={[
                styles.dome,
                { width: domeD, height: domeD, borderRadius: domeD / 2, top: 0, left: domeLeft + SPACE.screenX, borderColor: alpha(accent, 0.4) },
              ]}
            >
              <View style={[styles.domeArt, { left: artLeftInDome, top: artTopInDome }]}>
                {heroArt.kind === 'illustration' ? (
                  <ThemeIllustration name={heroArt.name} size={artSize} />
                ) : (
                  <Icon name={heroArt.name} size={artSize} color={PALETTE.cream} strokeWidth={1.2} />
                )}
              </View>
            </View>
            </View>

            <ThemeIcon
              themeName={detail.name}
              cluster={detail.cluster}
              superCategory={detail.super_category}
              size={plateSize}
            />
            <View style={styles.heroTexts} onLayout={e => { heroTextsYRef.current = e.nativeEvent.layout.y; }}>
              <Txt
                variant="h1"
                align="center"
                accessibilityRole="header"
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                onLayout={onTitleLayout}
              >
                {detail.name}
              </Txt>
              {detail.description ? (
                <>
                  <Txt variant="bodySmall" align="center" numberOfLines={descClamped ? 3 : undefined}>
                    {detail.description}
                  </Txt>
                  {descLong ? (
                    <Pressable
                      onPress={() => setDescExpanded(v => !v)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: descExpanded }}
                      style={({ pressed }) => [styles.descToggle, pressed && styles.pressed]}
                    >
                      <Txt variant="label" color={COLOR.text.primary}>
                        {descExpanded ? t('pilot.theme.read_less') : t('pilot.theme.read_more')}
                      </Txt>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Txt variant="statMedium">{detail.followers_count.toLocaleString()}</Txt>
                <Txt variant="overline">{t('category.followers')}</Txt>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Txt variant="statMedium">{detail.total_questions.toLocaleString()}</Txt>
                <Txt variant="overline">{t('category.questions')}</Txt>
              </View>
            </View>

            {/* VO — thèmes SCREEN uniquement : puce neutre (jaune quand active = sélection) */}
            {detail.super_category === 'SCREEN' && (
              <View style={styles.voRow}>
                <Chip
                  icon={voGenerating ? 'clock' : voMode ? 'check' : 'film'}
                  label={voGenerating ? t('category.vo_generating') : t('category.vo_toggle')}
                  selected={voMode && !voGenerating}
                  onPress={handleVoToggle}
                />
                <Txt variant="caption" align="center">
                  {voMode ? t('category.vo_on') : t('category.vo_off')}
                </Txt>
              </View>
            )}
          </View>

          {/* ── Ta progression : une seule carte, une seule barre ── */}
          <Section title={t('pilot.theme.progress_title')}>
            <Card>
              <View style={styles.levelRow}>
                <View>
                  <Txt variant="overline">{t('pilot.theme.level')}</Txt>
                  <Txt variant="statLarge" color={COLOR.action.primary}>{detail.user_level}</Txt>
                </View>
                <View style={styles.levelInfo}>
                  {detail.user_title ? (
                    <Txt variant="cardTitle" align="right" numberOfLines={2}>{detail.user_title}</Txt>
                  ) : (
                    <Txt variant="bodySmall" align="right">{t('category.no_title_yet')}</Txt>
                  )}
                </View>
              </View>

              {isMaxLevel ? (
                <Txt variant="label" color={COLOR.reward.gold} style={styles.maxLevel}>{t('category.max_level')}</Txt>
              ) : (
                <View style={styles.xpBlock}>
                  <ProgressBar value={detail.xp_progress.progress} />
                  <View style={styles.xpLegend}>
                    <Txt variant="caption">
                      {t('pilot.theme.next_level', { level: String(detail.user_level + 1) })}
                    </Txt>
                    <Txt variant="caption" style={styles.tabular}>
                      {detail.xp_progress.current.toLocaleString()} / {detail.xp_progress.needed.toLocaleString()} XP
                    </Txt>
                  </View>
                </View>
              )}

              {/* Jalons des titres 1 / 10 / 20 / 35 / 50 */}
              {hasMilestones && (
                <View style={styles.milestones}>
                  {/* Liste verticale : les titres longs restent lisibles en entier (plus de mots coupés) */}
                  {MILESTONES.map((lvl, i) => {
                    const title = detail.all_titles?.[String(lvl)];
                    if (!title) return null;
                    const reached = detail.user_level >= lvl;
                    const last = i === MILESTONES.length - 1;
                    return (
                      <View key={lvl} style={styles.milestone}>
                        <View style={styles.milestoneRail}>
                          <View style={[styles.milestoneDot, reached && styles.milestoneDotReached]}>
                            {reached ? <Icon name="check" size={12} color={COLOR.text.onAction} strokeWidth={3} /> : null}
                          </View>
                          {!last ? <View style={[styles.milestoneLine, reached && styles.milestoneLineReached]} /> : null}
                        </View>
                        <Txt variant="overline" color={reached ? COLOR.action.primary : COLOR.text.tertiary} style={styles.milestoneLvl}>
                          {lvl === 1 ? t('pilot.theme.milestone_start') : t('common.level_short', { n: String(lvl) })}
                        </Txt>
                        <Txt variant="label" color={reached ? COLOR.text.primary : COLOR.text.tertiary} style={styles.milestoneTitle}>
                          {title}
                        </Txt>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </Section>

          {/* ── Classement : maître du thème + lien vers le classement complet ── */}
          <Section title={t('category.leaderboard')}>
            <Card padded={false} style={styles.listCard}>
              {detail.top_player ? (
                <ListRow
                  leading={
                    <UserAvatar
                      avatarUrl={detail.top_player.avatar_url}
                      avatarSeed={detail.top_player.avatar_seed}
                      pseudo={detail.top_player.pseudo}
                      size={40}
                    />
                  }
                  title={detail.top_player.pseudo}
                  subtitle={detail.top_player.title}
                  trailing={<Badge label={t('category.top_master')} tone="reward" />}
                  chevron
                  onPress={() => router.push(`/player-profile?id=${detail.top_player!.id}`)}
                />
              ) : (
                <ListRow
                  leading={<Icon name="crown" size={22} color={COLOR.reward.gold} />}
                  title={t('pilot.theme.no_master')}
                />
              )}
              <View style={styles.rowDivider} />
              <ListRow
                testID="leaderboard-button"
                leadingIcon="trophy"
                title={t('pilot.theme.see_leaderboard')}
                onPress={handleLeaderboard}
              />
            </Card>
          </Section>

          {/* ── Mur de la communauté : 2 posts + « Voir tout » ── */}
          <Section
            title={t('pilot.theme.community')}
            onSeeAll={wallTruncated ? () => setShowAllPosts(true) : undefined}
          >
            {posts.length === 0 ? (
              <EmptyState
                icon="message"
                title={t('category.be_first_to_post')}
                message={t('category.share_opinions')}
                actionLabel={t('category.publish_btn')}
                onAction={() => setShowCreatePost(true)}
              />
            ) : (
              <>
                <Button
                  testID="create-post-button"
                  label={t('category.publish_btn')}
                  icon="plus"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  haptic={false}
                  onPress={() => setShowCreatePost(true)}
                />
                {visiblePosts.map(post => (
                  <Card key={post.id} testID={`post-card-${post.id}`}>
                    {/* Post Header */}
                    <Pressable
                      style={styles.postHeader}
                      onPress={() => router.push(`/player-profile?id=${post.user.id}`)}
                      accessibilityRole="button"
                    >
                      <UserAvatar avatarUrl={post.user.avatar_url} avatarSeed={post.user.avatar_seed} pseudo={post.user.pseudo} size={40} />
                      <View style={styles.flex}>
                        <Txt variant="cardTitle" numberOfLines={1}>{post.user.pseudo}</Txt>
                        <Txt variant="caption">{timeAgo(post.created_at)}</Txt>
                      </View>
                    </Pressable>

                    {/* Post Content */}
                    <Txt variant="body" style={styles.postContent}>{post.content}</Txt>

                    {/* Post Image */}
                    {post.image_base64 && (
                      <Image source={{ uri: post.image_base64 }} style={styles.postImage} resizeMode="cover" />
                    )}

                    {/* Post Actions */}
                    <View style={styles.postActions}>
                      <Pressable
                        style={styles.postActionBtn}
                        onPress={() => handleLike(post.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('pilot.theme.like')}
                        accessibilityState={{ selected: post.is_liked }}
                      >
                        <Icon name="heart" size={20} color={post.is_liked ? COLOR.accent.warm : COLOR.text.secondary} />
                        <Txt variant="label" color={post.is_liked ? COLOR.accent.warm : COLOR.text.secondary} style={styles.tabular}>
                          {post.likes_count}
                        </Txt>
                      </Pressable>
                      <Pressable
                        style={styles.postActionBtn}
                        onPress={() => loadComments(post.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('pilot.theme.comments')}
                        accessibilityState={{ expanded: expandedPost === post.id }}
                      >
                        <Icon name="message" size={20} color={expandedPost === post.id ? COLOR.text.primary : COLOR.text.secondary} />
                        <Txt variant="label" style={styles.tabular}>{post.comments_count}</Txt>
                      </Pressable>
                    </View>

                    {/* Comments Section */}
                    {expandedPost === post.id && (
                      <View style={styles.commentsSection}>
                        {(comments[post.id] || []).map(c => (
                          <View key={c.id} style={styles.commentRow}>
                            <UserAvatar avatarUrl={c.user.avatar_url} avatarSeed={c.user.avatar_seed} pseudo={c.user.pseudo} size={28} />
                            <View style={styles.commentContent}>
                              <Txt variant="label" color={COLOR.text.primary}>{c.user.pseudo}</Txt>
                              <Txt variant="bodySmall">{c.content}</Txt>
                              <Txt variant="caption">{timeAgo(c.created_at)}</Txt>
                            </View>
                          </View>
                        ))}
                        {/* Add comment input */}
                        <View style={styles.commentInputRow}>
                          <TextInput
                            style={styles.commentInput}
                            placeholder={t('category.add_comment')}
                            placeholderTextColor={COLOR.text.tertiary}
                            value={commentingPost === post.id ? commentText : ''}
                            onFocus={() => setCommentingPost(post.id)}
                            onChangeText={text => { setCommentingPost(post.id); setCommentText(text); }}
                            multiline
                            maxFontSizeMultiplier={1.3}
                          />
                          <Pressable
                            style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}
                            onPress={() => handleComment(post.id)}
                            accessibilityRole="button"
                            accessibilityLabel={t('pilot.theme.send')}
                          >
                            <Icon name="chevronRight" size={20} color={COLOR.text.onAction} strokeWidth={2.5} />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </Card>
                ))}
              </>
            )}
          </Section>
        </ScrollView>

        {/* ── CTA collant : « Jouer ce thème » au-dessus de la safe area ── */}
        {!keyboardOpen && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.md }]}>
            <LinearGradient colors={GRADIENTS.fadeBottom.colors} style={styles.footerFade} pointerEvents="none" />
            <View style={styles.footerRow}>
              <Button
                testID="challenge-friend-button"
                label={t('play.challenge_friend')}
                icon="users"
                variant="secondary"
                size="lg"
                haptic={false}
                onPress={openFriendSheet}
                style={styles.footerBtn}
              />
              <Button
                testID="play-button"
                label={t('pilot.theme.play')}
                icon="duel"
                size="lg"
                haptic={false}
                onPress={handlePlay}
                style={styles.footerBtn}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Défier un ami sur ce thème */}
      <BottomSheet
        visible={friendSheetVisible}
        onClose={closeFriendSheet}
        title={t('play.challenge_friend')}
        subtitle={detail?.name}
      >
        <SearchField
          placeholder={t('search.placeholder_players')}
          value={friendQuery}
          onChangeText={setFriendQuery}
        />
        <ScrollView style={styles.friendList} keyboardShouldPersistTaps="handled">
          {friendsLoading && friendQuery.trim().length < 2 ? (
            <Loader />
          ) : (() => {
            const list = friendQuery.trim().length >= 2 ? friendResults : friends;
            if (list.length === 0) {
              return friendQuery.trim().length >= 2
                ? <Txt variant="bodySmall" align="center" style={styles.friendEmpty}>{t('search.no_results')}</Txt>
                : null;
            }
            return list.map((f) => (
              <ListRow
                key={f.id}
                title={f.pseudo}
                subtitle={f.selected_title || undefined}
                leading={<UserAvatar avatarUrl={f.avatar_url || undefined} avatarSeed={f.avatar_seed || f.pseudo} pseudo={f.pseudo} size={40} />}
                trailing={<Icon name="duel" size={20} color={COLOR.action.primary} />}
                onPress={() => handleChallengeFriend(f.id)}
              />
            ));
          })()}
        </ScrollView>
      </BottomSheet>

      {/* Create Post Modal */}
      <Modal visible={showCreatePost} transparent animationType="slide" onRequestClose={() => setShowCreatePost(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
            <View style={[styles.createModalContent, { paddingBottom: insets.bottom + SPACE.xxl }]}>
              <View style={styles.grabber} />
              <View style={styles.createModalHeader}>
                <Button
                  label={t('category.cancel')}
                  variant="ghost"
                  size="sm"
                  haptic={false}
                  onPress={() => { setShowCreatePost(false); setNewPostImage(null); setNewPostText(''); }}
                />
                <Txt variant="h3" numberOfLines={1} style={styles.createModalTitle}>{t('category.new_post')}</Txt>
                <Button
                  label={t('category.publish_btn')}
                  size="sm"
                  haptic={false}
                  onPress={handleCreatePost}
                  disabled={!newPostText.trim() || posting}
                  loading={posting}
                />
              </View>

              <TextInput
                style={styles.postInput}
                placeholder={t('category.share_with_community')}
                placeholderTextColor={COLOR.text.tertiary}
                value={newPostText}
                onChangeText={setNewPostText}
                multiline
                maxLength={500}
                autoFocus
                maxFontSizeMultiplier={1.3}
              />

              {newPostImage && (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: newPostImage }} style={styles.previewImage} resizeMode="cover" />
                  <IconButton
                    icon="close"
                    accessibilityLabel={t('pilot.theme.remove_photo')}
                    onPress={() => setNewPostImage(null)}
                    style={styles.removeImage}
                  />
                </View>
              )}

              <View style={styles.createModalActions}>
                <Button label={t('category.photo')} icon="plus" variant="ghost" size="sm" haptic={false} onPress={pickImage} />
                <Txt variant="caption" style={styles.tabular}>{newPostText.length}/500</Txt>
              </View>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerFill: { flex: 1, justifyContent: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.7 },

  // Favori : corail (accent chaud), jamais le rouge d'erreur ni le jaune de sélection
  favBtn: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR.action.ghost, borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
  },
  favBtnActive: { backgroundColor: alpha(PALETTE.coral, 0.14), borderColor: alpha(PALETTE.coral, 0.4) },

  successToast: {
    position: 'absolute', top: SIZE.header + SPACE.giant, alignSelf: 'center', zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: COLOR.status.successFill, borderWidth: BORDER.hair, borderColor: COLOR.status.success,
    borderRadius: RADII.pill, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm,
  },

  scrollContent: {
    paddingHorizontal: SPACE.screenX,
    paddingTop: SPACE.xxl,
    paddingBottom: SPACE.xxxl,
    gap: SPACE.sectionGap,
  },

  // Hero (à plat, sans carte)
  hero: { alignItems: 'center', gap: SPACE.lg },
  heroCompact: { gap: SPACE.md },
  // Dôme pétrole + illustration géante à 6 % : la seule touche « propre au thème »
  domeClip: { position: 'absolute', overflow: 'hidden' },
  dome: {
    position: 'absolute', overflow: 'hidden',
    backgroundColor: alpha(PALETTE.petrolLight, 0.16),
    borderWidth: BORDER.default,
  },
  domeArt: { position: 'absolute', opacity: 0.06 },
  descToggle: { minHeight: SIZE.touch, justifyContent: 'center', paddingHorizontal: SPACE.md, marginTop: -SPACE.sm },
  heroTexts: { alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.sm },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xxl },
  heroStat: { alignItems: 'center', gap: SPACE.xxs, minWidth: 96 },
  heroStatDivider: { width: BORDER.hair, height: SPACE.xxxl, backgroundColor: COLOR.border.default },
  voRow: { alignItems: 'center', gap: SPACE.xs },

  // Progression
  levelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.md },
  levelInfo: { flex: 1, alignItems: 'flex-end', paddingBottom: SPACE.xs },
  maxLevel: { marginTop: SPACE.md },
  xpBlock: { marginTop: SPACE.md, gap: SPACE.sm },
  xpLegend: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm },

  // Jalons : liste verticale reliée par un rail
  milestones: { marginTop: SPACE.xl },
  milestone: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, minHeight: 36 },
  milestoneRail: { alignItems: 'center', alignSelf: 'stretch' },
  milestoneLine: { flex: 1, width: BORDER.default, backgroundColor: COLOR.border.default, marginVertical: SPACE.xxs },
  milestoneLineReached: { backgroundColor: COLOR.action.primary },
  milestoneLvl: { width: 64, paddingTop: 3 },
  milestoneTitle: { flex: 1, paddingTop: 2 },
  milestoneDot: {
    width: SPACE.xl, height: SPACE.xl, borderRadius: SPACE.xl / 2,
    borderWidth: BORDER.strong, borderColor: COLOR.text.disabled, backgroundColor: COLOR.surface.card,
    alignItems: 'center', justifyContent: 'center',
  },
  milestoneDotReached: { backgroundColor: COLOR.action.primary, borderColor: COLOR.action.primary },

  // Classement
  listCard: { paddingHorizontal: SPACE.cardPad },
  rowDivider: { height: BORDER.hair, backgroundColor: COLOR.border.subtle },

  // Post
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.touch, marginBottom: SPACE.md },
  postContent: { marginBottom: SPACE.md },
  postImage: { width: '100%', height: 200, borderRadius: RADII.md, marginBottom: SPACE.md },
  postActions: { flexDirection: 'row', gap: SPACE.xl },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: SIZE.touch, minWidth: SIZE.touch },

  // Commentaires
  commentsSection: { marginTop: SPACE.sm, paddingTop: SPACE.md, borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle, gap: SPACE.md },
  commentRow: { flexDirection: 'row', gap: SPACE.sm },
  commentContent: { flex: 1, gap: SPACE.xxs },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm },
  commentInput: {
    ...TYPO.bodySmall,
    flex: 1, minHeight: SIZE.touch, maxHeight: 96,
    color: COLOR.text.primary, backgroundColor: COLOR.bg.primary,
    borderRadius: RADII.md, borderWidth: BORDER.hair, borderColor: COLOR.border.default,
    paddingHorizontal: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.md,
  },
  sendBtn: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2,
    backgroundColor: COLOR.action.primary, alignItems: 'center', justifyContent: 'center',
  },

  // CTA collant
  footer: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.sm, backgroundColor: COLOR.bg.primary },
  footerRow: { flexDirection: 'row', gap: SPACE.sm },
  footerBtn: { flex: 1 },
  friendList: { maxHeight: 360, marginTop: SPACE.sm },
  friendEmpty: { paddingVertical: SPACE.lg },
  footerFade: { position: 'absolute', left: 0, right: 0, top: -SPACE.xxl, height: SPACE.xxl },

  // Modale de création
  modalOverlay: { flex: 1, backgroundColor: COLOR.overlay.scrim, justifyContent: 'flex-end' },
  modalScroll: { width: '100%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  createModalContent: {
    backgroundColor: COLOR.surface.card, borderTopLeftRadius: RADII.xl, borderTopRightRadius: RADII.xl,
    borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
    paddingHorizontal: SPACE.screenX, minHeight: 300, gap: SPACE.md,
  },
  grabber: { alignSelf: 'center', width: SPACE.huge, height: SPACE.xs, borderRadius: RADII.xs, backgroundColor: COLOR.border.strong, marginTop: SPACE.sm },
  createModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.sm },
  createModalTitle: { flex: 1, textAlign: 'center' },
  postInput: { ...TYPO.body, color: COLOR.text.primary, minHeight: 100, textAlignVertical: 'top' },
  previewImageContainer: { position: 'relative' },
  previewImage: { width: '100%', height: 200, borderRadius: RADII.md },
  removeImage: { position: 'absolute', top: SPACE.sm, right: SPACE.sm, backgroundColor: COLOR.overlay.soft },
  createModalActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle, paddingTop: SPACE.md,
  },
});

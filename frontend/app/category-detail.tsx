import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, RefreshControl,
  Modal, Dimensions, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GLASS } from '../theme/glassTheme';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import CategoryIcon from '../components/CategoryIcon';
import UserAvatar from '../components/UserAvatar';

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

type CategoryDetail = {
  id: string; name: string; description: string;
  total_questions: number; followers_count: number;
  user_level: number; user_title: string; user_xp: number;
  xp_progress: { current: number; needed: number; progress: number };
  is_following: boolean; completion_pct: number;
  color_hex?: string; icon_url?: string; question_count?: number;
  super_category?: string; cluster?: string;
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

  const oldMeta = { icon: '❓', color: '#8A2BE2', bgPattern: '' };

  const [userId, setUserId] = useState('');
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [meta, setMeta] = useState(oldMeta);
  const [posts, setPosts] = useState<WallPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
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

  // Leaderboard (navigates to separate screen)

  useEffect(() => {
    init();
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
      const res = await fetch(`${API_URL}/api/theme/${id}/detail${uid ? `?user_id=${uid}` : ''}`);
      if (!res.ok) { setFetchError(true); return; }
      const data = await res.json();
      setFetchError(false);
      setDetail({
        id: data.id,
        name: data.name,
        description: data.description || '',
        total_questions: data.question_count || 0,
        followers_count: data.followers_count || 0,
        user_level: data.user_level || 0,
        user_title: data.user_title || '',
        user_xp: data.user_xp || 0,
        xp_progress: data.xp_progress || { current: 0, needed: 500, progress: 0 },
        is_following: data.is_following || false,
        completion_pct: 0,
        color_hex: data.color_hex,
        icon_url: data.icon_url,
        question_count: data.question_count,
        super_category: data.super_category,
        cluster: data.cluster,
      });
      setMeta({
        icon: data.name?.[0]?.toUpperCase() || '?',
        color: hashColor(data.id),
        bgPattern: '',
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
    if (!userId || !detail || followLoading) return;
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
    } catch {
      setDetail(prev => prev ? { ...prev, is_following: wasFollowing, followers_count: prev.followers_count + (wasFollowing ? 1 : -1) } : null);
    }
    setFollowLoading(false);
  };

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${id}&themeName=${encodeURIComponent(detail?.name || '')}`);
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
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={meta.color} /></View>;
  }

  if (fetchError && !detail) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: '700' }}>{t('common.error_loading')}</Text>
        <TouchableOpacity onPress={() => { setFetchError(false); setLoading(true); init(); }} style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(255,59,48,0.12)', borderRadius: 12 }}>
          <Text style={{ color: '#FF3B30', fontWeight: '600' }}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!detail) return null;

  return (
    <SwipeBackPage>
    <View style={styles.container}>
      {/* Post success toast */}
      {postSuccess && (
        <View style={styles.successToast}>
          <Text style={styles.successToastText}>{t('category.post_published')}</Text>
        </View>
      )}
      <View style={{ paddingTop: insets.top, backgroundColor: GLASS.bgDark }}>
        <DueloHeader />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={meta.color} />}
        >
          {/* Back button */}
          <TouchableOpacity data-testid="back-button" style={styles.backBtn} onPress={() => router.back()}>
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']}
              style={styles.backCircle}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color="#A3A3A3" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Cluster label */}
          {detail.cluster ? (
            <View style={styles.clusterBadgeRow}>
              <View style={[styles.clusterBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
                <Text style={[styles.clusterBadgeText, { color: meta.color }]}>{detail.cluster.toUpperCase()}</Text>
              </View>
            </View>
          ) : null}

          {/* Category Header */}
          <View style={[styles.headerCard, { borderColor: meta.color + '30' }]}>
            <View style={styles.headerTop}>
              <View style={[styles.catImageBox, { backgroundColor: meta.color + '20' }]}>
                <CategoryIcon themeId={id} emoji={meta.icon} size={32} color={meta.color} type="theme" />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.catName}>{detail.name}</Text>
                <Text style={styles.catDescription}>{detail.description}</Text>
              </View>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity data-testid="play-button" style={[styles.actionBtn, styles.playBtn]} onPress={handlePlay} activeOpacity={0.8}>
                <Text style={styles.playBtnIcon}>⚡</Text>
                <Text style={styles.playBtnText}>{t('category.play')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                data-testid="follow-button"
                style={[styles.actionBtn, detail.is_following ? styles.followingBtn : styles.followBtn]}
                onPress={handleFollow} activeOpacity={0.8} disabled={followLoading}
              >
                <Text style={styles.followIcon}>{detail.is_following ? '✓' : '+'}</Text>
                <Text style={[styles.followText, detail.is_following && { color: '#00FF9D' }]}>
                  {detail.is_following ? t('category.following') : t('category.follow')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity data-testid="leaderboard-button" style={[styles.actionBtn, styles.leaderBtn]} onPress={handleLeaderboard} activeOpacity={0.8}>
                <Text style={styles.leaderIcon}>🏆</Text>
                <Text style={styles.leaderText}>{t('category.leaderboard')}</Text>
              </TouchableOpacity>
            </View>

            {/* VO Toggle — SCREEN themes only */}
            {detail.super_category === 'SCREEN' && (
              <TouchableOpacity
                style={[styles.voToggleBtn, voMode && styles.voToggleBtnActive]}
                onPress={handleVoToggle}
                activeOpacity={0.8}
                disabled={voGenerating}
              >
                {voGenerating ? (
                  <ActivityIndicator size="small" color="#A78BFA" />
                ) : (
                  <Text style={styles.voToggleIcon}>🎬</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.voToggleText, voMode && { color: '#A78BFA' }]}>
                    {voGenerating ? t('category.vo_generating') : t('category.vo_toggle')}
                  </Text>
                  <Text style={styles.voToggleSub}>
                    {voMode ? t('category.vo_on') : t('category.vo_off')}
                  </Text>
                </View>
                <View style={[styles.voToggleSwitch, voMode && styles.voToggleSwitchActive]}>
                  <View style={[styles.voToggleKnob, voMode && styles.voToggleKnobActive]} />
                </View>
              </TouchableOpacity>
            )}

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>{t('category.questions_completed')}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${detail.completion_pct}%`, backgroundColor: meta.color }]} />
                <Text style={styles.progressPct}>{detail.completion_pct}%</Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('category.your_level')}</Text>
                <Text style={[styles.statValue, { color: meta.color }]}>{detail.user_level}</Text>
                <Text style={styles.statSub}>{detail.user_title}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: meta.color + '30' }]} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('category.followers')}</Text>
                <Text style={styles.statValue}>{detail.followers_count.toLocaleString()}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: meta.color + '30' }]} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('category.questions')}</Text>
                <Text style={styles.statValue}>{detail.total_questions}</Text>
              </View>
            </View>
          </View>

          {/* Wall Header + Create Post */}
          <View style={styles.wallHeader}>
            <Text style={styles.wallTitle}>{t('category.community_wall')}</Text>
            <TouchableOpacity
              data-testid="create-post-button"
              style={[styles.createPostBtn, { backgroundColor: meta.color + '20', borderColor: meta.color + '40' }]}
              onPress={() => setShowCreatePost(true)}
            >
              <Text style={[styles.createPostText, { color: meta.color }]}>{t('category.publish')}</Text>
            </TouchableOpacity>
          </View>

          {/* Wall Posts */}
          {posts.length === 0 ? (
            <View style={styles.emptyWall}>
              <LinearGradient
                colors={[meta.color, meta.color + '80']}
                style={styles.emptyIconCircle}
              >
                <MaterialCommunityIcons name="chat-outline" size={36} color="#FFF" />
              </LinearGradient>
              <Text style={styles.emptyText}>{t('category.be_first_to_post')}</Text>
              <Text style={styles.emptySub}>{t('category.share_opinions')}</Text>
            </View>
          ) : (
            posts.map(post => (
              <View key={post.id} data-testid={`post-card-${post.id}`} style={styles.postCard}>
                {/* Post Header */}
                <TouchableOpacity
                  style={styles.postHeader}
                  onPress={() => router.push(`/player-profile?id=${post.user.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.postAvatar}>
                    <UserAvatar avatarUrl={post.user.avatar_url} avatarSeed={post.user.avatar_seed} pseudo={post.user.pseudo} size={40} />
                  </View>
                  <View style={styles.postUserInfo}>
                    <Text style={styles.postUsername}>{post.user.pseudo}</Text>
                    <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
                  </View>
                </TouchableOpacity>

                {/* Post Content */}
                <Text style={styles.postContent}>{post.content}</Text>

                {/* Post Image */}
                {post.image_base64 && (
                  <Image source={{ uri: post.image_base64 }} style={styles.postImage} resizeMode="cover" />
                )}

                {/* Post Actions */}
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.postActionBtn} onPress={() => handleLike(post.id)}>
                    <Text style={[styles.postActionIcon, post.is_liked && { color: '#FF3B30' }]}>
                      {post.is_liked ? '❤️' : '🤍'}
                    </Text>
                    <Text style={[styles.postActionCount, post.is_liked && { color: '#FF3B30' }]}>
                      {post.likes_count}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionBtn} onPress={() => loadComments(post.id)}>
                    <Text style={styles.postActionIcon}>💬</Text>
                    <Text style={styles.postActionCount}>{post.comments_count}</Text>
                  </TouchableOpacity>
                </View>

                {/* Comments Section */}
                {expandedPost === post.id && (
                  <View style={styles.commentsSection}>
                    {(comments[post.id] || []).map(c => (
                      <View key={c.id} style={styles.commentRow}>
                        <View style={styles.commentAvatar}>
                          <UserAvatar avatarUrl={c.user.avatar_url} avatarSeed={c.user.avatar_seed} pseudo={c.user.pseudo} size={28} />
                        </View>
                        <View style={styles.commentContent}>
                          <Text style={styles.commentUser}>{c.user.pseudo}</Text>
                          <Text style={styles.commentText}>{c.content}</Text>
                          <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                    {/* Add comment input */}
                    <View style={styles.commentInputRow}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder={t('category.add_comment')}
                        placeholderTextColor="#525252"
                        value={commentingPost === post.id ? commentText : ''}
                        onFocus={() => setCommentingPost(post.id)}
                        onChangeText={text => { setCommentingPost(post.id); setCommentText(text); }}
                        multiline
                      />
                      <TouchableOpacity
                        style={[styles.commentSend, { backgroundColor: meta.color }]}
                        onPress={() => handleComment(post.id)}
                      >
                        <Text style={styles.commentSendText}>↑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Create Post Modal */}
      <Modal visible={showCreatePost} transparent animationType="slide" onRequestClose={() => setShowCreatePost(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              style={{ width: '100%' }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            >
            <View style={styles.createModalContent}>
              <View style={styles.createModalHeader}>
                <TouchableOpacity onPress={() => { setShowCreatePost(false); setNewPostImage(null); setNewPostText(''); }}>
                  <Text style={styles.createModalCancel}>{t('category.cancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.createModalTitle}>{t('category.new_post')}</Text>
                <TouchableOpacity
                  style={[styles.publishBtn, { backgroundColor: newPostText.trim() ? meta.color : '#333' }]}
                  onPress={handleCreatePost}
                  disabled={!newPostText.trim() || posting}
                >
                  {posting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.publishText}>{t('category.publish_btn')}</Text>}
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.postInput}
                placeholder={t('category.share_with_community')}
                placeholderTextColor="#525252"
                value={newPostText}
                onChangeText={setNewPostText}
                multiline
                maxLength={500}
                autoFocus
              />

              {newPostImage && (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: newPostImage }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeImage} onPress={() => setNewPostImage(null)}>
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.createModalActions}>
                <TouchableOpacity style={styles.mediaBtn} onPress={pickImage}>
                  <MaterialCommunityIcons name="camera-outline" size={20} color={meta.color} />
                  <Text style={[styles.mediaBtnText, { color: meta.color }]}>{t('category.photo')}</Text>
                </TouchableOpacity>
                <Text style={styles.charCount}>{newPostText.length}/500</Text>
              </View>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' },
  successToast: {
    position: 'absolute', top: 60, alignSelf: 'center', zIndex: 999,
    backgroundColor: 'rgba(0,255,157,0.15)', borderWidth: 1, borderColor: 'rgba(0,255,157,0.4)',
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
  },
  successToastText: { color: '#00FF9D', fontWeight: '700', fontSize: 14 },
  scrollContent: { paddingBottom: 40 },

  // Back
  backBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  backCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // Header Card
  headerCard: {
    marginHorizontal: 16, borderRadius: GLASS.radiusLg, backgroundColor: GLASS.bg,
    padding: 20, borderWidth: 1, borderColor: GLASS.borderCyan, marginBottom: 20,
  },
  headerTop: { flexDirection: 'row', marginBottom: 20 },
  catImageBox: { width: 80, height: 80, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  catEmoji: { fontSize: 42 },
  headerInfo: { flex: 1, justifyContent: 'center' },
  catName: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  catDescription: { fontSize: 14, color: '#A3A3A3', lineHeight: 20 },

  // Action Buttons
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14, gap: 6,
  },
  playBtn: { backgroundColor: '#8A2BE2' },
  playBtnIcon: { fontSize: 16 },
  playBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  followBtn: {
    backgroundColor: GLASS.bgLight, borderWidth: 1, borderColor: GLASS.borderSubtle,
  },
  followingBtn: {
    backgroundColor: 'rgba(0,255,157,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,157,0.3)',
  },
  followIcon: { fontSize: 14, color: '#FFF', fontWeight: '800' },
  followText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  leaderBtn: {
    backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  leaderIcon: { fontSize: 14 },
  leaderText: { color: '#FFD700', fontSize: 12, fontWeight: '700' },

  // Progress
  progressSection: { marginBottom: 20 },
  progressLabel: { fontSize: 11, fontWeight: '800', color: '#525252', letterSpacing: 2, marginBottom: 8 },
  progressBar: {
    height: 28, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    overflow: 'hidden', justifyContent: 'center',
  },
  progressFill: { position: 'absolute', height: 28, borderRadius: 14 },
  progressPct: { color: '#FFF', fontSize: 12, fontWeight: '800', textAlign: 'center', zIndex: 1 },

  // Stats Row
  statsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, fontWeight: '800', color: '#525252', letterSpacing: 1, marginBottom: 6 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#FFF' },
  statSub: { fontSize: 11, color: '#A3A3A3', fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, height: 40 },

  // Wall
  wallHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  wallTitle: { fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 2 },
  createPostBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
  createPostText: { fontSize: 13, fontWeight: '700' },

  emptyWall: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  emptySub: { fontSize: 14, color: '#525252', textAlign: 'center' },

  // Cluster badge
  clusterBadgeRow: { paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' },
  clusterBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  clusterBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  // Post Card
  postCard: {
    marginHorizontal: 16, backgroundColor: GLASS.bg,
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: GLASS.borderSubtle,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  postAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  postAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  postUserInfo: { flex: 1 },
  postUsername: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  postTime: { color: '#525252', fontSize: 12, marginTop: 1 },
  postContent: { color: '#E0E0E0', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },

  // Post Actions
  postActions: { flexDirection: 'row', gap: 20 },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionIcon: { fontSize: 18 },
  postActionCount: { color: '#A3A3A3', fontSize: 14, fontWeight: '600' },

  // Comments
  commentsSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  commentRow: { flexDirection: 'row', marginBottom: 12 },
  commentAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  commentAvatarText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  commentContent: { flex: 1 },
  commentUser: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  commentText: { color: '#D0D0D0', fontSize: 13, marginTop: 2 },
  commentTime: { color: '#525252', fontSize: 11, marginTop: 4 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  commentInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, color: '#FFF', fontSize: 14, maxHeight: 80,
  },
  commentSend: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  commentSendText: { color: '#FFF', fontSize: 18, fontWeight: '800' },

  // Create Post Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  createModalContent: {
    backgroundColor: GLASS.bgDark, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, minHeight: 300,
  },
  createModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  createModalCancel: { color: '#A3A3A3', fontSize: 15, fontWeight: '600' },
  createModalTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  publishBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  publishText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  postInput: {
    color: '#FFF', fontSize: 16, minHeight: 100, textAlignVertical: 'top',
    lineHeight: 24,
  },
  previewImageContainer: { position: 'relative', marginBottom: 12 },
  previewImage: { width: '100%', height: 200, borderRadius: 12 },
  removeImage: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center',
  },
  removeImageText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  createModalActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12,
  },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  mediaBtnText: { fontSize: 14, fontWeight: '600' },
  charCount: { color: '#525252', fontSize: 13, fontWeight: '500' },

  // VO Toggle
  voToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  voToggleBtnActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  voToggleIcon: { fontSize: 20 },
  voToggleText: { color: '#D4D4D4', fontSize: 14, fontWeight: '700' },
  voToggleSub: { color: '#525252', fontSize: 11, marginTop: 2 },
  voToggleSwitch: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', paddingHorizontal: 2,
  },
  voToggleSwitchActive: {
    backgroundColor: 'rgba(167,139,250,0.4)', borderColor: 'rgba(167,139,250,0.6)',
  },
  voToggleKnob: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#666',
  },
  voToggleKnobActive: {
    backgroundColor: '#A78BFA', alignSelf: 'flex-end',
  },

});

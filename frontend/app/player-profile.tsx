import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  ActivityIndicator, RefreshControl, Dimensions, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GLASS } from '../theme/glassTheme';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import DueloHeader from '../components/DueloHeader';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import CategoryIcon from '../components/CategoryIcon';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  series_tv: { icon: 'television-classic', color: '#E040FB', bg: '#2D1B4E' },
  geographie: { icon: 'earth', color: '#00FFFF', bg: '#0D2B2B' },
  histoire: { icon: 'bank', color: '#FFD700', bg: '#2B2510' },
  cinema: { icon: 'movie-open', color: '#FF6B6B', bg: '#2B1515' },
  sport: { icon: 'soccer', color: '#00FF9D', bg: '#0D2B1A' },
  musique: { icon: 'music-note', color: '#FF8C00', bg: '#2B1E0D' },
  sciences: { icon: 'microscope', color: '#7B68EE', bg: '#1A1533' },
  gastronomie: { icon: 'silverware-fork-knife', color: '#FF69B4', bg: '#2B152B' },
};

type PlayerProfile = {
  id: string; pseudo: string; avatar_seed: string; avatar_url?: string;
  selected_title: string; country: string | null; country_flag: string;
  matches_played: number; matches_won: number; win_rate: number;
  current_streak: number; best_streak: number; total_xp: number;
  themes: Record<string, { xp: number; level: number; title: string; name?: string; color_hex?: string; cluster?: string; super_category?: string }>;
  champion_titles: { category: string; category_name: string; scope: string; date: string }[];
  followers_count: number; following_count: number; is_following: boolean;
  posts: {
    id: string; category_id: string; category_name: string;
    content: string; image_base64: string | null;
    likes_count: number; comments_count: number; is_liked: boolean; created_at: string;
  }[];
};

// Deterministic color from a letter for avatar backgrounds
const AVATAR_COLORS = ['#8A2BE2', '#E040FB', '#00FFFF', '#FFD700', '#FF6B6B', '#00FF9D', '#FF8C00', '#7B68EE', '#FF69B4', '#00BFFF'];
const getAvatarColor = (letter: string) => {
  const code = letter.toUpperCase().charCodeAt(0) - 65;
  return AVATAR_COLORS[Math.abs(code) % AVATAR_COLORS.length];
};

export default function PlayerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    router.back();
    return null;
  }

  const [myId, setMyId] = useState('');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [challengeModalVisible, setChallengeModalVisible] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<{id: string, name: string, color: string} | null>(null);
  const [challengeSending, setChallengeSending] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);
  const [vsStats, setVsStats] = useState<{ total: number; user_wins: number; opponent_wins: number } | null>(null);
  const [challengeHistory, setChallengeHistory] = useState<{
    challenge_id: string; opponent_pseudo: string; theme_name: string;
    my_score: number; opponent_score: number; won: boolean; played_at: string;
  }[]>([]);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    if (uid) setMyId(uid);
    await fetchProfile(uid || '');
    if (uid && uid !== id) {
      fetchVsStats(uid);
    }
    if (uid === id) {
      fetchChallengeHistory(uid);
    }
    setLoading(false);
  };

  const fetchVsStats = async (viewerId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/challenges/vs-stats?user_id=${viewerId}&opponent_id=${id}`);
      if (res.ok) setVsStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchChallengeHistory = async (userId: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/challenges/history?user_id=${userId}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setChallengeHistory(data.challenges || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchProfile = async (viewerId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/player/${id}/profile?viewer_id=${viewerId}`);
      const data = await res.json();
      setProfile(data);
    } catch (e) { console.error(e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile(myId);
    setRefreshing(false);
  };

  const handleFollow = async () => {
    if (!myId || followLoading || !profile || myId === profile.id) return;
    setFollowLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await authFetch(`${API_URL}/api/player/${id}/follow`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_id: myId }),
      });
      const data = await res.json();
      setProfile(prev => prev ? {
        ...prev,
        is_following: data.following,
        followers_count: prev.followers_count + (data.following ? 1 : -1)
      } : null);
    } catch (e) { console.error(e); }
    setFollowLoading(false);
  };

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (profile?.themes) {
      const cats = Object.entries(profile.themes);
      const best = cats.reduce((a, b) => b[1].xp > a[1].xp ? b : a, cats[0]);
      router.push(`/matchmaking?category=${best[0]}`);
    }
  };

  const handleChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat?partnerId=${id}&partnerPseudo=${encodeURIComponent(profile?.pseudo || '')}&partnerAvatarSeed=${encodeURIComponent(profile?.avatar_seed || '')}&partnerAvatarUrl=${encodeURIComponent(profile?.avatar_url || '')}`);
  };

  const handleSendChallenge = async () => {
    if (challengeSending) return;
    setChallengeSending(true);
    try {
      const res = await authFetch(`${API_URL}/api/challenges/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenger_id: myId,
          challenged_id: profile?.id,
          theme_id: selectedTheme?.id || '',
          theme_name: selectedTheme?.name || '',
        }),
      });
      if (res.status === 409) {
        // Challenge already pending — just close modal
        setChallengeSent(true);
        setTimeout(() => {
          setChallengeModalVisible(false);
          setChallengeSent(false);
          setSelectedTheme(null);
        }, 1500);
      } else if (res.ok) {
        const data = await res.json();
        setChallengeModalVisible(false);
        setSelectedTheme(null);
        // Go to waiting screen immediately
        router.push(
          `/challenge-waiting?challenge_id=${data.challenge_id}` +
          `&opponent_pseudo=${encodeURIComponent(profile?.pseudo || '')}` +
          `&opponent_seed=${encodeURIComponent(profile?.avatar_seed || '')}` +
          `&theme_id=${encodeURIComponent(selectedTheme?.id || '')}` +
          `&theme_name=${encodeURIComponent(selectedTheme?.name || '')}`
        );
      }
    } catch (e) { console.error(e); }
    setChallengeSending(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('player.just_now');
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  if (loading) {
    return <View style={[s.loadingContainer, { backgroundColor: '#050510' }]}><ActivityIndicator size="large" color="#8A2BE2" /></View>;
  }
  if (!profile) return null;

  const isOwnProfile = myId === profile.id;

  // Sort categories by level descending
  const sortedCategories = Object.entries(profile.themes || {})
    .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp);

  return (
    <SwipeBackPage>
    <View style={[s.container, { paddingTop: insets.top }]}>
      <DueloHeader />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2BE2" />}
      >
        {/* Back */}
        <TouchableOpacity data-testid="back-button" style={s.backBtn} onPress={() => router.back()}>
          <LinearGradient
            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']}
            style={s.backCircle}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color="#A3A3A3" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Hero Header ── */}
        <View style={s.heroCard}>
          <LinearGradient
            colors={['#1A0A2E', '#0D0D1A']}
            style={s.heroBg}
          />

          {/* Avatar */}
          <View style={s.avatarRing}>
            <UserAvatar avatarUrl={profile.avatar_url} avatarSeed={profile.avatar_seed} pseudo={profile.pseudo} size={94} />
          </View>

          {/* Name & Title */}
          <Text style={s.pseudo} data-testid="player-pseudo">{profile.pseudo}</Text>
          <Text style={s.title}>{profile.selected_title}</Text>

          {/* Location */}
          <View style={s.locationRow}>
            <Text style={s.locationFlag}>{profile.country_flag}</Text>
            <Text style={s.locationText}>{profile.country || t('player.world')}</Text>
          </View>

          {/* Champion Titles */}
          {profile.champion_titles.length > 0 && (
            <View style={s.championSection}>
              {profile.champion_titles.map((ct, i) => (
                <View key={i} style={s.championBanner}>
                  <LinearGradient
                    colors={['rgba(255,215,0,0.20)', 'rgba(255,215,0,0.06)']}
                    style={s.championIconCircle}
                  >
                    <MaterialCommunityIcons name="trophy" size={18} color="#FFD700" />
                  </LinearGradient>
                  <View>
                    <Text style={s.championText}>{t('player.number_one_in')} {ct.category_name}</Text>
                    <Text style={s.championSub}>{ct.scope} - {ct.date}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={s.actionsRow}>
              <TouchableOpacity
                data-testid="challenge-button"
                style={[s.actionBtn, s.challengeBtn]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setChallengeModalVisible(true); }}
              >
                <MaterialCommunityIcons name="sword-cross" size={16} color="#FFF" />
                <Text style={s.actionText}>{t('challenge.send')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                data-testid="follow-button"
                style={[s.actionBtn, profile.is_following ? s.followingBtn : s.followBtn]}
                onPress={handleFollow} disabled={followLoading}
              >
                <MaterialCommunityIcons
                  name={profile.is_following ? 'check' : 'plus'}
                  size={16}
                  color={profile.is_following ? '#00FF9D' : '#FFF'}
                />
                <Text style={[s.actionText, profile.is_following && { color: '#00FF9D' }]}>
                  {profile.is_following ? t('player.following') : t('player.follow')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity data-testid="chat-button" style={[s.actionBtn, s.chatBtn]} onPress={handleChat}>
                <MaterialCommunityIcons name="comment-outline" size={16} color="#00BFFF" />
                <Text style={[s.actionText, { color: '#00BFFF' }]}>{t('player.message')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Stats Row ── */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <LinearGradient
                colors={['rgba(138,43,226,0.20)', 'rgba(138,43,226,0.06)']}
                style={s.statIconCircle}
              >
                <MaterialCommunityIcons name="sword-cross" size={16} color="#8A2BE2" />
              </LinearGradient>
              <Text style={s.statValue} data-testid="stat-games">{profile.matches_played}</Text>
              <Text style={s.statLabel}>{t('player.games')}</Text>
            </View>
            <View style={s.statDivider} />
            <TouchableOpacity style={s.statItem} onPress={() => router.push(`/followers?userId=${profile.id}&type=followers`)}>
              <LinearGradient
                colors={['rgba(0,255,255,0.20)', 'rgba(0,255,255,0.06)']}
                style={s.statIconCircle}
              >
                <MaterialCommunityIcons name="account" size={16} color="#00FFFF" />
              </LinearGradient>
              <Text style={s.statValue} data-testid="stat-followers">{profile.followers_count}</Text>
              <Text style={s.statLabel}>{t('player.followers')}</Text>
            </TouchableOpacity>
            <View style={s.statDivider} />
            <TouchableOpacity style={s.statItem} onPress={() => router.push(`/followers?userId=${profile.id}&type=following`)}>
              <LinearGradient
                colors={['rgba(0,255,157,0.20)', 'rgba(0,255,157,0.06)']}
                style={s.statIconCircle}
              >
                <MaterialCommunityIcons name="heart" size={16} color="#00FF9D" />
              </LinearGradient>
              <Text style={s.statValue} data-testid="stat-following">{profile.following_count}</Text>
              <Text style={s.statLabel}>{t('player.following_label')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Quick Performance Stats ── */}
        <Text style={s.sectionTitle}>{t('player.performances')}</Text>
        <View style={s.perfRow}>
          {[
            { icon: 'trophy' as const, label: t('player.victories'), value: profile.matches_won, color: '#FFD700' },
            { icon: 'chart-line' as const, label: t('player.win_rate'), value: `${profile.win_rate}%`, color: '#00FFFF' },
            { icon: 'fire' as const, label: t('player.streak'), value: profile.current_streak, color: '#FF6B35' },
            { icon: 'star' as const, label: t('player.best'), value: profile.best_streak, color: '#E040FB' },
          ].map((stat, i) => (
            <View key={i} style={s.perfCard}>
              <LinearGradient
                colors={[stat.color + '22', stat.color + '08']}
                style={s.perfIconCircle}
              >
                <MaterialCommunityIcons name={stat.icon} size={18} color={stat.color} />
              </LinearGradient>
              <Text style={[s.perfValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.perfLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Topics Grid ── */}
        <Text style={s.sectionTitle}>{t('player.their_themes')}</Text>
        <View style={s.topicsGrid}>
          {sortedCategories.map(([catKey, catData]) => {
            const color = catData.color_hex || '#8A2BE2';
            const displayName = catData.name || catKey;
            return (
              <TouchableOpacity
                key={catKey}
                style={s.topicCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/category-detail?id=${catKey}`)}
              >
                <View style={[s.topicCardInner, { borderColor: color + '30' }]}>
                  <View style={[s.topicIconBox, { backgroundColor: color + '20' }]}>
                    <CategoryIcon themeId={catKey} emoji={catData.cluster || catData.super_category} size={22} color={color} type="cluster" />
                  </View>
                  <Text style={[s.topicName, { color }]} numberOfLines={1}>{displayName}</Text>
                  <Text style={s.topicLevel}>{t('player.level_short')} {catData.level}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── A vs B stats (only when viewing another player) ── */}
        {!isOwnProfile && vsStats !== null && (
          <>
            <Text style={s.sectionTitle}>{t('player.vs_title')}</Text>
            <View style={s.vsCard}>
              {vsStats.total === 0 ? (
                <View style={s.vsEmpty}>
                  <MaterialCommunityIcons name="sword-cross" size={22} color="#333" />
                  <Text style={s.vsEmptyText}>{t('player.vs_no_challenge')}</Text>
                </View>
              ) : (
                <View style={s.vsRow}>
                  <View style={s.vsBlock}>
                    <Text style={[s.vsScore, { color: '#8A2BE2' }]}>{vsStats.user_wins}</Text>
                    <Text style={s.vsLabel}>{t('player.vs_wins')}</Text>
                  </View>
                  <View style={s.vsDivider} />
                  <View style={s.vsBlock}>
                    <Text style={s.vsTotal}>{vsStats.total}</Text>
                    <Text style={s.vsLabel}>défis</Text>
                  </View>
                  <View style={s.vsDivider} />
                  <View style={s.vsBlock}>
                    <Text style={[s.vsScore, { color: '#FF3B5C' }]}>{vsStats.opponent_wins}</Text>
                    <Text style={s.vsLabel}>{t('player.vs_losses')}</Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Challenge History (own profile only) ── */}
        {isOwnProfile && (
          <>
            <Text style={s.sectionTitle}>{t('player.challenge_history')}</Text>
            {challengeHistory.length === 0 ? (
              <View style={s.emptyWall}>
                <MaterialCommunityIcons name="sword-cross" size={32} color="#525252" />
                <Text style={s.emptyText}>{t('player.no_challenges')}</Text>
              </View>
            ) : (
              challengeHistory.map(ch => (
                <View key={ch.challenge_id} style={[s.challengeHistoryCard, { borderLeftColor: ch.won ? '#00C853' : '#FF3B5C' }]}>
                  <View style={s.chRow}>
                    <MaterialCommunityIcons
                      name={ch.won ? 'trophy' : 'close-circle-outline'}
                      size={18}
                      color={ch.won ? '#00C853' : '#FF3B5C'}
                    />
                    <Text style={s.chOpponent}>{ch.opponent_pseudo}</Text>
                    {ch.theme_name ? <Text style={s.chTheme}>{ch.theme_name}</Text> : null}
                  </View>
                  <Text style={[s.chScore, { color: ch.won ? '#00C853' : '#FF3B5C' }]}>
                    {ch.my_score} – {ch.opponent_score}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        {/* ── Posts Wall ── */}
        <Text style={s.sectionTitle}>{t('player.publications')}</Text>

        {profile.posts.length === 0 ? (
          <View style={s.emptyWall}>
            <MaterialCommunityIcons name="post-outline" size={32} color="#525252" />
            <Text style={s.emptyText}>{t('player.no_posts')}</Text>
          </View>
        ) : (
          profile.posts.map(post => {
            const postMeta = CATEGORY_META[post.category_id];
            return (
              <View key={post.id} style={s.postCard}>
                <View style={s.postHeader}>
                  <View style={[s.postCatBadge, { backgroundColor: (postMeta?.color || '#8A2BE2') + '20' }]}>
                    <MaterialCommunityIcons
                      name={(postMeta?.icon || 'help-circle') as any}
                      size={14}
                      color={postMeta?.color || '#8A2BE2'}
                    />
                    <Text style={[s.postCatName, { color: postMeta?.color || '#8A2BE2' }]}>
                      {post.category_name}
                    </Text>
                  </View>
                  <Text style={s.postTime}>{timeAgo(post.created_at)}</Text>
                </View>
                <Text style={s.postContent}>{post.content}</Text>
                {post.image_base64 && (
                  <Image source={{ uri: post.image_base64 }} style={s.postImage} resizeMode="cover" />
                )}
                <View style={s.postActions}>
                  <View style={s.postActionItem}>
                    <MaterialCommunityIcons
                      name={post.is_liked ? 'heart' : 'heart-outline'}
                      size={18}
                      color={post.is_liked ? '#FF3B30' : '#A3A3A3'}
                    />
                    <Text style={s.postActionCount}>{post.likes_count}</Text>
                  </View>
                  <View style={s.postActionItem}>
                    <MaterialCommunityIcons name="comment-outline" size={18} color="#A3A3A3" />
                    <Text style={s.postActionCount}>{post.comments_count}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Challenge Modal ── */}
      <Modal
        visible={challengeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChallengeModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={s.modalBg} />

            <View style={s.modalHeader}>
              <MaterialCommunityIcons name="sword-cross" size={20} color="#8A2BE2" />
              <Text style={s.modalTitle}>{t('challenge.send')} {profile?.pseudo}</Text>
              <TouchableOpacity onPress={() => { setChallengeModalVisible(false); setSelectedTheme(null); }}>
                <MaterialCommunityIcons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSubtitle}>{t('challenge.choose_theme')}</Text>

            {/* No theme option */}
            <TouchableOpacity
              style={[s.themeChip, !selectedTheme && s.themeChipSelected]}
              onPress={() => setSelectedTheme(null)}
            >
              <Text style={[s.themeChipText, !selectedTheme && { color: '#FFF' }]}>{t('challenge.no_theme')}</Text>
            </TouchableOpacity>

            {/* Theme chips from profile categories */}
            <View style={s.themesGrid}>
              {Object.entries(profile?.themes || {}).slice(0, 6).map(([catKey, catData]) => {
                const nameSlug = (catData.name || catKey).toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  .replace(/[\s\-]+/g, '_');
                const meta = CATEGORY_META[nameSlug] || CATEGORY_META[catKey] || { icon: 'help-circle', color: '#8A2BE2', bg: '#1A1A2E' };
                const color = catData.color_hex || meta.color;
                const displayName = catData.name || catKey;
                const isSelected = selectedTheme?.id === catKey;
                return (
                  <TouchableOpacity
                    key={catKey}
                    style={[s.themeChip, { borderColor: color + '60' }, isSelected && { backgroundColor: color + '30', borderColor: color }]}
                    onPress={() => setSelectedTheme({ id: catKey, name: displayName, color })}
                  >
                    <MaterialCommunityIcons name={meta.icon as any} size={14} color={color} />
                    <Text style={[s.themeChipText, { color }]} numberOfLines={1}>{displayName}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {challengeSent ? (
              <View style={s.sentRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#00FF9D" />
                <Text style={s.sentText}>{t('challenge.sent')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.sendChallengeBtn, challengeSending && { opacity: 0.6 }]}
                onPress={handleSendChallenge}
                disabled={challengeSending}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#8A2BE2', '#BF5FFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sendChallengeBtnGradient}>
                  <MaterialCommunityIcons name="sword-cross" size={16} color="#FFF" />
                  <Text style={s.sendChallengeBtnText}>{t('challenge.confirm')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
    </SwipeBackPage>
  );
}


const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },

  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  backText: { color: '#A3A3A3', fontSize: 15, fontWeight: '600' },

  /* ── Hero Header ── */
  heroCard: {
    marginHorizontal: 16, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#0D0D1A', borderWidth: 1, borderColor: GLASS.borderCyan,
    paddingBottom: 24, alignItems: 'center',
  },
  heroBg: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
  },
  avatarRing: {
    marginTop: 60,
  },
  avatarGradient: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    padding: 3,
  },
  avatar: {
    width: 94, height: 94, borderRadius: 47, backgroundColor: '#0D0D1A',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 40, fontWeight: '900' },

  pseudo: { fontSize: 26, fontWeight: '900', color: '#FFF', marginTop: 12 },
  title: { fontSize: 14, color: '#B57EDC', fontWeight: '600', marginTop: 4 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationFlag: { fontSize: 16 },
  locationText: { color: '#A3A3A3', fontSize: 13, fontWeight: '600' },

  /* Champions */
  championSection: { width: '90%', marginTop: 12, gap: 6 },
  championBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  championIconCircle: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  championText: { color: '#FFD700', fontSize: 13, fontWeight: '800' },
  championSub: { color: '#A3A3A3', fontSize: 11, marginTop: 1 },

  /* Actions */
  actionsRow: { flexDirection: 'row', gap: 8, width: '90%', marginTop: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14, gap: 6, backgroundColor: '#8A2BE2',
  },
  followBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  followingBtn: { backgroundColor: 'rgba(0,255,157,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,157,0.3)' },
  chatBtn: { backgroundColor: 'rgba(0,191,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,191,255,0.3)' },
  challengeBtn: { backgroundColor: '#8A2BE2' },
  actionText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    marginTop: 20, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statIconCircle: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  statLabel: { fontSize: 9, fontWeight: '800', color: '#525252', letterSpacing: 1.5, marginTop: 4 },
  statDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.08)' },

  /* Performance Row */
  perfRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
  },
  perfCard: {
    flex: 1, backgroundColor: GLASS.bg, borderRadius: GLASS.radius,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: GLASS.borderCyan,
  },
  perfIconCircle: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  perfValue: { fontSize: 18, fontWeight: '800' },
  perfLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: '700', textTransform: 'uppercase' as const, textAlign: 'center' as const },

  /* Section Title */
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 3,
    marginBottom: 14, marginTop: 24, paddingHorizontal: 20,
  },

  /* ── Topics Grid ── */
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15 },
  topicCard: { width: '25%', padding: 5, alignItems: 'center' },
  topicCardInner: {
    width: '100%', borderRadius: GLASS.radius, paddingVertical: 12, paddingHorizontal: 6,
    borderWidth: 1, backgroundColor: GLASS.bg, alignItems: 'center',
    borderColor: GLASS.borderSubtle,
  },
  topicIconBox: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  topicName: { fontSize: 10, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  topicLevel: { fontSize: 9, fontWeight: '700', color: '#A3A3A3', letterSpacing: 0.5, marginBottom: 6 },

  /* Empty Wall */
  emptyWall: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { color: '#525252', fontSize: 15 },

  // A vs B
  vsCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16 },
  vsEmpty: { alignItems: 'center', gap: 8 },
  vsEmptyText: { color: '#525252', fontSize: 13, fontWeight: '600' },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  vsBlock: { alignItems: 'center', flex: 1 },
  vsScore: { fontSize: 32, fontWeight: '900' },
  vsTotal: { fontSize: 28, fontWeight: '900', color: '#FFF' },
  vsLabel: { fontSize: 11, color: '#666', fontWeight: '600', marginTop: 2, textAlign: 'center' },
  vsDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Challenge history
  challengeHistoryCard: {
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderLeftWidth: 3, padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  chOpponent: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  chTheme: { color: '#666', fontSize: 12, fontWeight: '500' },
  chScore: { fontSize: 15, fontWeight: '900' },

  /* Post */
  postCard: {
    marginHorizontal: 16, backgroundColor: GLASS.bg,
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: GLASS.borderCyan,
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  postCatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  postCatName: { fontSize: 12, fontWeight: '700' },
  postTime: { color: '#525252', fontSize: 12 },
  postContent: { color: '#E0E0E0', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 10 },
  postActions: { flexDirection: 'row', gap: 20 },
  postActionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionCount: { color: '#A3A3A3', fontSize: 14, fontWeight: '600' },

  /* Challenge Modal */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', padding: 24, paddingBottom: 40,
    backgroundColor: '#0D0D1A',
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.3)',
  },
  modalBg: { ...StyleSheet.absoluteFillObject },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20,
  },
  modalTitle: { flex: 1, color: '#FFF', fontSize: 18, fontWeight: '900' },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700',
    letterSpacing: 2, marginBottom: 14,
  },
  themesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20, marginTop: 10,
  },
  themeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 4,
  },
  themeChipSelected: {
    backgroundColor: 'rgba(138,43,226,0.2)', borderColor: '#8A2BE2',
  },
  themeChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  sendChallengeBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  sendChallengeBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8, borderRadius: 16,
  },
  sendChallengeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 16 },
  sentText: { color: '#00FF9D', fontSize: 16, fontWeight: '800' },
});

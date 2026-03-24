import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  ActivityIndicator, RefreshControl, Dimensions
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
  categories: Record<string, { xp: number; level: number; title: string }>;
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

  useEffect(() => { init(); }, []);

  const init = async () => {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    if (uid) setMyId(uid);
    await fetchProfile(uid || '');
    setLoading(false);
  };

  const fetchProfile = async (viewerId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/player/${id}/profile?viewer_id=${viewerId}`);
      const data = await res.json();
      setProfile(data);
    } catch {}
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
    } catch {}
    setFollowLoading(false);
  };

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (profile?.categories) {
      const cats = Object.entries(profile.categories);
      const best = cats.reduce((a, b) => b[1].xp > a[1].xp ? b : a, cats[0]);
      router.push(`/matchmaking?category=${best[0]}`);
    }
  };

  const handleChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat?partnerId=${id}&partnerPseudo=${profile?.pseudo || ''}`);
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
  const sortedCategories = Object.entries(profile.categories)
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
          <Text style={s.backText}>{t('player.back')}</Text>
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
              <TouchableOpacity data-testid="play-button" style={s.actionBtn} onPress={handlePlay}>
                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFF" />
                <Text style={s.actionText}>{t('player.play')}</Text>
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
            <View style={s.statItem}>
              <LinearGradient
                colors={['rgba(0,255,255,0.20)', 'rgba(0,255,255,0.06)']}
                style={s.statIconCircle}
              >
                <MaterialCommunityIcons name="account" size={16} color="#00FFFF" />
              </LinearGradient>
              <Text style={s.statValue} data-testid="stat-followers">{profile.followers_count}</Text>
              <Text style={s.statLabel}>{t('player.followers')}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <LinearGradient
                colors={['rgba(0,255,157,0.20)', 'rgba(0,255,157,0.06)']}
                style={s.statIconCircle}
              >
                <MaterialCommunityIcons name="heart" size={16} color="#00FF9D" />
              </LinearGradient>
              <Text style={s.statValue} data-testid="stat-following">{profile.following_count}</Text>
              <Text style={s.statLabel}>{t('player.following_label')}</Text>
            </View>
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
            const meta = CATEGORY_META[catKey] || { icon: 'help-circle', color: '#8A2BE2', bg: '#1A1A2E' };
            return (
              <View
                key={catKey}
                data-testid={`topic-${catKey}`}
                style={[s.topicCard, { backgroundColor: meta.bg }]}
              >
                <LinearGradient
                  colors={[meta.color + '30', meta.color + '10']}
                  style={s.topicIconBox}
                >
                  <MaterialCommunityIcons name={meta.icon as any} size={22} color={meta.color} />
                </LinearGradient>
                <Text style={[s.topicName, { color: meta.color }]}>{catData.title || catKey}</Text>
                <Text style={s.topicLevel}>{t('player.level_short')} {catData.level}</Text>
              </View>
            );
          })}
        </View>

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
    </View>
    </SwipeBackPage>
  );
}

const CARD_SIZE = (width - 72) / 4;

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
  perfLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: '700', textTransform: 'uppercase' as const },

  /* Section Title */
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 3,
    marginBottom: 14, marginTop: 24, paddingHorizontal: 20,
  },

  /* ── Topics Grid ── */
  topicsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 20,
  },
  topicCard: {
    width: CARD_SIZE, borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  topicIconBox: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  topicName: { fontSize: 10, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  topicLevel: { fontSize: 9, fontWeight: '700', color: '#A3A3A3', letterSpacing: 0.5 },

  /* Empty Wall */
  emptyWall: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { color: '#525252', fontSize: 15 },

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
});

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  ActivityIndicator, RefreshControl, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CATEGORY_META: Record<string, { icon: string; color: string; name: string; bg: string }> = {
  series_tv: { icon: '📺', color: '#E040FB', name: 'Séries TV', bg: '#2D1B4E' },
  geographie: { icon: '🌍', color: '#00FFFF', name: 'Géographie', bg: '#0D2B2B' },
  histoire: { icon: '🏛️', color: '#FFD700', name: 'Histoire', bg: '#2B2510' },
  cinema: { icon: '🎬', color: '#FF6B6B', name: 'Cinéma', bg: '#2B1515' },
  sport: { icon: '⚽', color: '#00FF9D', name: 'Sport', bg: '#0D2B1A' },
  musique: { icon: '🎵', color: '#FF8C00', name: 'Musique', bg: '#2B1E0D' },
  sciences: { icon: '🔬', color: '#7B68EE', name: 'Sciences', bg: '#1A1533' },
  gastronomie: { icon: '🍽️', color: '#FF69B4', name: 'Gastronomie', bg: '#2B152B' },
};

type PlayerProfile = {
  id: string; pseudo: string; avatar_seed: string;
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

export default function PlayerProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
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
      const res = await fetch(`${API_URL}/api/player/${id}/follow`, {
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
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  if (loading) {
    return <View style={s.loadingContainer}><ActivityIndicator size="large" color="#8A2BE2" /></View>;
  }
  if (!profile) return null;

  const isOwnProfile = myId === profile.id;

  // Sort categories by level descending
  const sortedCategories = Object.entries(profile.categories)
    .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp);

  return (
    <SwipeBackPage>
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2BE2" />}
      >
        {/* Back */}
        <TouchableOpacity data-testid="back-button" style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>{'← Retour'}</Text>
        </TouchableOpacity>

        {/* ── Hero Header ── */}
        <View style={s.heroCard}>
          <View style={s.heroBg} />

          {/* Avatar */}
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{profile.pseudo[0]?.toUpperCase()}</Text>
            </View>
          </View>

          {/* Name & Title */}
          <Text style={s.pseudo} data-testid="player-pseudo">{profile.pseudo}</Text>
          <Text style={s.title}>{profile.selected_title}</Text>

          {/* Location */}
          <View style={s.locationRow}>
            <Text style={s.locationFlag}>{profile.country_flag}</Text>
            <Text style={s.locationText}>{profile.country || 'Monde'}</Text>
          </View>

          {/* Champion Titles */}
          {profile.champion_titles.length > 0 && (
            <View style={s.championSection}>
              {profile.champion_titles.map((ct, i) => (
                <View key={i} style={s.championBanner}>
                  <Text style={s.championIcon}>{'🏆'}</Text>
                  <View>
                    <Text style={s.championText}>#1 en {ct.category_name}</Text>
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
                <Text style={s.actionIcon}>{'⚡'}</Text>
                <Text style={s.actionText}>Jouer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                data-testid="follow-button"
                style={[s.actionBtn, profile.is_following ? s.followingBtn : s.followBtn]}
                onPress={handleFollow} disabled={followLoading}
              >
                <Text style={s.actionIcon}>{profile.is_following ? '✓' : '+'}</Text>
                <Text style={[s.actionText, profile.is_following && { color: '#00FF9D' }]}>
                  {profile.is_following ? 'Suivi' : 'Suivre'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity data-testid="chat-button" style={[s.actionBtn, s.chatBtn]} onPress={handleChat}>
                <Text style={s.actionIcon}>{'💬'}</Text>
                <Text style={[s.actionText, { color: '#00BFFF' }]}>Message</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Stats Row ── */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue} data-testid="stat-games">{profile.matches_played}</Text>
              <Text style={s.statLabel}>PARTIES</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue} data-testid="stat-followers">{profile.followers_count}</Text>
              <Text style={s.statLabel}>ABONNÉS</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue} data-testid="stat-following">{profile.following_count}</Text>
              <Text style={s.statLabel}>ABONNEMENTS</Text>
            </View>
          </View>
        </View>

        {/* ── Topics Grid ── */}
        <Text style={s.sectionTitle}>SES THÈMES</Text>
        <View style={s.topicsGrid}>
          {sortedCategories.map(([catKey, catData]) => {
            const meta = CATEGORY_META[catKey] || { icon: '?', name: catKey, color: '#8A2BE2', bg: '#1A1A2E' };
            return (
              <View
                key={catKey}
                data-testid={`topic-${catKey}`}
                style={[s.topicCard, { backgroundColor: meta.bg }]}
              >
                <View style={[s.topicIconBox, { backgroundColor: meta.color + '25' }]}>
                  <Text style={s.topicIcon}>{meta.icon}</Text>
                </View>
                <Text style={[s.topicName, { color: meta.color }]}>{meta.name}</Text>
                <Text style={s.topicLevel}>NiV. {catData.level}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Posts Wall ── */}
        <Text style={s.sectionTitle}>PUBLICATIONS</Text>

        {profile.posts.length === 0 ? (
          <View style={s.emptyWall}>
            <Text style={s.emptyText}>Aucune publication</Text>
          </View>
        ) : (
          profile.posts.map(post => (
            <View key={post.id} style={s.postCard}>
              <View style={s.postHeader}>
                <View style={[s.postCatBadge, { backgroundColor: (CATEGORY_META[post.category_id]?.color || '#8A2BE2') + '20' }]}>
                  <Text style={s.postCatIcon}>{CATEGORY_META[post.category_id]?.icon || '?'}</Text>
                  <Text style={[s.postCatName, { color: CATEGORY_META[post.category_id]?.color || '#8A2BE2' }]}>
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
                  <Text style={s.postActionIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
                  <Text style={s.postActionCount}>{post.likes_count}</Text>
                </View>
                <View style={s.postActionItem}>
                  <Text style={s.postActionIcon}>{'💬'}</Text>
                  <Text style={s.postActionCount}>{post.comments_count}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
    </SwipeBackPage>
  );
}

const CARD_SIZE = (width - 72) / 4;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },

  backBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  backText: { color: '#A3A3A3', fontSize: 15, fontWeight: '600' },

  /* ── Hero Header ── */
  heroCard: {
    marginHorizontal: 16, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#0D0D1A', borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
    paddingBottom: 24, alignItems: 'center',
  },
  heroBg: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
    backgroundColor: '#1A0A2E',
  },
  avatarRing: {
    marginTop: 60, width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#00FFFF',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(8, 8, 24, 0.65)',
  },
  avatar: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 40, fontWeight: '900', color: '#8A2BE2' },

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
  championIcon: { fontSize: 22 },
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
  actionIcon: { fontSize: 16 },
  actionText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    marginTop: 20, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', color: '#FFF' },
  statLabel: { fontSize: 9, fontWeight: '800', color: '#525252', letterSpacing: 1.5, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.08)' },

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
  topicIcon: { fontSize: 22 },
  topicName: { fontSize: 10, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  topicLevel: { fontSize: 9, fontWeight: '700', color: '#A3A3A3', letterSpacing: 0.5 },

  /* Empty Wall */
  emptyWall: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { color: '#525252', fontSize: 15 },

  /* Post */
  postCard: {
    marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  postCatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  postCatIcon: { fontSize: 14 },
  postCatName: { fontSize: 12, fontWeight: '700' },
  postTime: { color: '#525252', fontSize: 12 },
  postContent: { color: '#E0E0E0', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 10 },
  postActions: { flexDirection: 'row', gap: 20 },
  postActionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionIcon: { fontSize: 18 },
  postActionCount: { color: '#A3A3A3', fontSize: 14, fontWeight: '600' },
});

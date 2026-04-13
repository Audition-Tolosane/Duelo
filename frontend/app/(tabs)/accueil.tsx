import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList,
  ActivityIndicator, RefreshControl, Dimensions, Platform, Modal, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, FadeInDown, FadeInRight,
  Easing, interpolate, runOnJS,
} from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import CosmicBackground from '../../components/CosmicBackground';
import CategoryIcon from '../../components/CategoryIcon';
import UserAvatar from '../../components/UserAvatar';
import SpinWheelModal from '../../components/SpinWheelModal';
import { GLASS } from '../../theme/glassTheme';
import { authFetch } from '../../utils/api';
import { t } from '../../utils/i18n';
import { flushPendingScores } from '../../utils/pendingScores';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DUEL_CARD_WIDTH = SCREEN_WIDTH * 0.72;

const CATEGORY_ICONS: Record<string, string> = {
  series_tv: '📺', geographie: '🌍', histoire: '🏛️', cinema: '🎬',
  sport: '⚽', musique: '🎵', sciences: '🔬', gastronomie: '🍽️',
};

// ── Types ──
interface DuelItem {
  id: string;
  opponent_pseudo: string;
  opponent_avatar_seed: string;
  opponent_avatar_url?: string;
  user_avatar_url?: string;
  category: string;
  category_name: string;
  category_color: string;
  player_score: number;
  opponent_score: number;
  won: boolean;
  created_at: string;
}

interface IncomingChallenge {
  challenge_id: string;
  challenger_id: string;
  challenger_pseudo: string;
  challenger_avatar_seed: string;
  challenger_avatar_url?: string;
  theme_id: string;
  theme_name: string;
  theme_color: string;
  expires_at: string;
  created_at: string;
}

interface FeedItem {
  type: 'record' | 'community' | 'event';
  id: string;
  theme_id?: string;
  category: string;
  category_name: string;
  category_color: string;
  user_pseudo?: string;
  user_avatar_seed?: string;
  user_avatar_url?: string;
  title?: string;
  body?: string;
  score?: string;
  icon?: string;
  xp_earned?: number;
  post_id?: string;
  user_id?: string;
  content?: string;
  has_image?: boolean;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_active?: boolean;
  expires_at?: string | null;
  created_at: string;
}

interface UserData {
  pseudo: string;
  avatar_seed: string;
  total_xp: number;
  current_streak: number;
  streak_badge: string;
  matches_played: number;
  matches_won: number;
  country_flag: string;
  selected_title: string;
  last_played_at: string | null;
  best_streak: number;
  login_streak: number;
  best_login_streak: number;
}

interface DailyMission {
  id: string;
  type: string;
  label: string;
  target: number;
  progress: number;
  completed: boolean;
  xp: number;
  cat?: string;
  rerolled?: boolean;
}

interface DailyMissionsState {
  missions: DailyMission[];
  multiplier: number;
  xp_earned: number;
  reward_claimed: boolean;
  target_theme_id: string | null;
  all_completed: boolean;
  any_completed: boolean;
  rerolls_used: number;
  user_themes: { id: string; name: string; color: string }[];
}

// ── Missions Widget Styles ──
const mStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 8, marginTop: 4,
    backgroundColor: '#1A1A2E', borderRadius: 16,
    borderWidth: 1, borderColor: '#FFB80030',
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  headerIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 14, fontWeight: '800', color: '#FFF' },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  countdownText: { fontSize: 11, color: '#888' },
  missionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  missionTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  missionLabel: { fontSize: 12, color: '#CCC', flex: 1 },
  progressBg: { height: 4, backgroundColor: '#2A2A3E', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#FFB800', borderRadius: 2 },
  progressText: { fontSize: 10, color: '#666', marginTop: 2 },
  missionRight: { alignItems: 'center', gap: 4 },
  xpBadge: { backgroundColor: '#FFB80020', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  xpBadgeText: { fontSize: 10, color: '#FFB800', fontWeight: '700' },
  rerollBtn: { padding: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  doubleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#FFB80050',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  doubleBtnText: { fontSize: 11, color: '#FFB800', fontWeight: '700' },
  activeDouble: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeDoubleText: { fontSize: 11, color: '#FFB800', fontWeight: '700' },
  claimBtn: { flex: 1 },
  claimGradient: { paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  claimText: { fontSize: 12, fontWeight: '900', color: '#000' },
  claimedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  claimedText: { fontSize: 11, color: '#00FF9D' },
});

// ── Tournament Banner ──
const TournamentBanner = React.memo(function TournamentBanner({ router }: { router: any }) {
  const [info, setInfo] = React.useState<{
    active: boolean; id?: string; theme_id?: string; theme_name?: string;
    end_at?: string; rank?: number | null; score?: number;
    games_remaining?: number; total_players?: number;
  } | null>(null);
  const [countdown, setCountdown] = React.useState('');

  React.useEffect(() => {
    authFetch(`${API_URL}/api/tournaments/current`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setInfo(d))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!info?.end_at) return;
    const fmt = (end: string) => {
      const diff = new Date(end).getTime() - Date.now();
      if (diff <= 0) return '00:00';
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
    };
    setCountdown(fmt(info.end_at));
    const iv = setInterval(() => setCountdown(fmt(info!.end_at!)), 30000);
    return () => clearInterval(iv);
  }, [info?.end_at]);

  if (!info?.active) return null;

  return (
    <LinearGradient
      colors={['rgba(255,215,0,0.12)', 'rgba(255,159,10,0.05)']}
      style={tStyles.container}
    >
      <TouchableOpacity
        style={tStyles.inner}
        onPress={() => router.push(`/tournament?tournamentId=${info.id}`)}
        activeOpacity={0.8}
      >
        <View style={tStyles.iconBox}>
          <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
        </View>
        <View style={tStyles.info}>
          <View style={tStyles.topRow}>
            <Text style={tStyles.label}>{t('tournament.weekend_title')}</Text>
            <View style={tStyles.clockRow}>
              <MaterialCommunityIcons name="clock-outline" size={11} color="#FFD700" />
              <Text style={tStyles.countdown}>{countdown}</Text>
            </View>
          </View>
          <Text style={tStyles.themeName} numberOfLines={1}>{info.theme_name}</Text>
          {info.rank != null && (
            <Text style={tStyles.rank}>
              #{info.rank} · {info.score} pts · {info.total_players} {t('tournament.players')}
            </Text>
          )}
        </View>
        {(info.games_remaining ?? 0) > 0 && (
          <TouchableOpacity
            style={tStyles.playBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push(`/matchmaking?category=${info.theme_id}&themeName=${encodeURIComponent(info.theme_name || '')}`);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#FFD700', '#FF9F0A']} style={tStyles.playGrad}>
              <MaterialCommunityIcons name="play" size={14} color="#000" />
              <Text style={tStyles.playText}>{info.games_remaining}x</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </LinearGradient>
  );
});

const tStyles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)' },
  inner: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,215,0,0.15)', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  label: { fontSize: 9, fontWeight: '800', color: '#FFD700', letterSpacing: 1.5, textTransform: 'uppercase' },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  countdown: { color: '#FFD700', fontSize: 10, fontWeight: '700' },
  themeName: { color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  rank: { color: '#A3A3A3', fontSize: 11, fontWeight: '600' },
  playBtn: { borderRadius: 10, overflow: 'hidden' },
  playGrad: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  playText: { color: '#000', fontSize: 12, fontWeight: '900' },
});

// ── Missions Widget ──
const MissionsWidget = React.memo(function MissionsWidget({
  data,
  onDouble,
  onReroll,
  onClaim,
}: {
  data: DailyMissionsState;
  onDouble: () => void;
  onReroll: (id: string) => void;
  onClaim: () => void;
}) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const secsLeft = Math.floor((midnight.getTime() - now.getTime()) / 1000);
  const hh = String(Math.floor(secsLeft / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0');
  const countdown = `${hh}h${mm}`;

  const totalXP = data.missions.reduce((s, m) => s + (m.completed ? m.xp : 0), 0) * data.multiplier;
  const canClaim = data.any_completed && !data.reward_claimed;

  return (
    <View style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.header}>
        <LinearGradient colors={['#FFB800', '#FF6B35']} style={mStyles.headerIcon}>
          <MaterialCommunityIcons name="flag-checkered" size={12} color="#FFF" />
        </LinearGradient>
        <Text style={mStyles.title}>{t('missions.day_title')}</Text>
        <View style={mStyles.countdown}>
          <MaterialCommunityIcons name="clock-outline" size={11} color="#888" />
          <Text style={mStyles.countdownText}>{countdown}</Text>
        </View>
      </View>

      {/* Mission rows */}
      {data.missions.map((m) => {
        const pct = Math.min(m.progress / m.target, 1);
        return (
          <View key={m.id} style={mStyles.missionRow}>
            <View style={{ flex: 1 }}>
              <View style={mStyles.missionTop}>
                <MaterialCommunityIcons
                  name={m.completed ? 'check-circle' : 'circle-outline'}
                  size={15}
                  color={m.completed ? '#00FF9D' : '#555'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[mStyles.missionLabel, m.completed && { color: '#00FF9D' }]} numberOfLines={1}>
                  {m.label}
                </Text>
              </View>
              <View style={mStyles.progressBg}>
                <View style={[mStyles.progressFill, { width: `${pct * 100}%` as any }]} />
              </View>
              <Text style={mStyles.progressText}>{m.progress}/{m.target}</Text>
            </View>
            <View style={mStyles.missionRight}>
              <View style={mStyles.xpBadge}>
                <Text style={mStyles.xpBadgeText}>+{m.xp * data.multiplier} XP</Text>
              </View>
              {!m.completed && !m.rerolled && !data.reward_claimed && (
                <TouchableOpacity style={mStyles.rerollBtn} onPress={() => onReroll(m.id)}>
                  <MaterialCommunityIcons name="refresh" size={13} color="#888" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {/* Bottom actions */}
      {!data.reward_claimed && (
        <View style={mStyles.actions}>
          {data.multiplier < 2 && (
            <TouchableOpacity style={mStyles.doubleBtn} onPress={onDouble} activeOpacity={0.8}>
              <MaterialCommunityIcons name="television-play" size={13} color="#FFB800" />
              <Text style={mStyles.doubleBtnText}>×2 toutes (pub)</Text>
            </TouchableOpacity>
          )}
          {data.multiplier >= 2 && (
            <View style={mStyles.activeDouble}>
              <MaterialCommunityIcons name="lightning-bolt" size={13} color="#FFB800" />
              <Text style={mStyles.activeDoubleText}>×2 actif</Text>
            </View>
          )}
          {canClaim && (
            <TouchableOpacity style={mStyles.claimBtn} onPress={onClaim} activeOpacity={0.8}>
              <LinearGradient colors={['#00FF9D', '#00D4FF']} style={mStyles.claimGradient}>
                <Text style={mStyles.claimText}>{t('missions.claim_xp').replace('{xp}', String(totalXP))}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}

      {data.reward_claimed && (
        <View style={mStyles.claimedBadge}>
          <MaterialCommunityIcons name="check-circle" size={14} color="#00FF9D" />
          <Text style={mStyles.claimedText}>{t('missions.claimed')}</Text>
        </View>
      )}
    </View>
  );
});

// Type icon mapping
const TYPE_ICON_MAP: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  record: 'trophy',
  community: 'account-group',
  event: 'lightning-bolt',
};

const FEED_ICON_MAP: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  '🏆': 'trophy',
  '⚡': 'lightning-bolt',
  '🔥': 'fire',
  '⭐': 'star',
  '🎯': 'target',
  '📈': 'trending-up',
  '🥇': 'medal',
  '💎': 'diamond-stone',
};

function getInitial(pseudo: string): string {
  return pseudo && pseudo.length > 0 ? pseudo[0].toUpperCase() : '?';
}

function getAvatarColor(seed: string): string {
  const palette = ['#FF6B35', '#8A2BE2', '#00D4FF', '#4CAF50', '#FF3B5C', '#FFB800', '#00FF9D', '#E53935'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('home.just_now');
  if (m < 60) return `${m}m`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(diff / 86400000);
  return `${d}${t('home.days_short')}`;
}

// ── Shimmer Border Animation ──
function ShimmerBorder({ color, children }: { color: string; children: React.ReactNode }) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.linear }),
      -1, false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.9, 0.3]),
  }));

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View
        style={[
          {
            position: 'absolute', top: -1, left: -1, right: -1, bottom: -1,
            borderRadius: 21, borderWidth: 1.5, borderColor: color,
          },
          animStyle,
        ]}
      />
      {children}
    </View>
  );
}

// ── Duel Card ──
const DuelCard = React.memo(function DuelCard({ duel, index, onRematch }: { duel: DuelItem; index: number; onRematch: () => void }) {
  return (
    <Animated.View entering={FadeInRight.delay(index * 100).duration(500)}>
      <ShimmerBorder color={duel.category_color}>
        <View style={[styles.duelCard, { borderColor: duel.category_color + '20' }]}>
          <View style={styles.duelGlass} />

          {/* Category badge */}
          <View style={[styles.duelCatBadge, { backgroundColor: duel.category_color + '20' }]}>
            <CategoryIcon themeId={duel.category} size={14} color={duel.category_color} type="theme" />
            <Text style={[styles.duelCatName, { color: duel.category_color }]} numberOfLines={1}>
              {duel.category_name}
            </Text>
          </View>

          {/* VS Section */}
          <View style={styles.duelVsSection}>
            {/* Player */}
            <View style={styles.duelPlayer}>
              <View style={styles.duelAvatarWrap}>
                <UserAvatar avatarUrl={duel.user_avatar_url} avatarSeed="me" pseudo={t('home.you')} size={44} />
              </View>
              <Text style={styles.duelPlayerLabel}>{t('home.you')}</Text>
            </View>

            {/* Score */}
            <View style={styles.duelScoreWrap}>
              <Text style={[styles.duelScoreNum, duel.won && { color: '#00FF9D' }]}>
                {duel.player_score}
              </Text>
              <View style={styles.vsCircle}>
                <Text style={styles.duelVsText}>{t('home.vs')}</Text>
              </View>
              <Text style={[styles.duelScoreNum, !duel.won && { color: '#FF3B5C' }]}>
                {duel.opponent_score}
              </Text>
            </View>

            {/* Opponent */}
            <View style={styles.duelPlayer}>
              <View style={styles.duelAvatarWrap}>
                <UserAvatar avatarUrl={duel.opponent_avatar_url} avatarSeed={duel.opponent_avatar_seed} pseudo={duel.opponent_pseudo} size={44} />
              </View>
              <Text style={styles.duelPlayerLabel} numberOfLines={1}>{duel.opponent_pseudo}</Text>
            </View>
          </View>

          {/* Result badge */}
          <View style={[styles.duelResultBadge, { backgroundColor: duel.won ? '#00FF9D15' : '#FF3B5C15' }]}>
            <MaterialCommunityIcons
              name={duel.won ? 'check-circle' : 'close-circle'}
              size={12}
              color={duel.won ? '#00FF9D' : '#FF3B5C'}
            />
            <Text style={[styles.duelResultText, { color: duel.won ? '#00FF9D' : '#FF3B5C' }]}>
              {duel.won ? t('home.victory_label') : t('home.defeat_label')}
            </Text>
          </View>

          {/* Rematch button */}
          <TouchableOpacity style={styles.rematchBtn} onPress={onRematch} activeOpacity={0.8}>
            <LinearGradient
              colors={[duel.category_color, '#8A2BE2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rematchGradient}
            >
              <MaterialCommunityIcons name="sword-cross" size={14} color="#FFF" />
              <Text style={styles.rematchText}>{t('home.rematch_label')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Time ago */}
          <View style={styles.duelTimeRow}>
            <MaterialCommunityIcons name="clock-outline" size={10} color="#444" />
            <Text style={styles.duelTimeAgo}>{timeAgo(duel.created_at)}</Text>
          </View>
        </View>
      </ShimmerBorder>
    </Animated.View>
  );
});

// ── Record Card ──
const RecordCard = React.memo(function RecordCard({ item, index }: { item: FeedItem; index: number }) {
  const mciName = FEED_ICON_MAP[item.icon || ''] || 'trophy';

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
      <View style={[styles.feedCard, { borderLeftWidth: 3, borderLeftColor: item.category_color }]}>
        <View style={styles.feedCardHeader}>
          <LinearGradient colors={[item.category_color, item.category_color + '80']} style={styles.feedIconBadge}>
            <MaterialCommunityIcons name={mciName} size={16} color="#FFF" />
          </LinearGradient>
          <View style={styles.feedHeaderText}>
            <Text style={styles.feedCardTitle}>{t('home.perfect_score')}</Text>
            <View style={styles.feedTimeRow}>
              <MaterialCommunityIcons name="clock-outline" size={10} color="#555" />
              <Text style={styles.feedCardTime}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.feedCardBody}>{`@${item.user_pseudo} ${t('home.perfect_score_body')} ${item.category_name} !`}</Text>
        {item.xp_earned ? (
          <View style={styles.xpBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={12} color="#8A2BE2" />
            <Text style={styles.xpBadgeText}>+{item.xp_earned} XP</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});

// ── Community Card ──
const CommunityCard = React.memo(function CommunityCard({ item, index, userId, onLike, onComment }: {
  item: FeedItem; index: number; userId: string; onLike: (postId: string) => void; onComment: (item: FeedItem) => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
      <View style={styles.feedCard}>
        {/* Header */}
        <View style={styles.communityHeader}>
          <View style={styles.communityUser}>
            <UserAvatar avatarUrl={item.user_avatar_url} avatarSeed={item.user_avatar_seed || ''} pseudo={item.user_pseudo || ''} size={38} />
            <View>
              <Text style={styles.communityPseudo}>{item.user_pseudo}</Text>
              <View style={styles.communityMeta}>
                <View style={[styles.communityCatDot, { backgroundColor: item.category_color }]} />
                <Text style={[styles.communityCatLabel, { color: item.category_color }]}>
                  {item.category_name}
                </Text>
                <Text style={styles.communityTime}> · {timeAgo(item.created_at)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content */}
        <Text style={styles.communityContent}>{item.content}</Text>

        {/* Actions */}
        <View style={styles.communityActions}>
          <TouchableOpacity
            style={styles.communityActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (item.post_id) onLike(item.post_id);
            }}
          >
            <MaterialCommunityIcons
              name={item.is_liked ? 'heart' : 'heart-outline'}
              size={16}
              color={item.is_liked ? '#FF3B5C' : '#666'}
            />
            <Text style={[styles.communityActionCount, item.is_liked && { color: '#FF3B5C' }]}>
              {item.likes_count || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.communityActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onComment(item);
            }}
          >
            <MaterialCommunityIcons name="comment-outline" size={15} color="#666" />
            <Text style={styles.communityActionCount}>{item.comments_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.communityActionBtn}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const { Share } = require('react-native');
              try {
                await Share.share({ message: `${item.user_pseudo} ${t('home.share_on_duelo')} "${item.content?.slice(0, 100)}"` });
              } catch (e) { console.error(e); }
            }}
          >
            <MaterialCommunityIcons name="share-outline" size={15} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

// ── Slot Machine ──
const SLOT_CARD_W = 84;
const SLOT_GAP = 10;
const SLOT_ITEM_W = SLOT_CARD_W + SLOT_GAP;

type SlotTheme = { id: string; name: string; color: string };

const SlotMachineOverlay = React.memo(function SlotMachineOverlay({
  visible, themes, chosen, onDone,
}: {
  visible: boolean;
  themes: SlotTheme[];
  chosen: SlotTheme | null;
  onDone: () => void;
}) {
  const offset = useSharedValue(0);
  const opacity = useSharedValue(0);

  const { list, chosenIndex } = useMemo(() => {
    if (!themes.length || !chosen) return { list: [], chosenIndex: 0 };
    let base = [...themes];
    while (base.length < 5) base = [...base, ...themes];
    const repeated = [...base, ...base, ...base, ...base];
    const ci = repeated.length;
    return {
      list: [...repeated, { ...chosen }, ...base.slice(0, 3)],
      chosenIndex: ci,
    };
  }, [chosen?.id]);

  useEffect(() => {
    if (!visible || !list.length || !chosen) return;
    offset.value = -(2 * SLOT_ITEM_W);
    opacity.value = withTiming(1, { duration: 200 });

    const spinTimer = setTimeout(() => {
      const targetOffset = -(chosenIndex - 1) * SLOT_ITEM_W;
      // Reste rapide longtemps puis décélère doucement sur la fin
      offset.value = withTiming(targetOffset, { duration: 3200, easing: Easing.bezier(0.05, 0.6, 0.1, 1.0) });
    }, 300);

    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400 });
    }, 4200);

    const doneTimer = setTimeout(onDone, 4600);

    return () => {
      clearTimeout(spinTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  if (!visible || !chosen) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[slotS.overlay, overlayStyle]}>
        <View style={slotS.box}>
          <Text style={slotS.title}>Sélection du thème</Text>
          <View style={slotS.viewport}>
            <Animated.View style={[slotS.row, rowStyle]}>
              {list.map((theme, idx) => {
                const isChosen = idx === chosenIndex;
                const c = theme.color || '#8A2BE2';
                return (
                  <View
                    key={`${theme.id}-${idx}`}
                    style={[slotS.card, {
                      backgroundColor: c + '22',
                      borderColor: c + (isChosen ? 'CC' : '35'),
                      borderWidth: isChosen ? 2 : 1,
                    }]}
                  >
                    <MaterialCommunityIcons name="lightning-bolt" size={22} color={c} />
                    <Text style={[slotS.cardName, { color: c }]} numberOfLines={2}>{theme.name}</Text>
                  </View>
                );
              })}
            </Animated.View>
            <LinearGradient colors={['#080810', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={slotS.fadeLeft} pointerEvents="none" />
            <LinearGradient colors={['transparent', '#080810']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={slotS.fadeRight} pointerEvents="none" />
            <View style={slotS.centerMark} pointerEvents="none" />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
});

const slotS = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center',
  },
  box: { alignItems: 'center', gap: 18, width: '100%' },
  title: { fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 3, textTransform: 'uppercase' },
  viewport: { width: SLOT_ITEM_W * 3, height: 108, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', height: 108, gap: SLOT_GAP },
  card: {
    width: SLOT_CARD_W, height: 100, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6,
  },
  cardName: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  fadeLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SLOT_ITEM_W },
  fadeRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: SLOT_ITEM_W },
  centerMark: {
    position: 'absolute', top: 4, bottom: 4,
    left: SLOT_ITEM_W, width: SLOT_CARD_W,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  subtitle: { fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
});

// ── Event Card ──
const EventCard = React.memo(function EventCard({ item, index, onActivate, onLaunch }: {
  item: FeedItem; index: number;
  onActivate: (themeId: string) => Promise<string | null>;
  onLaunch: (themeId: string, themeName: string) => void;
}) {
  const pulse = useSharedValue(0);
  const [countdown, setCountdown] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState<string | null>(item.expires_at || null);
  const [isActive, setIsActive] = React.useState(item.is_active || false);
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1200 }), withTiming(0, { duration: 1200 })),
      -1, true
    );
  }, []);

  useEffect(() => {
    if (!expiresAt) { setCountdown(''); return; }
    const update = () => {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      if (diff === 0) { setIsActive(false); setCountdown(''); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [isActive ? 0.8 : 0.5, 1]),
  }));

  const themeId = item.theme_id || item.category;

  const watchAdAndActivate = async () => {
    if (loading) return;
    setLoading(true);
    // TODO: afficher vraie pub ici (AdMob rewarded)
    await new Promise(r => setTimeout(r, 1000));
    const newExpiry = await onActivate(themeId);
    if (newExpiry) {
      setExpiresAt(newExpiry);
      setIsActive(true);
      onLaunch(themeId, item.category_name);
    }
    setLoading(false);
  };

  const handleCardPress = () => {
    if (isActive) {
      onLaunch(themeId, item.category_name);
      return;
    }
    Alert.alert(
      'Bonus XP ×2',
      `Regarde une pub pour activer le bonus sur "${item.category_name}" et lancer une partie.`,
      [
        { text: 'Pas maintenant', style: 'cancel' },
        { text: 'Regarder la pub', onPress: watchAdAndActivate },
      ],
    );
  };

  const color = item.category_color;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
      <Animated.View style={pulseStyle}>
        <TouchableOpacity onPress={handleCardPress} activeOpacity={0.85}>
          <LinearGradient
            colors={[color + (isActive ? '25' : '15'), 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.eventCard, { borderColor: color + (isActive ? '60' : '30') }]}
          >
            <LinearGradient colors={[color, color + '80']} style={styles.eventIconWrap}>
              <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFF" />
            </LinearGradient>
            <View style={styles.eventContent}>
              <Text style={[styles.eventTitle, { color }]}>{`XP ×2 — ${item.category_name}`}</Text>
              {isActive && countdown ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="timer-outline" size={13} color="#00FF9D" />
                  <Text style={[styles.eventBody, { color: '#00FF9D', fontWeight: '700' }]}>{countdown}</Text>
                </View>
              ) : (
                <Text style={styles.eventBody}>
                  {isActive ? 'Actif — Jouer maintenant' : 'Regarde une pub pour activer'}
                </Text>
              )}
            </View>
            {isActive ? (
              <View style={[styles.eventLiveBadge, { backgroundColor: '#00FF9D' }]}>
                <View style={[styles.liveDot, { backgroundColor: '#FFF' }]} />
                <Text style={[styles.eventLiveText, { color: '#000' }]}>ACTIF</Text>
              </View>
            ) : (
              <View style={[styles.adBtn, { borderColor: color, opacity: loading ? 0.5 : 1 }]}>
                <MaterialCommunityIcons
                  name={loading ? 'loading' : 'play-circle-outline'}
                  size={14} color={color}
                />
                <Text style={[styles.adBtnText, { color }]}>
                  {loading ? '...' : 'Pub'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});


// ── Weekly Summary ──
interface WeeklySummaryData {
  games_played: number;
  games_won: number;
  xp_earned: number;
  win_rate: number;
  best_theme_name: string;
  perfect_scores: number;
}

const WeeklySummaryWidget = React.memo(function WeeklySummaryWidget() {
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);

  useEffect(() => {
    authFetch(`${API_URL}/api/game/weekly-summary`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.games_played > 0) setSummary(data);
      })
      .catch(() => {});
  }, []);

  if (!summary) return null;

  return (
    <Animated.View entering={FadeInDown.delay(260).duration(500)}>
      <LinearGradient
        colors={['rgba(138,43,226,0.10)', 'rgba(0,191,255,0.05)']}
        style={wkStyles.card}
      >
        <View style={wkStyles.headerRow}>
          <LinearGradient colors={['#8A2BE2', '#A855F7']} style={wkStyles.iconCircle}>
            <MaterialCommunityIcons name="chart-line" size={13} color="#FFF" />
          </LinearGradient>
          <Text style={wkStyles.title}>Cette semaine</Text>
        </View>
        <View style={wkStyles.statsRow}>
          <View style={wkStyles.statItem}>
            <Text style={wkStyles.statVal}>{summary.games_played}</Text>
            <Text style={wkStyles.statLabel}>DUELS</Text>
          </View>
          <View style={wkStyles.divider} />
          <View style={wkStyles.statItem}>
            <Text style={[wkStyles.statVal, { color: '#00FF9D' }]}>{summary.win_rate}%</Text>
            <Text style={wkStyles.statLabel}>VICTOIRES</Text>
          </View>
          <View style={wkStyles.divider} />
          <View style={wkStyles.statItem}>
            <Text style={[wkStyles.statVal, { color: '#FFD700' }]}>+{summary.xp_earned}</Text>
            <Text style={wkStyles.statLabel}>XP</Text>
          </View>
          {summary.perfect_scores > 0 && (
            <>
              <View style={wkStyles.divider} />
              <View style={wkStyles.statItem}>
                <Text style={[wkStyles.statVal, { color: '#FF6B35' }]}>{summary.perfect_scores}</Text>
                <Text style={wkStyles.statLabel}>PARFAITS</Text>
              </View>
            </>
          )}
        </View>
        {summary.best_theme_name ? (
          <View style={wkStyles.bestThemeRow}>
            <MaterialCommunityIcons name="fire" size={11} color="#FF6B35" />
            <Text style={wkStyles.bestThemeText}>Thème favori : <Text style={{ color: '#FFF', fontWeight: '700' }}>{summary.best_theme_name}</Text></Text>
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
});

const wkStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 8, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)', padding: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconCircle: { width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#A855F7', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#555', fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.07)' },
  bestThemeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  bestThemeText: { color: '#888', fontSize: 11, fontWeight: '600' },
});

// ── Challenge Suggestions ──
interface SuggestedPlayer {
  user_id: string;
  pseudo: string;
  avatar_seed: string;
  avatar_url?: string;
  level: number;
  total_xp: number;
  xp_gap: number;
  common_theme_id: string;
  common_theme_name: string;
  shared_themes_count: number;
}

const ChallengeSuggestions = React.memo(function ChallengeSuggestions({ router }: { router: ReturnType<typeof useRouter> }) {
  const [suggestions, setSuggestions] = useState<SuggestedPlayer[]>([]);

  useEffect(() => {
    authFetch(`${API_URL}/api/social/challenge-suggestions`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(320).duration(500)}>
      <View style={styles.sectionHeader}>
        <LinearGradient colors={['#FF6B35', '#FF9F0A']} style={styles.sectionIconCircle}>
          <MaterialCommunityIcons name="sword-cross" size={12} color="#FFF" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{t('home.suggestions_title')}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.duelsScroll, { gap: 10 }]}>
        {suggestions.map((s, i) => (
          <Animated.View key={s.user_id} entering={FadeInRight.delay(i * 60).duration(350)}>
            <View style={sugStyles.card}>
              <UserAvatar avatarUrl={s.avatar_url} avatarSeed={s.avatar_seed} pseudo={s.pseudo} size={44} />
              <Text style={sugStyles.pseudo} numberOfLines={1}>{s.pseudo}</Text>
              <Text style={sugStyles.level}>Niv. {s.level}</Text>
              {s.common_theme_name ? (
                <View style={sugStyles.themeBadge}>
                  <Text style={sugStyles.themeName} numberOfLines={1}>{s.common_theme_name}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={sugStyles.challengeBtn}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const path = s.common_theme_id
                    ? `/matchmaking?category=${s.common_theme_id}&opponentId=${s.user_id}`
                    : `/matchmaking?opponentId=${s.user_id}`;
                  router.push(path as any);
                }}
              >
                <LinearGradient colors={['#FF6B35', '#FF9F0A']} style={sugStyles.challengeGrad}>
                  <MaterialCommunityIcons name="sword-cross" size={12} color="#000" />
                  <Text style={sugStyles.challengeText}>{t('home.challenge_btn')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

const sugStyles = StyleSheet.create({
  card: {
    width: 110, backgroundColor: 'rgba(255,107,53,0.07)',
    borderRadius: 16, padding: 12, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.2)',
  },
  pseudo: { color: '#FFF', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  level: { color: '#888', fontSize: 10, fontWeight: '600' },
  themeBadge: { backgroundColor: 'rgba(255,159,10,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2, maxWidth: 90 },
  themeName: { color: '#FF9F0A', fontSize: 9, fontWeight: '700', textAlign: 'center' },
  challengeBtn: { marginTop: 6, borderRadius: 8, overflow: 'hidden', width: '100%' },
  challengeGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7 },
  challengeText: { color: '#000', fontSize: 11, fontWeight: '900' },
});

// ── Challenge Card ──
const ChallengeCard = React.memo(function ChallengeCard({ challenge, onAccept, onDecline }: {
  challenge: IncomingChallenge; onAccept: () => void; onDecline: () => void;
}) {
  function expiresIn(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `< 1h`;
    return `${h}h`;
  }
  return (
    <Animated.View entering={FadeInRight.duration(400)}>
      <View style={[styles.challengeCard, { borderColor: challenge.theme_color + '30' }]}>
        <LinearGradient colors={[challenge.theme_color + '15', 'transparent']} style={styles.challengeCardGlow} />
        <View style={styles.challengeTop}>
          <UserAvatar avatarUrl={challenge.challenger_avatar_url} avatarSeed={challenge.challenger_avatar_seed} pseudo={challenge.challenger_pseudo} size={40} />
          <View style={styles.challengeInfo}>
            <Text style={styles.challengePseudo}>{challenge.challenger_pseudo}</Text>
            <Text style={styles.challengeVs}>{t('challenge.vs')}</Text>
            {challenge.theme_name ? (
              <View style={[styles.challengeThemeBadge, { backgroundColor: challenge.theme_color + '20' }]}>
                <Text style={[styles.challengeThemeName, { color: challenge.theme_color }]} numberOfLines={1}>{challenge.theme_name}</Text>
              </View>
            ) : (
              <Text style={styles.challengeNoTheme}>{t('challenge.no_theme')}</Text>
            )}
          </View>
          <View style={styles.challengeExpiry}>
            <MaterialCommunityIcons name="clock-outline" size={10} color="#555" />
            <Text style={styles.challengeExpiryText}>{expiresIn(challenge.expires_at)}</Text>
          </View>
        </View>
        <View style={styles.challengeActions}>
          <TouchableOpacity style={styles.challengeDeclineBtn} onPress={onDecline} activeOpacity={0.8}>
            <Text style={styles.challengeDeclineText}>{t('challenge.decline')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.challengeAcceptBtn, { backgroundColor: challenge.theme_color }]} onPress={onAccept} activeOpacity={0.8}>
            <MaterialCommunityIcons name="sword-cross" size={14} color="#FFF" />
            <Text style={styles.challengeAcceptText}>{t('challenge.accept')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

// ── Main Screen ──
export default function AccueilScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [pendingDuels, setPendingDuels] = useState<DuelItem[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<IncomingChallenge[]>([]);
  const [socialFeed, setSocialFeed] = useState<FeedItem[]>([]);
  const socialFeedRef = useRef<FeedItem[]>([]);
  useEffect(() => { socialFeedRef.current = socialFeed; }, [socialFeed]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [feedError, setFeedError] = useState(false);
  const [dailyMissions, setDailyMissions] = useState<DailyMissionsState | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [spinAvailable, setSpinAvailable] = useState(false);
  const [showSpin, setShowSpin] = useState(false);
  const [offerSlotExpiresAt, setOfferSlotExpiresAt] = useState<string | null>(null);
  const [offerCountdown, setOfferCountdown] = useState('');

  const hasPlayedToday = React.useMemo(() => {
    if (!userData?.last_played_at) return false;
    const last = new Date(userData.last_played_at);
    const now = new Date();
    return last.toDateString() === now.toDateString();
  }, [userData?.last_played_at]);

  useEffect(() => {
    loadFeed();
    loadMissions();
    loadDailyQuestion();
    checkSpinStatus();
  }, []);

  const checkSpinStatus = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/spin/status`);
      if (!res.ok) return;
      const data = await res.json();
      setSpinAvailable(data.available);
      if (data.available) {
        // Auto-open once per day — guard with AsyncStorage
        const lastAutoShown = await AsyncStorage.getItem('duelo_spin_auto_shown');
        const today = new Date().toDateString();
        if (lastAutoShown !== today) {
          await AsyncStorage.setItem('duelo_spin_auto_shown', today);
          setTimeout(() => setShowSpin(true), 1200);
        }
      }
    } catch {}
  }, []);


  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [dqAnswer, setDqAnswer] = useState<number | null>(null);
  const [dqResult, setDqResult] = useState<any>(null);
  const [slotVisible, setSlotVisible] = useState(false);
  const [slotChosen, setSlotChosen] = useState<SlotTheme | null>(null);
  const [slotThemes, setSlotThemes] = useState<SlotTheme[]>([]);

  const loadDailyQuestion = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/daily-question/today`);
      if (res.ok) setDailyQuestion(await res.json());
    } catch (e) { console.warn('[accueil] loadDailyQuestion:', e); }
  }, []);


  const handleDqAnswer = useCallback(async (idx: number) => {
    if (!dailyQuestion || dqAnswer !== null) return;
    setDqAnswer(idx);
    try {
      const res = await authFetch(`${API_URL}/api/daily-question/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: dailyQuestion.question_id, theme_id: dailyQuestion.theme_id, answer_index: idx }),
      });
      if (res.ok) setDqResult(await res.json());
    } catch (e) { console.warn('[accueil] handleDqAnswer:', e); }
  }, [dailyQuestion, dqAnswer]);

  const loadMissions = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/missions/today`);
      if (res.ok) setDailyMissions(await res.json());
    } catch (e) { console.warn('[accueil] loadMissions:', e); }
  }, []);

  const handleDoubleReward = useCallback(async () => {
    // TODO: show rewarded ad before calling API
    const res = await authFetch(`${API_URL}/api/missions/double`, { method: 'POST' });
    if (res.ok) {
      const d = await res.json();
      setDailyMissions(prev => prev ? { ...prev, multiplier: d.multiplier, xp_earned: d.xp_earned } : prev);
    }
  }, []);

  const handleRerollMission = useCallback(async (missionId: string) => {
    // TODO: show rewarded ad before calling API
    const res = await authFetch(`${API_URL}/api/missions/reroll/${missionId}`, { method: 'POST' });
    if (res.ok) {
      const d = await res.json();
      setDailyMissions(prev => prev ? { ...prev, missions: d.missions } : prev);
    }
  }, []);

  const handleClaimRewards = useCallback(async (themeId: string) => {
    const res = await authFetch(`${API_URL}/api/missions/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: themeId }),
    });
    if (res.ok) {
      setDailyMissions(prev => prev ? { ...prev, reward_claimed: true, target_theme_id: themeId } : prev);
      setShowThemePicker(false);
    }
  }, []);

  // Register Expo push token + flush any offline-queued score saves
  useEffect(() => {
    const registerPushAndFlush = async () => {
      try {
        // Flush any failed async score saves from previous sessions
        flushPendingScores();

        // Register for Expo push notifications
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        if (!projectId) return; // Expo Go sans EAS — push tokens non supportés en SDK 53+

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        const uid = await AsyncStorage.getItem('duelo_user_id');
        if (uid && token) {
          await authFetch(`${API_URL}/api/profile/user/push-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: uid, token }),
          });
        }
      } catch (e) { console.error(e); }
    };
    registerPushAndFlush();
  }, []);

  // Schedule daily streak reminder notification
  useEffect(() => {
    let cancelled = false;

    const scheduleStreakReminder = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        // Cancel ALL previously scheduled notifications to prevent accumulation
        await Notifications.cancelAllScheduledNotificationsAsync();

        if (cancelled) return;

        // Schedule daily at 19:00
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('home.streak_danger_title'),
            body: `${t('home.streak_danger_body')} ${userData?.login_streak || 0} ${t('home.streak_danger_days')}`,
            data: { type: 'streak_reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 19,
            minute: 0,
          },
        });
      } catch (e) { console.error(e); }
    };

    if (userData && !hasPlayedToday && (userData.login_streak || 0) > 0) {
      scheduleStreakReminder();
    }

    return () => {
      cancelled = true;
    };
  }, [userData, hasPlayedToday]);

  const handleActivateBoost = useCallback(async (themeId: string): Promise<string | null> => {
    try {
      const res = await authFetch(`${API_URL}/api/boosts/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_id: themeId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.expires_at;
    } catch { return null; }
  }, []);

  const handleLaunchBoost = useCallback((themeId: string, themeName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${themeId}&themeName=${encodeURIComponent(themeName)}`);
  }, [router]);

  // Countdown toward next 30-min slot for x2 offers
  useEffect(() => {
    if (!offerSlotExpiresAt) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(offerSlotExpiresAt).getTime() - Date.now()) / 1000));
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      setOfferCountdown(`${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offerSlotExpiresAt]);

  const handleRefreshOffers = useCallback(async () => {
    // TODO: show rewarded ad before calling API
    try {
      const res = await authFetch(`${API_URL}/api/boosts/refresh-offers`, { method: 'POST' });
      if (res.ok) await loadFeed();
    } catch (e) { console.warn('[accueil] refresh offers failed:', e); }
  }, []);

  const loadFeed = async () => {
    try {
      setFeedError(false);
      const uid = await AsyncStorage.getItem('duelo_user_id');
      if (!uid) { setLoading(false); return; }
      setUserId(uid);

      const res = await fetch(`${API_URL}/api/feed/home/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setUserData(data.user);
        setPendingDuels(data.pending_duels || []);
        setIncomingChallenges(data.incoming_challenges || []);
        setSocialFeed(data.social_feed || []);
        if (data.offer_slot_expires_at) setOfferSlotExpiresAt(data.offer_slot_expires_at);
      }
    } catch {
      setFeedError(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, []);

  const handleRematch = useCallback((duel: DuelItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${duel.category}`);
  }, [router]);

  const handleAcceptChallenge = useCallback(async (challenge: IncomingChallenge) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await authFetch(`${API_URL}/api/challenges/${challenge.challenge_id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        setIncomingChallenges(prev => prev.filter(c => c.challenge_id !== challenge.challenge_id));
        // Play in reveal mode: see Player A's answers revealed after each question
        if (challenge.theme_id) {
          router.push(
            `/game?category=${challenge.theme_id}&asyncMode=reveal` +
            `&opponentPseudo=${encodeURIComponent(challenge.challenger_pseudo)}` +
            `&opponentSeed=${encodeURIComponent(challenge.challenger_avatar_seed || '')}` +
            `&challenge_id=${challenge.challenge_id}`
          );
        } else {
          router.push('/(tabs)/play');
        }
      }
    } catch (e) { console.error(e); }
  }, [userId, router]);

  const handleDeclineChallenge = useCallback(async (challengeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await authFetch(`${API_URL}/api/challenges/${challengeId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      setIncomingChallenges(prev => prev.filter(c => c.challenge_id !== challengeId));
    } catch (e) { console.error(e); }
  }, [userId]);

  const handleLike = useCallback(async (postId: string) => {
    if (!userId) return;
    // Use ref to get latest feed without capturing it in deps
    const previousFeed = [...socialFeedRef.current];
    // Optimistic update
    setSocialFeed(prev =>
      prev.map(item =>
        item.post_id === postId
          ? {
              ...item,
              is_liked: !item.is_liked,
              likes_count: (item.likes_count || 0) + (item.is_liked ? -1 : 1),
            }
          : item
      )
    );
    try {
      const res = await authFetch(`${API_URL}/api/wall/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        setSocialFeed(previousFeed); // rollback
      }
    } catch {
      setSocialFeed(previousFeed); // rollback
    }
  }, [userId]);

  const handleComment = useCallback((feedItem: FeedItem) => {
    const themeId = feedItem.theme_id || feedItem.category;
    if (themeId) {
      router.push(`/category-detail?id=${themeId}`);
    }
  }, [router]);

  const winRate = userData && userData.matches_played > 0
    ? Math.round((userData.matches_won / userData.matches_played) * 100)
    : 0;

  if (loading) {
    return (
      <CosmicBackground>
      <View style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8A2BE2" />
        </View>
      </View>
      </CosmicBackground>
    );
  }

  return (
    <CosmicBackground>
    <View style={styles.container}>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8A2BE2"
            colors={['#8A2BE2']}
          />
        }
      >
        {/* ── Greeting Section ── */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.greetingSection}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingLeft}>
              <Text style={styles.greetingHi}>
                {t('home.greeting')} {userData?.pseudo || t('home.player')} {userData?.country_flag || ''}
              </Text>
              <View style={styles.titleRow}>
                <MaterialCommunityIcons name="shield-star" size={13} color="#8A2BE2" />
                <Text style={styles.greetingTitle}>{userData?.selected_title || t('home.novice')}</Text>
              </View>
            </View>
          </View>

          {/* Stats pills */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <LinearGradient colors={['#8A2BE2', '#A855F7']} style={styles.statPillIcon}>
                <MaterialCommunityIcons name="lightning-bolt" size={12} color="#FFF" />
              </LinearGradient>
              <Text style={styles.statPillNum}>{(userData?.total_xp || 0).toLocaleString()}</Text>
              <Text style={styles.statPillLabel}>XP</Text>
            </View>
            <View style={styles.statPill}>
              <LinearGradient colors={['#00FF9D', '#38BDF8']} style={styles.statPillIcon}>
                <MaterialCommunityIcons name="trophy" size={11} color="#FFF" />
              </LinearGradient>
              <Text style={styles.statPillNum}>{winRate}%</Text>
              <Text style={styles.statPillLabel}>{t('home.wins_label')}</Text>
            </View>
            <View style={styles.statPill}>
              <LinearGradient colors={['#00D4FF', '#38BDF8']} style={styles.statPillIcon}>
                <MaterialCommunityIcons name="sword-cross" size={11} color="#FFF" />
              </LinearGradient>
              <Text style={styles.statPillNum}>{userData?.matches_played || 0}</Text>
              <Text style={styles.statPillLabel}>{t('home.duels_label')}</Text>
            </View>
          </View>

          {/* Streak Widget */}
          <TouchableOpacity
            style={styles.streakCard}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (!hasPlayedToday) router.push('/(tabs)/play');
            }}
          >
            <LinearGradient
              colors={hasPlayedToday ? ['rgba(0,255,157,0.08)', 'rgba(0,191,255,0.04)'] : ['rgba(255,107,53,0.12)', 'rgba(255,59,48,0.06)']}
              style={styles.streakCardGradient}
            >
              <View style={styles.streakCardLeft}>
                <View style={[styles.streakFireCircle, { backgroundColor: hasPlayedToday ? 'rgba(0,255,157,0.15)' : 'rgba(255,107,53,0.2)' }]}>
                  <MaterialCommunityIcons
                    name={hasPlayedToday ? 'check-circle' : 'fire'}
                    size={24}
                    color={hasPlayedToday ? '#00FF9D' : '#FF6B35'}
                  />
                </View>
                <View style={styles.streakCardInfo}>
                  <Text style={styles.streakCardTitle}>
                    {(userData?.login_streak || 0) > 0
                      ? `${userData?.login_streak} ${t('home.streak_days')}`
                      : t('home.no_streak')}
                  </Text>
                  <Text style={styles.streakCardSub}>
                    {hasPlayedToday
                      ? t('home.streak_maintained')
                      : (userData?.login_streak || 0) > 0
                        ? t('home.play_to_keep_streak')
                        : t('home.play_to_start_streak')}
                  </Text>
                </View>
              </View>
              <View style={styles.streakCardRight}>
                <Text style={[styles.streakNum, { color: hasPlayedToday ? '#00FF9D' : '#FF6B35' }]}>
                  {userData?.login_streak || 0}
                </Text>
              </View>
            </LinearGradient>
            {/* Best login streak badge */}
            {(userData?.best_login_streak || 0) > 0 && (
              <View style={styles.bestStreakBadge}>
                <MaterialCommunityIcons name="trophy" size={10} color="#FFD700" />
                <Text style={styles.bestStreakText}>{t('home.best_streak_record')} {userData?.best_login_streak}{t('home.days_short')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ── Weekly Summary ── */}
        <WeeklySummaryWidget />

        {/* ── Daily Spin ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)} style={spinStyles.row}>
          <TouchableOpacity
            style={spinStyles.btn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowSpin(true); }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={spinAvailable ? ['rgba(138,43,226,0.25)', 'rgba(138,43,226,0.08)'] : ['rgba(30,30,50,0.6)', 'rgba(20,20,40,0.4)']}
              style={spinStyles.btnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={spinStyles.wheelEmoji}>🎡</Text>
              <View>
                <Text style={spinStyles.btnTitle}>{t('spin.btn_title')}</Text>
                <Text style={spinStyles.btnSub}>{spinAvailable ? t('spin.available') : t('spin.used')}</Text>
              </View>
              {spinAvailable && (
                <View style={spinStyles.badge}>
                  <Text style={spinStyles.badgeText}>1</Text>
                </View>
              )}
              <MaterialCommunityIcons name="chevron-right" size={18} color="#525252" style={{ marginLeft: 'auto' }} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Quick Play Button ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <TouchableOpacity
            style={styles.quickPlayBtn}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              const playedThemes: SlotTheme[] = (dailyMissions?.user_themes ?? []).map(t => ({ id: t.id, name: t.name, color: t.color }));
              const eventThemes: SlotTheme[] = socialFeedRef.current
                .filter(i => i.type === 'event' && i.theme_id && i.category_name)
                .map(i => ({ id: i.theme_id!, name: i.category_name, color: i.category_color }));
              // Deduplicated combined list for the carousel
              const allThemes = [...playedThemes];
              eventThemes.forEach(et => { if (!allThemes.find(t => t.id === et.id)) allThemes.push(et); });

              let chosen: SlotTheme | null = null;
              if (Math.random() < 0.5 && playedThemes.length > 0) {
                chosen = playedThemes[Math.floor(Math.random() * playedThemes.length)];
              } else if (eventThemes.length > 0) {
                chosen = eventThemes[Math.floor(Math.random() * eventThemes.length)];
              } else if (playedThemes.length > 0) {
                chosen = playedThemes[Math.floor(Math.random() * playedThemes.length)];
              }

              if (!chosen || allThemes.length === 0) {
                router.push('/matchmaking');
                return;
              }
              setSlotThemes(allThemes);
              setSlotChosen(chosen);
              setSlotVisible(true);
            }}
          >
            <LinearGradient
              colors={['#8A2BE2', '#00FFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.quickPlayGradient}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFF" />
                <Text style={styles.quickPlayText}>{t('home.start_duel')}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Incoming Challenges + Revenge Section ── */}
        {(incomingChallenges.length > 0 || pendingDuels.length > 0) && (
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            {/* Incoming challenges */}
            {incomingChallenges.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <LinearGradient colors={['#BF5FFF', '#8A2BE2']} style={styles.sectionIconCircle}>
                    <MaterialCommunityIcons name="sword-cross" size={12} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.sectionTitle}>{t('challenge.incoming_title')}</Text>
                  <View style={[styles.sectionBadge, { backgroundColor: '#BF5FFF' }]}>
                    <Text style={styles.sectionBadgeText}>{incomingChallenges.length}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.duelsScroll}>
                  {incomingChallenges.map((c) => (
                    <ChallengeCard
                      key={c.challenge_id}
                      challenge={c}
                      onAccept={() => handleAcceptChallenge(c)}
                      onDecline={() => handleDeclineChallenge(c.challenge_id)}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            {/* Revenge duels (recent defeats) */}
            {pendingDuels.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <LinearGradient colors={['#FF6B35', '#FF8F60']} style={styles.sectionIconCircle}>
                    <MaterialCommunityIcons name="fire" size={12} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.sectionTitle}>{t('challenge.revenge_title')}</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{pendingDuels.length}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.duelsScroll}>
                  {pendingDuels.map((duel, index) => (
                    <DuelCard key={duel.id} duel={duel} index={index} onRematch={() => handleRematch(duel)} />
                  ))}
                </ScrollView>
              </>
            )}
          </Animated.View>
        )}

        {/* ── Tournament Banner ── */}
        <TournamentBanner router={router} />

        {/* ── Challenge Suggestions ── */}
        <ChallengeSuggestions router={router} />

        {/* ── Daily Missions ── */}
        {dailyMissions && (
          <Animated.View entering={FadeInDown.delay(350).duration(500)}>
            <MissionsWidget
              data={dailyMissions}
              onDouble={handleDoubleReward}
              onReroll={handleRerollMission}
              onClaim={() => setShowThemePicker(true)}
            />
          </Animated.View>
        )}

        {/* ── Question du jour ── */}
        {dailyQuestion && !dailyQuestion.already_answered && (
          <Animated.View entering={FadeInDown.delay(370).duration(500)}>
            <View style={styles.dqCard}>
              <View style={styles.dqHeader}>
                <LinearGradient colors={['#A855F7', '#8B5CF6']} style={styles.dqIcon}>
                  <MaterialCommunityIcons name="help-circle" size={13} color="#FFF" />
                </LinearGradient>
                <Text style={styles.dqTitle}>Question du jour</Text>
                <View style={[styles.dqThemeBadge, { backgroundColor: (dailyQuestion.theme_color || '#8B5CF6') + '25' }]}>
                  <Text style={[styles.dqThemeName, { color: dailyQuestion.theme_color || '#A855F7' }]} numberOfLines={1}>
                    {dailyQuestion.theme_name}
                  </Text>
                </View>
              </View>
              <Text style={styles.dqQuestion}>{dailyQuestion.question_text}</Text>
              <View style={styles.dqOptions}>
                {(dailyQuestion.options || []).map((opt: string, idx: number) => {
                  const isChosen = dqAnswer === idx;
                  const isCorrect = dqResult && idx === dqResult.correct_option;
                  const isWrong = dqResult && isChosen && !dqResult.correct;
                  let bg = '#1A1A2E';
                  if (isCorrect) bg = '#00FF9D20';
                  if (isWrong) bg = '#FF3B5C20';
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dqOpt, { borderColor: isCorrect ? '#00FF9D' : isWrong ? '#FF3B5C' : '#333', backgroundColor: bg }]}
                      onPress={() => handleDqAnswer(idx)}
                      disabled={dqAnswer !== null}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dqOptText}>{opt}</Text>
                      {isCorrect && <MaterialCommunityIcons name="check-circle" size={14} color="#00FF9D" />}
                      {isWrong && <MaterialCommunityIcons name="close-circle" size={14} color="#FF3B5C" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {dqResult && (
                <Text style={[styles.dqFeedback, { color: dqResult.correct ? '#00FF9D' : '#FF6B35' }]}>
                  {dqResult.correct ? `Bravo ! +${dqResult.xp_earned} XP` : `Raté — +${dqResult.xp_earned} XP quand même`}
                </Text>
              )}
            </View>
          </Animated.View>
        )}
        {dailyQuestion?.already_answered && (
          <View style={styles.dqDoneCard}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#00FF9D" />
            <Text style={styles.dqDoneText}>Question du jour répondue · +{dailyQuestion.xp_earned} XP</Text>
          </View>
        )}

        {/* Slot Machine */}
        <SlotMachineOverlay
          visible={slotVisible}
          themes={slotThemes}
          chosen={slotChosen}
          onDone={() => {
            setSlotVisible(false);
            if (slotChosen) {
              router.push(`/matchmaking?category=${slotChosen.id}&themeName=${encodeURIComponent(slotChosen.name)}`);
            }
          }}
        />

        {/* Spin Wheel */}
        <SpinWheelModal
          visible={showSpin}
          onClose={(done) => {
            setShowSpin(false);
            if (done) setSpinAvailable(false);
          }}
        />

        {/* Theme Picker Modal */}
        <Modal visible={showThemePicker} transparent animationType="slide" onRequestClose={() => setShowThemePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Où envoyer les XP ?</Text>
              <Text style={styles.modalSubtitle}>Choisissez un thème pour recevoir vos récompenses</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {(dailyMissions?.user_themes ?? []).map((theme) => (
                  <TouchableOpacity
                    key={theme.id}
                    style={styles.themePickerRow}
                    onPress={() => handleClaimRewards(theme.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.themePickerDot, { backgroundColor: theme.color }]} />
                    <Text style={styles.themePickerName}>{theme.name}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#555" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowThemePicker(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Social Wall ── */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#00D4FF', '#38BDF8']} style={styles.sectionIconCircle}>
              <MaterialCommunityIcons name="earth" size={12} color="#FFF" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>{t('home.activity')}</Text>
          </View>
        </Animated.View>

        {feedError ? (
          <TouchableOpacity onPress={() => { setFeedError(false); loadFeed(); }} style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#aaa', fontSize: 14 }}>{t('home.load_error')}</Text>
          </TouchableOpacity>
        ) : socialFeed.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.emptyFeed}>
            <LinearGradient colors={['#8A2BE2', '#A855F7']} style={styles.emptyFeedCircle}>
              <MaterialCommunityIcons name="weather-night" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={styles.emptyFeedTitle}>{t('home.empty_title')}</Text>
            <Text style={styles.emptyFeedText}>
              {t('home.empty_text')}
            </Text>
          </Animated.View>
        ) : (
          <>
            {socialFeed.some(i => i.type === 'event') && (
              <View style={styles.offerHeader}>
                <MaterialCommunityIcons name="lightning-bolt" size={13} color="#FFD700" />
                <Text style={styles.offerHeaderText}>Offres x2 XP</Text>
                {offerCountdown ? (
                  <Text style={styles.offerHeaderCountdown}>dans {offerCountdown}</Text>
                ) : null}
                <TouchableOpacity style={styles.offerRefreshBtn} onPress={handleRefreshOffers} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="television-play" size={12} color="#888" />
                  <Text style={styles.offerRefreshText}>Changer (pub)</Text>
                </TouchableOpacity>
              </View>
            )}
          <FlatList
            data={socialFeed}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item, index: idx }) => {
              if (item.type === 'event') {
                return <EventCard item={item} index={idx} onActivate={handleActivateBoost} onLaunch={handleLaunchBoost} />;
              }
              if (item.type === 'record') {
                return <RecordCard item={item} index={idx} />;
              }
              if (item.type === 'community') {
                return (
                  <CommunityCard
                    item={item}
                    index={idx}
                    userId={userId || ''}
                    onLike={handleLike}
                    onComment={handleComment}
                  />
                );
              }
              return null;
            }}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={3}
          />
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
    </CosmicBackground>
  );
}

const spinStyles = StyleSheet.create({
  row: { marginHorizontal: 16, marginBottom: 12 },
  btn: { borderRadius: 14, overflow: 'hidden' },
  btnGrad: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 14, gap: 10,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)', borderRadius: 14,
  },
  wheelEmoji: { fontSize: 24 },
  btnTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  btnSub: { color: '#A3A3A3', fontSize: 11 },
  badge: {
    backgroundColor: '#FF3B30', width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // ── Greeting ──
  greetingSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  greetingLeft: {},
  greetingHi: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  greetingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A2BE2',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingRight: 10,
    paddingVertical: 5,
    paddingLeft: 4,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statPillIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statPillNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },

  // ── Section Headers ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 8,
  },
  sectionIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
  },
  sectionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  // ── Duels Scroll ──
  duelsScroll: {
    paddingLeft: 16,
    paddingRight: 4,
    gap: 12,
  },

  // ── Duel Card ──
  duelCard: {
    width: DUEL_CARD_WIDTH,
    borderRadius: GLASS.radius,
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    borderColor: GLASS.borderCyan,
    padding: 16,
    overflow: 'hidden',
  },
  duelGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 255, 255, 0.02)',
    borderRadius: GLASS.radius,
  },
  duelCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 14,
  },
  duelCatName: { fontSize: 11, fontWeight: '700' },

  duelVsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  duelPlayer: {
    alignItems: 'center',
    width: 60,
  },
  duelAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  duelAvatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  duelPlayerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#AAA',
    textAlign: 'center',
  },
  duelScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  duelScoreNum: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
  },
  vsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  duelVsText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 1,
  },
  duelResultBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  duelResultText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rematchBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  rematchGradient: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    gap: 6,
  },
  rematchText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1.5,
  },
  duelTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  duelTimeAgo: {
    fontSize: 10,
    color: '#444',
  },

  // ── Quick Play ──
  quickPlayBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: GLASS.radius,
    overflow: 'hidden',
  },
  quickPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    borderRadius: GLASS.radius,
  },
  quickPlayText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
  quickPlaySub: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },

  // ── Feed Cards ──
  feedCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: GLASS.radius,
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    borderColor: GLASS.borderCyan,
    padding: 14,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  feedIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedHeaderText: { flex: 1 },
  feedCardTitle: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  feedTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  feedCardTime: { fontSize: 11, color: '#555' },
  feedCardBody: { fontSize: 13, color: '#BBB', lineHeight: 18 },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(138, 43, 226, 0.15)',
    gap: 4,
  },
  xpBadgeText: { fontSize: 12, fontWeight: '800', color: '#8A2BE2' },

  // ── Community Card ──
  communityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  communityUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  communityAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityAvatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  communityPseudo: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  communityMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  communityCatDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  communityCatLabel: { fontSize: 11, fontWeight: '600' },
  communityTime: { fontSize: 11, color: '#555' },
  communityContent: { fontSize: 14, color: '#CCC', lineHeight: 20, marginBottom: 10 },
  communityActions: {
    flexDirection: 'row',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 10,
  },
  communityActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  communityActionCount: { fontSize: 12, fontWeight: '700', color: '#666' },

  // ── Event Card ──
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  eventIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '800' },
  eventBody: { fontSize: 12, color: '#888', marginTop: 2 },
  eventLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  eventLiveText: { fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  adBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  adBtnText: { fontSize: 11, fontWeight: '800' },

  // ── Daily Question ──
  dqCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#1A1A2E', borderRadius: 16,
    borderWidth: 1, borderColor: '#A855F730', padding: 14,
  },
  dqHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dqIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dqTitle: { fontSize: 13, fontWeight: '800', color: '#FFF', flex: 1 },
  dqThemeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  dqThemeName: { fontSize: 10, fontWeight: '700' },
  dqQuestion: { fontSize: 14, color: '#EEE', fontWeight: '600', marginBottom: 12, lineHeight: 20 },
  dqOptions: { gap: 6 },
  dqOpt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  dqOptText: { fontSize: 13, color: '#DDD', flex: 1 },
  dqFeedback: { marginTop: 10, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  dqDoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#00FF9D10', borderRadius: 12, borderWidth: 1, borderColor: '#00FF9D30',
  },
  dqDoneText: { fontSize: 12, color: '#00FF9D', fontWeight: '600' },

  // ── Offer header ──
  offerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  offerHeaderText: { fontSize: 12, color: '#FFD700', fontWeight: '700' },
  offerHeaderCountdown: { fontSize: 11, color: '#888', flex: 1 },
  offerRefreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offerRefreshText: { fontSize: 11, color: '#888' },

  // ── Theme Picker Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: '#000000AA',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1A1A2E', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  themePickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A3E',
  },
  themePickerDot: { width: 10, height: 10, borderRadius: 5 },
  themePickerName: { flex: 1, fontSize: 14, color: '#FFF', fontWeight: '600' },
  modalCancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontSize: 14, color: '#888' },

  // ── Empty Feed ──
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyFeedCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyFeedTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  emptyFeedText: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },

  // ── Streak Widget ──
  streakCard: {
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  streakCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  streakCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  streakFireCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakCardInfo: {
    flex: 1,
  },
  streakCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
  },
  streakCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  streakCardRight: {
    alignItems: 'center',
    marginLeft: 8,
  },
  streakNum: {
    fontSize: 28,
    fontWeight: '900',
  },
  bestStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bestStreakText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
  },

  // ── Challenge Card ──
  challengeCard: {
    width: DUEL_CARD_WIDTH, borderRadius: 20, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, overflow: 'hidden', marginRight: 4,
  },
  challengeCardGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%', borderRadius: 20 },
  challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  challengeInfo: { flex: 1 },
  challengePseudo: { color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  challengeVs: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  challengeThemeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  challengeThemeName: { fontSize: 11, fontWeight: '700' },
  challengeNoTheme: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontStyle: 'italic' },
  challengeExpiry: { alignItems: 'center', gap: 2 },
  challengeExpiryText: { color: '#555', fontSize: 9, fontWeight: '600' },
  challengeActions: { flexDirection: 'row', gap: 8 },
  challengeDeclineBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  challengeDeclineText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  challengeAcceptBtn: {
    flex: 2, paddingVertical: 9, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  challengeAcceptText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, Share, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { startQuickMatch } from '../../utils/quickMatch';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, FadeInDown, Easing,
} from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import UserAvatar from '../../components/UserAvatar';
import SpinWheelModal from '../../components/SpinWheelModal';
import SwordMark from '../../components/SwordMark';
import { useTabBar } from '../../contexts/TabBarContext';
import { authFetch } from '../../utils/api';
import { t, getLanguage, pluralKey } from '../../utils/i18n';
import { flushPendingScores } from '../../utils/pendingScores';
import {
  Txt, Icon, Button, IconButton, Badge, Section, ProgressBar, ListRow, Loader,
  BottomSheet, Dialog, ThemeIcon, ThemeCard, AnswerButton, EmptyState, StatCard,
  SatinSurface, ProgressRing, HaloIcon, AmbientBackdrop,
} from '../../components/ui';
import type { IconName, AnswerState } from '../../components/ui';
import { COLOR, SPACE, RADII, SIZE, BORDER, ELEVATION, GRADIENTS, ICON_SIZE, PALETTE, alpha } from '../../theme/tokens';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// ── Types ──
interface DuelItem {
  id: string;
  opponent_pseudo: string;
  opponent_id?: string | null;   // null = bot (ou serveur ancien) → « Rejouer ce thème »
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
  avatar_url?: string | null;
  avatar_frame?: string | null;
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

// Libellé de mission construit côté app (traduit, vocabulaire « duel ») ; celui du backend,
// en français en dur, ne sert que pour un type inconnu.
const MISSION_CATS = ['STV', 'CIN', 'SPO', 'GEO', 'HIS', 'SCI'];
function missionLabel(m: DailyMission): string {
  const n = { n: String(m.target) };
  switch (m.type) {
    case 'play_N': return t(pluralKey('pilot.mission.play', m.target), n);
    case 'win_N': return t(pluralKey('pilot.mission.win', m.target), n);
    case 'perfect_score': return t('pilot.mission.perfect');
    case 'send_challenge': return t('pilot.mission.send_challenge');
    case 'complete_challenge': return t('pilot.mission.complete_challenge');
    case 'play_category':
      if (m.cat && MISSION_CATS.includes(m.cat)) {
        return t(pluralKey('pilot.mission.category', m.target), { ...n, cat: t(`pilot.mission.cat_${m.cat}`) });
      }
      return m.label;
    default: return m.label;
  }
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

interface LeagueStatus {
  mmr: number; tier: string; tier_label: string; tier_color: string;
  tier_progress: number; global_rank: number;
  next_tier_label: string | null; next_tier_mmr: number | null;
  season: { name: string };
}

interface RivalInfo {
  user_id: string; pseudo: string; avatar_seed: string; avatar_url?: string;
  avatar_frame?: string; total_xp: number; xp_gap: number; level: number;
}

interface TournamentInfo {
  active: boolean; id?: string; theme_id?: string; theme_name?: string;
  end_at?: string; rank?: number | null; score?: number;
  games_remaining?: number; total_players?: number;
}

interface WeeklySummaryData {
  games_played: number;
  games_won: number;
  xp_earned: number;
  win_rate: number;
  best_theme_name: string;
  perfect_scores: number;
}

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

interface RecommendedTheme { id: string; name: string; match_count: number }

// ── XP/Level helpers (mirrors backend xp.py) ──
function xpForNextLevel(level: number): number { return 500 + Math.pow(level - 1, 2) * 10; }
function getXpLevel(xp: number): number {
  if (xp <= 0) return 0;
  let level = 1, cum = 0;
  while (level < 50) { const n = xpForNextLevel(level); if (cum + n > xp) break; cum += n; level++; }
  return level;
}
function getXpInLevel(xp: number, level: number): { current: number; needed: number; progress: number } {
  let cum = 0;
  for (let l = 1; l < (level || 1); l++) cum += xpForNextLevel(l);
  const needed = xpForNextLevel(level || 1);
  const current = Math.max(0, xp - cum);
  return { current, needed, progress: Math.min(current / Math.max(needed, 1), 1) };
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

const levelShort = () => t('profile.level_short');

// Rang de ligue : pictogramme par palier, toujours en or (rang = prestige).
const TIER_ICONS: Record<string, IconName> = {
  diamond: 'crown', gold: 'trophy', silver: 'medal', bronze: 'shield',
};

// ── Bloc de feuille : surtitre + contenu, séparé par un filet (pas de carte dans la feuille) ──
function SheetBlock({ title, right, children, first }: {
  title: string; right?: React.ReactNode; children: React.ReactNode; first?: boolean;
}) {
  return (
    <View style={[styles.sheetBlock, !first && styles.sheetBlockSep]}>
      <View style={styles.sheetBlockHead}>
        <Txt variant="overline" style={styles.flex}>{title}</Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

// ── Ligue (feuille Bonus & événements) ──
const LeagueBlock = React.memo(function LeagueBlock({ league }: { league: LeagueStatus }) {
  const icon = TIER_ICONS[league.tier] || 'shield';
  return (
    <View style={styles.rowCenter}>
      <View style={[styles.iconDisc, { backgroundColor: COLOR.tint.gold }]}>
        <Icon name={icon} size={ICON_SIZE.md} color={COLOR.reward.gold} />
      </View>
      <View style={styles.flexGap}>
        <View style={styles.rowBetween}>
          <Txt variant="cardTitle" color={COLOR.reward.gold} numberOfLines={1}>{league.tier_label}</Txt>
          <Txt variant="caption">{league.season.name}</Txt>
        </View>
        <ProgressBar value={league.tier_progress} tone="reward" height={6} />
        <Txt variant="caption">{t('pilot.league.points_value', { n: String(league.mmr) })}</Txt>
      </View>
      <View style={styles.rankBox}>
        <Txt variant="statMedium">{`#${league.global_rank}`}</Txt>
        <Txt variant="overline">{t('pilot.home.rank')}</Txt>
      </View>
    </View>
  );
});

// ── Rival ──
const RivalBlock = React.memo(function RivalBlock({ rival, onChallenge }: { rival: RivalInfo; onChallenge: () => void }) {
  return (
    <View style={styles.rowCenter}>
      <UserAvatar avatarUrl={rival.avatar_url} avatarSeed={rival.avatar_seed} pseudo={rival.pseudo} size={40} frame={rival.avatar_frame} />
      <View style={styles.flexGap}>
        <Txt variant="cardTitle" numberOfLines={1}>{rival.pseudo}</Txt>
        <Txt variant="caption">
          <Txt variant="caption" color={COLOR.player.opponent}>{rival.xp_gap.toLocaleString()}</Txt>
          {` ${t('rival.xp_behind')}`}
        </Txt>
      </View>
      <Button label={t('rival.challenge')} icon="duel" variant="secondary" size="sm" onPress={onChallenge} haptic={false} />
    </View>
  );
});

// ── Tournoi du week-end ──
const TournamentBlock = React.memo(function TournamentBlock({ info, onOpen, onPlay }: {
  info: TournamentInfo; onOpen: () => void; onPlay: () => void;
}) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!info?.end_at) return;
    const fmt = (end: string) => {
      const diff = new Date(end).getTime() - Date.now();
      if (diff <= 0) return '00:00';
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return h > 0
        ? t('pilot.tournament.hours', { h: String(h), m: m.toString().padStart(2, '0') })
        : t('pilot.tournament.minutes', { m: String(Math.max(1, m)) });
    };
    setCountdown(fmt(info.end_at));
    const iv = setInterval(() => setCountdown(fmt(info!.end_at!)), 30000);
    return () => clearInterval(iv);
  }, [info?.end_at]);

  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.rowCenter, pressed && styles.pressed]}>
      <View style={[styles.iconDisc, { backgroundColor: COLOR.tint.gold }]}>
        <Icon name="trophy" size={ICON_SIZE.md} color={COLOR.reward.gold} />
      </View>
      <View style={styles.flexGap}>
        <View style={styles.rowTight}>
          <Icon name="clock" size={14} color={COLOR.text.tertiary} />
          <Txt variant="caption">{countdown}</Txt>
        </View>
        <Txt variant="cardTitle" numberOfLines={1}>{info.theme_name}</Txt>
        {info.rank != null && (
          <Txt variant="caption">{`#${info.rank} · ${info.score} pts · ${info.total_players} ${t('tournament.players')}`}</Txt>
        )}
      </View>
      {(info.games_remaining ?? 0) > 0 && (
        <Button label={`${info.games_remaining}×`} icon="duel" size="sm" onPress={onPlay} haptic={false} />
      )}
    </Pressable>
  );
});

// ── Résumé de la semaine ──
const WeeklyBlock = React.memo(function WeeklyBlock({ summary }: { summary: WeeklySummaryData }) {
  return (
    <>
      <View style={styles.statsRow}>
        <StatCard appearance="plain" value={summary.games_played} label={t('pilot.home.week_duels')} />
        <StatCard appearance="plain" value={`${summary.win_rate}%`} label={t('pilot.home.week_wins')} tone="success" />
        <StatCard appearance="plain" value={`+${summary.xp_earned}`} label="XP" tone="reward" />
        {summary.perfect_scores > 0 && (
          <StatCard appearance="plain" value={summary.perfect_scores} label={t('pilot.home.week_perfect')} />
        )}
      </View>
      {summary.best_theme_name ? (
        <Txt variant="caption">{t('pilot.home.week_best_theme', { theme: summary.best_theme_name })}</Txt>
      ) : null}
    </>
  );
});

// ── Missions du jour ──
// Icône de mission : ce qu'il faut faire, lisible d'un coup d'œil
function missionIcon(m: DailyMission): IconName {
  switch (m.type) {
    case 'play_N': return 'duel';
    case 'win_N': return 'trophy';
    case 'perfect_score': return 'star';
    case 'send_challenge': return 'send';
    case 'complete_challenge': return 'users';
    case 'play_category': return 'compass';
    default: return 'target';
  }
}

const MissionsCard = React.memo(function MissionsCard({
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
  const hh = Math.floor(secsLeft / 3600);
  const mm = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0');
  const countdown = hh > 0 ? t('pilot.tournament.hours', { h: String(hh), m: mm }) : t('pilot.tournament.minutes', { m: String(Math.max(1, Number(mm))) });

  const totalXP = data.missions.reduce((s, m) => s + (m.completed ? m.xp : 0), 0) * data.multiplier;
  const canClaim = data.any_completed && !data.reward_claimed;

  return (
    <SatinSurface variant="card" contentStyle={styles.satinPad}>
      <View style={styles.missionList}>
        {data.missions.map((m) => {
          const pct = Math.min(m.progress / m.target, 1);
          const canReroll = !m.completed && !m.rerolled && !data.reward_claimed;
          return (
            <View key={m.id} style={styles.missionRow}>
              {/* Anneau = progression ; coche verte une fois faite */}
              <ProgressRing value={pct} tone={m.completed ? 'success' : 'action'}>
                <Icon
                  name={m.completed ? 'check' : missionIcon(m)}
                  size={ICON_SIZE.sm}
                  color={m.completed ? COLOR.status.success : COLOR.text.primary}
                />
              </ProgressRing>
              <View style={styles.missionText}>
                <Txt variant="cardTitle" color={m.completed ? COLOR.text.secondary : COLOR.text.primary} numberOfLines={2}>
                  {missionLabel(m)}
                </Txt>
                {/* Progression et récompense sur une ligne : le titre garde toute la largeur */}
                <View style={styles.rowCenter}>
                  <Txt variant="caption" color={m.completed ? COLOR.status.success : COLOR.text.tertiary}>
                    {`${m.progress} / ${m.target}`}
                  </Txt>
                  <View style={[styles.xpPill, m.completed && styles.xpPillDone]}>
                    <Txt variant="caption" color={COLOR.reward.gold}>{`+${m.xp * data.multiplier} XP`}</Txt>
                  </View>
                </View>
              </View>
              {canReroll ? (
                <IconButton icon="replay" appearance="bare" accessibilityLabel={t('pilot.home.reroll')} onPress={() => onReroll(m.id)} />
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.missionFooter}>
        <View style={styles.rowTight}>
          <Icon name="clock" size={14} color={COLOR.text.tertiary} />
          <Txt variant="caption">{t('pilot.home.missions_reset', { time: countdown })}</Txt>
        </View>

        {!data.reward_claimed && (
          <View style={styles.missionActions}>
            {canClaim && (
              <Button
                label={t('missions.claim_xp').replace('{xp}', String(totalXP))}
                size="sm"
                fullWidth
                haptic={false}
                onPress={onClaim}
              />
            )}
            {data.multiplier < 2 ? (
              <Button label={t('pilot.home.double_ad')} icon="bolt" variant="ghost" size="sm" fullWidth haptic={false} onPress={onDouble} />
            ) : (
              <View style={styles.rowTight}>
                <Icon name="bolt" size={14} color={COLOR.reward.gold} />
                <Txt variant="label" color={COLOR.reward.gold}>{t('pilot.home.double_active')}</Txt>
              </View>
            )}
          </View>
        )}

        {data.reward_claimed && (
          <View style={styles.rowTight}>
            <Icon name="success" size={16} color={COLOR.status.success} />
            <Txt variant="caption" color={COLOR.status.success}>{t('missions.claimed')}</Txt>
          </View>
        )}
      </View>
    </SatinSurface>
  );
});

// ── Défi reçu (événement entrant : liseré corail) ──
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
    <SatinSurface variant="card" warm="none" accent="event" contentStyle={styles.satinPad}>
      <View style={styles.rowCenter}>
        <UserAvatar avatarUrl={challenge.challenger_avatar_url} avatarSeed={challenge.challenger_avatar_seed} pseudo={challenge.challenger_pseudo} size={40} />
        <View style={styles.flexGap}>
          <Txt variant="cardTitle" numberOfLines={1}>{challenge.challenger_pseudo}</Txt>
          <Txt variant="caption" numberOfLines={1}>
            {`${t('challenge.vs')} · `}
            <Txt variant="caption" color={COLOR.text.secondary}>{challenge.theme_name || t('challenge.no_theme')}</Txt>
          </Txt>
        </View>
        <View style={styles.rowTight}>
          <Icon name="clock" size={14} color={COLOR.text.tertiary} />
          <Txt variant="caption">{expiresIn(challenge.expires_at)}</Txt>
        </View>
      </View>
      <View style={styles.challengeActions}>
        <Button label={t('challenge.decline')} variant="ghost" size="sm" onPress={onDecline} haptic={false} style={styles.flex} />
        <Button label={t('challenge.accept')} icon="duel" size="sm" onPress={onAccept} haptic={false} style={styles.flex} />
      </View>
    </SatinSurface>
  );
});

// ── Revanche (défaite récente) : une ligne par duel, dans une seule carte ──
const RevengeRow = React.memo(function RevengeRow({ duel, onRematch }: { duel: DuelItem; onRematch: () => void }) {
  return (
    <ListRow
      leading={<UserAvatar avatarUrl={duel.opponent_avatar_url} avatarSeed={duel.opponent_avatar_seed} pseudo={duel.opponent_pseudo} size={40} />}
      title={duel.opponent_pseudo}
      subtitle={`${duel.category_name} · ${duel.player_score}–${duel.opponent_score} · ${timeAgo(duel.created_at)}`}
      trailing={
        <Button
          label={duel.opponent_id ? t('home.rematch_label') : t('common.replay_theme')}
          icon={duel.opponent_id ? 'duel' : 'replay'}
          variant="secondary"
          size="sm"
          onPress={onRematch}
          haptic={false}
        />
      }
    />
  );
});

// ── Fil : record (score parfait) ──
const RecordRow = React.memo(function RecordRow({ item }: { item: FeedItem }) {
  return (
    <View style={styles.feedItem}>
      <View style={styles.rowCenter}>
        <View style={[styles.iconDisc, { backgroundColor: COLOR.tint.gold }]}>
          <Icon name="trophy" size={ICON_SIZE.md} color={COLOR.reward.gold} />
        </View>
        <View style={styles.flexGap}>
          <Txt variant="cardTitle">{t('home.perfect_score')}</Txt>
          <Txt variant="caption">{timeAgo(item.created_at)}</Txt>
        </View>
        {item.xp_earned ? (
          <Txt variant="label" color={COLOR.reward.gold}>{`+${item.xp_earned} XP`}</Txt>
        ) : null}
      </View>
      <Txt variant="bodySmall">{`@${item.user_pseudo} ${t('home.perfect_score_body')} ${item.category_name} !`}</Txt>
    </View>
  );
});

// ── Fil : publication de la communauté ──
const CommunityRow = React.memo(function CommunityRow({ item, onLike, onComment }: {
  item: FeedItem; onLike: (postId: string) => void; onComment: (item: FeedItem) => void;
}) {
  const liked = !!item.is_liked;
  return (
    <View style={styles.feedItem}>
      <View style={styles.rowCenter}>
        <UserAvatar avatarUrl={item.user_avatar_url} avatarSeed={item.user_avatar_seed || ''} pseudo={item.user_pseudo || ''} size={36} />
        <View style={styles.flexGap}>
          <Txt variant="cardTitle" numberOfLines={1}>{item.user_pseudo}</Txt>
          <Txt variant="caption" numberOfLines={1}>{`${item.category_name} · ${timeAgo(item.created_at)}`}</Txt>
        </View>
      </View>
      <Txt variant="body">{item.content}</Txt>
      <View style={styles.feedActions}>
        <Pressable
          style={({ pressed }) => [styles.feedAction, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (item.post_id) onLike(item.post_id);
          }}
        >
          <Icon name="heart" size={18} color={liked ? COLOR.action.primary : COLOR.text.tertiary} />
          <Txt variant="caption" color={liked ? COLOR.action.primary : COLOR.text.tertiary}>{item.likes_count || 0}</Txt>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.feedAction, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onComment(item);
          }}
        >
          <Icon name="message" size={18} color={COLOR.text.tertiary} />
          <Txt variant="caption">{item.comments_count || 0}</Txt>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.feedAction, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            try {
              await Share.share({ message: `${item.user_pseudo} ${t('home.share_on_duelo')} "${item.content?.slice(0, 100)}"` });
            } catch (e) { console.error(e); }
          }}
        >
          <Icon name="share" size={18} color={COLOR.text.tertiary} />
        </Pressable>
      </View>
    </View>
  );
});

// ── Offre XP ×2 (événement du fil, rangée dans la feuille Bonus) ──
const OfferRow = React.memo(function OfferRow({ item, onActivate, onLaunch }: {
  item: FeedItem;
  onActivate: (themeId: string) => Promise<string | null>;
  onLaunch: (themeId: string, themeName: string) => void;
}) {
  const [countdown, setCountdown] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(item.expires_at || null);
  const [isActive, setIsActive] = useState(item.is_active || false);
  const [loading, setLoading] = useState(false);
  const [ask, setAsk] = useState(false);

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
    setAsk(true);
  };

  return (
    <>
    <Pressable onPress={handleCardPress} accessibilityRole="button" style={({ pressed }) => [styles.offerRow, pressed && styles.pressed]}>
      <View style={[styles.iconDisc, { backgroundColor: COLOR.tint.gold }]}>
        <Icon name="bolt" size={ICON_SIZE.md} color={COLOR.reward.gold} />
      </View>
      <View style={styles.flexGap}>
        <Txt variant="cardTitle" numberOfLines={1}>{t('pilot.home.offer_title', { theme: item.category_name })}</Txt>
        {isActive && countdown ? (
          <View style={styles.rowTight}>
            <Icon name="timer" size={14} color={COLOR.status.success} />
            <Txt variant="caption" color={COLOR.status.success}>{countdown}</Txt>
          </View>
        ) : (
          <Txt variant="caption">{isActive ? t('pilot.home.offer_active') : t('pilot.home.offer_watch')}</Txt>
        )}
      </View>
      {/* Enveloppe : le Badge s'aligne en haut (alignSelf flex-start) ; ici on le veut centré dans la ligne */}
      <View>
        {isActive ? (
          <Badge label={t('pilot.home.offer_badge_active')} tone="success" />
        ) : (
          <Badge label={loading ? '…' : t('pilot.home.offer_ad')} tone="neutral" />
        )}
      </View>
    </Pressable>
    {/* Dialog rendu dans la feuille Bonus (modal imbriqué) : Alert.alert à boutons ne s'affiche pas sur le web */}
    <Dialog
      visible={ask}
      onClose={() => setAsk(false)}
      icon="tv"
      tone="reward"
      title={t('pilot.home.offer_alert_title')}
      message={t('pilot.home.offer_alert_body', { theme: item.category_name })}
      actions={
        <>
          <Button label={t('pilot.home.offer_alert_watch')} icon="tv" fullWidth haptic={false} onPress={() => { setAsk(false); watchAdAndActivate(); }} />
          <Button label={t('pilot.home.offer_alert_later')} variant="ghost" fullWidth haptic={false} onPress={() => setAsk(false)} />
        </>
      }
    />
    </>
  );
});

// ── Décor du bloc Duel rapide : treillis de losanges + épées en filigrane, ton sur ton ──
// Purement décoratif (pointerEvents none, masqué à l'accessibilité). Aucune animation :
// l'Accueil reste plus calme que le jeu, le CTA jaune reste l'unique point focal.
// ── Machine à sous (tirage du thème du Duel rapide) ──
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
          <Txt variant="overline" color={COLOR.text.secondary}>{t('pilot.home.slot_title')}</Txt>
          <View style={slotS.viewport}>
            <Animated.View style={[slotS.row, rowStyle]}>
              {list.map((theme, idx) => {
                const isChosen = idx === chosenIndex;
                return (
                  <View key={`${theme.id}-${idx}`} style={[slotS.card, isChosen && slotS.cardChosen]}>
                    <ThemeIcon themeName={theme.name} size={40} />
                    <Txt variant="caption" color={COLOR.text.primary} align="center" numberOfLines={2}>{theme.name}</Txt>
                  </View>
                );
              })}
            </Animated.View>
            <LinearGradient colors={GRADIENTS.fadeTop.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={slotS.fadeLeft} pointerEvents="none" />
            <LinearGradient colors={GRADIENTS.fadeRight.colors} start={GRADIENTS.fadeRight.start} end={GRADIENTS.fadeRight.end} style={slotS.fadeRight} pointerEvents="none" />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
});

const slotS = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: COLOR.overlay.scrim,
    justifyContent: 'center', alignItems: 'center',
  },
  box: {
    alignItems: 'center', gap: SPACE.lg,
    paddingVertical: SPACE.xl, paddingHorizontal: SPACE.lg,
    backgroundColor: COLOR.bg.primary, borderRadius: RADII.xl,
    borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
    ...ELEVATION.e3,
  },
  viewport: { width: SLOT_ITEM_W * 3, height: 116, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', height: 116, gap: SLOT_GAP },
  card: {
    width: SLOT_CARD_W, height: 108, borderRadius: RADII.lg,
    alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.xs,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
  },
  // Le thème tiré = la sélection : liseré jaune
  cardChosen: { borderWidth: BORDER.strong, borderColor: COLOR.border.active },
  fadeLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SLOT_ITEM_W },
  fadeRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: SLOT_ITEM_W },
});

// Nombre de défis / revanches visibles avant « Voir plus »
const MOVES_PREVIEW = 2;

// ── Main Screen ──
export default function AccueilScreen() {
  const router = useRouter();
  const { onScroll: onTabScroll } = useTabBar();
  // Très petits écrans (320 px) : hero un peu plus serré pour que le CTA tienne sur une ligne
  const { width: screenW } = useWindowDimensions();
  const compact = screenW < 360;
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
  // Blocs secondaires : chargés à l'ouverture de l'écran, affichés dans la feuille « Bonus & événements »
  const [league, setLeague] = useState<LeagueStatus | null>(null);
  const [rival, setRival] = useState<RivalInfo | null>(null);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummaryData | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedPlayer[]>([]);
  const [recommended, setRecommended] = useState<RecommendedTheme[]>([]);
  const [sheet, setSheet] = useState<'bonus' | 'activity' | null>(null);
  const [showAllMoves, setShowAllMoves] = useState(false);

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

  // Ligue, rival, tournoi, résumé hebdo, suggestions (mêmes appels qu'avant, une fois à l'ouverture)
  useEffect(() => {
    authFetch(`${API_URL}/api/league/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setLeague(d))
      .catch(() => {});
    authFetch(`${API_URL}/api/social/my-rival`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.rival && setRival(d.rival))
      .catch(() => {});
    authFetch(`${API_URL}/api/tournaments/current`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setTournament(d))
      .catch(() => {});
    authFetch(`${API_URL}/api/game/weekly-summary`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.games_played > 0) setWeekly(data);
      })
      .catch(() => {});
    authFetch(`${API_URL}/api/social/challenge-suggestions`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, []);

  // « Recommandé pour toi » : tendances × affinité du joueur (même source que le Duel rapide).
  // Lecture seule ; le carrousel est masqué si l'appel échoue ou ne renvoie rien.
  useEffect(() => {
    (async () => {
      try {
        const uid = await AsyncStorage.getItem('duelo_user_id');
        const lang = getLanguage();
        const params = [uid ? `user_id=${uid}` : '', lang && lang !== 'fr' ? `lang=${lang}` : ''].filter(Boolean).join('&');
        const res = await fetch(`${API_URL}/api/themes/trending${params ? `?${params}` : ''}`);
        if (!res.ok) return;
        const data = await res.json();
        setRecommended((data.trending || []).slice(0, 6));
      } catch { /* carrousel masqué */ }
    })();
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
      // Même format que les missions et le tournoi : « 2 h 05 », « 25 min »
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      setOfferCountdown(h > 0
        ? t('pilot.tournament.hours', { h: String(h), m: String(m).padStart(2, '0') })
        : t('pilot.tournament.minutes', { m: String(Math.max(1, m + (secs % 60 > 0 ? 1 : 0))) }));
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

  // Duel rapide : machine à sous sur les thèmes joués / en événement, sinon Quick Match commun.
  const handleQuickDuel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const playedThemes: SlotTheme[] = (dailyMissions?.user_themes ?? []).map(t => ({ id: t.id, name: t.name, color: t.color }));
    const eventThemes: SlotTheme[] = socialFeedRef.current
      .filter(i => i.type === 'event' && i.theme_id && i.category_name)
      .map(i => ({ id: i.theme_id!, name: i.category_name, color: i.category_color }));
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
      // Nouveau joueur (aucun thème joué ni événement) : même Quick Match que l'onglet Jouer.
      startQuickMatch(router);
      return;
    }
    setSlotThemes(allThemes);
    setSlotChosen(chosen);
    setSlotVisible(true);
  }, [dailyMissions, router]);

  // « Rejoue » : relance un duel sur un thème déjà joué (même route que « Rejouer ce thème »).
  const handleReplayTheme = useCallback((theme: { id: string; name: string }) => {
    router.push(`/matchmaking?category=${theme.id}&themeName=${encodeURIComponent(theme.name)}`);
  }, [router]);

  // Revanche = vrai défi contre le même joueur. Contre un bot (pas d'opponent_id),
  // le bouton s'appelle « Rejouer ce thème » et lance un duel sur le thème.
  const handleRematch = useCallback((duel: DuelItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (duel.opponent_id) {
      router.push(`/player-profile?id=${duel.opponent_id}&challenge=1&themeId=${duel.category}&themeName=${encodeURIComponent(duel.category_name || '')}` as any);
    } else {
      router.push(`/matchmaking?category=${duel.category}&themeName=${encodeURIComponent(duel.category_name || '')}`);
    }
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
        const data = await res.json().catch(() => ({}));
        setIncomingChallenges(prev => prev.filter(c => c.challenge_id !== challenge.challenge_id));
        // Le serveur ouvre une salle privée et prévient l'expéditeur (challenge_ready) : on la
        // rejoint pour jouer EN DIRECT, comme depuis la pop-up. Partir en mode différé laissait
        // l'expéditeur bloqué sur la carte du matchmaking pendant qu'on avait les questions.
        if (data.room_id && challenge.theme_id) {
          router.push(
            `/matchmaking?room_id=${data.room_id}&category=${challenge.theme_id}&challenge=true` +
            `&opponentPseudo=${encodeURIComponent(challenge.challenger_pseudo)}` +
            `&themeName=${encodeURIComponent(challenge.theme_name || '')}` as any
          );
        } else if (challenge.theme_id) {
          // Play in reveal mode: see Player A's answers revealed after each question
          router.push(
            `/game?category=${challenge.theme_id}&asyncMode=reveal` +
            `&opponentPseudo=${encodeURIComponent(challenge.challenger_pseudo)}` +
            `&opponentSeed=${encodeURIComponent(challenge.challenger_avatar_seed || '')}` +
            `&challenge_id=${challenge.challenge_id}` as any
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
      setSheet(null);
      router.push(`/category-detail?id=${themeId}`);
    }
  }, [router]);

  // Les feuilles sont des Modal : on les ferme avant de naviguer ou d'ouvrir une autre modale.
  const closeSheetThen = useCallback((fn: () => void, delay = 0) => {
    setSheet(null);
    if (delay > 0) setTimeout(fn, delay); else fn();
  }, []);

  const offers = useMemo(() => socialFeed.filter(i => i.type === 'event'), [socialFeed]);
  const feedItems = useMemo(() => socialFeed.filter(i => i.type !== 'event'), [socialFeed]);
  const replayThemes = (dailyMissions?.user_themes ?? []).slice(0, 3);
  const dqPending = !!dailyQuestion && !dailyQuestion.already_answered && !dqResult;
  const bonusCount = (spinAvailable ? 1 : 0) + (dqPending ? 1 : 0);
  const hasMoves = incomingChallenges.length > 0 || pendingDuels.length > 0;
  const shownChallenges = showAllMoves ? incomingChallenges : incomingChallenges.slice(0, MOVES_PREVIEW);
  const shownDuels = showAllMoves ? pendingDuels : pendingDuels.slice(0, MOVES_PREVIEW);
  const hiddenMoves = (incomingChallenges.length - shownChallenges.length) + (pendingDuels.length - shownDuels.length);
  const canExpandMoves = incomingChallenges.length > MOVES_PREVIEW || pendingDuels.length > MOVES_PREVIEW;

  if (loading) {
    return (
      <View style={styles.container}>
        <Loader fill />
      </View>
    );
  }

  const lvl = userData ? getXpLevel(userData.total_xp) : 0;
  const xp = userData ? getXpInLevel(userData.total_xp, lvl) : null;
  const streak = userData?.login_streak || 0;

  return (
    <View style={styles.container}>
      <AmbientBackdrop />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onTabScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLOR.text.primary}
            colors={[COLOR.action.primary]}
            progressBackgroundColor={COLOR.surface.card}
          />
        }
      >
        {/* ── 1. En-tête compact : salut, titre (or), niveau ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.greeting}>
          <View style={styles.flexGap}>
            {/* Pseudo long : réduit puis tronqué ; le drapeau reste toujours visible */}
            <View style={styles.rowTight}>
              <Txt variant="h2" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
                {`${t('home.greeting')} ${userData?.pseudo || t('home.player')}`}
              </Txt>
              {userData?.country_flag ? <Txt variant="h2">{userData.country_flag}</Txt> : null}
            </View>
            <View style={styles.rowTight}>
              <Icon name="crown" size={14} color={COLOR.reward.gold} />
              <Txt variant="label" color={COLOR.reward.gold} numberOfLines={1}>{userData?.selected_title || t('home.novice')}</Txt>
            </View>
          </View>
          {userData ? (
            <UserAvatar
              avatarUrl={userData.avatar_url}
              avatarSeed={userData.avatar_seed}
              pseudo={userData.pseudo}
              frame={userData.avatar_frame}
              size={52}
            />
          ) : null}
        </Animated.View>

        {feedError ? (
          <SatinSurface variant="card" warm="none" contentStyle={styles.satinPad} onPress={() => { setFeedError(false); loadFeed(); }}>
            <View style={styles.rowCenter}>
              <Icon name="error" size={ICON_SIZE.md} color={COLOR.status.error} />
              <Txt variant="bodySmall" style={styles.flex}>{t('home.load_error')}</Txt>
              <Icon name="replay" size={ICON_SIZE.md} color={COLOR.text.secondary} />
            </View>
          </SatinSurface>
        ) : null}

        {/* ── 2. HERO Duel rapide : un seul CTA jaune ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <SatinSurface halo contentStyle={[styles.hero, compact && styles.heroCompact]}>
            <View style={styles.heroHead}>
              <SwordMark size={compact ? 36 : 48} color={COLOR.text.primary} />
              <View style={styles.flexGap}>
                <Txt variant="overline" color={COLOR.text.secondary}>{t('pilot.home.hero_overline')}</Txt>
                <Txt variant="h1">{t('pilot.home.hero_title')}</Txt>
              </View>
            </View>
            <Txt variant="bodySmall">{t('pilot.home.hero_subtitle')}</Txt>
            <Button
              label={t('challenge.find_opponent')}
              icon={compact ? undefined : 'duel'}
              size="lg"
              fullWidth
              style={compact ? styles.heroCtaCompact : undefined}
              haptic={false}
              onPress={handleQuickDuel}
              testID="home-quick-duel"
            />
          </SatinSurface>
        </Animated.View>

        {/* ── 3. À toi de jouer : défis reçus + revanches (conditionnel) ── */}
        {hasMoves && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <Section title={t('pilot.home.your_move')}>
              {shownChallenges.map((c) => (
                <ChallengeCard
                  key={c.challenge_id}
                  challenge={c}
                  onAccept={() => handleAcceptChallenge(c)}
                  onDecline={() => handleDeclineChallenge(c.challenge_id)}
                />
              ))}
              {shownDuels.length > 0 && (
                <SatinSurface variant="card" contentStyle={[styles.satinPad, styles.revengeCard]}>
                  <Txt variant="overline">{t('challenge.revenge_title')}</Txt>
                  {shownDuels.map((duel) => (
                    <RevengeRow key={duel.id} duel={duel} onRematch={() => handleRematch(duel)} />
                  ))}
                </SatinSurface>
              )}
              {canExpandMoves ? (
                <Button
                  label={showAllMoves ? t('pilot.home.show_less') : t('pilot.home.show_more', { n: String(hiddenMoves) })}
                  variant="ghost"
                  size="sm"
                  icon={showAllMoves ? undefined : 'chevronDown'}
                  haptic={false}
                  onPress={() => setShowAllMoves(v => !v)}
                />
              ) : null}
            </Section>
          </Animated.View>
        )}

        {/* ── 3 bis. Rejoue tes thèmes : pictogrammes SKILKI uniquement ── */}
        {replayThemes.length > 0 && (
          <Animated.View entering={FadeInDown.delay(140).duration(400)}>
            <Section title={t('pilot.home.replay_title')}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
              >
                {replayThemes.map((th, i) => (
                  <SatinSurface
                    key={th.id}
                    variant="card"
                    warm={i % 2 === 0 ? 'tr-bl' : 'tr'}
                    onPress={() => handleReplayTheme(th)}
                    contentStyle={styles.replayCard}
                    accessibilityLabel={`${t('pilot.home.replay_action')} : ${th.name}`}
                  >
                    <ThemeIcon themeId={th.id} themeName={th.name} size={44} />
                    <Txt variant="label" color={COLOR.text.primary} numberOfLines={2} style={styles.replayName}>{th.name}</Txt>
                    <View style={styles.rowTight}>
                      <Icon name="replay" size={14} color={COLOR.action.primary} />
                      <Txt variant="caption" color={COLOR.action.primary}>{t('pilot.home.replay_action')}</Txt>
                    </View>
                  </SatinSurface>
                ))}
              </ScrollView>
            </Section>
          </Animated.View>
        )}

        {/* ── 4. Progression + série : une seule carte ── */}
        {userData && xp ? (
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <SatinSurface variant="card" contentStyle={styles.progressCard}>
              {/* Niveau (médaille or) → XP → série : du plus durable au plus quotidien */}
              <View style={styles.levelRow}>
                <View style={styles.levelMedal} accessibilityLabel={`${levelShort()} ${lvl}`}>
                  <Txt variant="overline" color={COLOR.reward.gold}>{levelShort()}</Txt>
                  <Txt variant="statMedium">{lvl}</Txt>
                </View>
                <View style={styles.levelBody}>
                  <Txt variant="cardTitle" color={COLOR.reward.gold} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {`${xp.current.toLocaleString()} / ${xp.needed.toLocaleString()} XP`}
                  </Txt>
                  <ProgressBar value={xp.progress} tone="action" height={10} sheen />
                  <Txt variant="caption">
                    {`${Math.max(0, xp.needed - xp.current).toLocaleString()} ${t('home.xp_to_level')} ${Math.min(lvl + 1, 50)}`}
                  </Txt>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.streakRow, pressed && styles.pressed]}
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (!hasPlayedToday) router.push('/(tabs)/play');
                }}
              >
                <HaloIcon name="flame" color={streak > 0 ? COLOR.accent.warm : COLOR.text.tertiary} size={SIZE.buttonSm} />
                <View style={styles.flexGap}>
                  <Txt variant="cardTitle">
                    {streak > 0 ? t(streak === 1 ? 'pilot.home.streak_one' : 'pilot.home.streak_many', { n: String(streak) }) : t('home.no_streak')}
                  </Txt>
                  <Txt variant="caption" color={hasPlayedToday ? COLOR.status.success : COLOR.text.tertiary}>
                    {hasPlayedToday
                      ? t('home.streak_maintained')
                      : streak > 0
                        ? t('home.play_to_keep_streak')
                        : t('home.play_to_start_streak')}
                  </Txt>
                </View>
                {(userData.best_login_streak || 0) > 0 ? (
                  <View style={styles.rowTight}>
                    <Icon name="trophy" size={14} color={COLOR.reward.gold} />
                    <Txt variant="caption">{`${t('home.best_streak_record')} ${userData.best_login_streak}${t('home.days_short')}`}</Txt>
                  </View>
                ) : null}
              </Pressable>
            </SatinSurface>
          </Animated.View>
        ) : null}

        {/* ── 5. Missions du jour ── */}
        {dailyMissions && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Section title={t('missions.day_title')}>
              <MissionsCard
                data={dailyMissions}
                onDouble={handleDoubleReward}
                onReroll={handleRerollMission}
                onClaim={() => setShowThemePicker(true)}
              />
            </Section>
          </Animated.View>
        )}

        {/* ── 6. Recommandé pour toi : le seul carrousel de l'écran ── */}
        {recommended.length > 0 && (
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <Section title={t('pilot.home.recommended')}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
              >
                {recommended.map((th, i) => (
                  <ThemeCard
                    key={th.id}
                    finish="satin"
                    warm={i % 2 === 0 ? 'tr-bl' : 'tr'}
                    name={th.name}
                    themeId={th.id}
                    meta={th.match_count > 0 ? t(pluralKey('pilot.home.duels', th.match_count), { n: String(th.match_count) }) : undefined}
                    onPress={() => router.push(`/category-detail?id=${th.id}`)}
                  />
                ))}
              </ScrollView>
            </Section>
          </Animated.View>
        )}

        {/* ── Rangée discrète : bonus & événements, activité de la communauté ── */}
        <SatinSurface variant="card" warm="none" contentStyle={styles.moreCard}>
          <ListRow
            leadingIcon="gift"
            title={t('pilot.home.bonus_row')}
            subtitle={spinAvailable ? t('spin.available') : t('pilot.home.bonus_sub')}
            trailing={bonusCount > 0 ? <Badge count={bonusCount} /> : undefined}
            chevron
            onPress={() => setSheet('bonus')}
            style={styles.moreRow}
            testID="home-bonus-row"
          />
          <View style={styles.hairline} />
          <ListRow
            leadingIcon="users"
            title={t('pilot.home.activity_row')}
            subtitle={t('pilot.home.activity_sub')}
            chevron
            onPress={() => setSheet('activity')}
            style={styles.moreRow}
            testID="home-activity-row"
          />
        </SatinSurface>
      </ScrollView>

      {/* ── Feuille « Bonus & événements » ── */}
      <BottomSheet visible={sheet === 'bonus'} onClose={() => setSheet(null)} title={t('pilot.home.bonus_row')}>
        <SheetBlock title={t('spin.btn_title')} first>
          <ListRow
            leadingIcon="sparkles"
            title={t('spin.btn_title')}
            subtitle={spinAvailable ? t('spin.available') : t('spin.used')}
            trailing={spinAvailable ? <Badge count={1} /> : undefined}
            chevron
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              closeSheetThen(() => setShowSpin(true), 400);
            }}
          />
        </SheetBlock>

        {dailyQuestion && !dailyQuestion.already_answered && (
          <SheetBlock
            title={t('pilot.home.daily_question')}
            right={dailyQuestion.theme_name ? <Txt variant="caption" numberOfLines={1}>{dailyQuestion.theme_name}</Txt> : undefined}
          >
            <Txt variant="body">{dailyQuestion.question_text}</Txt>
            <View style={styles.dqOptions}>
              {(dailyQuestion.options || []).map((opt: string, idx: number) => {
                const isChosen = dqAnswer === idx;
                const isCorrect = dqResult && idx === dqResult.correct_option;
                const isWrong = dqResult && isChosen && !dqResult.correct;
                let state: AnswerState = 'idle';
                if (dqResult) state = isCorrect ? 'correct' : isWrong ? 'wrong' : 'dimmed';
                else if (isChosen) state = 'selected';
                return (
                  <AnswerButton
                    key={idx}
                    letter={String.fromCharCode(65 + idx)}
                    text={opt}
                    state={state}
                    onPress={() => handleDqAnswer(idx)}
                    disabled={dqAnswer !== null}
                  />
                );
              })}
            </View>
            {dqResult && (
              <Txt variant="label" color={dqResult.correct ? COLOR.status.success : COLOR.text.secondary}>
                {dqResult.correct
                  ? t('pilot.home.dq_correct', { xp: String(dqResult.xp_earned) })
                  : t('pilot.home.dq_wrong', { xp: String(dqResult.xp_earned) })}
              </Txt>
            )}
          </SheetBlock>
        )}
        {dailyQuestion?.already_answered && (
          <SheetBlock title={t('pilot.home.daily_question')}>
            <View style={styles.rowTight}>
              <Icon name="success" size={16} color={COLOR.status.success} />
              <Txt variant="bodySmall">{t('pilot.home.dq_done', { xp: String(dailyQuestion.xp_earned) })}</Txt>
            </View>
          </SheetBlock>
        )}

        {offers.length > 0 && (
          <SheetBlock
            title={t('pilot.home.offers_title')}
            right={offerCountdown ? <Txt variant="caption">{t('pilot.home.offers_next', { time: offerCountdown })}</Txt> : undefined}
          >
            {offers.map(item => (
              <OfferRow
                key={item.id}
                item={item}
                onActivate={handleActivateBoost}
                onLaunch={(id, name) => closeSheetThen(() => handleLaunchBoost(id, name))}
              />
            ))}
            <Button label={t('pilot.home.offers_change')} icon="replay" variant="ghost" size="sm" haptic={false} onPress={handleRefreshOffers} />
          </SheetBlock>
        )}

        {(league || rival || tournament?.active) ? (
          <SheetBlock title={t('home.competition_section')}>
            {league ? <LeagueBlock league={league} /> : null}
            {rival ? (
              <RivalBlock
                rival={rival}
                onChallenge={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // Vrai défi nominatif : la fiche du rival ouvre la fenêtre de défi.
                  closeSheetThen(() => router.push(`/player-profile?id=${rival.user_id}&challenge=1` as any));
                }}
              />
            ) : null}
            {tournament?.active ? (
              <TournamentBlock
                info={tournament}
                onOpen={() => closeSheetThen(() => router.push(`/tournament?tournamentId=${tournament.id}`))}
                onPlay={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  closeSheetThen(() => router.push(`/matchmaking?category=${tournament.theme_id}&themeName=${encodeURIComponent(tournament.theme_name || '')}`));
                }}
              />
            ) : null}
          </SheetBlock>
        ) : null}

        {suggestions.length > 0 && (
          <SheetBlock title={t('home.suggestions_title')}>
            {suggestions.map(s => (
              <ListRow
                key={s.user_id}
                leading={<UserAvatar avatarUrl={s.avatar_url} avatarSeed={s.avatar_seed} pseudo={s.pseudo} size={40} />}
                title={s.pseudo}
                subtitle={`${levelShort()} ${s.level}${s.common_theme_name ? ` · ${s.common_theme_name}` : ''}`}
                trailing={
                  <Button
                    label={t('home.challenge_btn')}
                    icon="duel"
                    variant="secondary"
                    size="sm"
                    haptic={false}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      // Vrai défi nominatif, thème commun présélectionné s'il existe.
                      const theme = s.common_theme_id
                        ? `&themeId=${s.common_theme_id}&themeName=${encodeURIComponent(s.common_theme_name || '')}`
                        : '';
                      closeSheetThen(() => router.push(`/player-profile?id=${s.user_id}&challenge=1${theme}` as any));
                    }}
                  />
                }
              />
            ))}
          </SheetBlock>
        )}

        {weekly ? (
          <SheetBlock title={t('pilot.home.week_title')}>
            <WeeklyBlock summary={weekly} />
          </SheetBlock>
        ) : null}
      </BottomSheet>

      {/* ── Feuille « Activité de la communauté » (fil social de l'Accueil) ── */}
      <BottomSheet visible={sheet === 'activity'} onClose={() => setSheet(null)} title={t('pilot.home.activity_row')}>
        {feedError ? (
          <ListRow
            leadingIcon="error"
            title={t('home.load_error')}
            onPress={() => { setFeedError(false); loadFeed(); }}
          />
        ) : feedItems.length === 0 ? (
          <EmptyState
            icon="users"
            title={t('home.empty_title')}
            message={t('home.empty_text')}
            actionLabel={t('challenge.find_opponent')}
            onAction={() => closeSheetThen(() => startQuickMatch(router))}
          />
        ) : (
          feedItems.map((item, idx) => (
            <View key={item.id} style={idx > 0 ? styles.feedSep : undefined}>
              {item.type === 'record' ? (
                <RecordRow item={item} />
              ) : (
                <CommunityRow item={item} onLike={handleLike} onComment={handleComment} />
              )}
            </View>
          ))
        )}
      </BottomSheet>

      {/* Machine à sous du Duel rapide */}
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

      {/* Roue quotidienne */}
      <SpinWheelModal
        visible={showSpin}
        onClose={(done) => {
          setShowSpin(false);
          if (done) setSpinAvailable(false);
        }}
      />

      {/* Choix du thème qui reçoit les XP des missions */}
      <BottomSheet
        visible={showThemePicker}
        onClose={() => setShowThemePicker(false)}
        title={t('pilot.home.claim_title')}
        subtitle={t('pilot.home.claim_subtitle')}
        footer={<Button label={t('common.cancel')} variant="ghost" fullWidth haptic={false} onPress={() => setShowThemePicker(false)} />}
      >
        {(dailyMissions?.user_themes ?? []).map((theme) => (
          <ListRow
            key={theme.id}
            leading={<ThemeIcon themeName={theme.name} size={40} />}
            title={theme.name}
            chevron
            onPress={() => handleClaimRewards(theme.id)}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const MEDAL = SIZE.buttonLg + SPACE.sm; // médaille de niveau : 64

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { flex: 1 },
  // Bas de page : place pour la tab bar flottante
  scrollContent: {
    paddingHorizontal: SPACE.screenX,
    paddingTop: SPACE.lg,
    paddingBottom: SIZE.tabBar + SPACE.giant,
    gap: SPACE.xxl,
  },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  flexGap: { flex: 1, gap: SPACE.xs },
  pressed: { opacity: 0.7 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rowTight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  iconDisc: {
    width: SIZE.buttonSm, height: SIZE.buttonSm, borderRadius: SIZE.buttonSm / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  hairline: { height: BORDER.hair, backgroundColor: COLOR.border.subtle, marginHorizontal: SPACE.cardPad },

  // ── 1. En-tête ──
  greeting: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },

  // ── 2. Hero (surface satinée : components/ui/SatinSurface) ──
  hero: { padding: SPACE.xl, gap: SPACE.lg },
  heroCompact: { padding: SPACE.lg },
  heroCtaCompact: { paddingHorizontal: SPACE.md },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },

  // ── 3 bis. Rejoue tes thèmes ──
  replayCard: { width: 128 - 2 * BORDER.hair, gap: SPACE.sm, padding: SPACE.md },
  replayName: { minHeight: 32 },

  // ── 3. À toi de jouer ──
  challengeActions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  // Cartes satinées : même padding que Card
  satinPad: { padding: SPACE.cardPad },
  revengeCard: { paddingBottom: SPACE.sm },

  // ── 4. Progression ──
  // Un seul écart (8) dans le groupe niveau ; la série forme un 2e groupe (8 + 8 + filet) — V1.2
  progressCard: { gap: SPACE.sm, padding: SPACE.cardPad },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  levelMedal: {
    width: MEDAL, height: MEDAL, borderRadius: MEDAL / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR.tint.gold,
    borderWidth: BORDER.hair, borderColor: alpha(PALETTE.gold, 0.45),
  },
  levelBody: { flex: 1, gap: SPACE.sm },
  streakRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    marginTop: SPACE.sm, paddingTop: SPACE.lg,
    borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle,
  },

  // ── 5. Missions ──
  missionList: { gap: SPACE.md },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.touch },
  missionText: { flex: 1, gap: SPACE.xxs },
  missionActions: { gap: SPACE.sm },
  xpPill: {
    paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs,
    borderRadius: RADII.pill, backgroundColor: COLOR.tint.gold,
  },
  xpPillDone: { borderWidth: BORDER.hair, borderColor: alpha(PALETTE.gold, 0.45) },
  missionFooter: {
    gap: SPACE.md, marginTop: SPACE.lg, paddingTop: SPACE.md,
    borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle,
  },

  // ── 6. Carrousel pleine largeur ──
  carousel: { marginHorizontal: -SPACE.screenX },
  carouselContent: { paddingHorizontal: SPACE.screenX, gap: SPACE.md },

  // ── Rangée « Bonus & événements » / « Activité » ──
  moreCard: { paddingVertical: SPACE.xs },
  moreRow: { paddingHorizontal: SPACE.cardPad },

  // ── Feuilles ──
  sheetBlock: { gap: SPACE.md, paddingVertical: SPACE.md },
  sheetBlockSep: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
  sheetBlockHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rankBox: { alignItems: 'center', minWidth: SIZE.buttonLg },
  statsRow: { flexDirection: 'row', gap: SPACE.md },
  dqOptions: { gap: SPACE.sm },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.listRow },
  feedItem: { gap: SPACE.sm, paddingVertical: SPACE.md },
  feedSep: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
  feedActions: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  feedAction: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: SIZE.touch, minWidth: SIZE.touch },
});

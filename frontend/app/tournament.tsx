import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import {
  Txt, Icon, Button, Badge, Card, ListRow, Loader, EmptyState, StatCard, ScreenContainer, ScreenHeader, ThemeIcon,
} from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';

// Tournoi du week-end : en-tête (thème, temps restant, mes stats, CTA jaune unique) puis classement.
// Rôles : récompense / rang = or, moi = jaune, « En direct » = corail (événement).

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type TournamentEntry = {
  rank: number;
  user_id: string;
  pseudo: string;
  avatar_seed: string;
  avatar_url?: string;
  score: number;
  games_played: number;
};

type TournamentInfo = {
  active: boolean;
  id: string;
  theme_id: string;
  theme_name: string;
  end_at: string;
  games_played: number;
  score: number;
  games_remaining: number;
  rank: number | null;
  total_players: number;
  max_games: number;
};

function formatCountdown(endAt: string): string {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return t('pilot.tournament.hours', { h: String(h), m: m.toString().padStart(2, '0') });
  return t('pilot.tournament.minutes', { m: String(Math.max(1, m + (s > 0 ? 1 : 0))) });
}

export default function TournamentScreen() {
  const router = useRouter();
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();

  const [info, setInfo] = useState<TournamentInfo | null>(null);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // Ma ligne du classement est surlignée en jaune
    AsyncStorage.getItem('duelo_user_id').then(setMyId).catch(() => {});
  }, []);

  useEffect(() => {
    if (!info?.end_at) return;
    setCountdown(formatCountdown(info.end_at));
    const iv = setInterval(() => setCountdown(formatCountdown(info.end_at)), 1000);
    return () => clearInterval(iv);
  }, [info?.end_at]);

  const load = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/tournaments/current`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!data.active) { setLoading(false); return; }
      setInfo(data);
      const lbRes = await authFetch(`${API_URL}/api/tournaments/${data.id}/leaderboard?limit=50`);
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        setEntries(lbData.leaderboard || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handlePlay = () => {
    if (!info) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${info.theme_id}&themeName=${encodeURIComponent(info.theme_name)}`);
  };

  const maxGames = info?.max_games || 3;

  const RankMark = ({ rank }: { rank: number }) => (
    <View style={[st.rankBadge, rank === 1 && st.rankFirst]}>
      {rank === 1 ? <Icon name="trophy" size={ICON_SIZE.sm} color={COLOR.reward.gold} />
        : rank <= 3 ? <Icon name="medal" size={ICON_SIZE.sm} color={COLOR.text.secondary} />
        : <Txt variant="label" color={COLOR.text.secondary}>{rank}</Txt>}
    </View>
  );

  const renderEntry = ({ item, index }: { item: TournamentEntry; index: number }) => {
    const isMe = !!myId && item.user_id === myId;
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(400)}>
        <ListRow
          leading={(
            <View style={st.leading}>
              <RankMark rank={item.rank} />
              <UserAvatar avatarUrl={item.avatar_url} avatarSeed={item.avatar_seed} pseudo={item.pseudo} size={36} />
            </View>
          )}
          title={item.pseudo}
          subtitle={t('pilot.tournament.duels', { n: String(item.games_played), max: String(maxGames) })}
          trailing={(
            <View style={st.score}>
              <Txt variant="cardTitle" color={isMe ? COLOR.action.primary : COLOR.reward.gold}>{item.score.toLocaleString()}</Txt>
              <Txt variant="caption">{t('pilot.tournament.pts')}</Txt>
            </View>
          )}
          onPress={() => router.push(`/player-profile?id=${item.user_id}`)}
          style={[st.row, isMe && st.rowMe]}
        />
      </Animated.View>
    );
  };

  return (
    <SwipeBackPage>
      <ScreenContainer>
        <ScreenHeader title={t('pilot.play.tournament')} />

        {loading ? (
          <Loader fill />
        ) : !info ? (
          <EmptyState icon="trophy" title={t('tournament.no_active')} message={t('tournament.weekend_hint')} />
        ) : (
          <FlatList
            data={entries}
            renderItem={renderEntry}
            keyExtractor={item => item.user_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.listContent}
            ListHeaderComponent={() => (
              <View style={st.header}>
                <Card accent="reward" style={st.hero}>
                  <View style={st.heroTop}>
                    <ThemeIcon themeId={info.theme_id} themeName={info.theme_name} size={56} />
                    <View style={st.flex}>
                      <Txt variant="overline" color={COLOR.reward.gold}>{t('pilot.play.tournament')}</Txt>
                      <Txt variant="h2" numberOfLines={2}>{info.theme_name}</Txt>
                    </View>
                  </View>

                  <View style={st.metaRow}>
                    <Badge label={t('pilot.tournament.live')} tone="warm" />
                    <View style={st.countdown}>
                      <Icon name="clock" size={ICON_SIZE.sm} color={COLOR.text.secondary} />
                      <Txt variant="label" color={COLOR.text.secondary} numberOfLines={1}>
                        {t('pilot.tournament.ends_in', { t: countdown })}
                      </Txt>
                    </View>
                  </View>

                  {/* Mes stats : rang en jaune (moi), score en or (récompense) */}
                  <View style={st.stats}>
                    <StatCard appearance="plain" tone="action" value={info.rank ?? '—'} label={t('pilot.tournament.your_rank')} style={st.stat} />
                    <StatCard appearance="plain" tone="reward" value={info.score.toLocaleString()} label={t('pilot.tournament.score')} style={st.stat} />
                    <StatCard appearance="plain" value={info.games_remaining} label={t('pilot.tournament.remaining')} style={st.stat} />
                    <StatCard appearance="plain" value={info.total_players.toLocaleString()} label={t('pilot.tournament.players')} style={st.stat} />
                  </View>

                  {info.games_remaining > 0 ? (
                    <Button label={t('pilot.tournament.play')} icon="duel" size="lg" fullWidth haptic={false} onPress={handlePlay} />
                  ) : (
                    <View style={st.done}>
                      <Icon name="success" size={ICON_SIZE.sm} color={COLOR.status.success} />
                      <Txt variant="label" color={COLOR.status.success} style={st.flexShrink}>{t('pilot.tournament.done')}</Txt>
                    </View>
                  )}
                </Card>

                <Txt variant="overline" style={st.lbTitle}>{t('tournament.leaderboard')}</Txt>
              </View>
            )}
          />
        )}
      </ScreenContainer>
    </SwipeBackPage>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1, gap: SPACE.xxs },
  flexShrink: { flexShrink: 1 },
  listContent: { paddingBottom: SPACE.huge },
  header: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.lg, gap: SPACE.lg },
  hero: { gap: SPACE.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.md },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, flexShrink: 1 },
  stats: {
    flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.md,
    paddingTop: SPACE.md, borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle,
  },
  // 4 chiffres en 2 × 2 : en ligne, les grands nombres et « Duels restants » sont à l'étroit
  stat: { flexGrow: 1, flexBasis: '45%', alignItems: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, minHeight: 44 },
  lbTitle: { marginBottom: SPACE.xs },
  row: { paddingHorizontal: SPACE.screenX, borderBottomWidth: BORDER.hair, borderBottomColor: COLOR.border.subtle },
  rowMe: { backgroundColor: COLOR.action.selectedFill, borderLeftWidth: BORDER.selected, borderLeftColor: COLOR.action.primary },
  leading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rankBadge: {
    width: 32, height: 32, borderRadius: RADII.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR.surface.subtle,
  },
  rankFirst: { backgroundColor: COLOR.tint.gold },
  score: { alignItems: 'flex-end' },
});

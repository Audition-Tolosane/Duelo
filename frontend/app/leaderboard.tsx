import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import { authFetch } from '../utils/api';
import { t, pluralKey, getLocale } from '../utils/i18n';
import {
  Txt, Icon, IconName, Button, Badge, Card, Chip, ScreenContainer, ScreenHeader, ThemeIcon, Loader, EmptyState,
} from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, SIZE, ICON_SIZE } from '../theme/tokens';

// Classement global ou d'un thème (/leaderboard?themeId=…&themeName=…).
// Rôles : 1er = or (récompense), moi = jaune (ma ligne surlignée), rival à dépasser = corail.

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const SCOPES = [
  { id: 'world', labelKey: 'leaderboard.scope_world' },
  { id: 'friends', labelKey: 'leaderboard.scope_friends' },
  { id: 'continent', labelKey: 'leaderboard.scope_continent' },
  { id: 'country', labelKey: 'leaderboard.scope_country' },
  { id: 'region', labelKey: 'leaderboard.scope_region' },
  { id: 'city', labelKey: 'leaderboard.scope_city' },
];

const VIEWS = [
  { id: 'alltime', labelKey: 'leaderboard.view_alltime' },
  { id: 'seasonal', labelKey: 'leaderboard.view_seasonal' },
];

// Badges de série : flamme corail (série), éclair et étincelles or (paliers)
const BADGE_ICON_MAP: Record<string, { name: IconName; color: string }> = {
  fire: { name: 'flame', color: COLOR.accent.warm },
  bolt: { name: 'bolt', color: COLOR.reward.gold },
  glow: { name: 'sparkles', color: COLOR.reward.gold },
};

const fmt = (n: number) => n.toLocaleString(getLocale());

type LeaderEntry = {
  id?: string;
  pseudo: string;
  avatar_seed: string;
  avatar_url?: string;
  total_xp?: number;
  xp?: number;
  matches_won?: number;
  current_streak?: number;
  streak_badge?: string;
  level: number;
  title: string;
  rank: number;
};

type CitySuggestion = {
  city: string;
  player_count: number;
  distance_km: number;
};

type LeaderMeta = {
  scope_used: string;
  city_name?: string;
  country_name?: string;
  too_small?: boolean;
  city_player_count?: number;
  fallback?: boolean;
  missing?: boolean;
  suggestions?: CitySuggestion[];
};

const getXp = (item: LeaderEntry) => item.total_xp ?? item.xp ?? 0;

// ── Podium (top 3) : 2e à gauche, 1er au centre (or), 3e à droite ──
function Podium({ entries, myId, onOpen }: { entries: LeaderEntry[]; myId: string; onOpen: (id?: string) => void }) {
  if (entries.length < 2) return null;
  const slots = [entries[1], entries[0], entries.length > 2 ? entries[2] : null];
  const blockHeights = [96, 128, 72];
  const avatarSizes = [44, 56, 40];

  return (
    <View style={pd.container}>
      <Txt variant="overline" align="center">{t('search.top_players')}</Txt>
      <View style={pd.columns}>
        {slots.map((entry, col) => {
          if (!entry) return <View key={col} style={pd.column} />;
          const first = col === 1;
          const isMe = entry.id === myId;
          return (
            <Pressable
              key={col}
              accessibilityRole="button"
              onPress={() => onOpen(entry.id)}
              style={({ pressed }) => [pd.column, pressed && pd.pressed]}
            >
              <UserAvatar
                avatarUrl={entry.avatar_url}
                avatarSeed={entry.avatar_seed}
                pseudo={entry.pseudo}
                size={avatarSizes[col]}
                borderColor={isMe ? COLOR.player.self : first ? COLOR.reward.gold : undefined}
                borderWidth={isMe || first ? BORDER.strong : 0}
              />
              <Txt variant="label" color={COLOR.text.primary} align="center" numberOfLines={1} style={pd.pseudo}>
                {entry.pseudo}
              </Txt>
              {isMe ? <Badge label={t('pilot.leaderboard.you')} tone="action" /> : null}
              <View style={[pd.block, first && pd.blockFirst, { height: blockHeights[col] }]}>
                {first ? <Icon name="trophy" size={ICON_SIZE.md} color={COLOR.reward.gold} /> : null}
                <Txt variant={first ? 'statMedium' : 'h3'} color={first ? COLOR.reward.gold : COLOR.text.secondary}>
                  {first ? 1 : col === 0 ? 2 : 3}
                </Txt>
                <Txt variant="caption" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {fmt(getXp(entry))} XP
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const pd = StyleSheet.create({
  container: { gap: SPACE.lg, marginBottom: SPACE.lg },
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm },
  column: { flex: 1, minWidth: 0, alignItems: 'center', gap: SPACE.xs },
  pressed: { opacity: 0.7 },
  pseudo: { alignSelf: 'stretch' },
  block: {
    alignSelf: 'stretch',
    borderTopLeftRadius: RADII.md,
    borderTopRightRadius: RADII.md,
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair,
    borderBottomWidth: 0,
    borderColor: COLOR.border.subtle,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: SPACE.md,
    paddingHorizontal: SPACE.xs,
    gap: SPACE.xxs,
    marginTop: SPACE.xs,
  },
  blockFirst: { backgroundColor: COLOR.tint.gold, borderColor: COLOR.reward.gold },
});

export default function LeaderboardScreen() {
  const router = useRouter();
  const { themeId, themeName } = useLocalSearchParams<{ themeId?: string; themeName?: string }>();

  const isThemeMode = !!themeId;
  const decodedThemeName = themeName ? decodeURIComponent(themeName) : '';

  const [scope, setScope] = useState('world');
  const [view, setView] = useState('alltime');
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [meta, setMeta] = useState<LeaderMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [noLocation, setNoLocation] = useState(false);
  const [myUserId, setMyUserId] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('duelo_user_id').then(id => { if (id) setMyUserId(id); });
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [scope, view, themeId]);


  const fetchLeaderboard = async () => {
    setLoading(true);
    setNoLocation(false);
    setMeta(null);
    try {
      const url = isThemeMode
        ? `${API_URL}/api/theme/${themeId}/leaderboard?scope=${scope}&limit=50`
        : `${API_URL}/api/leaderboard?scope=${scope}&view=${view}&limit=50`;
      const res = await authFetch(url);
      const data = await res.json();

      const responseEntries = data.entries ?? data;
      const responseMeta: LeaderMeta = data.meta ?? { scope_used: scope };
      setEntries(Array.isArray(responseEntries) ? responseEntries : []);
      setMeta(responseMeta);
      const locationScopes = ['country', 'city', 'continent', 'region'];
      if (locationScopes.includes(scope) && responseMeta.missing) {
        setNoLocation(true);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchCityLeaderboard = async (cityName: string) => {
    setLoading(true);
    setMeta(null);
    try {
      const url = isThemeMode
        ? `${API_URL}/api/theme/${themeId}/leaderboard?scope=city&city_override=${encodeURIComponent(cityName)}&limit=50`
        : `${API_URL}/api/leaderboard?scope=city&city_override=${encodeURIComponent(cityName)}&limit=50`;
      const res = await authFetch(url);
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setMeta(data.meta ?? { scope_used: 'city', city_name: cityName });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openProfile = (id?: string) => { if (id) router.push(`/player-profile?id=${id}` as any); };

  // Rival : joueur juste au-dessus de moi dans le classement actuel
  const myEntry = myUserId ? entries.find(e => e.id === myUserId) : undefined;
  const rivalEntry = myEntry ? entries.find(e => e.rank === myEntry.rank - 1) : undefined;
  const xpGap = (myEntry && rivalEntry) ? (getXp(rivalEntry) - getXp(myEntry)) : 0;

  const renderEntry = useCallback(({ item, index }: { item: LeaderEntry; index: number }) => {
    const first = item.rank === 1;
    const badgeInfo = item.streak_badge ? BADGE_ICON_MAP[item.streak_badge] : null;
    const isMe = item.id === myUserId;
    const stats = [
      `${t('leaderboard.level_short')} ${item.level}`,
      item.title || null,
      item.matches_won != null ? `${fmt(item.matches_won)} ${t('leaderboard.wins_short')}` : null,
    ].filter(Boolean).join(' · ');

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
        <Card
          testID={`leaderboard-entry-${index}`}
          onPress={() => openProfile(item.id)}
          accent={isMe ? 'selected' : 'none'}
          style={[styles.entry, isMe && styles.entryMe]}
        >
          <View style={styles.rank}>
            {first
              ? <Icon name="trophy" size={ICON_SIZE.md} color={COLOR.reward.gold} />
              : <Txt variant="label" color={COLOR.text.secondary} numberOfLines={1} adjustsFontSizeToFit>{item.rank}</Txt>}
          </View>
          <UserAvatar avatarUrl={item.avatar_url} avatarSeed={item.avatar_seed} pseudo={item.pseudo} size={40} />
          <View style={styles.entryInfo}>
            <View style={styles.pseudoRow}>
              <Txt variant="cardTitle" color={isMe ? COLOR.player.self : COLOR.text.primary} numberOfLines={1} style={styles.shrink}>
                {item.pseudo}
              </Txt>
              {badgeInfo ? <Icon name={badgeInfo.name} size={ICON_SIZE.sm} color={badgeInfo.color} /> : null}
            </View>
            <Txt variant="caption" numberOfLines={1}>{stats}</Txt>
          </View>
          <View style={styles.xp}>
            <Txt variant="label" color={first ? COLOR.reward.gold : COLOR.text.primary} numberOfLines={1}>{fmt(getXp(item))}</Txt>
            <Txt variant="caption">XP</Txt>
          </View>
        </Card>
      </Animated.View>
    );
  }, [router, myUserId]);

  const header = isThemeMode ? (
    <ScreenHeader
      overline={t('leaderboard.theme_ranking')}
      title={decodedThemeName || t('leaderboard.title')}
      right={<ThemeIcon themeId={themeId} themeName={decodedThemeName} size={ICON_SIZE.theme.sm} />}
    />
  ) : (
    <ScreenHeader title={t('leaderboard.title')} />
  );

  return (
    <SwipeBackPage>
      <ScreenContainer>
        {header}

        {/* Période — classement global seulement */}
        {!isThemeMode && (
          <View style={styles.viewToggle}>
            {VIEWS.map((v) => (
              <Chip
                testID={`view-${v.id}`}
                key={v.id}
                label={t(v.labelKey)}
                selected={view === v.id}
                onPress={() => setView(v.id)}
                style={styles.viewChip}
              />
            ))}
          </View>
        )}

        {/* Zone géographique */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scopeScroll} contentContainerStyle={styles.scopeContainer}>
          {SCOPES.map((s) => (
            <Chip
              testID={`scope-${s.id}`}
              key={s.id}
              label={t(s.labelKey)}
              selected={scope === s.id}
              onPress={() => setScope(s.id)}
            />
          ))}
        </ScrollView>

        {!isThemeMode && view === 'seasonal' && (
          <Txt variant="caption" style={styles.seasonInfo}>{t('leaderboard.season_info')}</Txt>
        )}

        {loading ? (
          <Loader fill />
        ) : scope === 'friends' && entries.length <= 1 ? (
          <EmptyState icon="users" title={t('leaderboard.friends_empty')} message={t('leaderboard.friends_empty_hint')} />
        ) : noLocation ? (
          <EmptyState icon="globe" title={t('leaderboard.no_location')} message={t('leaderboard.set_location_hint')} />
        ) : meta?.too_small && meta.suggestions && meta.suggestions.length > 0 ? (
          <ScrollView contentContainerStyle={styles.suggestions}>
            <EmptyState
              icon="home"
              title={t(pluralKey('pilot.leaderboard.city_too_small', meta.city_player_count ?? 0), {
                city: meta.city_name ?? '', count: fmt(meta.city_player_count ?? 0),
              })}
              message={t('leaderboard.nearby_cities')}
            />
            <Card padded={false} style={styles.suggestionCard}>
              {meta.suggestions.map((s, i) => (
                <Pressable
                  key={s.city}
                  accessibilityRole="button"
                  onPress={() => fetchCityLeaderboard(s.city)}
                  style={({ pressed }) => [styles.suggestionRow, i > 0 && styles.divider, pressed && styles.pressed]}
                >
                  <Icon name="home" size={ICON_SIZE.md} color={COLOR.text.secondary} />
                  <Txt variant="cardTitle" numberOfLines={1} style={styles.flex}>{s.city}</Txt>
                  <View style={styles.xp}>
                    <Txt variant="label" color={COLOR.text.primary}>
                      {t(pluralKey('pilot.leaderboard.players', s.player_count), { n: fmt(s.player_count) })}
                    </Txt>
                    <Txt variant="caption">{fmt(s.distance_km)} km</Txt>
                  </View>
                  <Icon name="chevronRight" size={18} color={COLOR.text.disabled} />
                </Pressable>
              ))}
            </Card>
          </ScrollView>
        ) : meta?.too_small && meta.fallback ? (
          <View style={styles.fallbackBanner}>
            <Icon name="info" size={ICON_SIZE.sm} color={COLOR.text.secondary} />
            <Txt variant="bodySmall" style={styles.flex}>
              {t('leaderboard.city_fallback', { city: meta.city_name ?? '', country: meta.country_name ?? '' })}
            </Txt>
          </View>
        ) : null}

        {/* Liste : carte rival + podium en en-tête, joueurs à partir du 4e ensuite */}
        {!loading && entries.length > 0 && (
          <FlatList
            style={styles.flex}
            data={entries.length >= 3 ? entries.slice(3) : entries}
            renderItem={renderEntry}
            keyExtractor={(item) => item.pseudo + item.rank}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {rivalEntry && myEntry && xpGap > 0 && (
                  <Card accent="event" style={styles.rivalCard}>
                    <Txt variant="overline" color={COLOR.player.opponentText}>{t('leaderboard.your_rival')}</Txt>
                    <View style={styles.rivalBody}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openProfile(rivalEntry.id)}
                        style={({ pressed }) => [styles.rivalWho, pressed && styles.pressed]}
                      >
                        <UserAvatar avatarUrl={rivalEntry.avatar_url} avatarSeed={rivalEntry.avatar_seed} pseudo={rivalEntry.pseudo} size={40} />
                        <View style={styles.flex}>
                          <Txt variant="cardTitle" numberOfLines={1}>
                            #{rivalEntry.rank} {rivalEntry.pseudo}
                          </Txt>
                          <View style={styles.gapRow}>
                            <Icon name="arrowUp" size={ICON_SIZE.sm} color={COLOR.player.opponentText} />
                            <Txt variant="caption" color={COLOR.player.opponentText} numberOfLines={2} style={styles.shrink}>
                              {fmt(xpGap)} {t('leaderboard.to_overtake')}
                            </Txt>
                          </View>
                        </View>
                      </Pressable>
                      <Button
                        label={t('leaderboard.challenge')}
                        icon="duel"
                        size="sm"
                        onPress={() => router.push(`/player-profile?id=${rivalEntry.id}&challenge=1` as any)}
                      />
                    </View>
                  </Card>
                )}
                {entries.length >= 2 && (
                  <Podium entries={entries} myId={myUserId} onOpen={openProfile} />
                )}
              </>
            }
          />
        )}

        {!loading && entries.length === 0 && !noLocation && !meta?.too_small && (
          <EmptyState icon="trophy" title={t('leaderboard.empty')} message={t('leaderboard.be_first')} />
        )}
      </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  divider: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },

  viewToggle: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.screenX, paddingTop: SPACE.md },
  viewChip: { flexGrow: 1, justifyContent: 'center' },

  // flexShrink: 0 obligatoire : sinon le ScrollView horizontal est écrasé par la liste
  scopeScroll: { flexGrow: 0, flexShrink: 0, marginVertical: SPACE.md },
  scopeContainer: { paddingHorizontal: SPACE.screenX, gap: SPACE.sm, alignItems: 'center', minHeight: SIZE.touch },

  seasonInfo: { paddingHorizontal: SPACE.screenX, marginBottom: SPACE.sm },

  listContent: { paddingHorizontal: SPACE.screenX, paddingBottom: SPACE.xxxl, gap: SPACE.sm },

  rivalCard: { gap: SPACE.sm, marginBottom: SPACE.lg },
  // Petit écran : « Défier » passe sous le joueur plutôt que de tronquer pseudo et écart d'XP
  rivalBody: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.md },
  rivalWho: { flex: 1, minWidth: 190, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.touch },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },

  entry: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.md, minHeight: SIZE.listRow },
  entryMe: { backgroundColor: COLOR.action.selectedFill },
  rank: { width: 32, alignItems: 'center' },
  entryInfo: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  pseudoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  xp: { alignItems: 'flex-end' },

  suggestions: { paddingHorizontal: SPACE.screenX, paddingBottom: SPACE.xxxl },
  suggestionCard: { paddingHorizontal: SPACE.cardPad },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.listRow, paddingVertical: SPACE.sm },

  fallbackBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    marginHorizontal: SPACE.screenX, marginBottom: SPACE.md,
    backgroundColor: COLOR.surface.subtle, borderRadius: RADII.md,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
  },
});

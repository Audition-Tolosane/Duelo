import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, RefreshControl, Alert, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { authFetch } from '../utils/api';
import { t, getLocale, getLanguage } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import {
  Txt, Icon, IconName, Button, IconButton, Card, Chip, Section, ListRow, Loader, BottomSheet,
  ScreenContainer, ScreenHeader, ThemeIcon, SearchField,
} from '../components/ui';
import { COLOR, SPACE, RADII, SIZE, BORDER, ICON_SIZE } from '../theme/tokens';

// Profil d'un autre joueur : même famille que le Profil (pilote validé). Le joueur consulté reste
// neutre ; le corail (rival) n'apparaît que dans le face-à-face, quand il est mis en face de moi.

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const THEMES_SHOWN = 5;

type PlayerProfile = {
  id: string; pseudo: string; avatar_seed: string; avatar_url?: string;
  selected_title: string; country: string | null; country_flag: string;
  matches_played: number; matches_won: number; win_rate: number;
  current_streak: number; best_streak: number; total_xp: number;
  themes: Record<string, { xp: number; level: number; title: string; name?: string; color_hex?: string; cluster?: string; super_category?: string }>;
  // Le backend envoie theme_id / theme_name ; category / category_name = ancien format
  champion_titles: { category?: string; category_name?: string; theme_id?: string; theme_name?: string; scope: string; date: string }[];
  followers_count: number; following_count: number; is_following: boolean;
  posts: {
    id: string; category_id: string; category_name: string;
    content: string; image_base64: string | null;
    likes_count: number; comments_count: number; is_liked: boolean; created_at: string;
  }[];
};

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString(getLocale());
// Le backend envoie le mois en anglais (« October 2026 ») : on le traduit dans la langue de l'app
const monthLabel = (raw: string) => {
  const d = new Date(`1 ${raw}`);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
};

function Divider() {
  return <View style={s.divider} />;
}

function StatCell({ value, label, icon, testID }: { value: string; label: string; icon?: IconName; testID?: string }) {
  return (
    <View style={s.statCell} accessible accessibilityLabel={`${label} ${value}`}>
      <View style={s.inline}>
        {icon ? <Icon name={icon} size={ICON_SIZE.sm} color={COLOR.accent.warm} /> : null}
        <Txt testID={testID} variant="statMedium" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={s.shrink}>
          {value}
        </Txt>
      </View>
      <Txt variant="overline" numberOfLines={1}>{label}</Txt>
    </View>
  );
}

export default function PlayerProfileScreen() {
  const router = useRouter();
  // challenge=1 ouvre directement la fenêtre de défi (boutons « Défier X » des autres écrans) ;
  // themeId/themeName présélectionnent le thème du contexte (rival, suggestion…).
  const { id, challenge, themeId, themeName } = useLocalSearchParams<{
    id: string; challenge?: string; themeId?: string; themeName?: string;
  }>();

  if (!id) {
    router.back();
    return null;
  }

  const [myId, setMyId] = useState('');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [themesExpanded, setThemesExpanded] = useState(false);
  const [challengeModalVisible, setChallengeModalVisible] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<{id: string, name: string, color: string} | null>(null);
  const [challengeSending, setChallengeSending] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);
  // Thèmes proposés en plus de ceux de l'adversaire : tendances, puis recherche libre.
  // Sans ça, deux joueurs qui n'ont jamais joué ne pouvaient choisir aucun thème.
  const [suggestedThemes, setSuggestedThemes] = useState<{ id: string; name: string; color_hex?: string }[]>([]);
  const [themeQuery, setThemeQuery] = useState('');
  const [themeResults, setThemeResults] = useState<{ id: string; name: string; color_hex?: string }[]>([]);
  const [vsStats, setVsStats] = useState<{ total: number; user_wins: number; opponent_wins: number } | null>(null);
  const [challengeHistory, setChallengeHistory] = useState<{
    challenge_id: string; opponent_pseudo: string; theme_name: string;
    my_score: number; opponent_score: number; won: boolean; played_at: string;
  }[]>([]);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    if (uid) setMyId(uid);
    const loaded = await fetchProfile(uid || '');
    if (uid && uid !== id) {
      fetchVsStats(uid);
      fetchSuggestedThemes(uid);
      if (challenge === '1') openChallenge(loaded);
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

  const fetchSuggestedThemes = async (viewerId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/themes/trending?user_id=${viewerId}&lang=${getLanguage()}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestedThemes(data.trending || []);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const q = themeQuery.trim();
    if (q.length < 2) { setThemeResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/search/themes?q=${encodeURIComponent(q)}&limit=12&lang=${getLanguage()}`);
        if (res.ok) setThemeResults(await res.json());
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [themeQuery]);

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
      const res = await fetch(`${API_URL}/api/player/${id}/profile?viewer_id=${viewerId}&lang=${getLanguage()}`);
      const data = await res.json();
      setProfile(data);
      return data as PlayerProfile;
    } catch (e) { console.error(e); }
    return null;
  };

  // Un défi exige un thème : sans thème, la salle de duel ne trouve aucune question
  // (load_and_start_game côté serveur). On présélectionne le thème du contexte,
  // sinon le meilleur thème de l'adversaire.
  const openChallenge = (p: PlayerProfile | null = profile) => {
    if (themeId) {
      setSelectedTheme({ id: themeId, name: themeName || themeId, color: COLOR.action.primary });
    } else if (p?.themes && Object.keys(p.themes).length > 0) {
      const [bestId, best] = Object.entries(p.themes).reduce((a, b) => (b[1].xp > a[1].xp ? b : a));
      setSelectedTheme({ id: bestId, name: best.name || bestId, color: best.color_hex || COLOR.action.primary });
    } else if (suggestedThemes.length > 0) {
      const first = suggestedThemes[0];
      setSelectedTheme({ id: first.id, name: first.name, color: first.color_hex || COLOR.action.primary });
    }
    setChallengeModalVisible(true);
  };

  const closeChallenge = () => {
    setChallengeModalVisible(false);
    setSelectedTheme(null);
    setThemeQuery('');
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
      } else {
        // 404 (thème introuvable), 429 (trop de défis envoyés)… : on le dit au lieu d'échouer en silence.
        const err = await res.json().catch(() => null);
        Alert.alert(t('common.error'), err?.detail || t('common.error_loading'));
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('common.error'), t('common.error_loading'));
    }
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
    return (
      <SwipeBackPage>
        <ScreenContainer>
          <ScreenHeader title={t('pilot.player.title')} />
          <Loader fill />
        </ScreenContainer>
      </SwipeBackPage>
    );
  }
  if (!profile) return null;

  const isOwnProfile = myId === profile.id;
  const winRate = Math.max(0, Math.min(100, Math.round(profile.win_rate || 0)));

  // Thèmes triés par niveau décroissant
  const sortedCategories = Object.entries(profile.themes || {})
    .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp);
  const themesShown = themesExpanded ? sortedCategories : sortedCategories.slice(0, THEMES_SHOWN);

  // Thèmes proposés pour le défi : celui du contexte s'il y en a un, ceux de l'adversaire,
  // puis les tendances — ou les résultats de recherche dès qu'on tape. N'importe quel thème
  // est jouable, même si aucun des deux joueurs n'y a encore joué.
  // Pas d'option « thème libre » : une salle sans thème ne trouve aucune question.
  const toEntry = (th: { id: string; name: string; color_hex?: string }) =>
    [th.id, { xp: 0, level: 0, title: '', name: th.name, color_hex: th.color_hex }] as [string, PlayerProfile['themes'][string]];
  const challengeThemes: [string, PlayerProfile['themes'][string]][] = [];
  const pushTheme = (entry: [string, PlayerProfile['themes'][string]]) => {
    if (!challengeThemes.some(([k]) => k === entry[0])) challengeThemes.push(entry);
  };
  if (themeQuery.trim().length >= 2) {
    themeResults.forEach((th) => pushTheme(toEntry(th)));
  } else {
    if (themeId) pushTheme([themeId, profile.themes?.[themeId] || { xp: 0, level: 0, title: '', name: themeName || themeId }]);
    Object.entries(profile.themes || {}).slice(0, 6).forEach(pushTheme);
    suggestedThemes.forEach((th) => pushTheme(toEntry(th)));
  }

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('pilot.player.title')} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.text.primary} />}
      >
        {/* ── Hero : avatar, pseudo, titre (or), lieu ── */}
        <View style={s.hero}>
          <View style={s.avatarWrap}>
            <UserAvatar avatarUrl={profile.avatar_url} avatarSeed={profile.avatar_seed} pseudo={profile.pseudo} size={96} />
          </View>
          <Txt testID="player-pseudo" variant="h1" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={s.heroName}>
            {profile.pseudo}
          </Txt>
          {profile.selected_title ? (
            <View style={s.heroLine}>
              <Icon name="crown" size={ICON_SIZE.sm} color={COLOR.reward.gold} />
              <Txt variant="label" color={COLOR.reward.gold} numberOfLines={1} style={s.shrink}>{profile.selected_title}</Txt>
            </View>
          ) : null}
          <View style={s.heroLine}>
            {profile.country_flag
              ? <Txt variant="label">{profile.country_flag}</Txt>
              : <Icon name="globe" size={ICON_SIZE.sm} color={COLOR.text.secondary} />}
            <Txt variant="label" numberOfLines={1} style={s.shrink}>{profile.country || t('player.world')}</Txt>
          </View>

          {/* Actions : un seul CTA jaune (Défier), Suivre en secondaire, Message en icône */}
          {!isOwnProfile && (
            <View style={s.actions}>
              <Button
                testID="challenge-button"
                label={t('challenge.send')}
                icon="duel"
                haptic={false}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); openChallenge(); }}
                style={s.actionMain}
              />
              <Button
                testID="follow-button"
                label={profile.is_following ? t('pilot.player.following') : t('player.follow')}
                icon={profile.is_following ? 'check' : 'plus'}
                variant={profile.is_following ? 'ghost' : 'secondary'}
                onPress={handleFollow}
                disabled={followLoading}
                style={s.actionMain}
              />
              <IconButton
                testID="chat-button"
                icon="message"
                accessibilityLabel={t('player.message')}
                onPress={handleChat}
                style={s.chatBtn}
              />
            </View>
          )}

          {/* Abonnés / abonnements (ligne compacte, comme le Profil) */}
          <View style={s.socialRow}>
            <Pressable
              onPress={() => router.push(`/followers?userId=${profile.id}&type=followers`)}
              accessibilityRole="button"
              style={({ pressed }) => [s.socialItem, pressed && s.pressed]}
            >
              <Txt testID="stat-followers" variant="cardTitle" style={s.tabular}>{fmt(profile.followers_count)}</Txt>
              <Txt variant="overline">{t('profile.followers_label')}</Txt>
            </Pressable>
            <View style={s.socialDot} />
            <Pressable
              onPress={() => router.push(`/followers?userId=${profile.id}&type=following`)}
              accessibilityRole="button"
              style={({ pressed }) => [s.socialItem, pressed && s.pressed]}
            >
              <Txt testID="stat-following" variant="cardTitle" style={s.tabular}>{fmt(profile.following_count)}</Txt>
              <Txt variant="overline">{t('profile.following_label')}</Txt>
            </Pressable>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Titres de champion (récompense : or) ── */}
          {profile.champion_titles.length > 0 && (
            <Card accent="reward" padded={false} style={s.listCard}>
              {profile.champion_titles.map((ct, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    leading={<Icon name="trophy" size={22} color={COLOR.reward.gold} />}
                    title={t('pilot.player.champion', { theme: ct.theme_name || ct.category_name || profile.themes?.[ct.theme_id || ct.category || '']?.name || '' })}
                    subtitle={`${ct.scope} · ${monthLabel(ct.date)}`}
                  />
                </React.Fragment>
              ))}
            </Card>
          )}

          {/* ── Victoires : % puis 4 stats (même carte que le Profil) ── */}
          <Card style={s.statsCard}>
            <View>
              <Txt variant="overline" numberOfLines={1}>{t('pilot.profile.win_rate_title')}</Txt>
              <Txt variant="statLarge" numberOfLines={1}>{`${winRate}%`}</Txt>
              <Txt variant="caption" numberOfLines={2} style={s.tabular}>
                {t('pilot.profile.win_summary', { wins: fmt(profile.matches_won), played: fmt(profile.matches_played) })}
              </Txt>
            </View>
            <Divider />
            <View style={s.statGrid}>
              <StatCell testID="stat-games" value={fmt(profile.matches_played)} label={t('pilot.profile.stat_duels')} />
              <StatCell value={fmt(profile.matches_won)} label={t('profile.matches_won')} />
              <StatCell value={fmt(profile.current_streak)} label={t('pilot.profile.stat_streak')} icon="flame" />
              <StatCell value={fmt(profile.best_streak)} label={t('pilot.profile.stat_best')} />
            </View>
          </Card>

          {/* ── Face-à-face : moi (jaune) contre lui (corail) ── */}
          {!isOwnProfile && vsStats !== null && (
            <Section title={t('player.vs_title')}>
              <Card>
                {vsStats.total === 0 ? (
                  <View style={s.inlineCenter}>
                    <Icon name="duel" size={ICON_SIZE.md} color={COLOR.text.tertiary} />
                    <Txt variant="bodySmall">{t('pilot.player.vs_empty')}</Txt>
                  </View>
                ) : (
                  <View style={s.vsRow}>
                    <View style={s.vsBlock}>
                      <Txt variant="score" color={COLOR.player.self}>{fmt(vsStats.user_wins)}</Txt>
                      <Txt variant="overline" align="center" numberOfLines={2}>{t('pilot.player.vs_my_wins')}</Txt>
                    </View>
                    <View style={s.vsDivider} />
                    <View style={s.vsBlock}>
                      <Txt variant="score">{fmt(vsStats.total)}</Txt>
                      <Txt variant="overline" align="center" numberOfLines={2}>{t('pilot.player.vs_total')}</Txt>
                    </View>
                    <View style={s.vsDivider} />
                    <View style={s.vsBlock}>
                      <Txt variant="score" color={COLOR.player.opponentText}>{fmt(vsStats.opponent_wins)}</Txt>
                      <Txt variant="overline" align="center" numberOfLines={2}>{t('pilot.player.vs_their_wins')}</Txt>
                    </View>
                  </View>
                )}
              </Card>
            </Section>
          )}

          {/* ── Ses thèmes (niveau du joueur consulté : neutre, pas jaune) ── */}
          {sortedCategories.length > 0 && (
            <Section
              title={isOwnProfile ? t('pilot.profile.fav_themes') : t('pilot.player.themes')}
              onSeeAll={!themesExpanded && sortedCategories.length > THEMES_SHOWN ? () => setThemesExpanded(true) : undefined}
            >
              <Card padded={false} style={s.listCard}>
                {themesShown.map(([catKey, catData], i) => (
                  <React.Fragment key={catKey}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      leading={<ThemeIcon themeName={catData.name || catKey} cluster={catData.cluster} superCategory={catData.super_category} size={ICON_SIZE.theme.sm} />}
                      title={catData.name || catKey}
                      subtitle={catData.title || catData.cluster}
                      trailing={<Txt variant="label" color={COLOR.text.secondary}>{t('common.level_short', { n: String(catData.level) })}</Txt>}
                      chevron
                      onPress={() => router.push(`/category-detail?id=${catKey}`)}
                    />
                  </React.Fragment>
                ))}
              </Card>
            </Section>
          )}

          {/* ── Défis joués (mon propre profil seulement) ── */}
          {isOwnProfile && (
            <Section title={t('player.challenge_history')}>
              {challengeHistory.length === 0 ? (
                <Txt variant="bodySmall">{t('player.no_challenges')}</Txt>
              ) : (
                <Card padded={false} style={s.listCard}>
                  {challengeHistory.map((ch, i) => {
                    const resultColor = ch.won ? COLOR.status.success : COLOR.status.error;
                    return (
                      <React.Fragment key={ch.challenge_id}>
                        {i > 0 ? <Divider /> : null}
                        <View style={s.matchRow}>
                          <View style={[s.matchMark, { backgroundColor: resultColor }]} />
                          <View style={s.flex}>
                            <Txt variant="cardTitle" numberOfLines={1}>{`vs ${ch.opponent_pseudo}`}</Txt>
                            {ch.theme_name ? <Txt variant="caption" numberOfLines={1}>{ch.theme_name}</Txt> : null}
                          </View>
                          <View style={s.alignEnd}>
                            <Txt variant="cardTitle" style={s.tabular}>{`${ch.my_score} - ${ch.opponent_score}`}</Txt>
                            <Txt variant="overline" color={resultColor}>{ch.won ? t('profile.victory') : t('profile.defeat')}</Txt>
                          </View>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </Card>
              )}
            </Section>
          )}

          {/* ── Publications ── */}
          <Section title={t('pilot.player.posts')}>
            {profile.posts.length === 0 ? (
              <Txt variant="bodySmall">{t('player.no_posts')}</Txt>
            ) : (
              <View style={s.posts}>
                {profile.posts.map(post => (
                  <Card key={post.id} style={s.post}>
                    <View style={s.postHeader}>
                      <ThemeIcon themeName={post.category_name} size={ICON_SIZE.theme.xs} />
                      <Txt variant="label" numberOfLines={1} style={s.flex}>{post.category_name}</Txt>
                      <Txt variant="caption">{timeAgo(post.created_at)}</Txt>
                    </View>
                    <Txt variant="body">{post.content}</Txt>
                    {post.image_base64 && (
                      <Image source={{ uri: post.image_base64 }} style={s.postImage} resizeMode="cover" />
                    )}
                    <View style={s.postActions}>
                      <View style={s.inline}>
                        <Icon name="heart" size={ICON_SIZE.sm} color={post.is_liked ? COLOR.accent.warm : COLOR.text.tertiary} />
                        <Txt variant="label" style={s.tabular}>{fmt(post.likes_count)}</Txt>
                      </View>
                      <View style={s.inline}>
                        <Icon name="message" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
                        <Txt variant="label" style={s.tabular}>{fmt(post.comments_count)}</Txt>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </Section>
        </View>
      </ScrollView>

      {/* ── Défier : choix du thème ── */}
      <BottomSheet
        visible={challengeModalVisible}
        onClose={closeChallenge}
        title={t('pilot.player.challenge_title', { name: profile.pseudo })}
        subtitle={t('challenge.choose_theme')}
        footer={challengeSent ? (
          <View style={s.inlineCenter}>
            <Icon name="success" size={ICON_SIZE.md} color={COLOR.status.success} />
            <Txt variant="cardTitle" color={COLOR.status.success}>{t('challenge.already_pending')}</Txt>
          </View>
        ) : (
          <Button
            label={t('challenge.confirm')}
            icon="duel"
            fullWidth
            loading={challengeSending}
            disabled={!selectedTheme}
            onPress={handleSendChallenge}
          />
        )}
      >
        <SearchField
          placeholder={t('search.placeholder_themes')}
          value={themeQuery}
          onChangeText={setThemeQuery}
        />
        <View style={s.chips}>
          {challengeThemes.map(([catKey, catData]) => {
            const displayName = catData.name || catKey;
            return (
              <Chip
                key={catKey}
                label={displayName}
                selected={selectedTheme?.id === catKey}
                onPress={() => setSelectedTheme({ id: catKey, name: displayName, color: catData.color_hex || COLOR.action.primary })}
                style={s.chip}
              />
            );
          })}
        </View>
      </BottomSheet>
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: SPACE.giant },
  body: { paddingHorizontal: SPACE.screenX, gap: SPACE.sectionGap },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  inlineCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  alignEnd: { alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.7 },
  divider: { height: BORDER.hair, backgroundColor: COLOR.border.subtle },

  /* Hero */
  hero: { alignItems: 'center', paddingTop: SPACE.xl, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.screenX, gap: SPACE.xxs },
  avatarWrap: { marginBottom: SPACE.md },
  heroName: { alignSelf: 'stretch' },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, maxWidth: '100%', minHeight: SPACE.xxl },

  /* Actions */
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, alignSelf: 'stretch', marginTop: SPACE.lg },
  actionMain: { flex: 1, paddingHorizontal: SPACE.md },
  chatBtn: { width: SIZE.button, height: SIZE.button, borderRadius: RADII.md },

  /* Social */
  socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, marginTop: SPACE.sm },
  socialItem: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.xs, minHeight: SIZE.touch, paddingHorizontal: SPACE.sm, justifyContent: 'center' },
  socialDot: { width: SPACE.xs, height: SPACE.xs, borderRadius: RADII.pill, backgroundColor: COLOR.border.strong },

  /* Stats */
  statsCard: { gap: SPACE.lg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.lg },
  statCell: { width: '50%', gap: SPACE.xxs, paddingRight: SPACE.sm },

  /* Face-à-face */
  vsRow: { flexDirection: 'row', alignItems: 'center' },
  vsBlock: { flex: 1, alignItems: 'center', gap: SPACE.xxs, paddingHorizontal: SPACE.xs },
  vsDivider: { width: BORDER.hair, alignSelf: 'stretch', backgroundColor: COLOR.border.subtle },

  /* Listes */
  listCard: { paddingHorizontal: SPACE.cardPad },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.listRow, paddingVertical: SPACE.sm },
  matchMark: { width: BORDER.selected, alignSelf: 'stretch', borderRadius: RADII.xs },

  /* Publications */
  posts: { gap: SPACE.md },
  post: { gap: SPACE.md },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  postImage: { width: '100%', height: 200, borderRadius: RADII.md },
  postActions: { flexDirection: 'row', gap: SPACE.xl },

  /* Défi */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, paddingTop: SPACE.xs },
  chip: { maxWidth: '100%' },
});

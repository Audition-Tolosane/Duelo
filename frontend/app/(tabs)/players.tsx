import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, useWindowDimensions, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, FadeInDown, SlideInRight, interpolate } from 'react-native-reanimated';
import { useTabBar } from '../../contexts/TabBarContext';
import UserAvatar from '../../components/UserAvatar';
import { t } from '../../utils/i18n';
import {
  Txt, Icon, IconName, Button, Card, Chip, ThemeIcon, Loader, EmptyState,
} from '../../components/ui';
import { COLOR, SPACE, RADII, BORDER, SIZE, ICON_SIZE } from '../../theme/tokens';

// Onglet Social : Activité (exploits des joueurs + suggestion du coach), Champions (le meilleur
// joueur de chaque thème) et Créer (renvoi vers la création de thème). Aucune couleur par section :
// la sélection est jaune, le défi corail, le champion et l'XP en or.

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ── Types ──
type FeedItem = {
  type: string; id: string; user_id?: string;
  user_pseudo?: string; user_avatar_seed?: string; user_avatar_url?: string; user_level?: number;
  category?: string; category_name?: string; category_color?: string;
  pillar_color?: string; score?: string; correct?: number;
  opponent_pseudo?: string; xp_earned?: number; is_self?: boolean;
  can_challenge?: boolean; icon?: string; title?: string;
  created_at?: string; rival_id?: string; rival_pseudo?: string;
  rival_avatar_seed?: string; rival_avatar_url?: string; rival_level?: number; my_level?: number;
  message?: string;
};

type Tribe = {
  id: string; name: string; icon: string;
  pillar_id: string; pillar_name: string; pillar_color: string;
  playable: boolean;
  throne: {
    id: string; pseudo: string; avatar_seed: string; avatar_url?: string;
    level: number; title: string; xp: number;
  } | null;
  member_count: number;
};

type CoachSuggestion = {
  type: string; rival_id?: string; rival_pseudo?: string;
  rival_avatar_seed?: string; category?: string; category_name?: string;
  category_color?: string; rival_level?: number; my_level?: number;
  message?: string; icon?: string;
};

type SectionTab = 'pulse' | 'tribus' | 'forge';

// Univers : pictogramme Lucide des filtres (les illustrations de thèmes restent sur les cartes)
const UNIVERSE_ICON: Record<string, IconName> = {
  screen: 'film', sound: 'music', arena: 'trophy', legends: 'landmark', lab: 'flask',
  globe: 'globe', art: 'palette', life: 'leaf', mind: 'brain',
};
const UNIVERSE_IDS = ['screen', 'sound', 'arena', 'legends', 'lab', 'globe', 'art', 'life', 'mind'];

// ── Titre d'un exploit, traduit côté client ──
function getPulseTitle(item: FeedItem): string {
  if (item.type === 'perfect') return t('pulse.perfect_score');
  if (item.type === 'streak') {
    const n = (item as any).streak_count ?? '';
    return `${t('pulse.streak')} ${n} ${t('pulse.streak_wins')}`;
  }
  const cat = item.category_name || '';
  if (item.type === 'victory') return `${t('pulse.victory')} ${cat}`;
  return `${t('pulse.match')} ${cat}`;
}

// ── Exploit (fil d'activité) ──
const ExploitCard = ({ item, index = 0, onChallenge, onProfile }: {
  item: FeedItem; index?: number; onChallenge: (userId: string, category: string, categoryName?: string) => void;
  onProfile: (userId: string) => void;
}) => {
  const isPerfect = item.type === 'perfect';
  const isStreak = item.type === 'streak';
  // Sans-faute = récompense (or) ; série = accent chaud ; duel = crème
  const icon: IconName = isPerfect ? 'star' : isStreak ? 'flame' : 'duel';
  const iconColor = isPerfect ? COLOR.reward.gold : isStreak ? COLOR.accent.warm : COLOR.text.secondary;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      {/* La carte n'est pas cliquable en entier : elle contient le bouton Défier (pas de bouton dans un bouton) */}
      <Card style={st.exploit}>
        <Pressable
          onPress={() => item.user_id && onProfile(item.user_id)}
          accessibilityRole="button"
          style={({ pressed }) => [st.exploitRow, pressed && st.pressed]}
        >
          <UserAvatar
            avatarUrl={item.user_avatar_url}
            avatarSeed={item.user_avatar_seed || item.user_pseudo}
            pseudo={item.user_pseudo}
            size={40}
          />
          <View style={st.exploitText}>
            <View style={st.titleRow}>
              <Icon name={icon} size={ICON_SIZE.sm} color={iconColor} />
              <Txt variant="cardTitle" color={isPerfect ? COLOR.reward.gold : COLOR.text.primary} numberOfLines={1} style={st.flexShrink}>
                {getPulseTitle(item)}
              </Txt>
            </View>
            <Txt variant="caption" numberOfLines={1}>
              @{item.user_pseudo}
              {item.opponent_pseudo && !isStreak ? ` · ${t('players.vs')} ${item.opponent_pseudo}` : ''}
            </Txt>
            {item.score ? (
              <View style={st.statsRow}>
                <Txt variant="label" color={COLOR.text.primary}>{item.score}</Txt>
                {item.xp_earned ? <Txt variant="caption" color={COLOR.reward.gold}>+{item.xp_earned} XP</Txt> : null}
                {item.category_name ? (
                  <Txt variant="caption" color={COLOR.text.secondary} numberOfLines={1} style={st.flexShrink}>{item.category_name}</Txt>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>

        {/* Défi nominatif sur le thème de l'exploit */}
        {item.can_challenge ? (
          <Button
            label={t('players.challenge')}
            icon="duel"
            variant="secondary"
            size="sm"
            haptic={false}
            onPress={() => item.user_id && item.category && onChallenge(item.user_id, item.category, item.category_name)}
            style={st.challengeBtn}
          />
        ) : null}
      </Card>
    </Animated.View>
  );
};

// ── Champion d'un thème ──
const TribeCard = ({ tribe, onPress, index = 0 }: { tribe: Tribe; onPress: () => void; index?: number }) => {
  const throne = tribe.throne;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      <Card onPress={onPress} style={st.tribe}>
        <ThemeIcon themeName={tribe.name} superCategory={tribe.pillar_id?.toUpperCase()} size={ICON_SIZE.theme.sm} />
        <Txt variant="cardTitle" align="center" numberOfLines={1}>{tribe.name}</Txt>

        {throne ? (
          <View style={st.throne}>
            <View style={st.throneLabel}>
              <Icon name="crown" size={14} color={COLOR.reward.gold} />
              <Txt variant="caption" color={COLOR.reward.gold}>{t('pilot.social.champion')}</Txt>
            </View>
            <UserAvatar
              avatarUrl={throne.avatar_url}
              avatarSeed={throne.avatar_seed || throne.pseudo}
              pseudo={throne.pseudo}
              size={32}
            />
            <Txt variant="label" color={COLOR.text.primary} align="center" numberOfLines={1} style={st.thronePseudo}>{throne.pseudo}</Txt>
            <Txt variant="caption">{t('players.level_short')} {throne.level}</Txt>
          </View>
        ) : (
          <View style={st.throne}>
            <Icon name="crown" size={24} color={COLOR.text.disabled} />
            <Txt variant="caption" align="center">{t('pilot.social.no_champion')}</Txt>
          </View>
        )}

        <Txt variant="caption" align="center">
          {tribe.member_count} {tribe.member_count !== 1 ? t('players.members_plural') : t('players.members')}
        </Txt>
      </Card>
    </Animated.View>
  );
};

// ── Suggestion du coach ──
const CoachWidget = ({ suggestions, onAction }: {
  suggestions: CoachSuggestion[];
  onAction: (s: CoachSuggestion) => void;
}) => {
  if (!suggestions.length) return null;
  const sug = suggestions[0];
  return (
    <Animated.View entering={SlideInRight.springify().delay(300)}>
      <Card style={st.coach}>
        <View style={st.iconDisc}><Icon name="sparkles" size={ICON_SIZE.md} color={COLOR.text.primary} /></View>
        <View style={st.coachText}>
          <Txt variant="overline">{t('players.coach_label')}</Txt>
          <Txt variant="bodySmall" color={COLOR.text.primary} numberOfLines={3}>{sug.message}</Txt>
        </View>
        <Button label={t('tab.play')} size="sm" haptic={false} onPress={() => onAction(sug)} />
      </Card>
    </Animated.View>
  );
};

// ── Écran ──
export default function PlayersScreen() {
  const { width: winW } = useWindowDimensions();
  const compact = winW < 360;
  const router = useRouter();
  const { onScroll: onTabScroll, hidden: tabHidden } = useTabBar();
  const insets = useSafeAreaInsets();

  // Le header de page est FIXE : quand le header global se replie (safe-area
  // comprise), on compense pour ne pas passer sous la zone caméra.
  const headerSafeStyle = useAnimatedStyle(() => {
    const h = tabHidden ? tabHidden.value : 0;
    return { paddingTop: interpolate(h, [0, 1], [0, insets.top]) };
  });
  const [myId, setMyId] = useState('');
  const [activeSection, setActiveSection] = useState<SectionTab>('pulse');
  const [refreshing, setRefreshing] = useState(false);

  // Activité
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [pulseError, setPulseError] = useState(false);

  // Champions
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [loadingTribes, setLoadingTribes] = useState(true);
  const [tribesError, setTribesError] = useState(false);
  const [selectedPillar, setSelectedPillar] = useState<string>('all');

  // Coach
  const [coachSuggestions, setCoachSuggestions] = useState<CoachSuggestion[]>([]);
  const [coachError, setCoachError] = useState(false);

  // Nom d'univers : celui que renvoie l'API avec les thèmes, sinon le code
  const pillarName = (id: string) =>
    tribes.find((tr) => tr.pillar_id.toLowerCase() === id)?.pillar_name || id.toUpperCase();

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    // Always load tribes (public data)
    loadTribes();
    if (uid) {
      setMyId(uid);
      loadPulse(uid);
      loadCoach(uid);
    } else {
      setLoadingFeed(false);
    }
  };

  const loadPulse = async (uid: string) => {
    setLoadingFeed(true);
    setPulseError(false);
    try {
      const res = await fetch(`${API_URL}/api/social/pulse/${uid}`);
      const data = await res.json();
      setFeed(data.feed || []);
    } catch {
      setPulseError(true);
    }
    setLoadingFeed(false);
  };

  const loadTribes = async () => {
    setLoadingTribes(true);
    setTribesError(false);
    try {
      const res = await fetch(`${API_URL}/api/social/tribes`);
      const data = await res.json();
      setTribes(data.tribes || []);
    } catch {
      setTribesError(true);
    }
    setLoadingTribes(false);
  };

  const loadCoach = async (uid: string) => {
    setCoachError(false);
    try {
      const res = await fetch(`${API_URL}/api/social/coach/${uid}`);
      const data = await res.json();
      setCoachSuggestions(data.suggestions || []);
    } catch {
      setCoachError(true);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (myId) {
      await Promise.all([loadPulse(myId), loadTribes(), loadCoach(myId)]);
    }
    setRefreshing(false);
  }, [myId]);

  // Vrai défi nominatif sur le thème de l'exploit (et non un matchmaking aléatoire).
  const handleChallenge = useCallback((userId: string, category: string, categoryName?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/player-profile?id=${userId}&challenge=1&themeId=${category}&themeName=${encodeURIComponent(categoryName || '')}`);
  }, [router]);

  const handleProfile = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/player-profile?id=${userId}`);
  }, [router]);

  const handleCoachAction = useCallback((sug: CoachSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (sug.category) {
      router.push(`/matchmaking?category=${sug.category}`);
    }
  }, [router]);

  const handleTribePress = useCallback((tribe: Tribe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tribe.playable) {
      router.push(`/category-detail?id=${tribe.id}`);
    }
  }, [router]);

  const filteredTribes = selectedPillar === 'all'
    ? tribes
    : tribes.filter(tr => tr.pillar_id.toLowerCase() === selectedPillar);

  const sections: { key: SectionTab; label: string; icon: IconName }[] = [
    { key: 'pulse', label: t('pilot.social.section_activity'), icon: 'bolt' },
    { key: 'tribus', label: t('pilot.social.section_champions'), icon: 'crown' },
    { key: 'forge', label: t('pilot.social.section_create'), icon: 'forge' },
  ];

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.text.primary} />;

  return (
    <View style={st.container}>

      {/* En-tête de page — compensé quand le header global se replie */}
      <Animated.View style={[st.pageHeader, headerSafeStyle]}>
        <Txt variant="overline">{t('players.header_eyebrow')}</Txt>
        <Txt variant="h1">{t('players.header_title')}</Txt>
      </Animated.View>

      {/* Sections */}
      <View style={st.sectionNav}>
        {sections.map((sec) => (
          <Chip
            key={sec.key}
            label={sec.label}
            // 320 px : sans icône, pour que les 3 libellés tiennent en entier
            icon={compact ? undefined : sec.icon}
            selected={activeSection === sec.key}
            onPress={() => setActiveSection(sec.key)}
            style={st.sectionChip}
          />
        ))}
      </View>

      {/* ─── ACTIVITÉ ─── */}
      {activeSection === 'pulse' && (
        <ScrollView
          contentContainerStyle={st.scroll}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          scrollEventThrottle={16}
        >
          <CoachWidget suggestions={coachSuggestions} onAction={handleCoachAction} />

          {pulseError ? (
            <EmptyState
              icon="offline"
              title={t('pilot.social.load_error')}
              actionLabel={t('common.retry')}
              onAction={() => { setPulseError(false); if (myId) loadPulse(myId); }}
            />
          ) : loadingFeed ? (
            <Loader />
          ) : feed.length === 0 ? (
            <EmptyState icon="bolt" title={t('pilot.social.quiet_title')} message={t('pilot.social.quiet_sub')} />
          ) : (
            feed.map((item, feedIndex) => (
              <ExploitCard
                key={item.id}
                item={item}
                index={feedIndex}
                onChallenge={handleChallenge}
                onProfile={handleProfile}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ─── CHAMPIONS ─── */}
      {activeSection === 'tribus' && (
        <ScrollView
          contentContainerStyle={[st.scroll, st.scrollFlush]}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          scrollEventThrottle={16}
        >
          {/* Filtre par univers */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filters}>
            <Chip
              label={t('pilot.social.all')}
              icon="grid"
              selected={selectedPillar === 'all'}
              onPress={() => setSelectedPillar('all')}
            />
            {UNIVERSE_IDS.map((id) => (
              <Chip
                key={id}
                label={pillarName(id)}
                icon={UNIVERSE_ICON[id]}
                selected={selectedPillar === id}
                onPress={() => setSelectedPillar(id)}
              />
            ))}
          </ScrollView>

          {tribesError ? (
            <EmptyState
              icon="offline"
              title={t('pilot.social.load_error')}
              actionLabel={t('common.retry')}
              onAction={() => { setTribesError(false); loadTribes(); }}
            />
          ) : loadingTribes ? (
            <Loader />
          ) : (
            (() => {
              const grouped: { [key: string]: Tribe[] } = {};
              filteredTribes.forEach(tr => {
                if (!grouped[tr.pillar_id]) grouped[tr.pillar_id] = [];
                grouped[tr.pillar_id].push(tr);
              });
              return Object.entries(grouped).map(([pillarId, pillarTribes]) => (
                <Animated.View key={pillarId} entering={FadeInDown.springify()} style={st.group}>
                  <View style={st.groupHead}>
                    <Icon name={UNIVERSE_ICON[pillarId.toLowerCase()] ?? 'compass'} size={ICON_SIZE.sm} color={COLOR.text.secondary} />
                    <Txt variant="overline" numberOfLines={1}>{pillarTribes[0]?.pillar_name || pillarId}</Txt>
                    <View style={st.groupRule} />
                  </View>
                  {/* FlatList virtualisée : monte 3 cartes, le reste au scroll */}
                  <FlatList
                    horizontal
                    data={pillarTribes}
                    keyExtractor={(tr) => tr.id}
                    renderItem={({ item, index: tribeIndex }) => (
                      <TribeCard tribe={item} index={tribeIndex} onPress={() => handleTribePress(item)} />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={st.carousel}
                    initialNumToRender={3}
                    maxToRenderPerBatch={3}
                    windowSize={3}
                    removeClippedSubviews
                  />
                </Animated.View>
              ));
            })()
          )}
        </ScrollView>
      )}

      {/* ─── CRÉER ─── */}
      {activeSection === 'forge' && (
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          scrollEventThrottle={16}
        >
          {/* Renvoi vers la page unique /create-theme */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Card style={st.forge}>
              <View style={st.forgeIcon}><Icon name="forge" size={ICON_SIZE.xl} color={COLOR.text.primary} /></View>
              <Txt variant="h2" align="center">{t('pilot.social.create_title')}</Txt>
              <Txt variant="body" color={COLOR.text.secondary} align="center">{t('players.forge_subtitle')}</Txt>
              <Button
                label={t('pilot.social.create_cta')}
                icon="plus"
                size="lg"
                fullWidth
                onPress={() => router.push('/create-theme')}
                style={st.forgeCta}
              />
              <Txt variant="caption" align="center">{t('players.generate_hint')}</Txt>
            </Card>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1, gap: SPACE.xxs },
  flexShrink: { flexShrink: 1 },

  pageHeader: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.lg, paddingBottom: SPACE.md, gap: SPACE.xs },
  sectionNav: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.screenX, paddingBottom: SPACE.lg },
  // Largeur selon le libellé (« Champions » est plus long) ; l'espace restant est partagé
  sectionChip: { flexGrow: 1, justifyContent: 'center' },

  // Bas : place réservée à la barre d'onglets flottante
  scroll: { paddingHorizontal: SPACE.screenX, paddingBottom: 120, gap: SPACE.md },
  // Champions : carrousels pleine largeur, marges portées par les rangées
  scrollFlush: { paddingHorizontal: 0, gap: SPACE.xl },

  // Exploit
  exploit: { gap: SPACE.md },
  pressed: { opacity: 0.7 },
  // Pseudo long : coupé à la largeur de la carte (sinon centré et rogné des deux côtés)
  thronePseudo: { alignSelf: 'stretch' },
  exploitRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.touch },
  exploitText: { flex: 1, gap: SPACE.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xxs },
  challengeBtn: { alignSelf: 'flex-start' },

  // Coach
  // Petit écran : le bouton passe sous le message plutôt que de l'écraser (texte ≥ 170 px)
  coach: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.md },
  coachText: { flex: 1, minWidth: 170 },
  iconDisc: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: RADII.md,
    backgroundColor: COLOR.surface.subtle, alignItems: 'center', justifyContent: 'center',
  },

  // Champions
  filters: { gap: SPACE.sm, paddingHorizontal: SPACE.screenX },
  group: { gap: SPACE.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.screenX },
  groupRule: { flex: 1, height: BORDER.hair, backgroundColor: COLOR.border.subtle },
  carousel: { gap: SPACE.md, paddingHorizontal: SPACE.screenX },
  tribe: { width: 156, alignItems: 'center', gap: SPACE.sm },
  throne: { alignSelf: 'stretch', alignItems: 'center', gap: SPACE.xs, minHeight: 104, justifyContent: 'center' },
  throneLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },

  // Créer
  forge: { alignItems: 'center', gap: SPACE.md, padding: SPACE.xxl },
  forgeIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLOR.surface.subtle, alignItems: 'center', justifyContent: 'center',
  },
  forgeCta: { marginTop: SPACE.sm },
});

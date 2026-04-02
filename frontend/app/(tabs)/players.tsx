import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions, FlatList, Modal, Pressable, TextInput, useWindowDimensions,
  RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withDelay, withRepeat, withSequence, Easing, FadeIn, FadeInDown,
  FadeInUp, FadeInLeft, FadeInRight, SlideInRight,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DueloHeader from '../../components/DueloHeader';
import CategoryIcon from '../../components/CategoryIcon';
import { GLASS } from '../../theme/glassTheme';
import CosmicBackground from '../../components/CosmicBackground';
import UserAvatar from '../../components/UserAvatar';
import ScalePressable from '../../components/ScalePressable';
import { t } from '../../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_W } = Dimensions.get('window');

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

// ── Aura Ring (prestige level) ──
const AuraAvatar = ({ letter, level, color, size = 44, avatarUrl, avatarSeed, pseudo }: {
  letter: string; level: number; color: string; size?: number;
  avatarUrl?: string; avatarSeed?: string; pseudo?: string;
}) => {
  const intensity = Math.min(level / 15, 1);
  const auraOpacity = 0.2 + intensity * 0.6;
  return (
    <View style={[auraStyles.wrap, { width: size + 12, height: size + 12 }]}>
      {level > 0 && (
        <View style={[auraStyles.glow, {
          width: size + 12, height: size + 12, borderRadius: (size + 12) / 2,
          backgroundColor: color + Math.round(auraOpacity * 255).toString(16).padStart(2, '0'),
          shadowColor: color,
          shadowOpacity: auraOpacity,
          shadowRadius: 8 + intensity * 8,
        }]} />
      )}
      <UserAvatar
        avatarUrl={avatarUrl}
        avatarSeed={avatarSeed || pseudo || letter}
        pseudo={pseudo || letter}
        size={size}
        borderColor={level > 0 ? color : '#333'}
        borderWidth={level > 3 ? 2 : 1}
      />
    </View>
  );
};

const auraStyles = StyleSheet.create({
  wrap: { justifyContent: 'center', alignItems: 'center' },
  glow: { position: 'absolute', shadowOffset: { width: 0, height: 0 } },
  avatar: {
    backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center',
  },
  letter: { color: '#FFF', fontWeight: '900' },
});

// ── Neon Border Animated (Forge Hero) ──
const ForgeHeroCard = ({ children }: { children: React.ReactNode }) => {
  const glowAnim = useSharedValue(0.3);
  useEffect(() => {
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
  }, []);
  const borderStyle = useAnimatedStyle(() => ({ opacity: glowAnim.value }));
  return (
    <View style={forgeHero.wrap}>
      <Animated.View style={[forgeHero.neonBorder, borderStyle]} />
      <View style={forgeHero.inner}>{children}</View>
    </View>
  );
};

const forgeHero = StyleSheet.create({
  wrap: { borderRadius: 20, overflow: 'hidden', position: 'relative', marginHorizontal: 16, marginBottom: 20 },
  neonBorder: {
    ...StyleSheet.absoluteFillObject, borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(138,43,226,0.6)',
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 15, elevation: 6,
  },
  inner: {
    borderRadius: 20, backgroundColor: 'rgba(138,43,226,0.06)',
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.1)',
  },
});

// ── Pulse title — translated client-side ──
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

// ── Exploit Card (Pulse Feed) ──
const ExploitCard = ({ item, index = 0, onChallenge, onProfile }: {
  item: FeedItem; index?: number; onChallenge: (userId: string, category: string) => void;
  onProfile: (userId: string) => void;
}) => {
  const color = item.pillar_color || item.category_color || '#8A2BE2';
  const isPerfect = item.type === 'perfect';
  const isStreak = item.type === 'streak';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
      <ScalePressable
        style={[exploitStyles.card, { borderColor: color + '20' }]}
        onPress={() => item.user_id && onProfile(item.user_id)}
      >
        {/* Glow background for records */}
        {isPerfect && (
          <View style={[exploitStyles.cardGlow, {
            backgroundColor: color + '08',
            shadowColor: color,
          }]} />
        )}

        <View style={exploitStyles.row}>
          <AuraAvatar
            letter={item.user_pseudo?.[0]?.toUpperCase() || '?'}
            level={item.user_level || 0}
            color={color}
            size={40}
            avatarUrl={item.user_avatar_url}
            avatarSeed={item.user_avatar_seed}
            pseudo={item.user_pseudo}
          />
          <View style={exploitStyles.content}>
            <View style={exploitStyles.titleRow}>
              <MaterialCommunityIcons
                name={isPerfect ? 'star-circle' : isStreak ? 'fire' : 'sword-cross'}
                size={16}
                color={isPerfect ? '#FFD700' : isStreak ? '#FF6B35' : color}
              />
              <Text style={[exploitStyles.title, isPerfect && { color: '#FFD700' }]} numberOfLines={1}>
                {getPulseTitle(item)}
              </Text>
            </View>
            <Text style={exploitStyles.pseudo}>
              @{item.user_pseudo}
              {item.opponent_pseudo && !isStreak ? (
                <Text style={exploitStyles.vs}> {t('players.vs')} {item.opponent_pseudo}</Text>
              ) : null}
            </Text>
            {item.score && (
              <View style={exploitStyles.statsRow}>
                <Text style={[exploitStyles.score, { color }]}>{item.score}</Text>
                {item.xp_earned ? (
                  <Text style={exploitStyles.xpEarned}>+{item.xp_earned} XP</Text>
                ) : null}
                {item.category_name ? (
                  <View style={[exploitStyles.catBadge, { backgroundColor: color + '15', borderColor: color + '30' }]}>
                    <Text style={[exploitStyles.catBadgeText, { color }]}>{item.category_name}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* DÉFIER Button */}
          {item.can_challenge && (
            <TouchableOpacity
              style={[exploitStyles.challengeBtn, { backgroundColor: color + '20', borderColor: color + '40' }]}
              onPress={() => item.user_id && item.category && onChallenge(item.user_id, item.category)}
              activeOpacity={0.7}
            >
              <Text style={[exploitStyles.challengeText, { color }]}>{t('players.challenge')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScalePressable>
    </Animated.View>
  );
};

const exploitStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 10, borderRadius: 16,
    backgroundColor: GLASS.bg, borderWidth: 1,
    padding: 14, overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute', top: -20, left: -20, right: -20, bottom: -20,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 30,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1 },
  pseudo: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  vs: { color: '#555' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  score: { fontSize: 13, fontWeight: '800' },
  xpEarned: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  catBadgeText: { fontSize: 9, fontWeight: '700' },
  challengeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
  },
  challengeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});

// ── Tribe Card ──
const TribeCard = ({ tribe, onPress, accentColor, index = 0 }: { tribe: Tribe; onPress: () => void; accentColor?: string; index?: number }) => {
  const color = accentColor || tribe.pillar_color;
  const hasThrone = !!tribe.throne;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 80).duration(450)}>
    <ScalePressable
      style={[tribeStyles.card, { borderColor: color + '20' }]}
      onPress={onPress}
    >
      <LinearGradient colors={[color + '30', color + '08']} style={tribeStyles.pillarBar} />
      <View style={tribeStyles.content}>
        <LinearGradient colors={[color + '25', color + '08']} style={tribeStyles.iconCircle}>
          <CategoryIcon themeId={tribe.id} emoji={tribe.icon} size={22} color={color} type="theme" />
        </LinearGradient>
        <Text style={[tribeStyles.name, { color: '#FFF' }]} numberOfLines={1}>{tribe.name}</Text>
        <Text style={[tribeStyles.pillarLabel, { color: color + 'AA' }]}>{tribe.pillar_name}</Text>

        {/* Throne */}
        {hasThrone ? (
          <View style={tribeStyles.throneWrap}>
            <View style={tribeStyles.throneLabelRow}>
              <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
              <Text style={tribeStyles.throneLabel}>{t('players.throne')}</Text>
            </View>
            <AuraAvatar
              letter={tribe.throne!.pseudo[0]?.toUpperCase() || '?'}
              level={tribe.throne!.level}
              color={color}
              size={32}
              avatarUrl={tribe.throne!.avatar_url}
              avatarSeed={tribe.throne!.avatar_seed}
              pseudo={tribe.throne!.pseudo}
            />
            <Text style={tribeStyles.thronePseudo} numberOfLines={1}>
              {tribe.throne!.pseudo}
            </Text>
            <Text style={[tribeStyles.throneLevel, { color }]}>
              {t('players.level_short')} {tribe.throne!.level}
            </Text>
          </View>
        ) : (
          <View style={tribeStyles.throneEmpty}>
            <MaterialCommunityIcons name="crown-outline" size={24} color="#444" />
            <Text style={tribeStyles.throneEmptyLabel}>{t('players.throne_vacant')}</Text>
          </View>
        )}

        <View style={tribeStyles.memberRow}>
          <Text style={tribeStyles.memberCount}>
            {tribe.member_count} {tribe.member_count !== 1 ? t('players.members_plural') : t('players.members')}
          </Text>
        </View>
      </View>
    </ScalePressable>
    </Animated.View>
  );
};

const tribeStyles = StyleSheet.create({
  card: {
    width: 160, marginRight: 12, borderRadius: 18,
    backgroundColor: GLASS.bg, borderWidth: 1,
    overflow: 'hidden',
  },
  pillarBar: { height: 3, width: '100%' },
  content: { padding: 12, alignItems: 'center' },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  name: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  pillarLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  throneWrap: { alignItems: 'center', marginBottom: 8 },
  throneLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  throneLabel: { fontSize: 10, fontWeight: '700', color: '#FFD700' },
  thronePseudo: { color: '#CCC', fontSize: 11, fontWeight: '600', marginTop: 4 },
  throneLevel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  throneEmpty: { alignItems: 'center', marginBottom: 8, paddingVertical: 8, gap: 4 },
  throneEmptyLabel: { fontSize: 10, color: '#444', fontWeight: '600' },
  memberRow: { alignItems: 'center' },
  memberCount: { fontSize: 10, color: '#555', fontWeight: '600' },
});

// ── Coach Widget ──
const CoachWidget = ({ suggestions, onAction }: {
  suggestions: CoachSuggestion[];
  onAction: (s: CoachSuggestion) => void;
}) => {
  if (!suggestions.length) return null;
  const s = suggestions[0];
  const color = s.category_color || '#8A2BE2';

  return (
    <Animated.View entering={SlideInRight.springify().delay(300)}>
      <TouchableOpacity
        style={[coachStyles.widget, { borderColor: color + '30' }]}
        onPress={() => onAction(s)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={[color + '25', color + '08']} style={coachStyles.iconWrap}>
          <MaterialCommunityIcons name="robot-outline" size={22} color={color} />
        </LinearGradient>
        <View style={coachStyles.textWrap}>
          <Text style={coachStyles.label}>{t('players.coach_label')}</Text>
          <Text style={coachStyles.message} numberOfLines={2}>{s.message}</Text>
        </View>
        <View style={[coachStyles.goBtn, { backgroundColor: color }]}>
          <Text style={coachStyles.goBtnText}>{t('players.coach_go')}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const coachStyles = StyleSheet.create({
  widget: {
    marginHorizontal: 16, marginBottom: 16, borderRadius: 16,
    backgroundColor: GLASS.bg, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  textWrap: { flex: 1 },
  label: { fontSize: 9, fontWeight: '900', color: '#FFD700', letterSpacing: 2, marginBottom: 3 },
  message: { color: '#CCC', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  goBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
  },
  goBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});

// ── Main Screen ──
export default function PlayersScreen() {
  const router = useRouter();
  const [myId, setMyId] = useState('');
  const [activeSection, setActiveSection] = useState<SectionTab>('pulse');
  const [refreshing, setRefreshing] = useState(false);

  // Pulse
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [pulseError, setPulseError] = useState(false);

  // Tribes
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [loadingTribes, setLoadingTribes] = useState(true);
  const [tribesError, setTribesError] = useState(false);
  const [selectedPillar, setSelectedPillar] = useState<string>('all');

  // Coach
  const [coachSuggestions, setCoachSuggestions] = useState<CoachSuggestion[]>([]);
  const [coachError, setCoachError] = useState(false);

  // Forge
  const [forgeThemeName, setForgeThemeName] = useState('');
  const [forgeDescription, setForgeDescription] = useState('');
  const [forgeLoading, setForgeLoading] = useState(false);
  const [forgeError, setForgeError] = useState('');
  const [forgeResult, setForgeResult] = useState<{ theme_id: string; name: string; question_count: number } | null>(null);


  const pillarFilters = [
    { id: 'all', name: t('players.all_filter'), icon: '🌐', color: '#8A2BE2' },
    { id: 'screen', name: 'SCREEN', icon: '🎬', color: '#8A2BE2' },
    { id: 'sound', name: 'SOUND', icon: '🎵', color: '#FF6B35' },
    { id: 'arena', name: 'ARENA', icon: '⚽', color: '#00FF9D' },
    { id: 'legends', name: 'LEGENDS', icon: '🏛️', color: '#FFD700' },
    { id: 'lab', name: 'LAB', icon: '🔬', color: '#1565C0' },
    { id: 'globe', name: 'GLOBE', icon: '🌍', color: '#4ECDC4' },
    { id: 'art', name: 'ART', icon: '🎨', color: '#E53935' },
    { id: 'life', name: 'LIFE', icon: '🌱', color: '#2E7D32' },
    { id: 'mind', name: 'MIND', icon: '🧠', color: '#FFAB40' },
  ];

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

  const handleChallenge = useCallback((userId: string, category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${category}`);
  }, [router]);

  const handleProfile = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/player-profile?id=${userId}`);
  }, [router]);

  const handleCoachAction = useCallback((s: CoachSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (s.category) {
      router.push(`/matchmaking?category=${s.category}`);
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

  const sectionColor = activeSection === 'pulse' ? '#8A2BE2' : activeSection === 'tribus' ? '#FFD700' : '#10B981';

  return (
    <CosmicBackground>
    <View style={s.container}>

      {/* Section Navigator */}
      <View style={s.sectionNav}>
        {(['pulse', 'tribus', 'forge'] as SectionTab[]).map((section) => {
          const isActive = activeSection === section;
          const meta = {
            pulse: { label: t('players.pulse_label'), icon: 'lightning-bolt' as const, color: '#8A2BE2' },
            tribus: { label: t('players.tribus_label'), icon: 'crown' as const, color: '#FFD700' },
            forge: { label: t('players.forge_label'), icon: 'hammer-wrench' as const, color: '#10B981' },
          }[section];
          return (
            <TouchableOpacity
              key={section}
              style={[s.sectionTab, isActive && { backgroundColor: meta.color + '15', borderColor: meta.color + '40' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveSection(section);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={meta.icon} size={16} color={isActive ? meta.color : '#555'} />
              <Text style={[s.sectionTabLabel, isActive && { color: meta.color }]}>{meta.label}</Text>
              {isActive && <View style={[s.sectionDot, { backgroundColor: meta.color }]} />}
            </TouchableOpacity>
          );
        })}

      </View>

      {/* ─── PULSE SECTION ─── */}
      {activeSection === 'pulse' && (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2BE2" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Coach Widget */}
          <CoachWidget suggestions={coachSuggestions} onAction={handleCoachAction} />

          {/* Feed */}
          {pulseError ? (
            <TouchableOpacity onPress={() => { setPulseError(false); if (myId) loadPulse(myId); }} style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#aaa', fontSize: 14 }}>{t('players.load_error')}</Text>
            </TouchableOpacity>
          ) : loadingFeed ? (
            <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
          ) : feed.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="lightning-bolt" size={48} color="#8A2BE230" />
              <Text style={s.emptyTitle}>{t('players.pulse_quiet')}</Text>
              <Text style={s.emptySub}>{t('players.pulse_quiet_sub')}</Text>
            </View>
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
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ─── TRIBUS SECTION ─── */}
      {activeSection === 'tribus' && (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Pillar Filter */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pillarFilterScroll}
          >
            {pillarFilters.map((pf) => {
              const isActive = selectedPillar === pf.id;
              return (
                <TouchableOpacity
                  key={pf.id}
                  style={[s.pillarFilterChip, isActive && { backgroundColor: pf.color + '20', borderColor: pf.color }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPillar(pf.id);
                  }}
                >
                  <CategoryIcon emoji={pf.icon} size={14} color={isActive ? pf.color : '#666'} type="super" />
                  <Text style={[s.pillarFilterName, { color: isActive ? pf.color : '#666' }]}>{pf.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Group by pillar */}
          {tribesError ? (
            <TouchableOpacity onPress={() => { setTribesError(false); loadTribes(); }} style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#aaa', fontSize: 14 }}>{t('players.load_error')}</Text>
            </TouchableOpacity>
          ) : loadingTribes ? (
            <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 40 }} />
          ) : (
            (() => {
              const grouped: { [key: string]: Tribe[] } = {};
              filteredTribes.forEach(tr => {
                if (!grouped[tr.pillar_id]) grouped[tr.pillar_id] = [];
                grouped[tr.pillar_id].push(tr);
              });
              return Object.entries(grouped).map(([pillarId, pillarTribes]) => {
                const pf = pillarFilters.find(p => p.id === pillarId.toLowerCase());
                return (
                  <Animated.View key={pillarId} entering={FadeInDown.springify()}>
                    <View style={s.tribeGroupHeader}>
                      <CategoryIcon emoji={pf?.icon || '🌐'} size={18} color={pf?.color || '#FFF'} type="super" />
                      <Text style={[s.tribeGroupName, { color: pf?.color || '#FFF' }]}>{pf?.name || pillarId}</Text>
                      <View style={[s.tribeGroupLine, { backgroundColor: (pf?.color || '#333') + '30' }]} />
                    </View>
                    <ScrollView
                      horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.tribeCarousel}
                    >
                      {pillarTribes.map((tribe, tribeIndex) => (
                        <TribeCard key={tribe.id} tribe={tribe} accentColor={pf?.color} index={tribeIndex} onPress={() => handleTribePress(tribe)} />
                      ))}
                    </ScrollView>
                  </Animated.View>
                );
              });
            })()
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ─── FORGE SECTION ─── */}
      {activeSection === 'forge' && (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Forge Hero */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <ForgeHeroCard>
              <View style={forgeStyles.hero}>
                <LinearGradient colors={['rgba(138,43,226,0.25)', 'rgba(138,43,226,0.08)']} style={forgeStyles.heroIconWrap}>
                  <MaterialCommunityIcons name="hammer-wrench" size={32} color="#8A2BE2" />
                </LinearGradient>
                <Text style={forgeStyles.heroTitle}>{t('players.forge_title')}</Text>
                <Text style={forgeStyles.heroSub}>
                  {t('players.forge_subtitle')}
                </Text>
              </View>
            </ForgeHeroCard>
          </Animated.View>

          {/* Create Theme */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View style={forgeStyles.createSection}>
              <Text style={forgeStyles.createLabel}>{t('players.create_theme')}</Text>
              <View style={forgeStyles.inputRow}>
                <TextInput
                  style={forgeStyles.input}
                  placeholder={t('players.theme_placeholder')}
                  placeholderTextColor="#444"
                  value={forgeThemeName}
                  onChangeText={setForgeThemeName}
                  returnKeyType="done"
                />
              </View>
              <View style={forgeStyles.inputRow}>
                <TextInput
                  style={forgeStyles.input}
                  placeholder={t('forge.description_placeholder')}
                  placeholderTextColor="#444"
                  value={forgeDescription}
                  onChangeText={setForgeDescription}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                />
              </View>
              {forgeError ? (
                <Text style={forgeStyles.errorText}>{forgeError}</Text>
              ) : null}
              {forgeResult ? (
                <TouchableOpacity
                  style={forgeStyles.playThemeBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    router.push(`/matchmaking?category=${forgeResult.theme_id}`);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="play-circle" size={18} color="#FFF" />
                  <Text style={forgeStyles.generateBtnText}>{t('forge.play_new_theme')} — {forgeResult.name}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[forgeStyles.generateBtn, (!forgeThemeName.trim() || forgeDescription.trim().length < 10 || forgeLoading) && { opacity: 0.4 }]}
                  onPress={async () => {
                    if (!forgeThemeName.trim() || forgeDescription.trim().length < 10 || forgeLoading) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setForgeLoading(true);
                    setForgeError('');
                    try {
                      const { authFetch } = await import('../../utils/api');
                      const uid = await (await import('@react-native-async-storage/async-storage')).default.getItem('duelo_user_id');
                      const res = await authFetch(`${API_URL}/api/forge/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: uid, name: forgeThemeName.trim(), description: forgeDescription.trim() }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setForgeResult({ theme_id: data.theme_id, name: data.name, question_count: data.question_count });
                        setForgeThemeName('');
                        setForgeDescription('');
                      } else {
                        setForgeError(data.detail || t('forge.error'));
                      }
                    } catch {
                      setForgeError(t('forge.error'));
                    }
                    setForgeLoading(false);
                  }}
                  disabled={forgeLoading}
                  activeOpacity={0.7}
                >
                  {forgeLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialCommunityIcons name="creation" size={18} color="#FFF" />
                  )}
                  <Text style={forgeStyles.generateBtnText}>
                    {forgeLoading ? t('forge.generating') : t('players.generate_ai')}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={forgeStyles.generateHint}>
                {t('players.generate_hint')}
              </Text>
            </View>
          </Animated.View>

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
    </CosmicBackground>
  );
}

// ── Forge Styles ──
const forgeStyles = StyleSheet.create({
  hero: { alignItems: 'center', padding: 24 },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(138,43,226,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 2, marginBottom: 8 },
  heroSub: { fontSize: 13, color: '#888', fontWeight: '600', textAlign: 'center', lineHeight: 20 },

  createSection: { marginHorizontal: 16, marginBottom: 24 },
  createLabel: { fontSize: 11, fontWeight: '900', color: '#525252', letterSpacing: 3, marginBottom: 12 },
  inputRow: { marginBottom: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 14, gap: 8, marginBottom: 8,
  },
  generateBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  generateHint: { fontSize: 11, color: '#555', textAlign: 'center', fontWeight: '500' },
  errorText: { color: '#FF3B5C', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  playThemeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8A2BE2', paddingVertical: 14, borderRadius: 14, gap: 8, marginBottom: 8,
  },

});

// ── Main Styles ──
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingBottom: 20 },

  // Section Nav
  sectionNav: {
    flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 14, gap: 6, alignItems: 'center',
  },
  sectionTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 14, gap: 6,
    backgroundColor: GLASS.bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTabLabel: { fontSize: 11, fontWeight: '900', color: '#555', letterSpacing: 1 },
  sectionDot: { width: 4, height: 4, borderRadius: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 4, marginTop: 12 },
  emptySub: { color: '#525252', fontSize: 13, fontWeight: '500' },

  // Pillar filter
  pillarFilterScroll: { paddingHorizontal: 12, paddingBottom: 16, gap: 6 },
  pillarFilterChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: GLASS.borderSubtle, gap: 4,
  },
  pillarFilterName: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Tribe groups
  tribeGroupHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8,
  },
  tribeGroupName: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  tribeGroupLine: { flex: 1, height: 1, marginLeft: 8 },
  tribeCarousel: { paddingHorizontal: 12, paddingBottom: 12 },
});

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
import DueloHeader from '../../components/DueloHeader';
import { GLASS } from '../../theme/glassTheme';
import CosmicBackground from '../../components/CosmicBackground';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_W } = Dimensions.get('window');

// ── Types ──
type FeedItem = {
  type: string; id: string; user_id?: string;
  user_pseudo?: string; user_avatar_seed?: string; user_level?: number;
  category?: string; category_name?: string; category_color?: string;
  pillar_color?: string; score?: string; correct?: number;
  opponent_pseudo?: string; xp_earned?: number; is_self?: boolean;
  can_challenge?: boolean; icon?: string; title?: string;
  created_at?: string; rival_id?: string; rival_pseudo?: string;
  rival_avatar_seed?: string; rival_level?: number; my_level?: number;
  message?: string;
};

type Tribe = {
  id: string; name: string; icon: string;
  pillar_id: string; pillar_name: string; pillar_color: string;
  playable: boolean;
  throne: {
    id: string; pseudo: string; avatar_seed: string;
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
const AuraAvatar = ({ letter, level, color, size = 44 }: {
  letter: string; level: number; color: string; size?: number;
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
      <View style={[auraStyles.avatar, {
        width: size, height: size, borderRadius: size / 2,
        borderColor: level > 0 ? color : '#333',
        borderWidth: level > 3 ? 2 : 1,
      }]}>
        <Text style={[auraStyles.letter, { fontSize: size * 0.45 }]}>{letter}</Text>
      </View>
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

// ── Exploit Card (Pulse Feed) ──
const ExploitCard = ({ item, onChallenge, onProfile }: {
  item: FeedItem; onChallenge: (userId: string, category: string) => void;
  onProfile: (userId: string) => void;
}) => {
  const color = item.pillar_color || item.category_color || '#8A2BE2';
  const isPerfect = item.type === 'perfect';
  const isStreak = item.type === 'streak';

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <TouchableOpacity
        style={[exploitStyles.card, { borderColor: color + '20' }]}
        onPress={() => item.user_id && onProfile(item.user_id)}
        activeOpacity={0.8}
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
          />
          <View style={exploitStyles.content}>
            <View style={exploitStyles.titleRow}>
              <Text style={exploitStyles.icon}>{item.icon}</Text>
              <Text style={[exploitStyles.title, isPerfect && { color: '#FFD700' }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <Text style={exploitStyles.pseudo}>
              @{item.user_pseudo}
              {item.opponent_pseudo && !isStreak ? (
                <Text style={exploitStyles.vs}> vs {item.opponent_pseudo}</Text>
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
              <Text style={[exploitStyles.challengeText, { color }]}>DÉFIER</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
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
  icon: { fontSize: 16 },
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
const TribeCard = ({ tribe, onPress }: { tribe: Tribe; onPress: () => void }) => {
  const color = tribe.pillar_color;
  const hasThrone = !!tribe.throne;

  return (
    <TouchableOpacity
      style={[tribeStyles.card, { borderColor: color + '20' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[tribeStyles.pillarBar, { backgroundColor: color }]} />
      <View style={tribeStyles.content}>
        <Text style={tribeStyles.icon}>{tribe.icon}</Text>
        <Text style={[tribeStyles.name, { color: '#FFF' }]} numberOfLines={1}>{tribe.name}</Text>
        <Text style={[tribeStyles.pillarLabel, { color: color + 'AA' }]}>{tribe.pillar_name}</Text>

        {/* Throne */}
        {hasThrone ? (
          <View style={tribeStyles.throneWrap}>
            <Text style={tribeStyles.throneLabel}>👑 Trône</Text>
            <AuraAvatar
              letter={tribe.throne!.pseudo[0]?.toUpperCase() || '?'}
              level={tribe.throne!.level}
              color={color}
              size={32}
            />
            <Text style={tribeStyles.thronePseudo} numberOfLines={1}>
              {tribe.throne!.pseudo}
            </Text>
            <Text style={[tribeStyles.throneLevel, { color }]}>
              Niv. {tribe.throne!.level}
            </Text>
          </View>
        ) : (
          <View style={tribeStyles.throneEmpty}>
            <Text style={tribeStyles.throneEmptyText}>👑</Text>
            <Text style={tribeStyles.throneEmptyLabel}>Trône vacant</Text>
          </View>
        )}

        <View style={tribeStyles.memberRow}>
          <Text style={tribeStyles.memberCount}>
            {tribe.member_count} membre{tribe.member_count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
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
  icon: { fontSize: 28, marginBottom: 6 },
  name: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  pillarLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  throneWrap: { alignItems: 'center', marginBottom: 8 },
  throneLabel: { fontSize: 10, fontWeight: '700', color: '#FFD700', marginBottom: 6 },
  thronePseudo: { color: '#CCC', fontSize: 11, fontWeight: '600', marginTop: 4 },
  throneLevel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  throneEmpty: { alignItems: 'center', marginBottom: 8, paddingVertical: 8 },
  throneEmptyText: { fontSize: 24, marginBottom: 4 },
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
        <View style={[coachStyles.iconWrap, { backgroundColor: color + '20' }]}>
          <Text style={coachStyles.icon}>{s.icon || '🤖'}</Text>
        </View>
        <View style={coachStyles.textWrap}>
          <Text style={coachStyles.label}>COACH DUELO</Text>
          <Text style={coachStyles.message} numberOfLines={2}>{s.message}</Text>
        </View>
        <View style={[coachStyles.goBtn, { backgroundColor: color }]}>
          <Text style={coachStyles.goBtnText}>GO</Text>
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
  icon: { fontSize: 22 },
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

  // Tribes
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [loadingTribes, setLoadingTribes] = useState(true);
  const [selectedPillar, setSelectedPillar] = useState<string>('all');

  // Coach
  const [coachSuggestions, setCoachSuggestions] = useState<CoachSuggestion[]>([]);

  // Forge
  const [forgeThemeName, setForgeThemeName] = useState('');

  // Messages (keep accessible)
  const [totalUnread, setTotalUnread] = useState(0);

  const pillarFilters = [
    { id: 'all', name: 'TOUS', icon: '🌐', color: '#8A2BE2' },
    { id: 'screen', name: 'SCREEN', icon: '🎬', color: '#8B5CF6' },
    { id: 'sound', name: 'SOUND', icon: '🎵', color: '#6366F1' },
    { id: 'lab', name: 'LAB', icon: '🔬', color: '#06B6D4' },
    { id: 'arena', name: 'ARENA', icon: '⚽', color: '#84CC16' },
    { id: 'legends', name: 'LEGENDS', icon: '🏛️', color: '#F59E0B' },
    { id: 'globe', name: 'GLOBE', icon: '🌍', color: '#F97316' },
    { id: 'art', name: 'ART', icon: '🎨', color: '#D946EF' },
    { id: 'mind', name: 'MIND', icon: '📖', color: '#3B82F6' },
    { id: 'life', name: 'LIFE', icon: '🌿', color: '#10B981' },
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
      fetchUnreadCount(uid);
    } else {
      setLoadingFeed(false);
    }
  };

  const loadPulse = async (uid: string) => {
    setLoadingFeed(true);
    try {
      const res = await fetch(`${API_URL}/api/social/pulse/${uid}`);
      const data = await res.json();
      setFeed(data.feed || []);
    } catch (e) { console.log('Pulse error:', e); }
    setLoadingFeed(false);
  };

  const loadTribes = async () => {
    setLoadingTribes(true);
    try {
      const res = await fetch(`${API_URL}/api/social/tribes`);
      const data = await res.json();
      setTribes(data.tribes || []);
    } catch (e) { console.log('Tribes error:', e); }
    setLoadingTribes(false);
  };

  const loadCoach = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/social/coach/${uid}`);
      const data = await res.json();
      setCoachSuggestions(data.suggestions || []);
    } catch (e) { console.log('Coach error:', e); }
  };

  const fetchUnreadCount = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/unread-count/${uid}`);
      const data = await res.json();
      setTotalUnread(data.unread_count || 0);
    } catch {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (myId) {
      await Promise.all([loadPulse(myId), loadTribes(), loadCoach(myId)]);
    }
    setRefreshing(false);
  };

  const handleChallenge = (userId: string, category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/matchmaking?category=${category}`);
  };

  const handleProfile = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/player-profile?id=${userId}`);
  };

  const handleCoachAction = (s: CoachSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (s.category) {
      router.push(`/matchmaking?category=${s.category}`);
    }
  };

  const handleTribePress = (tribe: Tribe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tribe.playable) {
      router.push(`/category-detail?id=${tribe.id}`);
    }
  };

  const filteredTribes = selectedPillar === 'all'
    ? tribes
    : tribes.filter(t => t.pillar_id === selectedPillar);

  const sectionColor = activeSection === 'pulse' ? '#8A2BE2' : activeSection === 'tribus' ? '#FFD700' : '#10B981';

  return (
    <CosmicBackground>
    <View style={s.container}>

      {/* Section Navigator */}
      <View style={s.sectionNav}>
        {(['pulse', 'tribus', 'forge'] as SectionTab[]).map((section) => {
          const isActive = activeSection === section;
          const meta = {
            pulse: { label: 'PULSE', icon: '⚡', color: '#8A2BE2' },
            tribus: { label: 'TRIBUS', icon: '👑', color: '#FFD700' },
            forge: { label: 'FORGE', icon: '⚒️', color: '#10B981' },
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
              <Text style={s.sectionTabIcon}>{meta.icon}</Text>
              <Text style={[s.sectionTabLabel, isActive && { color: meta.color }]}>{meta.label}</Text>
              {isActive && <View style={[s.sectionDot, { backgroundColor: meta.color }]} />}
            </TouchableOpacity>
          );
        })}

        {/* Messages shortcut */}
        <TouchableOpacity
          style={s.msgShortcut}
          onPress={() => router.push('/search')}
          activeOpacity={0.7}
        >
          <Text style={s.msgIcon}>💬</Text>
          {totalUnread > 0 && (
            <View style={s.msgBadge}>
              <Text style={s.msgBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </TouchableOpacity>
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
          {loadingFeed ? (
            <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
          ) : feed.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>⚡</Text>
              <Text style={s.emptyTitle}>Le Pulse est calme</Text>
              <Text style={s.emptySub}>Lance un match pour animer le feed !</Text>
            </View>
          ) : (
            feed.map((item) => (
              <ExploitCard
                key={item.id}
                item={item}
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
                  <Text style={s.pillarFilterIcon}>{pf.icon}</Text>
                  <Text style={[s.pillarFilterName, { color: isActive ? pf.color : '#666' }]}>{pf.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Group by pillar */}
          {loadingTribes ? (
            <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 40 }} />
          ) : (
            (() => {
              const grouped: { [key: string]: Tribe[] } = {};
              filteredTribes.forEach(t => {
                if (!grouped[t.pillar_id]) grouped[t.pillar_id] = [];
                grouped[t.pillar_id].push(t);
              });
              return Object.entries(grouped).map(([pillarId, pillarTribes]) => {
                const pf = pillarFilters.find(p => p.id === pillarId);
                return (
                  <Animated.View key={pillarId} entering={FadeInDown.springify()}>
                    <View style={s.tribeGroupHeader}>
                      <Text style={s.tribeGroupIcon}>{pf?.icon || '🌐'}</Text>
                      <Text style={[s.tribeGroupName, { color: pf?.color || '#FFF' }]}>{pf?.name || pillarId}</Text>
                      <View style={[s.tribeGroupLine, { backgroundColor: (pf?.color || '#333') + '30' }]} />
                    </View>
                    <ScrollView
                      horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.tribeCarousel}
                    >
                      {pillarTribes.map((tribe) => (
                        <TribeCard key={tribe.id} tribe={tribe} onPress={() => handleTribePress(tribe)} />
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
                <View style={forgeStyles.heroIconWrap}>
                  <Text style={forgeStyles.heroIcon}>⚒️</Text>
                </View>
                <Text style={forgeStyles.heroTitle}>La Forge</Text>
                <Text style={forgeStyles.heroSub}>
                  Crée ton propre thème de quiz{'\n'}
                  et défie la communauté
                </Text>
              </View>
            </ForgeHeroCard>
          </Animated.View>

          {/* Create Theme */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View style={forgeStyles.createSection}>
              <Text style={forgeStyles.createLabel}>CRÉER UN THÈME</Text>
              <View style={forgeStyles.inputRow}>
                <TextInput
                  style={forgeStyles.input}
                  placeholder="Nom du thème (ex: Dragon Ball, NBA, Harry Potter...)"
                  placeholderTextColor="#444"
                  value={forgeThemeName}
                  onChangeText={setForgeThemeName}
                  returnKeyType="done"
                />
              </View>
              <TouchableOpacity
                style={[forgeStyles.generateBtn, !forgeThemeName.trim() && { opacity: 0.4 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  // TODO: AI generation
                }}
                disabled={!forgeThemeName.trim()}
                activeOpacity={0.7}
              >
                <Text style={forgeStyles.generateBtnIcon}>✨</Text>
                <Text style={forgeStyles.generateBtnText}>Générer avec l'IA</Text>
              </TouchableOpacity>
              <Text style={forgeStyles.generateHint}>
                L'IA génère 5 questions + un logo pour validation
              </Text>
            </View>
          </Animated.View>

          {/* Community Themes */}
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={forgeStyles.communitySection}>
              <Text style={forgeStyles.communityLabel}>THÈMES COMMUNAUTAIRES</Text>
              <Text style={forgeStyles.communityHint}>
                Les thèmes les plus joués et les mieux notés seront promus "Thèmes Officiels"
              </Text>

              {/* Placeholder community themes */}
              {[
                { name: 'One Piece', author: 'Luffy_Fan', votes: 42, icon: '🏴‍☠️', color: '#F97316' },
                { name: 'Formule 1', author: 'SpeedKing', votes: 38, icon: '🏎️', color: '#EF4444' },
                { name: 'K-Pop', author: 'BTS_Army', votes: 31, icon: '🎤', color: '#EC4899' },
              ].map((theme, i) => (
                <Animated.View key={i} entering={FadeInDown.delay(400 + i * 80).springify()}>
                  <View style={[forgeStyles.communityCard, { borderColor: theme.color + '20' }]}>
                    <View style={[forgeStyles.communityIconWrap, { backgroundColor: theme.color + '15' }]}>
                      <Text style={forgeStyles.communityIcon}>{theme.icon}</Text>
                    </View>
                    <View style={forgeStyles.communityInfo}>
                      <Text style={forgeStyles.communityName}>{theme.name}</Text>
                      <Text style={forgeStyles.communityAuthor}>Créé par @{theme.author}</Text>
                    </View>
                    <View style={forgeStyles.voteSection}>
                      <TouchableOpacity style={[forgeStyles.voteBtn, { borderColor: theme.color + '40' }]}>
                        <Text style={[forgeStyles.voteIcon, { color: theme.color }]}>▲</Text>
                      </TouchableOpacity>
                      <Text style={[forgeStyles.voteCount, { color: theme.color }]}>{theme.votes}</Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
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
  heroIcon: { fontSize: 32 },
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
  generateBtnIcon: { fontSize: 18 },
  generateBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  generateHint: { fontSize: 11, color: '#555', textAlign: 'center', fontWeight: '500' },

  communitySection: { marginHorizontal: 16 },
  communityLabel: { fontSize: 11, fontWeight: '900', color: '#525252', letterSpacing: 3, marginBottom: 8 },
  communityHint: { fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 16, lineHeight: 17 },
  communityCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16,
    backgroundColor: GLASS.bg, borderWidth: 1, marginBottom: 10, gap: 12,
  },
  communityIconWrap: {
    width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  communityIcon: { fontSize: 22 },
  communityInfo: { flex: 1 },
  communityName: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  communityAuthor: { color: '#666', fontSize: 11, fontWeight: '600' },
  voteSection: { alignItems: 'center', gap: 4 },
  voteBtn: {
    width: 34, height: 28, borderRadius: 8, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center',
  },
  voteIcon: { fontSize: 14, fontWeight: '800' },
  voteCount: { fontSize: 13, fontWeight: '800' },
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
  sectionTabIcon: { fontSize: 16 },
  sectionTabLabel: { fontSize: 11, fontWeight: '900', color: '#555', letterSpacing: 1 },
  sectionDot: { width: 4, height: 4, borderRadius: 2 },
  msgShortcut: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  msgIcon: { fontSize: 18 },
  msgBadge: {
    position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
  },
  msgBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptySub: { color: '#525252', fontSize: 13, fontWeight: '500' },

  // Pillar filter
  pillarFilterScroll: { paddingHorizontal: 12, paddingBottom: 16, gap: 6 },
  pillarFilterChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: GLASS.borderSubtle, gap: 4,
  },
  pillarFilterIcon: { fontSize: 14 },
  pillarFilterName: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Tribe groups
  tribeGroupHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8,
  },
  tribeGroupIcon: { fontSize: 18 },
  tribeGroupName: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  tribeGroupLine: { flex: 1, height: 1, marginLeft: 8 },
  tribeCarousel: { paddingHorizontal: 12, paddingBottom: 12 },
});

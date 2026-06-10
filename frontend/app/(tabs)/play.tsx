import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withRepeat, withSequence, withDelay, FadeInDown, Easing,
} from 'react-native-reanimated';
import CosmicBackground from '../../components/CosmicBackground';
import CategoryIcon from '../../components/CategoryIcon';
import { t } from '../../utils/i18n';
import { FONTS } from '../../theme/fonts';

const CYAN = '#00E5FF';
const VIOLET = '#B366FF';
const GOLD = '#FFB547';
const FIRE = '#FF6B2C';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type SuperCategory = {
  id: string;
  label: string;
  icon: string;
  color: string;
  clusters: { name: string; icon: string; theme_count: number }[];
  total_themes: number;
};

const UPCOMING_CATS = [
  { id: 'SOUND', label: 'Sound', icon: '🎵', color: '#FF6B35' },
  { id: 'ARENA', label: 'Arena', icon: '⚽', color: '#00FF9D' },
  { id: 'LEGENDS', label: 'Legends', icon: '🏛️', color: '#FFD700' },
  { id: 'LAB', label: 'Lab', icon: '🔬', color: '#1565C0' },
  { id: 'TASTE', label: 'Taste', icon: '🍽️', color: '#FF69B4' },
  { id: 'GLOBE', label: 'Globe', icon: '🌍', color: '#4ECDC4' },
  { id: 'PIXEL', label: 'Pixel', icon: '🎮', color: '#FF3B5C' },
  { id: 'STYLE', label: 'Style', icon: '✨', color: '#E040FB' },
];

function SuperCard({ cat, index, onPress }: { cat: SuperCategory; index: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const shimmerX = useSharedValue(-300);

  useEffect(() => {
    shimmerX.value = withDelay(
      1000 + index * 400,
      withRepeat(
        withSequence(
          withTiming(550, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withDelay(4500, withTiming(-300, { duration: 0 }))
        ),
        -1, false
      )
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const shimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shimmerX.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 90).duration(500)} style={cardStyle}>
      <TouchableOpacity
        style={styles.superCard}
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 80 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 180 }); }}
        activeOpacity={1}
      >
        <LinearGradient colors={[cat.color + '30', 'transparent']} style={styles.cardTopGlow} />
        <LinearGradient colors={[cat.color, cat.color + '40']} style={styles.cardAccent} />

        <View style={styles.superCardContent}>
          <View style={styles.superCardTop}>
            <LinearGradient colors={[cat.color + '35', cat.color + '15']} style={styles.superIconCircle}>
              <CategoryIcon emoji={cat.icon} size={28} color={cat.color} type="super" />
            </LinearGradient>
            <View style={styles.superCardInfo}>
              <Text style={[styles.superLabel, { color: cat.color }]}>{cat.label.toUpperCase()}</Text>
              <Text style={styles.superMeta}>{cat.total_themes} {t('play.themes_count')}</Text>
            </View>
            <View style={[styles.arrowCircle, { backgroundColor: cat.color + '18' }]}>
              <Text style={[styles.arrowText, { color: cat.color }]}>›</Text>
            </View>
          </View>
          <View style={styles.clustersPreview}>
            {cat.clusters.map((cluster) => (
              <View key={cluster.name} style={[styles.clusterPill, { borderColor: cat.color + '20' }]}>
                <CategoryIcon emoji={cluster.icon} size={13} color="rgba(255,255,255,0.7)" type="cluster" />
                <Text style={styles.clusterPillText}>{cluster.name}</Text>
                <View style={[styles.clusterCountBadge, { backgroundColor: cat.color + '25' }]}>
                  <Text style={[styles.clusterPillCount, { color: cat.color }]}>{cluster.theme_count}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* C — Shimmer diagonal */}
        <Animated.View pointerEvents="none" style={[styles.shimmerOverlay, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ width: 80, height: '400%', marginTop: '-150%', transform: [{ rotate: '25deg' }] }}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PlayScreen() {
  const router = useRouter();
  const [superCategories, setSuperCategories] = useState<SuperCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Les tournois ont lieu du vendredi au dimanche (cf. crons backend)
  const day = new Date().getDay();
  const isTournamentLive = day === 5 || day === 6 || day === 0;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoadError(false);
      const uid = await AsyncStorage.getItem('duelo_user_id');
      // #44 — pass userId so the API can personalise results (e.g. followed themes)
      const url = uid
        ? `${API_URL}/api/explore/super-categories?user_id=${uid}`
        : `${API_URL}/api/explore/super-categories`;
      const res = await fetch(url);
      const data = await res.json();
      setSuperCategories(data);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  };

  const handlePress = (cat: SuperCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/super-category?id=${cat.id}`);
  };

  if (loading) {
    return (
      <CosmicBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CYAN} />
        </View>
      </CosmicBackground>
    );
  }

  if (loadError) {
    return (
      <CosmicBackground>
        <View style={styles.loadingContainer}>
          <TouchableOpacity onPress={() => { setLoadError(false); setLoading(true); loadData(); }} style={{ padding: 20, alignItems: 'center' }}>
            <MaterialCommunityIcons name="refresh" size={32} color={CYAN} style={{ marginBottom: 10 }} />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{t('play.load_error')}</Text>
          </TouchableOpacity>
        </View>
      </CosmicBackground>
    );
  }

  const loadedIds = new Set(superCategories.map(sc => sc.id));
  const upcomingFiltered = UPCOMING_CATS.filter(c => !loadedIds.has(c.id));

  return (
    <CosmicBackground>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header — modes de jeu */}
          <View style={styles.pageHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modesEyebrow}>◆ {t('play.modes_eyebrow')}</Text>
              <Text style={styles.modesTitle}>{t('play.modes_title')}</Text>
            </View>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => router.push('/search')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={CYAN} />
            </TouchableOpacity>
          </View>

          {/* Quick Match — gros bloc gradient */}
          <Animated.View entering={FadeInDown.duration(450)}>
            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.88}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.push('/matchmaking');
              }}
            >
              <LinearGradient
                colors={[CYAN, VIOLET]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.quickGradient}
              >
                <Text style={styles.quickWatermark}>⚔</Text>
                <Text style={styles.quickEyebrow}>◆ {t('play.random').toUpperCase()} · ~8s</Text>
                <Text style={styles.quickTitle}>QUICK MATCH</Text>
                <Text style={styles.quickSub}>{t('play.quick_sub')}</Text>
                <View style={styles.quickCta}>
                  <Text style={styles.quickCtaText}>{t('tournament.play_now')} →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Autres modes */}
          <Animated.View entering={FadeInDown.delay(80).duration(450)}>
            <TouchableOpacity
              style={[styles.modeRow, { backgroundColor: 'rgba(179,102,255,0.07)', borderColor: 'rgba(179,102,255,0.21)' }]}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/players');
              }}
            >
              <View style={[styles.modeIconTile, { backgroundColor: 'rgba(179,102,255,0.15)', borderColor: 'rgba(179,102,255,0.31)' }]}>
                <Text style={styles.modeIcon}>⚔</Text>
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>{t('play.challenge_friend')}</Text>
                <Text style={styles.modeSub}>{t('play.challenge_friend_sub')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={VIOLET} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeRow, { backgroundColor: 'rgba(255,181,71,0.07)', borderColor: 'rgba(255,181,71,0.21)' }]}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/tournament');
              }}
            >
              <View style={[styles.modeIconTile, { backgroundColor: 'rgba(255,181,71,0.15)', borderColor: 'rgba(255,181,71,0.31)' }]}>
                <Text style={styles.modeIcon}>🏆</Text>
              </View>
              <View style={styles.modeInfo}>
                <View style={styles.modeTitleRow}>
                  <Text style={styles.modeTitle}>{t('tournament.weekend_title')}</Text>
                  {isTournamentLive && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modeSub}>{t('tournament.weekend_hint')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={GOLD} />
            </TouchableOpacity>
          </Animated.View>

          {/* Univers */}
          <Text style={styles.sectionEyebrow}>◆ {t('play.super_categories')}</Text>

          {superCategories.map((cat, index) => (
            <SuperCard key={cat.id} cat={cat} index={index} onPress={() => handlePress(cat)} />
          ))}

          {upcomingFiltered.length > 0 && (
            <>
              <Text style={styles.comingSoonTitle}>BIENTÔT</Text>
              <View style={styles.upcomingGrid}>
                {upcomingFiltered.map((c) => (
                  <View key={c.id} style={styles.upcomingCard}>
                    <View style={styles.upcomingInner}>
                      <LinearGradient colors={[c.color + '25', 'transparent']} style={styles.upcomingGlow} />
                      <View style={[styles.upcomingIconCircle, { backgroundColor: c.color + '18' }]}>
                        <Text style={styles.upcomingIcon}>{c.icon}</Text>
                      </View>
                      <Text style={[styles.upcomingLabel, { color: c.color }]}>{c.label.toUpperCase()}</Text>
                      <MaterialCommunityIcons name="lock-outline" size={11} color="rgba(255,255,255,0.3)" />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 30 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18,
  },
  modesEyebrow: {
    fontSize: 10, fontFamily: FONTS.mono.bold, color: CYAN,
    letterSpacing: 2.5, textTransform: 'uppercase',
  },
  modesTitle: {
    fontSize: 28, fontFamily: FONTS.display.bold, color: '#FFF',
    letterSpacing: -1, lineHeight: 31, marginTop: 4, textTransform: 'uppercase',
  },

  // Quick Match hero
  quickCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 22, overflow: 'hidden',
    shadowColor: VIOLET, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 28, elevation: 10,
  },
  quickGradient: { padding: 22, overflow: 'hidden' },
  quickWatermark: {
    position: 'absolute', top: -24, right: -8,
    fontSize: 120, color: 'rgba(255,255,255,0.18)',
  },
  quickEyebrow: {
    fontSize: 9, fontFamily: FONTS.mono.bold, color: 'rgba(0,0,0,0.70)',
    letterSpacing: 2,
  },
  quickTitle: {
    fontSize: 32, fontFamily: FONTS.display.bold, color: '#000',
    letterSpacing: -1, lineHeight: 34, marginTop: 4,
  },
  quickSub: {
    fontSize: 12, fontFamily: FONTS.display.semiBold, color: 'rgba(0,0,0,0.65)',
    marginTop: 4,
  },
  quickCta: {
    alignSelf: 'flex-start', marginTop: 12,
    backgroundColor: '#000', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  quickCtaText: { color: '#FFF', fontSize: 13, fontFamily: FONTS.display.bold },

  // Lignes de modes
  modeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 8,
    padding: 16, borderRadius: 16, borderWidth: 1,
  },
  modeIconTile: {
    width: 50, height: 50, borderRadius: 14, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  modeIcon: { fontSize: 24 },
  modeInfo: { flex: 1 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeTitle: { fontSize: 16, fontFamily: FONTS.display.bold, color: '#FFF' },
  modeSub: { fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 2 },
  liveBadge: {
    backgroundColor: FIRE, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  liveBadgeText: {
    color: '#FFF', fontSize: 8, fontFamily: FONTS.display.bold, letterSpacing: 1,
  },
  sectionEyebrow: {
    fontSize: 10, fontFamily: FONTS.mono.bold, color: 'rgba(255,255,255,0.40)',
    letterSpacing: 2.5, textTransform: 'uppercase',
    paddingHorizontal: 20, marginTop: 14, marginBottom: 10,
  },
  searchBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  comingSoonTitle: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 3,
    marginBottom: 12, paddingHorizontal: 20, marginTop: 8,
  },

  // Super Category Card
  superCard: {
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTopGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 80,
  },
  cardAccent: {
    position: 'absolute', top: 12, bottom: 12, left: 0, width: 3,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
  },
  superCardContent: {
    padding: 16, paddingLeft: 18,
  },
  superCardTop: {
    flexDirection: 'row', alignItems: 'center',
  },
  superIconCircle: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
  },
  superIcon: { fontSize: 28 },
  superCardInfo: { flex: 1, marginLeft: 14 },
  superLabel: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  superMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginTop: 3 },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  arrowText: { fontSize: 22, fontWeight: '600', marginTop: -2 },

  // Clusters preview
  clustersPreview: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 8,
  },
  clusterPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    gap: 5,
    borderWidth: 1,
  },
  clusterPillIcon: { fontSize: 13 },
  clusterPillText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  clusterCountBadge: {
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  clusterPillCount: { fontSize: 10, fontWeight: '800' },

  shimmerOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    overflow: 'hidden', borderRadius: 20,
  },

  // Upcoming
  upcomingGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14,
  },
  upcomingCard: { width: '25%', padding: 4 },
  upcomingInner: {
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  upcomingGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
  },
  upcomingIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  upcomingIcon: { fontSize: 18 },
  upcomingLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  lockText: { fontSize: 9, opacity: 0.6 },
});

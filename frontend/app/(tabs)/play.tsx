import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import CosmicBackground from '../../components/CosmicBackground';
import CategoryIcon from '../../components/CategoryIcon';
import ScalePressable from '../../components/ScalePressable';
import { t } from '../../utils/i18n';
import { FONTS } from '../../theme/fonts';

const CYAN = '#00E5FF';
const VIOLET = '#B366FF';
const GOLD = '#FFB547';
const FIRE = '#FF6B2C';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_W } = Dimensions.get('window');

// Grille 2 colonnes de tuiles carrées teintées (pattern écran 6 du handoff)
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - 16 * 2 - GRID_GAP) / 2;

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

// Tuile carrée teintée — même pattern que l'écran Thèmes (écran 6 du handoff)
function UniverseTile({ cat, index, onPress }: { cat: SuperCategory; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 70).duration(450)}>
      <ScalePressable style={styles.tile} onPress={onPress}>
        <LinearGradient
          colors={[cat.color + '25', cat.color + '08']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
        />
        <View style={styles.tileIcon}>
          <CategoryIcon emoji={cat.icon} size={34} color={cat.color} type="super" />
        </View>
        <View>
          <Text style={styles.tileName} numberOfLines={1}>{cat.label}</Text>
          <Text style={[styles.tileStat, { color: cat.color }]}>
            {cat.total_themes} {t('play.themes_count').toUpperCase()}
          </Text>
        </View>
        <View style={[styles.tileBorder, { borderColor: cat.color + '40' }]} pointerEvents="none" />
      </ScalePressable>
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

          {/* Univers — grille 2 colonnes de tuiles teintées */}
          <Text style={styles.sectionEyebrow}>◆ {t('play.super_categories')}</Text>

          <View style={styles.tileGrid}>
            {superCategories.map((cat, index) => (
              <UniverseTile key={cat.id} cat={cat} index={index} onPress={() => handlePress(cat)} />
            ))}
          </View>

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

  // Tuiles univers — grille 2 colonnes (pattern écran 6)
  tileGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: GRID_GAP,
  },
  tile: {
    width: TILE_W, aspectRatio: 1 / 1.05,
    borderRadius: 18, padding: 16,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  tileBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1,
  },
  tileIcon: { alignSelf: 'flex-start' },
  tileName: {
    color: '#FFF', fontSize: 15, fontFamily: FONTS.display.bold, letterSpacing: -0.3,
  },
  tileStat: {
    fontFamily: FONTS.mono.regular, fontSize: 9, letterSpacing: 1, marginTop: 2,
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

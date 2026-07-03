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
import CategoryIcon from '../../components/CategoryIcon';
import ScalePressable from '../../components/ScalePressable';
import { useTabBar } from '../../contexts/TabBarContext';
import { COLORS, RADIUS } from '../../theme/tokens';
import { FONTS } from '../../theme/fonts';
import { t } from '../../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_W } = Dimensions.get('window');

// Grille 2 colonnes de tuiles carrées teintées (écran 6 du handoff)
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - 16 * 2 - GRID_GAP) / 2;

type ClusterInfo = { name: string; icon: string; theme_count: number };

type SuperCategory = {
  id: string; label: string; icon: string; color: string;
  clusters: ClusterInfo[]; total_themes: number;
};

// Univers teasés verrouillés (déplacé depuis l'écran Jouer)
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

export default function ThemesScreen() {
  const router = useRouter();
  const { onScroll: onTabScroll } = useTabBar();
  const [cats, setCats] = useState<SuperCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    setLoadError(false);
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      const url = uid
        ? `${API_URL}/api/explore/super-categories?user_id=${uid}`
        : `${API_URL}/api/explore/super-categories`;
      const res = await fetch(url);
      const data = await res.json();
      setCats(Array.isArray(data) ? data : []);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  };

  const openUniverse = (cat: SuperCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/super-category?id=${cat.id}`);
  };

  const loadedIds = new Set(cats.map(c => c.id));
  const upcomingFiltered = UPCOMING_CATS.filter(c => !loadedIds.has(c.id));

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.loadCenter}>
          <ActivityIndicator size="large" color={COLORS.violet} />
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ flex: 1 }}>
        <View style={s.container}>
          <View style={s.loadCenter}>
            <TouchableOpacity onPress={() => { setLoadError(false); setLoading(true); loadCategories(); }} style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#aaa', fontSize: 14 }}>{t('themes.load_error')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Vedette = l'univers le plus fourni ; le reste part en grille
  const featured = cats.reduce<SuperCategory | null>(
    (best, c) => (!best || c.total_themes > best.total_themes ? c : best), null);
  const rest = cats.filter(c => c.id !== featured?.id);

  return (
    <View style={{ flex: 1 }}>
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={onTabScroll} scrollEventThrottle={16}>

        {/* ── Header Arène ── */}
        <View style={s.arenaHeader}>
          <Text style={s.arenaEyebrow}>◆ {t('themes.arena_eyebrow')}</Text>
          <Text style={s.arenaTitle}>{t('themes.arena_title')}</Text>
        </View>

        {/* ── Vedette — gradient violet→cyan, texte noir (écran 6) ── */}
        {featured && (
          <Animated.View entering={FadeInDown.duration(450)}>
            <TouchableOpacity style={s.featuredCard} activeOpacity={0.88} onPress={() => openUniverse(featured)}>
              <LinearGradient
                colors={[COLORS.violet, COLORS.cyan]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.featuredWatermark}>
                <CategoryIcon emoji={featured.icon} size={130} color="#000" type="super" />
              </View>
              <View style={s.featuredBadge}>
                <Text style={s.featuredBadgeText}>◆ {t('themes.featured_badge')}</Text>
              </View>
              <Text style={s.featuredTitle}>{featured.label.toUpperCase()}</Text>
              <Text style={s.featuredCount}>
                {featured.total_themes} {t('themes.themes_count').toUpperCase()}
              </Text>
              <View style={s.featuredClusters}>
                {featured.clusters.slice(0, 3).map((cl) => (
                  <View key={cl.name} style={s.featuredClusterChip}>
                    <Text style={s.featuredClusterText} numberOfLines={1}>{cl.name}</Text>
                  </View>
                ))}
              </View>
              <View style={s.featuredCta}>
                <Text style={s.featuredCtaText}>{t('themes.featured_cta')} →</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Grille 2 colonnes — tuiles carrées teintées ── */}
        <View style={s.grid}>
          {rest.map((cat, index) => (
            <Animated.View key={cat.id} entering={FadeInDown.delay(Math.min(index, 8) * 70).duration(450)}>
              <ScalePressable style={s.tile} onPress={() => openUniverse(cat)}>
                <LinearGradient
                  colors={[cat.color + '25', cat.color + '08']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.lg - 4 }]}
                />
                {/* Icône + nom à sa droite (police style vedette) */}
                <View style={s.tileHeader}>
                  <CategoryIcon emoji={cat.icon} size={36} color={cat.color} type="super" />
                  <Text style={s.tileName} numberOfLines={1}>{cat.label.toUpperCase()}</Text>
                </View>
                {/* Les 3 grands sous-groupes — cartouches (comme la vedette).
                    Retour à la ligne autorisé (2 lignes max), hauteur de tuile inchangée. */}
                <View style={s.tileBody}>
                  {cat.clusters.slice(0, 3).map((cl) => (
                    <View key={cl.name} style={s.tileClusterChip}>
                      <Text style={s.tileClusterText} numberOfLines={2}>{cl.name}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[s.tileStat, { color: cat.color }]}>
                  {cat.total_themes} {t('themes.themes_count').toUpperCase()}
                </Text>
                <View style={[s.tileBorder, { borderColor: cat.color + '40' }]} pointerEvents="none" />
              </ScalePressable>
            </Animated.View>
          ))}
        </View>

        {/* ── BIENTÔT — univers verrouillés ── */}
        {upcomingFiltered.length > 0 && (
          <>
            <Text style={s.comingSoonTitle}>◆ {t('themes.coming_soon')}</Text>
            <View style={s.upcomingGrid}>
              {upcomingFiltered.map((c) => (
                <View key={c.id} style={s.upcomingCard}>
                  <View style={s.upcomingInner}>
                    <LinearGradient colors={[c.color + '25', 'transparent']} style={s.upcomingGlow} />
                    <View style={[s.upcomingIconCircle, { backgroundColor: c.color + '18' }]}>
                      <Text style={s.upcomingIcon}>{c.icon}</Text>
                    </View>
                    <Text style={[s.upcomingLabel, { color: c.color }]}>{c.label.toUpperCase()}</Text>
                    <MaterialCommunityIcons name="lock-outline" size={11} color="rgba(255,255,255,0.3)" />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── LA FORGE ── */}
        <TouchableOpacity style={s.forgeCard} activeOpacity={0.8} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          router.push('/create-theme');
        }}>
          <LinearGradient colors={['rgba(179,102,255,0.15)', 'rgba(0,229,255,0.08)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.forgeBg} />
          <View style={s.forgeIconWrap}>
            <MaterialCommunityIcons name="hammer-wrench" size={26} color="#FFF" />
          </View>
          <View style={s.forgeText}>
            <Text style={s.forgeTitle}>{t('themes.create_theme')}</Text>
            <Text style={s.forgeSub}>{t('themes.create_subtitle')}</Text>
          </View>
          <View style={s.forgeArrow}>
            <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
          </View>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },

  // Header Arène
  arenaHeader: { paddingHorizontal: 20, paddingTop: 16 },
  arenaEyebrow: {
    fontSize: 11, fontFamily: FONTS.display.bold, color: COLORS.gold,
    letterSpacing: 2.5, textTransform: 'uppercase',
  },
  arenaTitle: {
    fontSize: 28, fontFamily: FONTS.display.bold, color: COLORS.white,
    letterSpacing: -1, lineHeight: 30, marginTop: 4, textTransform: 'uppercase',
  },

  // Vedette — texte noir sur gradient (convention handoff)
  featuredCard: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 12,
    borderRadius: 20, padding: 20, overflow: 'hidden',
    shadowColor: COLORS.violet, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 10,
  },
  featuredWatermark: {
    position: 'absolute', opacity: 0.14,
    right: -14, top: -16,
  },
  // Pastille or bien visible (le texte mono noir se fondait dans le gradient)
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12, paddingVertical: 5,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 10, elevation: 4,
  },
  featuredBadgeText: {
    fontFamily: FONTS.mono.bold, fontSize: 10, color: '#000',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 36, fontFamily: FONTS.display.bold, color: '#000',
    letterSpacing: -1.5, lineHeight: 38, marginTop: 6,
  },
  // Compteur affirmé + sous-catégories en puces sombres (lisibles sur le gradient)
  featuredCount: {
    fontSize: 13, fontFamily: FONTS.mono.bold, color: '#000',
    letterSpacing: 1.5, marginTop: 6,
  },
  featuredClusters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10,
  },
  featuredClusterChip: {
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  featuredClusterText: {
    fontSize: 12, fontFamily: FONTS.display.semiBold, color: '#FFF',
  },
  featuredCta: {
    alignSelf: 'flex-start', marginTop: 12,
    backgroundColor: '#000', borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  featuredCtaText: {
    fontSize: 12, fontFamily: FONTS.display.bold, color: '#FFF', letterSpacing: 0.5,
  },

  // Grille 2 colonnes
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: GRID_GAP,
  },
  tile: {
    width: TILE_W, aspectRatio: 1 / 1.1,
    borderRadius: RADIUS.lg - 4, padding: 14,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  tileBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg - 4, borderWidth: 1,
  },
  tileHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  tileBody: {
    flex: 1, justifyContent: 'center',
    alignItems: 'flex-start', gap: 4, marginVertical: 4,
    overflow: 'hidden',
  },
  // Police de la vignette vedette (SG 900, uppercase, serrée)
  tileName: {
    flex: 1, color: COLORS.white, fontSize: 18, fontFamily: FONTS.display.bold,
    letterSpacing: -1, lineHeight: 20,
  },
  // Cartouches sous-catégories (déclinaison sombre de celles de la vedette)
  tileClusterChip: {
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  tileClusterText: {
    color: 'rgba(255,255,255,0.85)', fontSize: 12,
    fontFamily: FONTS.display.semiBold, lineHeight: 15,
  },
  tileStat: {
    fontFamily: FONTS.mono.regular, fontSize: 11, letterSpacing: 1,
  },

  // Bientôt (univers verrouillés)
  comingSoonTitle: {
    fontSize: 10, fontFamily: FONTS.mono.bold, color: 'rgba(255,255,255,0.40)',
    letterSpacing: 2.5, textTransform: 'uppercase',
    paddingHorizontal: 20, marginTop: 20, marginBottom: 10,
  },
  upcomingGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14,
  },
  upcomingCard: { width: '25%', padding: 4 },
  upcomingInner: {
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', overflow: 'hidden',
  },
  upcomingGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
  },
  upcomingIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  upcomingIcon: { fontSize: 18 },
  upcomingLabel: {
    fontSize: 9, fontFamily: FONTS.display.bold, letterSpacing: 1, marginBottom: 4,
  },

  // La Forge
  forgeCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 20,
    borderRadius: 18, padding: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(179,102,255,0.3)',
  },
  forgeBg: { ...StyleSheet.absoluteFillObject, borderRadius: 18 },
  forgeIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  forgeText: { flex: 1, marginLeft: 14 },
  forgeTitle: { fontSize: 16, fontFamily: FONTS.display.bold, color: '#FFF', marginBottom: 2 },
  forgeSub: { fontSize: 12, fontFamily: FONTS.display.regular, color: 'rgba(255,255,255,0.45)' },
  forgeArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
});

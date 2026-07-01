import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Animated, Dimensions, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import CategoryIcon from '../components/CategoryIcon';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_W } = Dimensions.get('window');
const CAROUSEL_CARD_W = SCREEN_W * 0.32;
const CAROUSEL_CARD_H = 150;
const SEE_ALL_W = SCREEN_W * 0.25;
const TOP_COUNT = 7;

const CLUSTER_HUE_SHIFTS = [0, 50, -50];
const DEFAULT_COLOR = '#B366FF';

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(hue2rgb(p, q, h/360 + 1/3))}${toHex(hue2rgb(p, q, h/360))}${toHex(hue2rgb(p, q, h/360 - 1/3))}`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return hslToHex(Math.abs(hash) % 360, 65, 55);
}

function shiftHue(hex: string, degrees: number): string {
  const rr = parseInt(hex.slice(1, 3), 16) / 255;
  const gg = parseInt(hex.slice(3, 5), 16) / 255;
  const bb = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }
  h = ((h * 360 + degrees) % 360 + 360) % 360;
  return hslToHex(h, s * 100, l * 100);
}

function themeColor(theme: ThemeItem): string {
  return hashColor(theme.id);
}

// Full grid layout
const GRID_GAP = 10;
const GRID_COLS = 3;
const GRID_CARD_W = (SCREEN_W - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type ThemeItem = {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  color_hex: string;
  question_count: number;
  user_level: number;
  user_title: string;
};

type Cluster = {
  name: string;
  icon: string;
  themes: ThemeItem[];
};

type ClusterData = {
  super_category: string;
  label: string;
  icon: string;
  color: string;
  clusters: Cluster[];
};

export default function SuperCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const url = `${API_URL}/api/explore/${id}/clusters${userId ? `?user_id=${userId}` : ''}`;
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
    } catch (e) { console.error(e); }
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const openThemeDetail = (theme: ThemeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/category-detail?id=${theme.id}`);
  };

  const showAllThemes = (clusterName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCluster(prev => prev === clusterName ? null : clusterName);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B366FF" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{t('common.error_loading')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accent = data.color || DEFAULT_COLOR;

  return (
    <SwipeBackPage>
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top, backgroundColor: '#050510' }}>
        <DueloHeader />
      </View>

      {/* Sub-header */}
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle} activeOpacity={0.6}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
        </TouchableOpacity>
        <LinearGradient
          colors={[accent, accent + '70']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroTile}
        >
          <CategoryIcon emoji={data.icon} size={26} color="#FFF" type="super" />
        </LinearGradient>
        <View style={styles.subHeaderCenter}>
          <Text style={[styles.subHeaderEyebrow, { color: accent }]}>◆ UNIVERS</Text>
          <Text style={styles.subHeaderTitle}>{data.label.toUpperCase()}</Text>
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {data.clusters.map((cluster, clusterIdx) => {
          const clusterColor = shiftHue(accent, CLUSTER_HUE_SHIFTS[clusterIdx % CLUSTER_HUE_SHIFTS.length]);
          const topThemes = [...cluster.themes]
            .sort((a, b) => b.question_count - a.question_count)
            .slice(0, TOP_COUNT);
          const isExpanded = expandedCluster === cluster.name;

          return (
            <View key={cluster.name} style={styles.clusterSection}>
              {/* En-tête de groupe — pastille teintée + label (pattern sections) */}
              <View style={styles.clusterHeader}>
                <View style={[styles.clusterIconCircle, { backgroundColor: clusterColor + '20' }]}>
                  <CategoryIcon emoji={cluster.icon} size={16} color={clusterColor} type="cluster" />
                </View>
                <Text style={styles.clusterName}>{cluster.name}</Text>
                <Text style={[styles.clusterCount, { color: clusterColor }]}>
                  {cluster.themes.length} {t('themes.themes_count').toUpperCase()}
                </Text>
              </View>

              {/* Carousel of top themes */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
              >
                {topThemes.map((theme, idx) => {
                  const tColor = themeColor(theme);
                  return (
                    <TouchableOpacity
                      key={theme.id}
                      style={styles.carouselCard}
                      onPress={() => openThemeDetail(theme)}
                      activeOpacity={0.8}
                    >
                      {/* Tuile carrée teintée (pattern écran 6) */}
                      <LinearGradient
                        colors={[tColor + '25', tColor + '08']}
                        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                      />

                      <View style={styles.carouselTop}>
                        <CategoryIcon themeId={theme.id} size={28} color={tColor} type="theme" />
                        <Text style={[styles.rankText, { color: tColor + 'B3' }]}>#{idx + 1}</Text>
                      </View>

                      <View>
                        <Text style={styles.carouselName} numberOfLines={2}>{theme.name}</Text>
                        <Text style={[styles.carouselMeta, { color: tColor }]} numberOfLines={1}>
                          {theme.user_level > 0
                            ? `${t('themes.level').toUpperCase()} ${theme.user_level}`
                            : theme.question_count > 0
                              ? `${theme.question_count} QUIZ`
                              : ''}
                        </Text>
                      </View>

                      <View style={[styles.tileBorder, { borderColor: tColor + '40' }]} pointerEvents="none" />
                    </TouchableOpacity>
                  );
                })}

                {/* See All card */}
                <TouchableOpacity
                  style={styles.seeAllCard}
                  onPress={() => showAllThemes(cluster.name)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.seeAllCircle, { backgroundColor: clusterColor + '20' }]}>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'grid'}
                      size={24}
                      color={clusterColor}
                    />
                  </View>
                  <Text style={[styles.seeAllText, { color: clusterColor }]}>
                    {isExpanded ? t('themes.collapse') : t('themes.see_all')}
                  </Text>
                  <Text style={styles.seeAllCount}>{cluster.themes.length} {t('themes.themes_count').toUpperCase()}</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Expanded full grid */}
              {isExpanded && (
                <View style={styles.fullGrid}>
                  {cluster.themes.map((theme) => {
                    const tColor = themeColor(theme);
                    return (
                      <TouchableOpacity
                        key={theme.id}
                        style={[styles.gridCard, { width: GRID_CARD_W }]}
                        onPress={() => openThemeDetail(theme)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[tColor + '25', tColor + '08']}
                          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                        />
                        <View style={styles.gridIconWrap}>
                          <CategoryIcon themeId={theme.id} size={24} color={tColor} type="theme" />
                        </View>
                        <View>
                          <Text style={styles.gridName} numberOfLines={2}>{theme.name}</Text>
                          {theme.user_level > 0 && (
                            <Text style={[styles.gridMeta, { color: tColor }]}>
                              {t('themes.level').toUpperCase()} {theme.user_level}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.tileBorder, { borderColor: tColor + '40', borderRadius: 16 }]} pointerEvents="none" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  loadingContainer: { flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#666', fontSize: 16, marginBottom: 16 },
  backBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  backBtnText: { color: '#B366FF', fontSize: 16, fontWeight: '600' },

  // Sub-header
  subHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroTile: {
    width: 44, height: 44, borderRadius: 14, marginLeft: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  subHeaderCenter: { flex: 1, marginLeft: 12 },
  subHeaderEyebrow: {
    fontSize: 9, fontFamily: 'JetBrainsMono_700Bold',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  subHeaderTitle: {
    fontSize: 24, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.8, color: '#FFF',
  },

  scroll: { paddingTop: 4 },

  // Cluster Section
  clusterSection: { marginBottom: 26 },
  clusterHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16,
  },
  clusterIconCircle: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  clusterName: {
    flex: 1, color: 'rgba(255,255,255,0.60)', fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  clusterCount: { fontSize: 9, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 1 },

  // Carousel — tuiles carrées teintées (pattern écran 6)
  carousel: {
    paddingLeft: 16, paddingRight: 8, paddingTop: 12, gap: 10,
  },
  carouselCard: {
    width: CAROUSEL_CARD_W, height: CAROUSEL_CARD_H,
    borderRadius: 18, padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tileBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1,
  },
  carouselTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  rankText: { fontSize: 9, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 1 },
  carouselName: {
    color: '#FFF', fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.2, lineHeight: 15,
  },
  carouselMeta: {
    fontSize: 8, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 1, marginTop: 3,
  },

  // See All card
  seeAllCard: {
    width: SEE_ALL_W, height: CAROUSEL_CARD_H,
    borderRadius: 18, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  seeAllCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  seeAllText: { fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
  seeAllCount: {
    color: 'rgba(255,255,255,0.30)', fontSize: 8,
    fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 1, marginTop: 3,
  },

  // Full grid (expanded) — mêmes tuiles teintées
  fullGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingTop: 12, paddingHorizontal: 16,
    gap: GRID_GAP,
  },
  gridCard: {
    borderRadius: 16, padding: 10,
    aspectRatio: 1 / 1.1,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  gridIconWrap: { alignSelf: 'flex-start' },
  gridName: {
    color: '#FFF', fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.2, lineHeight: 14,
  },
  gridMeta: {
    fontSize: 8, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 1, marginTop: 2,
  },
});

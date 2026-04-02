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
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import CategoryIcon from '../components/CategoryIcon';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_W } = Dimensions.get('window');
const CAROUSEL_CARD_W = SCREEN_W * 0.32;
const CAROUSEL_CARD_H = 150;
const SEE_ALL_W = SCREEN_W * 0.25;
const TOP_COUNT = 7;

const CLUSTER_HUE_SHIFTS = [0, 50, -50];
const DEFAULT_COLOR = '#8A2BE2';

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
        <ActivityIndicator size="large" color="#8A2BE2" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Catégorie introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accent = data.color || '#8A2BE2';

  return (
    <SwipeBackPage>
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top, backgroundColor: GLASS.bgDark }}>
        <DueloHeader />
      </View>

      {/* Sub-header */}
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle} activeOpacity={0.6}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.subHeaderCenter}>
          <CategoryIcon emoji={data.icon} size={22} color={accent} type="super" />
          <Text style={[styles.subHeaderTitle, { color: accent }]}>{data.label.toUpperCase()}</Text>
        </View>
        <View style={{ width: 40 }} />
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
              {/* Cluster Header */}
              <View style={styles.clusterHeader}>
                <LinearGradient
                  colors={[clusterColor + '20', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.clusterGradient}
                />
                <View style={[styles.clusterIconCircle, { backgroundColor: clusterColor + '25' }]}>
                  <CategoryIcon emoji={cluster.icon} size={20} color={clusterColor} type="cluster" />
                </View>
                <View style={styles.clusterInfo}>
                  <Text style={styles.clusterName}>{cluster.name}</Text>
                  <Text style={[styles.clusterCount, { color: clusterColor + '90' }]}>
                    {cluster.themes.length} thèmes
                  </Text>
                </View>
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
                      <LinearGradient
                        colors={[tColor + '22', tColor + '08', 'transparent']}
                        style={styles.carouselCardBg}
                      />

                      {/* Rank badge */}
                      <View style={[styles.rankBadge, { backgroundColor: tColor + '30' }]}>
                        <Text style={[styles.rankText, { color: tColor }]}>#{idx + 1}</Text>
                      </View>

                      <LinearGradient
                        colors={[tColor + '35', tColor + '12']}
                        style={styles.carouselIcon}
                      >
                        <CategoryIcon themeId={theme.id} size={26} color={tColor} type="theme" />
                      </LinearGradient>

                      <Text style={styles.carouselName} numberOfLines={2}>{theme.name}</Text>

                      {theme.user_level > 0 ? (
                        <View style={[styles.carouselBadge, { backgroundColor: tColor + '25' }]}>
                          <Text style={[styles.carouselBadgeText, { color: tColor }]}>
                            Niv.{theme.user_level}
                          </Text>
                        </View>
                      ) : theme.question_count > 0 ? (
                        <Text style={styles.carouselQCount}>{theme.question_count} Q</Text>
                      ) : null}
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
                    {isExpanded ? 'Réduire' : 'Tout voir'}
                  </Text>
                  <Text style={styles.seeAllCount}>{cluster.themes.length} thèmes</Text>
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
                          colors={[tColor + '18', 'transparent']}
                          style={styles.gridCardGlow}
                        />
                        <LinearGradient
                          colors={[tColor + '30', tColor + '10']}
                          style={styles.gridIcon}
                        >
                          <CategoryIcon themeId={theme.id} size={22} color={tColor} type="theme" />
                        </LinearGradient>
                        <Text style={styles.gridName} numberOfLines={2}>{theme.name}</Text>
                        {theme.user_level > 0 && (
                          <View style={[styles.gridBadge, { backgroundColor: tColor + '25' }]}>
                            <Text style={[styles.gridBadgeText, { color: tColor }]}>
                              Niv.{theme.user_level}
                            </Text>
                          </View>
                        )}
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
  backBtnText: { color: '#8A2BE2', fontSize: 16, fontWeight: '600' },

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
  subHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 2 },

  scroll: { paddingTop: 4 },

  // Cluster Section
  clusterSection: { marginBottom: 24 },
  clusterHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14, marginHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  clusterGradient: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: '60%',
  },
  clusterIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  clusterInfo: { flex: 1, marginLeft: 12 },
  clusterName: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  clusterCount: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Carousel
  carousel: {
    paddingLeft: 16, paddingRight: 8, paddingTop: 12, gap: 10,
  },
  carouselCard: {
    width: CAROUSEL_CARD_W, height: CAROUSEL_CARD_H,
    borderRadius: 18, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  carouselCardBg: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
    borderRadius: 18,
  },
  rankBadge: {
    position: 'absolute', top: 8, left: 8,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  rankText: { fontSize: 10, fontWeight: '900' },
  carouselIcon: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  carouselName: {
    color: '#FFF', fontSize: 11, fontWeight: '700',
    textAlign: 'center', lineHeight: 14,
  },
  carouselBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 6,
  },
  carouselBadgeText: { fontSize: 9, fontWeight: '800' },
  carouselQCount: {
    color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '600', marginTop: 6,
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
  seeAllText: { fontSize: 12, fontWeight: '800' },
  seeAllCount: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Full grid (expanded)
  fullGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingTop: 12, paddingHorizontal: 16,
    gap: GRID_GAP,
  },
  gridCard: {
    borderRadius: 16, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', overflow: 'hidden',
  },
  gridCardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 50,
  },
  gridIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  gridName: {
    color: '#FFF', fontSize: 11, fontWeight: '700',
    textAlign: 'center', lineHeight: 14, minHeight: 28,
  },
  gridBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
  },
  gridBadgeText: { fontSize: 10, fontWeight: '800' },
});

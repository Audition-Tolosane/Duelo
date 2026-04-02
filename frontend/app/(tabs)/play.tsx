import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withRepeat, withSequence, withDelay, FadeInDown, Easing,
} from 'react-native-reanimated';
import CosmicBackground from '../../components/CosmicBackground';
import CategoryIcon from '../../components/CategoryIcon';
import { t } from '../../utils/i18n';

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
  const [pseudo, setPseudo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const storedPseudo = await AsyncStorage.getItem('duelo_pseudo');
    if (storedPseudo) setPseudo(storedPseudo);

    try {
      setLoadError(false);
      const res = await fetch(`${API_URL}/api/explore/super-categories`);
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
          <ActivityIndicator size="large" color="#8A2BE2" />
        </View>
      </CosmicBackground>
    );
  }

  if (loadError) {
    return (
      <CosmicBackground>
        <View style={styles.loadingContainer}>
          <TouchableOpacity onPress={() => { setLoadError(false); setLoading(true); loadData(); }} style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#aaa', fontSize: 14 }}>{t('play.load_error')}</Text>
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
          <Text style={styles.greeting}>{t('play.greeting')} {pseudo || t('play.default_player')} 👋</Text>
          <Text style={styles.sectionTitle}>{t('play.super_categories')}</Text>

          {superCategories.map((cat, index) => (
            <SuperCard key={cat.id} cat={cat} index={index} onPress={() => handlePress(cat)} />
          ))}

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

  greeting: {
    fontSize: 24, fontWeight: '800', color: '#FFF',
    marginTop: 20, marginBottom: 28, paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 3,
    marginBottom: 16, paddingHorizontal: 20,
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

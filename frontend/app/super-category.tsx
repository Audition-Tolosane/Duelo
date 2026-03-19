import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const url = `${API_URL}/api/explore/${id}/clusters${userId ? `?user_id=${userId}` : ''}`;
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
      // Auto-expand first cluster
      if (result.clusters?.length > 0) {
        setExpandedCluster(result.clusters[0].name);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const toggleCluster = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCluster(prev => prev === name ? null : name);
  };

  const startGame = (theme: ThemeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/matchmaking?category=${theme.id}&themeName=${encodeURIComponent(theme.name)}`);
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

  const accentColor = data.color || '#8A2BE2';

  return (
    <SwipeBackPage>
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} activeOpacity={0.6}>
          <Text style={styles.headerBackText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerIcon}>{data.icon}</Text>
          <Text style={[styles.headerTitle, { color: accentColor }]}>{data.label.toUpperCase()}</Text>
        </View>
        <View style={styles.headerBack} />
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {data.clusters.map((cluster) => {
          const isExpanded = expandedCluster === cluster.name;

          return (
            <View key={cluster.name} style={styles.clusterSection}>
              {/* Cluster Header */}
              <TouchableOpacity
                style={[styles.clusterHeader, isExpanded && { borderColor: accentColor + '40' }]}
                onPress={() => toggleCluster(cluster.name)}
                activeOpacity={0.7}
              >
                <View style={styles.clusterHeaderLeft}>
                  <Text style={styles.clusterIcon}>{cluster.icon}</Text>
                  <View>
                    <Text style={styles.clusterName}>{cluster.name}</Text>
                    <Text style={styles.clusterCount}>{cluster.themes.length} thèmes</Text>
                  </View>
                </View>
                <Text style={[styles.clusterChevron, isExpanded && styles.clusterChevronOpen]}>
                  {isExpanded ? '▾' : '▸'}
                </Text>
              </TouchableOpacity>

              {/* Themes Grid */}
              {isExpanded && (
                <View style={styles.themesGrid}>
                  {cluster.themes.map((theme) => (
                    <TouchableOpacity
                      key={theme.id}
                      style={styles.themeCard}
                      onPress={() => startGame(theme)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.themeCardInner, { borderColor: accentColor + '20' }]}>
                        {/* Theme icon placeholder */}
                        <View style={[styles.themeIconBox, { backgroundColor: accentColor + '15' }]}>
                          <Text style={styles.themeInitial}>
                            {theme.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>

                        <Text style={styles.themeName} numberOfLines={2}>{theme.name}</Text>

                        {theme.user_level > 0 && (
                          <View style={[styles.levelBadge, { backgroundColor: accentColor + '20' }]}>
                            <Text style={[styles.levelText, { color: accentColor }]}>
                              Niv.{theme.user_level}
                            </Text>
                          </View>
                        )}

                        <Text style={styles.themeQuestionCount}>
                          {theme.question_count} Q
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </SafeAreaView>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#666', fontSize: 16, marginBottom: 16 },
  backBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  backBtnText: { color: '#8A2BE2', fontSize: 16, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBack: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerBackText: { color: '#FFF', fontSize: 32, fontWeight: '300' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 24 },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  // Cluster Section
  clusterSection: { marginBottom: 16 },
  clusterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: GLASS.bg, borderRadius: GLASS.radius,
    padding: 16, borderWidth: 1, borderColor: GLASS.borderCyan,
  },
  clusterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clusterIcon: { fontSize: 28 },
  clusterName: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  clusterCount: { color: '#666', fontSize: 12, fontWeight: '600', marginTop: 2 },
  clusterChevron: { color: '#666', fontSize: 18, fontWeight: '600' },
  clusterChevronOpen: { color: '#8A2BE2' },

  // Themes Grid
  themesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingTop: 12,
  },
  themeCard: {
    width: '25%', padding: 4,
  },
  themeCardInner: {
    borderRadius: GLASS.radiusSm, padding: 8, borderWidth: 1,
    backgroundColor: GLASS.bg,
    borderColor: GLASS.borderSubtle,
    alignItems: 'center', minHeight: 100,
  },
  themeIconBox: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  themeInitial: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  themeName: {
    color: '#FFF', fontSize: 10, fontWeight: '700',
    textAlign: 'center', lineHeight: 13, minHeight: 26,
  },
  levelBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
  levelText: { fontSize: 9, fontWeight: '800' },
  themeQuestionCount: { color: '#444', fontSize: 8, fontWeight: '600', marginTop: 3 },
});

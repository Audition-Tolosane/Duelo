import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  FadeIn, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import CosmicBackground from '../../components/CosmicBackground';
import CategoryIcon from '../../components/CategoryIcon';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_W } = Dimensions.get('window');

// ── Types ──
type TopicData = {
  id: string; name: string; icon: string; icon_url: string; category_id: string;
};

type ThemeData = {
  id: string; name: string; icon: string; playable: boolean;
  level: number; xp: number; title: string; title_lvl50: string;
  xp_progress: { current: number; needed: number; progress: number };
  total_questions: number;
  topics: TopicData[];
};

type PillarData = {
  id: string; name: string; label: string; color: string;
  icon: string; themes: ThemeData[];
};

// ── Progress Ring ──
const ProgressRing = ({ progress, color, size = 56, strokeWidth = 3 }: {
  progress: number; color: string; size?: number; strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Circle cx={size/2} cy={size/2} r={radius} stroke={color+'20'} strokeWidth={strokeWidth} fill="none" />
      <Circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={`${circumference}`} strokeDashoffset={strokeDashoffset}
        strokeLinecap="round" rotation={-90} origin={`${size/2}, ${size/2}`} />
    </Svg>
  );
};

// ── Main Component ──
export default function ThemesScreen() {
  const router = useRouter();
  const [pillars, setPillars] = useState<PillarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePillar, setActivePillar] = useState<string>('');
  const [previewTheme, setPreviewTheme] = useState<ThemeData | null>(null);
  const [previewColor, setPreviewColor] = useState('#8A2BE2');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadThemes(); }, []);

  const loadThemes = async () => {
    const userId = await AsyncStorage.getItem('duelo_user_id');
    try {
      const url = userId
        ? `${API_URL}/api/themes/explore?user_id=${userId}`
        : `${API_URL}/api/themes/explore`;
      const res = await fetch(url);
      const data = await res.json();
      const p = data.pillars || [];
      setPillars(p);
      if (p.length > 0) setActivePillar(p[0].id);
    } catch (e) { console.log('Error loading themes:', e); }
    setLoading(false);
  };

  const handlePillarSelect = (pillarId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivePillar(pillarId);
  };

  const handleThemePress = (theme: ThemeData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (theme.topics && theme.topics.length > 0) return;
    if (theme.playable) router.push(`/category-detail?id=${theme.id}`);
  };

  const currentPillar = pillars.find(p => p.id === activePillar);
  const accent = currentPillar?.color || '#8A2BE2';

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.loadCenter}>
          <ActivityIndicator size="large" color="#8A2BE2" />
        </View>
      </View>
    );
  }

  return (
    <CosmicBackground>
    <View style={s.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── LA FORGE ── */}
        <TouchableOpacity style={s.forgeCard} activeOpacity={0.8} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }}>
          <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.forgeBg} />
          <View style={s.forgeIconWrap}>
            <MaterialCommunityIcons name="hammer-wrench" size={26} color="#FFF" />
          </View>
          <View style={s.forgeText}>
            <Text style={s.forgeTitle}>Créer mon Thème</Text>
            <Text style={s.forgeSub}>Génère tes propres quiz avec l'IA</Text>
          </View>
          <View style={s.forgeArrow}>
            <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
          </View>
        </TouchableOpacity>

        {/* ── PILLAR CHIPS ── */}
        <Text style={s.sectionLabel}>UNIVERS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillarsScroll}>
          {pillars.map((pillar) => {
            const isActive = pillar.id === activePillar;
            return (
              <TouchableOpacity
                key={pillar.id}
                style={[s.pillarChip, isActive && {
                  backgroundColor: pillar.color + '18',
                  borderColor: pillar.color + '50',
                }]}
                onPress={() => handlePillarSelect(pillar.id)}
                activeOpacity={0.7}
              >
                <CategoryIcon emoji={pillar.icon} size={16} color={isActive ? pillar.color : '#666'} type="super" />
                <Text style={[s.pillarChipText, { color: isActive ? pillar.color : '#666' }]}>
                  {pillar.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── CURRENT PILLAR HEADER ── */}
        {currentPillar && (
          <Animated.View key={currentPillar.id} entering={FadeIn.duration(300)} style={s.pillarHeader}>
            <LinearGradient colors={[accent + '20', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pillarHeaderGradient} />
            <View style={[s.pillarHeaderIcon, { backgroundColor: accent + '20' }]}>
              <CategoryIcon emoji={currentPillar.icon} size={24} color={accent} type="super" />
            </View>
            <View style={s.pillarHeaderInfo}>
              <Text style={[s.pillarHeaderName, { color: accent }]}>
                {currentPillar.name}
              </Text>
              <Text style={s.pillarHeaderLabel}>{currentPillar.label}</Text>
            </View>
          </Animated.View>
        )}

        {/* ── CLUSTERS WITH THEMES ── */}
        {currentPillar && (
          <Animated.View key={`clusters-${currentPillar.id}`} entering={FadeInDown.delay(100).springify()}>
            {currentPillar.themes.map((theme) => (
              <View key={theme.id} style={{ marginBottom: 18 }}>
                {/* Cluster header */}
                <View style={s.clusterHeader}>
                  <LinearGradient colors={[accent + '20', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.clusterGradient} />
                  <View style={[s.clusterIconCircle, { backgroundColor: accent + '25' }]}>
                    <CategoryIcon emoji={theme.icon} size={18} color={accent} type="cluster" />
                  </View>
                  <Text style={s.clusterName}>{theme.name}</Text>
                  <Text style={[s.clusterCount, { color: accent + '80' }]}>
                    {theme.topics?.length || 0} thèmes
                  </Text>
                </View>

                {/* Themes carousel */}
                {theme.topics && theme.topics.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.carousel}>
                    {theme.topics.map((topic) => (
                      <TouchableOpacity key={topic.id} style={s.topicCard}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/category-detail?id=${topic.id}`); }}
                        activeOpacity={0.8}>
                        <LinearGradient colors={[accent+'18', 'transparent']} style={s.topicCardGlow} />
                        <LinearGradient colors={[accent+'30', accent+'10']} style={s.topicIconCircle}>
                          <CategoryIcon themeId={topic.id} emoji={topic.icon} size={24} color={accent} type="theme" />
                        </LinearGradient>
                        <Text style={s.topicName} numberOfLines={2}>{topic.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── OTHER PILLARS ── */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>AUTRES UNIVERS</Text>
        {pillars.filter(p => p.id !== activePillar).map((pillar) => (
          <View key={pillar.id} style={{ marginBottom: 20 }}>
            <TouchableOpacity style={s.miniPillarHeader} onPress={() => handlePillarSelect(pillar.id)} activeOpacity={0.7}>
              <LinearGradient colors={[pillar.color+'15', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.miniPillarGradient} />
              <View style={[s.miniPillarIcon, { backgroundColor: pillar.color+'20' }]}>
                <CategoryIcon emoji={pillar.icon} size={18} color={pillar.color} type="super" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.miniPillarName, { color: pillar.color }]}>{pillar.name}</Text>
                <Text style={s.miniPillarLabel}>{pillar.label}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={pillar.color+'60'} />
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.carousel}>
              {pillar.themes.slice(0, 8).map((theme) => {
                const isLocked = theme.level === 0 && !theme.playable;
                return (
                  <TouchableOpacity key={theme.id} style={s.miniThemeCard}
                    onPress={() => { handlePillarSelect(pillar.id); }} activeOpacity={0.8}>
                    <LinearGradient colors={[isLocked ? '#111' : pillar.color+'15', 'transparent']}
                      style={s.miniThemeGlow} />
                    <LinearGradient
                      colors={isLocked ? ['#1a1a1a','#111'] : [pillar.color+'25', pillar.color+'08']}
                      style={s.miniThemeIcon}>
                      <CategoryIcon emoji={theme.icon} size={20}
                        color={isLocked ? '#444' : pillar.color} type="cluster" />
                    </LinearGradient>
                    <Text style={[s.miniThemeName, isLocked && { color: '#444' }]} numberOfLines={2}>
                      {theme.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── LONG-PRESS PREVIEW ── */}
      <Modal visible={!!previewTheme} transparent animationType="fade"
        onRequestClose={() => setPreviewTheme(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setPreviewTheme(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            {previewTheme && (
              <Animated.View entering={FadeInUp.springify()} style={s.previewCard}>
                <LinearGradient colors={[previewColor+'20', 'transparent']}
                  style={s.previewGlow} />

                <View style={s.previewRingWrap}>
                  <ProgressRing progress={previewTheme.xp_progress?.progress || 0}
                    color={previewColor} size={88} strokeWidth={4} />
                  <LinearGradient colors={[previewColor+'30', previewColor+'10']}
                    style={s.previewIconCircle}>
                    <CategoryIcon emoji={previewTheme.icon} size={34} color={previewColor} type="cluster" />
                  </LinearGradient>
                </View>

                <Text style={s.previewName}>{previewTheme.name}</Text>

                {previewTheme.level > 0 && (
                  <View style={[s.previewBadge, { backgroundColor: previewColor+'25' }]}>
                    <Text style={[s.previewBadgeText, { color: previewColor }]}>
                      Niveau {previewTheme.level}
                    </Text>
                  </View>
                )}

                {previewTheme.title ? (
                  <Text style={[s.previewTitle, { color: previewColor }]}>
                    « {previewTheme.title} »
                  </Text>
                ) : null}

                <View style={s.previewStats}>
                  <View style={s.previewStat}>
                    <Text style={s.previewStatVal}>{previewTheme.total_questions}</Text>
                    <Text style={s.previewStatLbl}>Questions</Text>
                  </View>
                  <View style={[s.previewDivider, { backgroundColor: previewColor+'30' }]} />
                  <View style={s.previewStat}>
                    <Text style={s.previewStatVal}>{previewTheme.xp}</Text>
                    <Text style={s.previewStatLbl}>XP</Text>
                  </View>
                </View>

                {previewTheme.title_lvl50 ? (
                  <View style={s.previewGoal}>
                    <Text style={s.previewGoalLabel}>Titre Niveau 50</Text>
                    <Text style={[s.previewGoalTitle, { color: previewColor }]}>
                      {previewTheme.title_lvl50}
                    </Text>
                  </View>
                ) : null}

                {previewTheme.playable && (
                  <TouchableOpacity
                    style={[s.previewPlayBtn, { backgroundColor: previewColor }]}
                    onPress={() => { setPreviewTheme(null); handleThemePress(previewTheme); }}
                    activeOpacity={0.8}>
                    <Text style={s.previewPlayText}>JOUER</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </CosmicBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },

  // La Forge
  forgeCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16, marginBottom: 20,
    borderRadius: 18, padding: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  forgeBg: { ...StyleSheet.absoluteFillObject, borderRadius: 18 },
  forgeIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  forgeText: { flex: 1, marginLeft: 14 },
  forgeTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 2 },
  forgeSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  forgeArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 3, marginHorizontal: 16, marginBottom: 12, marginTop: 8,
  },

  // Pillar chips
  pillarsScroll: { paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  pillarChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  pillarChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  // Pillar header
  pillarHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16, padding: 14,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  pillarHeaderGradient: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: '60%',
  },
  pillarHeaderIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  pillarHeaderInfo: { flex: 1, marginLeft: 12 },
  pillarHeaderName: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  pillarHeaderLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginTop: 2 },

  // Cluster header
  clusterHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10, padding: 12,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  clusterGradient: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%' },
  clusterIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  clusterName: { color: '#FFF', fontSize: 14, fontWeight: '800', flex: 1, marginLeft: 10 },
  clusterCount: { fontSize: 11, fontWeight: '600' },

  // Carousel
  carousel: { paddingHorizontal: 12, paddingBottom: 8, gap: 10 },
  topicCard: {
    width: 125, borderRadius: 18, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', overflow: 'hidden',
  },
  topicCardGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 60, borderRadius: 18 },
  topicIconCircle: {
    width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  topicName: {
    color: '#FFF', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14,
  },

  // Mini pillar (other univers)
  miniPillarHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10, padding: 12,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  miniPillarGradient: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%' },
  miniPillarIcon: {
    width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  miniPillarName: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  miniPillarLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginTop: 1 },

  miniThemeCard: {
    width: 100, borderRadius: 14, padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', overflow: 'hidden',
  },
  miniThemeGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%', borderRadius: 14 },
  miniThemeIcon: {
    width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  miniThemeName: {
    color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 12,
  },

  // Preview modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewCard: {
    width: SCREEN_W * 0.82, maxWidth: 340,
    borderRadius: 24, backgroundColor: '#0a0a1a',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    overflow: 'hidden',
  },
  previewGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120, borderRadius: 24,
  },
  previewRingWrap: {
    width: 88, height: 88, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  previewIconCircle: {
    width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center',
  },
  previewName: {
    fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 10, textAlign: 'center',
  },
  previewBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginBottom: 6 },
  previewBadgeText: { fontSize: 13, fontWeight: '800' },
  previewTitle: { fontSize: 14, fontWeight: '700', fontStyle: 'italic', marginBottom: 16 },
  previewStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  previewStat: { alignItems: 'center', paddingHorizontal: 20 },
  previewStatVal: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  previewStatLbl: { fontSize: 10, fontWeight: '600', color: '#888', marginTop: 2 },
  previewDivider: { width: 1, height: 30 },
  previewGoal: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12,
    width: '100%', alignItems: 'center', marginBottom: 16,
  },
  previewGoalLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 4 },
  previewGoalTitle: { fontSize: 16, fontWeight: '900' },
  previewPlayBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4,
  },
  previewPlayText: { fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
});

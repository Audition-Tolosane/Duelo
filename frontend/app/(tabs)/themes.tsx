import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions, FlatList, Modal, Pressable, Platform, useWindowDimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withDelay, withRepeat, withSequence, Easing, FadeIn, FadeInDown,
  FadeInUp, interpolateColor, runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import DueloHeader from '../../components/DueloHeader';
import { GlassIconFrame } from '../../components/GlassIconFrame';
import { GLASS } from '../../theme/glassTheme';
import CosmicBackground from '../../components/CosmicBackground';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = 130;
const CARD_H = 170;
const GRID_CARD_W = Math.floor((SCREEN_W - 48 - 16) / 3);

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

// ── Progress Ring Component ──
const ProgressRing = ({ progress, color, size = 72, strokeWidth = 4 }: {
  progress: number; color: string; size?: number; strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color + '20'} strokeWidth={strokeWidth} fill="none"
      />
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation={-90} origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
};

// ── Animated Neon Border (for La Forge) ──
const NeonBorderCard = ({ children }: { children: React.ReactNode }) => {
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
  }, []);

  const borderStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={forgeStyles.outerWrap}>
      <Animated.View style={[forgeStyles.neonBorder, borderStyle]} />
      <View style={forgeStyles.innerCard}>
        {children}
      </View>
    </View>
  );
};

// ── Theme Card ──
const ThemeCard = ({ theme, pillarColor, onPress, onLongPress }: {
  theme: ThemeData; pillarColor: string;
  onPress: () => void; onLongPress: () => void;
}) => {
  const isLocked = theme.level === 0 && !theme.playable;
  const isNewTheme = theme.level === 0 && theme.playable;
  const progress = theme.xp_progress?.progress || 0;

  return (
    <TouchableOpacity
      style={styles.themeCard}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <View style={[
        styles.themeCardInner,
        { borderColor: isLocked ? '#222' : pillarColor + '30' },
        isLocked && styles.themeCardLocked,
      ]}>
        {/* GlassIconFrame */}
        <GlassIconFrame
          emoji={theme.icon}
          size={64}
          pillarColor={pillarColor}
          progress={progress}
          showRing={!isLocked}
          locked={isLocked}
        />

        {/* Name */}
        <Text style={[
          styles.themeName,
          { color: isLocked ? '#444' : '#FFF' },
        ]} numberOfLines={2}>
          {theme.name}
        </Text>

        {/* Badge Level / Lock */}
        {isLocked ? (
          <View style={styles.lockBadge}>
            <Text style={styles.lockText}>🔒 Bientôt</Text>
          </View>
        ) : isNewTheme ? (
          <View style={[styles.levelBadge, { backgroundColor: pillarColor + '25', borderColor: pillarColor + '50' }]}>
            <Text style={[styles.levelBadgeText, { color: pillarColor }]}>À découvrir</Text>
          </View>
        ) : (
          <View style={[styles.levelBadge, { backgroundColor: pillarColor + '25', borderColor: pillarColor + '50' }]}>
            <Text style={[styles.levelBadgeText, { color: pillarColor }]}>Niv. {theme.level}</Text>
          </View>
        )}

        {/* Title */}
        {theme.title ? (
          <Text style={[styles.themeTitle, { color: pillarColor + 'CC' }]} numberOfLines={1}>
            {theme.title}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

// ── Topic Card (Individual themes like Breaking Bad) ──
const TopicCardItem = ({ topic, pillarColor, onPress }: {
  topic: TopicData; pillarColor: string; onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.topicCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.topicCardInner, { borderColor: pillarColor + '25' }]}>
        {/* Subtle glow */}
        <View style={[styles.topicGlow, {
          backgroundColor: pillarColor + '06',
          shadowColor: pillarColor,
        }]} />

        <GlassIconFrame
          iconUrl={topic.icon_url || undefined}
          emoji={!topic.icon_url ? topic.icon : undefined}
          size={68}
          pillarColor={pillarColor}
          progress={0}
          showRing={true}
        />

        <Text style={styles.topicName} numberOfLines={2}>{topic.name}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Grid Theme Card (for "Tout Voir") ──
const GridThemeCard = ({ theme, pillarColor, onPress, index, cardWidth }: {
  theme: ThemeData; pillarColor: string; onPress: () => void; index: number; cardWidth: number;
}) => {
  const isLocked = theme.level === 0 && !theme.playable;
  const progress = theme.xp_progress?.progress || 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()} style={{ width: cardWidth, marginBottom: 8 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{ width: '100%' }}
      >
        <View style={[
          styles.gridCardInner,
          { borderColor: isLocked ? '#222' : pillarColor + '30' },
          isLocked && styles.themeCardLocked,
        ]}>
          <View style={styles.gridRingWrap}>
            {!isLocked && (
              <ProgressRing progress={progress} color={pillarColor} size={56} strokeWidth={3} />
            )}
            <View style={[styles.gridIconCircle, { backgroundColor: isLocked ? '#111' : pillarColor + '15' }]}>
              <Text style={[styles.gridThemeIcon, isLocked && { opacity: 0.3 }]}>{theme.icon}</Text>
            </View>
          </View>
          <Text style={[styles.gridThemeName, { color: isLocked ? '#444' : '#FFF' }]} numberOfLines={2}>
            {theme.name}
          </Text>
          {!isLocked && theme.level > 0 && (
            <Text style={[styles.gridLevel, { color: pillarColor }]}>Niv. {theme.level}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Main Component ──
export default function ThemesScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [pillars, setPillars] = useState<PillarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePillar, setActivePillar] = useState<string>('screen');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeData | null>(null);
  const [previewPillarColor, setPreviewPillarColor] = useState('#8B5CF6');
  const scrollRef = useRef<ScrollView>(null);

  // Compute responsive grid card width
  const gridCardWidth = Math.floor((Math.min(windowWidth, 500) - 32 - 16) / 3);

  // Background glow animation
  const glowColor = useSharedValue(0);
  const pillarColors = pillars.map(p => p.color);

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    const userId = await AsyncStorage.getItem('duelo_user_id');
    try {
      const url = userId
        ? `${API_URL}/api/themes/explore?user_id=${userId}`
        : `${API_URL}/api/themes/explore`;
      const res = await fetch(url);
      const data = await res.json();
      setPillars(data.pillars || []);
    } catch (e) {
      console.log('Error loading themes:', e);
    }
    setLoading(false);
  };

  const handlePillarSelect = (pillarId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivePillar(pillarId);
    setExpandedSection(null);
    const idx = pillars.findIndex(p => p.id === pillarId);
    if (idx >= 0) {
      glowColor.value = withTiming(idx, { duration: 600 });
    }
  };

  const handleThemePress = (theme: ThemeData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Clusters have topics → scroll down to show them, don't navigate
    if (theme.topics && theme.topics.length > 0) {
      // The topics are already displayed below - no need to navigate
      return;
    }
    // Fallback for legacy themes without topics
    if (theme.playable) {
      router.push(`/category-detail?id=${theme.id}`);
    }
  };

  const handleLongPress = (theme: ThemeData, pillarColor: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPreviewTheme(theme);
    setPreviewPillarColor(pillarColor);
  };

  const handleToggleExpand = (sectionName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSection(expandedSection === sectionName ? null : sectionName);
  };

  const currentPillar = pillars.find(p => p.id === activePillar);
  const currentColor = currentPillar?.color || '#8B5CF6';

  // Dynamic background glow
  const glowBgStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: 'transparent',
    };
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadCenter}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <CosmicBackground>
    <View style={styles.container}>

      {/* Dynamic Background Glow */}
      <View style={[styles.bgGlow, { backgroundColor: currentColor + '08', pointerEvents: 'none' }]} />
      <View style={[styles.bgGlowTop, { 
        shadowColor: currentColor,
        backgroundColor: currentColor + '06',
        pointerEvents: 'none',
      }]} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── LA FORGE / HERO SECTION ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={forgeStyles.container}>
          <NeonBorderCard>
            <TouchableOpacity
              style={forgeStyles.touchable}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                // TODO: Open AI theme creation
              }}
              activeOpacity={0.8}
            >
              <View style={forgeStyles.content}>
                <View style={forgeStyles.iconWrap}>
                  <Text style={forgeStyles.icon}>⚒️</Text>
                </View>
                <View style={forgeStyles.textWrap}>
                  <Text style={forgeStyles.title}>Créer mon Thème</Text>
                  <Text style={forgeStyles.subtitle}>
                    Génère tes propres quiz avec l'IA ✨
                  </Text>
                </View>
                <View style={forgeStyles.arrow}>
                  <Text style={forgeStyles.arrowText}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          </NeonBorderCard>
        </Animated.View>

        {/* ── 9 PILLARS NAVIGATION ── */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={styles.sectionLabel}>UNIVERS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillarsScroll}
          >
            {pillars.map((pillar) => {
              const isActive = pillar.id === activePillar;
              return (
                <TouchableOpacity
                  key={pillar.id}
                  style={[
                    styles.pillarChip,
                    isActive && { backgroundColor: pillar.color + '20', borderColor: pillar.color },
                  ]}
                  onPress={() => handlePillarSelect(pillar.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pillarIcon}>{pillar.icon}</Text>
                  <Text style={[
                    styles.pillarName,
                    { color: isActive ? pillar.color : '#888' },
                  ]}>
                    {pillar.name}
                  </Text>
                  {isActive && (
                    <View style={[styles.pillarDot, { backgroundColor: pillar.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ── PILLAR LABEL ── */}
        {currentPillar && (
          <Animated.View
            key={currentPillar.id}
            entering={FadeIn.duration(300)}
            style={styles.pillarHeader}
          >
            <Text style={[styles.pillarHeaderIcon]}>{currentPillar.icon}</Text>
            <View>
              <Text style={[styles.pillarHeaderName, { color: currentColor }]}>
                {currentPillar.name}
              </Text>
              <Text style={styles.pillarHeaderLabel}>{currentPillar.label}</Text>
            </View>
          </Animated.View>
        )}

        {/* ── THEMES CAROUSEL ── */}
        {currentPillar && (
          <Animated.View key={`carousel-${currentPillar.id}`} entering={FadeInDown.delay(100).springify()}>
            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Thèmes disponibles
              </Text>
              <TouchableOpacity
                onPress={() => handleToggleExpand(currentPillar.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.seeAll, { color: currentColor }]}>
                  {expandedSection === currentPillar.id ? 'Carrousel' : 'Tout Voir'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Carousel Mode */}
            {expandedSection !== currentPillar.id ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselScroll}
              >
                {currentPillar.themes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    pillarColor={currentColor}
                    onPress={() => handleThemePress(theme)}
                    onLongPress={() => handleLongPress(theme, currentColor)}
                  />
                ))}
              </ScrollView>
            ) : (
              /* Grid Mode (Tout Voir) */
              <View style={styles.gridContainer}>
                {currentPillar.themes.map((theme, i) => (
                  <GridThemeCard
                    key={theme.id}
                    theme={theme}
                    pillarColor={currentColor}
                    onPress={() => handleThemePress(theme)}
                    index={i}
                    cardWidth={gridCardWidth}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ── TOPICS CAROUSEL (Individual themes with icon_url) ── */}
        {currentPillar && currentPillar.themes.some(t => t.topics && t.topics.length > 0) && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            {currentPillar.themes.filter(t => t.topics && t.topics.length > 0).map((theme) => (
              <View key={`topics-${theme.id}`}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {theme.icon} {theme.name}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselScroll}
                >
                  {theme.topics.map((topic: TopicData) => (
                    <TopicCardItem
                      key={topic.id}
                      topic={topic}
                      pillarColor={currentColor}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push(`/category-detail?id=${topic.id}`);
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── ALL PILLARS PREVIEW ── */}
        <View style={styles.allPillarsSection}>
          <Text style={styles.sectionLabel}>TOUS LES UNIVERS</Text>
          {pillars.filter(p => p.id !== activePillar).map((pillar, pIdx) => (
            <Animated.View
              key={pillar.id}
              entering={FadeInDown.delay(pIdx * 60).springify()}
            >
              <View style={styles.miniSectionHeader}>
                <TouchableOpacity
                  style={styles.miniSectionTouch}
                  onPress={() => handlePillarSelect(pillar.id)}
                >
                  <Text style={styles.miniSectionIcon}>{pillar.icon}</Text>
                  <Text style={[styles.miniSectionName, { color: pillar.color }]}>
                    {pillar.name}
                  </Text>
                  <Text style={styles.miniSectionLabel}>{pillar.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handlePillarSelect(pillar.id)}>
                  <Text style={[styles.seeAll, { color: pillar.color }]}>Explorer →</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselScroll}
              >
                {pillar.themes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    pillarColor={pillar.color}
                    onPress={() => handleThemePress(theme)}
                    onLongPress={() => handleLongPress(theme, pillar.color)}
                  />
                ))}
              </ScrollView>
            </Animated.View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── LONG-PRESS PREVIEW MODAL ── */}
      <Modal
        visible={!!previewTheme}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewTheme(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPreviewTheme(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {previewTheme && (
              <Animated.View entering={FadeInUp.springify()} style={styles.previewCard}>
                {/* Glow */}
                <View style={[styles.previewGlow, {
                  shadowColor: previewPillarColor,
                  backgroundColor: previewPillarColor + '10',
                }]} />

                <View style={styles.previewRingWrap}>
                  <ProgressRing
                    progress={previewTheme.xp_progress?.progress || 0}
                    color={previewPillarColor}
                    size={96}
                    strokeWidth={4}
                  />
                  <View style={[styles.previewIconCircle, { backgroundColor: previewPillarColor + '15' }]}>
                    <Text style={styles.previewIcon}>{previewTheme.icon}</Text>
                  </View>
                </View>

                <Text style={styles.previewName}>{previewTheme.name}</Text>

                {previewTheme.level > 0 ? (
                  <View style={[styles.previewLevelBadge, { backgroundColor: previewPillarColor + '25' }]}>
                    <Text style={[styles.previewLevelText, { color: previewPillarColor }]}>
                      Niveau {previewTheme.level}
                    </Text>
                  </View>
                ) : null}

                {previewTheme.title ? (
                  <Text style={[styles.previewTitle, { color: previewPillarColor }]}>
                    « {previewTheme.title} »
                  </Text>
                ) : null}

                {/* Stats */}
                <View style={styles.previewStats}>
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatValue}>{previewTheme.total_questions}</Text>
                    <Text style={styles.previewStatLabel}>Questions</Text>
                  </View>
                  <View style={[styles.previewDivider, { backgroundColor: previewPillarColor + '30' }]} />
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatValue}>{previewTheme.xp}</Text>
                    <Text style={styles.previewStatLabel}>XP</Text>
                  </View>
                </View>

                {/* Lvl 50 Target */}
                {previewTheme.title_lvl50 ? (
                  <View style={styles.previewGoal}>
                    <Text style={styles.previewGoalLabel}>🏆 Titre Niveau 50</Text>
                    <Text style={[styles.previewGoalTitle, { color: previewPillarColor }]}>
                      {previewTheme.title_lvl50}
                    </Text>
                  </View>
                ) : null}

                {/* Play Button */}
                {previewTheme.playable && (
                  <TouchableOpacity
                    style={[styles.previewPlayBtn, { backgroundColor: previewPillarColor }]}
                    onPress={() => {
                      setPreviewTheme(null);
                      handleThemePress(previewTheme);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.previewPlayText}>⚔️  JOUER</Text>
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

// ── La Forge Styles ──
const forgeStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  outerWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  neonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  innerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  touchable: {
    padding: 18,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  icon: { fontSize: 26 },
  textWrap: { flex: 1 },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '600',
  },
});

// ── Main Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Background glow
  bgGlow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  bgGlowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    shadowOffset: { width: 0, height: 80 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    zIndex: 0,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#525252',
    letterSpacing: 3,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },

  // Pillars
  pillarsScroll: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 8,
  },
  pillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  pillarIcon: { fontSize: 18 },
  pillarName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pillarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // Pillar Header
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  pillarHeaderIcon: { fontSize: 32 },
  pillarHeaderName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  pillarHeaderLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginTop: 1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Carousel
  carouselScroll: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
  },

  // Theme Card
  themeCard: {
    width: CARD_W,
  },
  themeCardInner: {
    width: '100%',
    height: CARD_H,
    borderRadius: 18,
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  themeCardLocked: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  ringWrap: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIcon: { fontSize: 28 },
  themeName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 14,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  lockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: GLASS.bg,
  },
  lockText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#444',
  },
  themeTitle: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },

  // Topic Card (individual themes with icon_url)
  topicCard: {
    width: CARD_W,
  },
  topicCardInner: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: CARD_H,
    overflow: 'hidden',
  },
  topicGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    height: 80,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  topicName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },

  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  gridCard: {
    width: Math.floor((SCREEN_W - 32 - 16) / 3),
    marginBottom: 4,
  },
  gridCardInner: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: 140,
  },
  gridRingWrap: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridThemeIcon: { fontSize: 22 },
  gridThemeName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
    width: '100%',
    paddingHorizontal: 2,
  },
  gridLevel: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
  },

  // All Pillars Section
  allPillarsSection: {
    marginTop: 24,
  },
  miniSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 16,
  },
  miniSectionTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  miniSectionIcon: { fontSize: 20 },
  miniSectionName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  miniSectionLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },

  // Long-Press Preview Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_W * 0.82,
    maxWidth: 340,
  },
  previewCard: {
    borderRadius: 24,
    backgroundColor: GLASS.bgDark,
    borderWidth: 1,
    borderColor: GLASS.borderCyan,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  previewGlow: {
    position: 'absolute',
    top: -40,
    left: -40,
    right: -40,
    height: 180,
    borderRadius: 100,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
  },
  previewRingWrap: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewIcon: { fontSize: 38 },
  previewName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  previewLevelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 6,
  },
  previewLevelText: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  previewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewStat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  previewStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
  },
  previewStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
    marginTop: 2,
  },
  previewDivider: {
    width: 1,
    height: 30,
  },
  previewGoal: {
    backgroundColor: GLASS.bg,
    borderRadius: 12,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewGoalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    marginBottom: 4,
  },
  previewGoalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  previewPlayBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  previewPlayText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
});

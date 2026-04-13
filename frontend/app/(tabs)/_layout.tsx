import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useRouter, usePathname, Slot } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../../theme/glassTheme';
import DueloHeader from '../../components/DueloHeader';
import { useSwipeBackProgress } from '../../components/SwipeBackContext';
import { t } from '../../utils/i18n';
import { useWS } from '../../contexts/WebSocketContext';

// Import screen components directly for the pager
import AccueilScreen from './accueil';
import PlayersScreen from './players';
import PlayScreen from './play';
import ThemesScreen from './themes';
import ProfileScreen from './profile';

// ── Neon SVG tab icons ────────────────────────────────────────────────────────

function HomeIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12L12 3l9 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlayersIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="2" />
      <Path d="M2 21v-1a7 7 0 0 1 7-7h1" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="17" cy="9" r="3" stroke={color} strokeWidth="2" />
      <Path d="M13 21v-1a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v1" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

const PLAY_ICON = require('../../assets/tabs/play.webp');

function ThemesIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"
        stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
      />
    </Svg>
  );
}

function ProfileIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
      <Path d="M4 20a8 8 0 0 1 16 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TAB_COLORS = {
  accueil: '#00E5FF',   // cyan
  players: '#BF5FFF',  // violet
  play:    '#FFFFFF',  // blanc (bouton central)
  themes:  '#FF3E9D',  // rose
  profile: '#FF9F0A',  // orange
};

const TAB_CONFIG = [
  { name: 'accueil', labelKey: 'tab.home' as const },
  { name: 'players', labelKey: 'tab.players' as const },
  { name: 'play', labelKey: 'tab.play' as const, isCenter: true },
  { name: 'themes', labelKey: 'tab.themes' as const },
  { name: 'profile', labelKey: 'tab.profile' as const },
];

const TAB_NAMES = TAB_CONFIG.map(tab => tab.name);
const TAB_COUNT = TAB_CONFIG.length;
const SCREENS = [AccueilScreen, PlayersScreen, PlayScreen, ThemesScreen, ProfileScreen];

const SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.8 };

function TabIcon({ name, color, size }: { name: string; color: string; size?: number }) {
  if (name === 'accueil') return <HomeIcon color={color} size={size} />;
  if (name === 'players') return <PlayersIcon color={color} size={size} />;
  if (name === 'play')    return <Image source={PLAY_ICON} style={{ width: size ?? 30, height: size ?? 30 }} resizeMode="contain" />;
  if (name === 'themes')  return <ThemesIcon color={color} size={size} />;
  if (name === 'profile') return <ProfileIcon color={color} size={size} />;
  return null;
}

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99' : String(count)}</Text>
    </View>
  );
}

function CustomTabBar({ currentIndex, onTabPress }: { currentIndex: number; onTabPress: (index: number) => void }) {
  const insets = useSafeAreaInsets();
  const { unreadNotifs, unreadMessages } = useWS();

  const badgeForTab = (name: string) => {
    if (name === 'accueil') return unreadNotifs;
    if (name === 'players') return unreadMessages;
    return 0;
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
      {TAB_CONFIG.map((tab, index) => {
        const isFocused = currentIndex === index;
        const color = TAB_COLORS[tab.name as keyof typeof TAB_COLORS];
        const badgeCount = badgeForTab(tab.name);

        if (tab.isCenter) {
          return (
            <TouchableOpacity key={tab.name} style={styles.playTabWrap} onPress={() => onTabPress(index)} activeOpacity={1}>
              <View style={[
                styles.playTabCircle,
                isFocused && { borderColor: 'rgba(0,255,255,0.8)', shadowOpacity: 0.8, shadowRadius: 18 },
              ]}>
                <TabIcon name={tab.name} color="#FFF" size={30} />
              </View>
              <Text style={[styles.tabLabel, isFocused && { color: '#00FFFF' }]}>{t(tab.labelKey)}</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={tab.name} style={styles.tabItem} onPress={() => onTabPress(index)} activeOpacity={1}>
            {/* Glow spot when active */}
            {isFocused && (
              <View style={[styles.iconGlow, { backgroundColor: color + '22', shadowColor: color }]} />
            )}
            <View style={{ opacity: isFocused ? 1 : 0.38 }}>
              <TabIcon name={tab.name} color={color} size={26} />
              <TabBadge count={badgeCount} />
            </View>
            <Text style={[styles.tabLabel, isFocused && { color }]}>{t(tab.labelKey)}</Text>
            {isFocused && (
              <View style={[styles.activeIndicator, { backgroundColor: color, shadowColor: color }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const currentIndex = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeBackProgress = useSwipeBackProgress();

  // Only keep active page + adjacent pages mounted, unmount the rest
  const renderedPages = useMemo(() => {
    const pages = new Set<number>();
    pages.add(activeIndex);
    if (activeIndex > 0) pages.add(activeIndex - 1);
    if (activeIndex < TAB_COUNT - 1) pages.add(activeIndex + 1);
    return pages;
  }, [activeIndex]);

  // Handle external navigation (e.g., from results screen back to a tab)
  const pathname = usePathname();
  const lastSyncedPath = useRef('');

  useEffect(() => {
    if (!pathname) return;
    const tabName = pathname.split('/').pop();
    if (!tabName || tabName === lastSyncedPath.current) return;
    const idx = TAB_NAMES.indexOf(tabName);
    if (idx >= 0 && idx !== activeIndex) {
      lastSyncedPath.current = tabName;
      currentIndex.value = idx;
      translateX.value = -idx * SCREEN_WIDTH;
      setActiveIndex(idx);
    }
  }, [pathname, SCREEN_WIDTH]);

  const updateActiveIndex = useCallback((idx: number) => {
    if (idx !== activeIndex) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveIndex(idx);
    lastSyncedPath.current = TAB_NAMES[idx];
  }, [activeIndex]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      'worklet';
      const rawTranslate = -currentIndex.value * SCREEN_WIDTH + e.translationX;
      const maxTranslate = 0;
      const minTranslate = -(TAB_COUNT - 1) * SCREEN_WIDTH;

      // Rubber band effect at edges
      if (rawTranslate > maxTranslate) {
        translateX.value = rawTranslate * 0.25;
      } else if (rawTranslate < minTranslate) {
        translateX.value = minTranslate + (rawTranslate - minTranslate) * 0.25;
      } else {
        translateX.value = rawTranslate;
      }
    })
    .onEnd((e) => {
      'worklet';
      const curPage = currentIndex.value;
      let newPage = curPage;

      const threshold = SCREEN_WIDTH / 3;
      const isHorizontal = Math.abs(e.translationX) > Math.abs(e.translationY) * 1.2;

      if (isHorizontal) {
        if (e.translationX < -threshold || (e.translationX < -30 && e.velocityX < -500)) {
          newPage = Math.min(curPage + 1, TAB_COUNT - 1);
        } else if (e.translationX > threshold || (e.translationX > 30 && e.velocityX > 500)) {
          newPage = Math.max(curPage - 1, 0);
        }
      }

      currentIndex.value = newPage;
      translateX.value = withSpring(-newPage * SCREEN_WIDTH, SPRING_CONFIG);
      runOnJS(updateActiveIndex)(newPage);
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const onTabPress = useCallback((index: number) => {
    if (index !== activeIndex) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    currentIndex.value = index;
    translateX.value = withTiming(-index * SCREEN_WIDTH, { duration: 300 });
    setActiveIndex(index);
    lastSyncedPath.current = TAB_NAMES[index];
  }, [SCREEN_WIDTH, activeIndex]);

  // Parallax: shift the tab content slightly left when a stack page is on top
  // progress: 0 = normal (no page on top), 1 = page fully covering tabs
  const parallaxStyle = useAnimatedStyle(() => {
    if (!swipeBackProgress) return {};
    const p = swipeBackProgress.value;
    const shift = interpolate(
      p,
      [0, 1],
      [0, -60],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      p,
      [0, 1],
      [1, 0.94],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX: shift }, { scale }],
    };
  });

  return (
    <Animated.View style={[styles.container, parallaxStyle]}>
      {/* Hidden Slot for expo-router compatibility */}
      <View style={styles.hiddenSlot} pointerEvents="none">
        <Slot />
      </View>

      {/* Fixed header - stays in place during swipe */}
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <DueloHeader />
      </SafeAreaView>

      {/* Custom swipeable pager */}
      <View style={styles.pagerContainer}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.pagerStrip, containerStyle]}>
            {SCREENS.map((ScreenComponent, idx) => (
              <View key={idx} style={[styles.page, { width: SCREEN_WIDTH }]}>
                {renderedPages.has(idx) ? <ScreenComponent /> : <View style={styles.placeholder} />}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      </View>

      <CustomTabBar currentIndex={activeIndex} onTabPress={onTabPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
  hiddenSlot: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  safeTop: {
    backgroundColor: GLASS.bgDark,
  },
  pagerContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  pagerStrip: {
    flexDirection: 'row',
    flex: 1,
  },
  page: {
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#050510',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: GLASS.bgDark,
    borderTopWidth: 1,
    borderTopColor: GLASS.borderCyan,
    paddingTop: 8,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any,
      default: {},
    }),
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    minWidth: 56,
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    top: 2, width: 44, height: 36,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  tabLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeIndicator: {
    width: 4, height: 4, borderRadius: 2,
    marginTop: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 6,
  },
  playTabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#050510',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
  },
  playTabCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#7B22E2',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(0,255,255,0.45)',
    shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
});

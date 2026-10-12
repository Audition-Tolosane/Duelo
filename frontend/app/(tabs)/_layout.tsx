import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { usePathname, Slot } from 'expo-router';
import * as Haptics from 'expo-haptics';
import DueloHeader from '../../components/DueloHeader';
import { useSwipeBackProgress } from '../../components/SwipeBackContext';
import { t } from '../../utils/i18n';
import { TabBarProvider, useTabBar } from '../../contexts/TabBarContext';
import { ActiveTabContext } from '../../contexts/ActiveTabContext';
import { ScreenContainer, Txt, Icon } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { COLOR, SPACE, SIZE, RADII, BORDER, ELEVATION, ICON_SIZE, TYPO } from '../../theme/tokens';

// Import screen components directly for the pager
import AccueilScreen from './accueil';
import PlayersScreen from './players';
import PlayScreen from './play';
import ThemesScreen from './themes';
import ProfileScreen from './profile';

// ── Tab config ────────────────────────────────────────────────────────────────
// Icônes Lucide (registre <Icon>) : actif = jaune (icône + libellé + point), inactif = crème.
// Les pastilles de notification vivent uniquement dans l'en-tête (DueloHeader).

const TAB_CONFIG: { name: string; labelKey: string; icon: IconName; isCenter?: boolean }[] = [
  { name: 'accueil', labelKey: 'tab.home', icon: 'home' },
  { name: 'players', labelKey: 'tab.players', icon: 'users' },
  { name: 'play', labelKey: 'tab.play', icon: 'duel', isCenter: true },
  { name: 'themes', labelKey: 'tab.themes', icon: 'compass' },
  { name: 'profile', labelKey: 'tab.profile', icon: 'user' },
];

const TAB_NAMES = TAB_CONFIG.map(tab => tab.name);
const TAB_COUNT = TAB_CONFIG.length;
const SCREENS = [AccueilScreen, PlayersScreen, PlayScreen, ThemesScreen, ProfileScreen];

const SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.8 };

// D9 : le glisser horizontal entre onglets est désactivé (conflit avec les carrousels,
// la tab bar suffit). Repasser à true pour le réactiver après les retours du pilote.
const PAGER_SWIPE_ENABLED = false;

// Libellés d'onglet à 11 px (plancher lisibilité) : Space Grotesk Medium à la taille de l'overline.
const TAB_LABEL_SIZE = { fontSize: TYPO.overline.fontSize, lineHeight: TYPO.overline.lineHeight };
const PLAY_DISC = SIZE.buttonLg; // disque central Jouer : 56 px

// Header qui s'efface au scroll vers le bas (même valeur que la cartouche du bas).
// Le repli inclut la zone safe-area : aucune bande résiduelle, le contenu
// monte jusqu'au bord physique de l'écran.
const HEADER_ROW_H = SIZE.header; // 46 px — sync avec DueloHeader

function CollapsingHeader() {
  const insets = useSafeAreaInsets();
  const { hidden } = useTabBar();
  const fullHeight = insets.top + HEADER_ROW_H;

  const collapseStyle = useAnimatedStyle(() => {
    const h = hidden ? hidden.value : 0;
    return {
      height: interpolate(h, [0, 1], [fullHeight, 0]),
      opacity: interpolate(h, [0, 0.7], [1, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[styles.headerCollapse, collapseStyle]}>
      <View style={{ paddingTop: insets.top }}>
        <DueloHeader />
      </View>
    </Animated.View>
  );
}

function CustomTabBar({ currentIndex, onTabPress }: { currentIndex: number; onTabPress: (index: number) => void }) {
  const insets = useSafeAreaInsets();
  const { hidden } = useTabBar();

  // Réduction au scroll : la cartouche se compacte (icônes seules, légèrement plus petite)
  const bottomOffset = (insets.bottom > 0 ? insets.bottom : SPACE.md) + SPACE.xs;
  const hideStyle = useAnimatedStyle(() => {
    const h = hidden ? hidden.value : 0;
    return {
      transform: [
        { translateY: interpolate(h, [0, 1], [0, 8]) },
        { scale: interpolate(h, [0, 1], [1, 0.88]) },
      ],
    };
  });

  // Les labels se replient (hauteur + opacité) → pill compacte icônes seules
  const labelWrapStyle = useAnimatedStyle(() => {
    const h = hidden ? hidden.value : 0;
    return {
      opacity: interpolate(h, [0, 0.6], [1, 0], Extrapolation.CLAMP),
      height: interpolate(h, [0, 1], [TYPO.overline.lineHeight + SPACE.xxs, 0]),
      marginTop: interpolate(h, [0, 1], [SPACE.xxs, 0]),
    };
  });

  return (
    <Animated.View style={[styles.tabBar, { bottom: bottomOffset }, hideStyle]}>
      {TAB_CONFIG.map((tab, index) => {
        const isFocused = currentIndex === index;
        const fg = isFocused ? COLOR.action.primary : COLOR.text.tertiary;
        const label = t(tab.labelKey);

        if (tab.isCenter) {
          return (
            <Pressable
              key={tab.name}
              style={styles.playTabWrap}
              onPress={() => onTabPress(index)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isFocused }}
            >
              {({ pressed }) => (
                <>
                  <View style={[styles.playTabCircle, pressed && styles.playTabPressed]}>
                    <Icon name={tab.icon} size={ICON_SIZE.xl} color={COLOR.text.onAction} />
                  </View>
                  <Animated.View style={[styles.labelWrap, labelWrapStyle]}>
                    <Txt variant="label" color={fg} style={TAB_LABEL_SIZE} numberOfLines={1}>{label}</Txt>
                  </Animated.View>
                </>
              )}
            </Pressable>
          );
        }

        return (
          <Pressable
            key={tab.name}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
            onPress={() => onTabPress(index)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isFocused }}
          >
            <Icon name={tab.icon} size={ICON_SIZE.lg} color={fg} />
            <Animated.View style={[styles.labelWrap, labelWrapStyle]}>
              <Txt variant="label" color={fg} style={TAB_LABEL_SIZE} numberOfLines={1}>{label}</Txt>
            </Animated.View>
            <View style={[styles.activeDot, isFocused && styles.activeDotOn]} />
          </Pressable>
        );
      })}
    </Animated.View>
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
    .enabled(PAGER_SWIPE_ENABLED)
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
    <TabBarProvider>
    <Animated.View style={[styles.container, parallaxStyle]}>
    {/* Fond nuit pétrole UNIQUE derrière header + contenu + cartouche
        (les onglets sont transparents — aucune couture sous le header) */}
    <ScreenContainer>
      {/* Hidden Slot for expo-router compatibility */}
      <View style={styles.hiddenSlot} pointerEvents="none">
        <Slot />
      </View>

      {/* Header — s'efface au scroll vers le bas, revient au scroll vers le haut */}
      <CollapsingHeader />

      {/* Custom swipeable pager */}
      <ActiveTabContext.Provider value={TAB_NAMES[activeIndex]}>
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
      </ActiveTabContext.Provider>

      <CustomTabBar currentIndex={activeIndex} onTabPress={onTabPress} />
    </ScreenContainer>
    </Animated.View>
    </TabBarProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg.primary,
  },
  hiddenSlot: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  headerCollapse: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
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
    backgroundColor: 'transparent',
  },
  // Cartouche flottante détachée du bas de l'écran : nuit pétrole, liseré crème 8 %
  tabBar: {
    position: 'absolute',
    left: SPACE.md,
    right: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLOR.bg.primary,
    borderRadius: RADII.pill,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.subtle,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.xs,
    ...ELEVATION.e3,
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
    minWidth: SIZE.buttonLg,
    minHeight: SIZE.touch,
    paddingTop: SPACE.xs,
  },
  tabPressed: { opacity: 0.7 },
  labelWrap: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  // Point actif de 4 px sous le libellé (reste visible quand la cartouche est compacte)
  activeDot: {
    width: SPACE.xs,
    height: SPACE.xs,
    borderRadius: RADII.xs,
    marginTop: SPACE.xxs,
    backgroundColor: 'transparent',
  },
  activeDotOn: { backgroundColor: COLOR.action.primary },
  playTabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: SIZE.buttonLg,
    marginTop: -SPACE.lg,
  },
  // Bouton central Jouer : disque jaune plein, icône nuit
  playTabCircle: {
    width: PLAY_DISC,
    height: PLAY_DISC,
    borderRadius: PLAY_DISC / 2,
    backgroundColor: COLOR.action.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: BORDER.strong,
    borderColor: COLOR.bg.primary,
    ...ELEVATION.e2,
  },
  playTabPressed: { backgroundColor: COLOR.action.primaryPressed, transform: [{ scale: 0.96 }] },
});

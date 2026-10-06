import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, SlideInRight,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Txt, Icon, Button, Card, ScreenContainer, ThemeIcon, Loader } from '../components/ui';
import type { IconName } from '../components/ui';
import { COLOR, PALETTE, SPACE, SIZE, RADII } from '../theme/tokens';
import { authFetch } from '../utils/api';
import { t, getLanguage } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type TrendingTheme = {
  id: string;
  name: string;
  color_hex: string;
  description: string;
  match_count: number;
  icon_url: string;
};

// Pictogrammes Lucide crème sur disque pétrole : le tutoriel explique, il ne décore pas.
const TUTO_SLIDES: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: 'search', titleKey: 'onboarding.tuto_title_1', bodyKey: 'onboarding.tuto_body_1' },
  { icon: 'brain', titleKey: 'onboarding.tuto_title_2', bodyKey: 'onboarding.tuto_body_2' },
  { icon: 'trend', titleKey: 'onboarding.tuto_title_3', bodyKey: 'onboarding.tuto_body_3' },
];

// Confettis du bonus de bienvenue (moment de récompense) : couleurs de la palette SKILKI uniquement
const CONFETTI_COLORS = [PALETTE.yellow, PALETTE.gold, PALETTE.coral, PALETTE.green, PALETTE.cream];

/** Points d'étape : l'étape en cours est un trait jaune (état actif). */
function StepDots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.dotsRow} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: count, now: active + 1 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, active === i && styles.dotActive]} />
      ))}
    </View>
  );
}

/** Lien texte « Passer » (cible de 44 px). */
function SkipLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={4} style={styles.skipBtn}>
      <Txt variant="label" color={COLOR.text.secondary}>{t('onboarding.skip')}</Txt>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  // Grille de 3 thèmes par ligne, calculée sur la largeur réelle (320 → 88 px par tuile)
  const tileW = Math.floor((Math.min(winW, 480) - SPACE.screenX * 2 - SPACE.md * 2) / 3);
  const [step, setStep] = useState(0); // 0=welcome, 1=trending, 2=tuto
  const [trending, setTrending] = useState<TrendingTheme[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [tutoIndex, setTutoIndex] = useState(0);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [showXpBanner, setShowXpBanner] = useState(false);
  const confettiRef = useRef<any>(null);

  // Animations
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const xpBannerOpacity = useSharedValue(0);
  const xpBannerY = useSharedValue(20);

  useEffect(() => {
    // Welcome animation
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // Fetch trending themes
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      const lang = getLanguage();
      const res = await fetch(
        `${API_URL}/api/themes/trending${lang && lang !== 'fr' ? `?lang=${lang}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setTrending(data.trending || []);
      }
    } catch (e) { console.error(e); }
    setLoadingTrending(false);
  };

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const finishOnboarding = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      if (uid) {
        // Follow selected themes
        for (const themeId of selectedThemes) {
          authFetch(`${API_URL}/api/theme/${themeId}/follow`, { method: 'POST' }).catch(() => {});
        }
        // Mark onboarding done + grant welcome XP
        authFetch(`${API_URL}/api/auth/onboarding-done`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: uid }),
        }).catch(() => {});
      }
      await AsyncStorage.setItem('duelo_onboarding_done', 'true');
    } catch (e) { console.error(e); }
    if (isMounted.current) router.replace('/(tabs)/play');
  };

  const toggleTheme = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedThemes(prev => {
      if (prev.includes(id)) return prev.filter(t => t !== id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, id];
    });
  };

  const nextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 2) {
      setStep(step + 1);
    } else if (step === 2) {
      if (tutoIndex < TUTO_SLIDES.length - 1) {
        setTutoIndex(tutoIndex + 1);
      } else {
        // Last slide: shoot confetti + show XP banner, then navigate
        confettiRef.current?.start();
        setShowXpBanner(true);
        xpBannerOpacity.value = withTiming(1, { duration: 400 });
        xpBannerY.value = withSpring(0, { damping: 10 });
        setTimeout(finishOnboarding, 1800);
      }
    }
  };

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const xpBannerStyle = useAnimatedStyle(() => ({
    opacity: xpBannerOpacity.value,
    transform: [{ translateY: xpBannerY.value }],
  }));

  const top = { paddingTop: insets.top + SPACE.lg };
  const bottom = { paddingBottom: insets.bottom + SPACE.xxl };

  // -- Step 0: Welcome --
  if (step === 0) {
    return (
      <ScreenContainer style={top}>
        <StepDots count={3} active={step} />
        <Animated.View style={[styles.welcomeCenter, logoStyle]}>
          <View style={styles.welcomeDisc}>
            <Icon name="duel" size={48} color={COLOR.text.primary} />
          </View>
          <Animated.View entering={FadeInDown.delay(400).duration(600)}>
            <Txt variant="h1" align="center">{t('onboarding.welcome')}</Txt>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(600).duration(600)}>
            <Txt variant="body" color={COLOR.text.secondary} align="center">{t('onboarding.subtitle')}</Txt>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(800).duration(500)} style={[styles.bottomArea, bottom]}>
          <Button label={t('onboarding.lets_go')} onPress={nextStep} fullWidth />
          <SkipLink onPress={finishOnboarding} />
        </Animated.View>
      </ScreenContainer>
    );
  }

  // -- Step 1: Pick Favorite Themes --
  if (step === 1) {
    const count = selectedThemes.length;
    return (
      <ScreenContainer style={top}>
        <StepDots count={3} active={step} />
        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(500)} style={styles.stepHeader}>
            <View style={styles.stepDisc}>
              <Icon name="heart" size={24} color={COLOR.text.primary} />
            </View>
            <Txt variant="h2" align="center">{t('onboarding.pick_favorites')}</Txt>
            <Txt variant="bodySmall" align="center">{t('onboarding.pick_sub')}</Txt>
            <Txt variant="label" color={count > 0 ? COLOR.action.primary : COLOR.text.tertiary} style={styles.counter}>
              {t('pilot.onboarding.selection', { n: String(count) })}
            </Txt>
          </Animated.View>

          {loadingTrending ? (
            <Loader />
          ) : (
            <View style={styles.themesGrid}>
              {trending.map((theme, idx) => {
                const isSelected = selectedThemes.includes(theme.id);
                return (
                  <Animated.View key={theme.id} entering={FadeInDown.delay(idx * 80).duration(350)}>
                    <Card
                      onPress={() => toggleTheme(theme.id)}
                      accent={isSelected ? 'selected' : 'none'}
                      padded={false}
                      style={[styles.themeCard, styles.tileFill, { width: tileW }]}
                    >
                      <ThemeIcon themeName={theme.name} size={48} />
                      <Txt variant="label" color={COLOR.text.primary} align="center" numberOfLines={2} style={styles.tileName}>{theme.name}</Txt>
                      {theme.match_count > 0 ? (
                        <View style={styles.themeMeta}>
                          <Icon name="duel" size={12} color={COLOR.text.tertiary} />
                          <Txt variant="caption">{theme.match_count}</Txt>
                        </View>
                      ) : null}
                      {isSelected ? (
                        <View style={styles.checkBadge}>
                          <Icon name="check" size={12} color={COLOR.text.onAction} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={[styles.bottomArea, bottom]}>
          <Button
            label={t('onboarding.next_upper')}
            onPress={nextStep}
            variant={count > 0 ? 'primary' : 'secondary'}
            fullWidth
          />
          <SkipLink onPress={finishOnboarding} />
        </Animated.View>
      </ScreenContainer>
    );
  }

  // -- Step 2: Tutorial --
  const slide = TUTO_SLIDES[tutoIndex];
  const isLastSlide = tutoIndex === TUTO_SLIDES.length - 1;
  return (
    <ScreenContainer style={top}>
      <StepDots count={3} active={step} />
      <Animated.View key={tutoIndex} entering={SlideInRight.duration(400)} style={styles.tutoCenter}>
        <View style={styles.tutoDisc}>
          <Icon name={slide.icon} size={36} color={COLOR.text.primary} />
        </View>
        <Txt variant="h2" align="center">{t(slide.titleKey)}</Txt>
        <Txt variant="body" color={COLOR.text.secondary} align="center">{t(slide.bodyKey)}</Txt>
        <View style={styles.tutoDotsRow}>
          {TUTO_SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, tutoIndex === i && styles.dotActive]} />
          ))}
        </View>
      </Animated.View>

      {/* Bonus de bienvenue : moment de récompense (or), affiché à la fin */}
      {showXpBanner && (
        <Animated.View style={[styles.xpBanner, xpBannerStyle]}>
          <Card accent="reward" style={styles.xpBannerCard}>
            <Icon name="bolt" size={24} color={COLOR.reward.gold} />
            <Txt variant="h2" color={COLOR.reward.gold} align="center" style={styles.xpBannerText}>{t('onboarding.xp_bonus')}</Txt>
          </Card>
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={[styles.bottomArea, bottom]}>
        {!showXpBanner && (
          <Button
            label={isLastSlide ? t('onboarding.begin') : t('onboarding.next_upper')}
            onPress={nextStep}
            fullWidth
          />
        )}
        {tutoIndex < TUTO_SLIDES.length - 1 && !showXpBanner && (
          <SkipLink onPress={finishOnboarding} />
        )}
      </Animated.View>

      {/* Confetti — fires on last slide completion */}
      <ConfettiCannon
        ref={confettiRef}
        count={120}
        origin={{ x: winW / 2, y: -10 }}
        autoStart={false}
        fadeOut
        colors={CONFETTI_COLORS}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Nom sur 2 lignes réservées : toutes les tuiles d'une rangée ont la même hauteur
  tileName: { minHeight: 32 },
  // La tuile remplit la hauteur de sa rangée (celles sans compteur de parties sont plus courtes)
  tileFill: { flexGrow: 1 },
  // Points d'étape
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLOR.track,
  },
  dotActive: {
    backgroundColor: COLOR.action.primary,
    width: 20,
  },

  // Welcome
  welcomeCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.xxxl,
  },
  welcomeDisc: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLOR.surface.card,
    borderWidth: 1,
    borderColor: COLOR.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
  },

  // Étape « thèmes »
  stepScroll: {
    paddingTop: SPACE.xxxl,
    paddingHorizontal: SPACE.screenX,
    paddingBottom: SPACE.xxl,
    gap: SPACE.xxl,
  },
  stepHeader: {
    alignItems: 'center',
    gap: SPACE.sm,
  },
  stepDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLOR.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.sm,
  },
  counter: { marginTop: SPACE.xs },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACE.md,
  },
  themeCard: {
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    overflow: 'visible',
  },
  themeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
  },
  checkBadge: {
    position: 'absolute',
    top: SPACE.xs,
    right: SPACE.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLOR.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tutoriel
  tutoCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.xxxl,
  },
  tutoDisc: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLOR.surface.card,
    borderWidth: 1,
    borderColor: COLOR.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
  },
  tutoDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACE.sm,
    marginTop: SPACE.xl,
  },

  // Bas d'écran
  bottomArea: {
    paddingHorizontal: SPACE.xxl,
    paddingTop: SPACE.md,
    alignItems: 'center',
    gap: SPACE.xs,
  },
  skipBtn: {
    minHeight: SIZE.touch,
    paddingHorizontal: SPACE.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bonus XP (fin du tutoriel)
  xpBanner: {
    position: 'absolute',
    top: '40%',
    left: SPACE.huge,
    right: SPACE.huge,
    zIndex: 10,
  },
  xpBannerCard: {
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.xl,
    borderRadius: RADII.xl,
  },
  xpBannerText: { flexShrink: 1 },
});

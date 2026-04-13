import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, SlideInRight,
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withRepeat,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import CategoryIcon from '../components/CategoryIcon';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type TrendingTheme = {
  id: string;
  name: string;
  color_hex: string;
  description: string;
  match_count: number;
  icon_url: string;
};

const TUTO_SLIDES = [
  {
    icon: 'magnify' as const,
    titleKey: 'onboarding.tuto_title_1',
    bodyKey: 'onboarding.tuto_body_1',
    color: '#8A2BE2',
  },
  {
    icon: 'head-question' as const,
    titleKey: 'onboarding.tuto_title_2',
    bodyKey: 'onboarding.tuto_body_2',
    color: '#00BFFF',
  },
  {
    icon: 'trending-up' as const,
    titleKey: 'onboarding.tuto_title_3',
    bodyKey: 'onboarding.tuto_body_3',
    color: '#00FF9D',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
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
      const res = await fetch(`${API_URL}/api/themes/trending`);
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

  // -- Step 0: Welcome --
  if (step === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A1A', '#1A0A2E', '#0A0A1A']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.welcomeCenter, logoStyle]}>
          <LinearGradient
            colors={['#8A2BE2', '#00FFFF']}
            style={styles.welcomeLogoCircle}
          >
            <MaterialCommunityIcons name="sword-cross" size={60} color="#FFF" />
          </LinearGradient>
          <Animated.Text entering={FadeInDown.delay(400).duration(600)} style={styles.welcomeTitle}>
            {t('onboarding.welcome')}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(600).duration(600)} style={styles.welcomeSub}>
            {t('onboarding.subtitle')}
          </Animated.Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(800).duration(500)} style={styles.bottomArea}>
          <TouchableOpacity onPress={nextStep} activeOpacity={0.85}>
            <LinearGradient
              colors={['#8A2BE2', '#00BFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.mainBtn}
            >
              <Text style={styles.mainBtnText}>{t('onboarding.lets_go')}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={finishOnboarding} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Step dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
          ))}
        </View>
      </View>
    );
  }

  // -- Step 1: Pick Favorite Themes --
  if (step === 1) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A1A', '#1A0A2E', '#0A0A1A']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View entering={FadeIn.duration(500)} style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <LinearGradient colors={['#8A2BE2', '#00BFFF']} style={styles.stepIconCircle}>
              <MaterialCommunityIcons name="heart" size={24} color="#FFF" />
            </LinearGradient>
            <Text style={styles.stepTitle}>{t('onboarding.pick_favorites')}</Text>
            <Text style={styles.stepSub}>{t('onboarding.pick_sub')}</Text>
          </View>

          {/* Selected counter */}
          <View style={styles.selectedCounter}>
            <LinearGradient
              colors={selectedThemes.length > 0 ? ['#8A2BE2', '#A855F7'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)']}
              style={styles.selectedCounterBadge}
            >
              <MaterialCommunityIcons name="check-circle" size={13} color={selectedThemes.length > 0 ? '#FFF' : '#555'} />
              <Text style={[styles.selectedCounterText, selectedThemes.length > 0 && { color: '#FFF' }]}>
                {t('onboarding.selected').replace('{n}', String(selectedThemes.length))}
              </Text>
            </LinearGradient>
          </View>

          {loadingTrending ? (
            <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.themesGrid}>
              {trending.map((theme, idx) => {
                const isSelected = selectedThemes.includes(theme.id);
                return (
                  <Animated.View
                    key={theme.id}
                    entering={FadeInDown.delay(idx * 80).duration(350)}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => toggleTheme(theme.id)}
                      style={[
                        styles.themeCard,
                        isSelected && { borderColor: theme.color_hex + '80', backgroundColor: theme.color_hex + '15' },
                      ]}
                    >
                      <View style={[styles.themeIconWrap, { backgroundColor: theme.color_hex + (isSelected ? '30' : '20') }]}>
                        <CategoryIcon themeId={theme.id} size={28} />
                      </View>
                      <Text style={[styles.themeName, isSelected && { color: theme.color_hex }]} numberOfLines={1}>{theme.name}</Text>
                      {isSelected ? (
                        <View style={[styles.themeMatchBadge, { backgroundColor: theme.color_hex + '30' }]}>
                          <MaterialCommunityIcons name="check" size={10} color={theme.color_hex} />
                        </View>
                      ) : theme.match_count > 0 ? (
                        <View style={styles.themeMatchBadge}>
                          <MaterialCommunityIcons name="sword-cross" size={9} color="rgba(255,255,255,0.5)" />
                          <Text style={styles.themeMatchCount}>{theme.match_count}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.bottomArea}>
          <TouchableOpacity onPress={nextStep} activeOpacity={0.85}>
            <LinearGradient
              colors={selectedThemes.length > 0 ? ['#8A2BE2', '#00BFFF'] : ['#444', '#333']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.mainBtn}
            >
              <Text style={styles.mainBtnText}>{t('onboarding.next_upper')}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={finishOnboarding} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.dotsRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
          ))}
        </View>
      </View>
    );
  }

  // -- Step 2: Tutorial --
  const slide = TUTO_SLIDES[tutoIndex];
  const isLastSlide = tutoIndex === TUTO_SLIDES.length - 1;
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A1A', '#1A0A2E', '#0A0A1A']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View key={tutoIndex} entering={SlideInRight.duration(400)} style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <LinearGradient colors={[slide.color, slide.color + '80']} style={styles.tutoIconCircle}>
            <MaterialCommunityIcons name={slide.icon} size={36} color="#FFF" />
          </LinearGradient>
          <Text style={styles.tutoTitle}>{t(slide.titleKey)}</Text>
          <Text style={styles.tutoBody}>{t(slide.bodyKey)}</Text>
        </View>

        {/* Tuto dots */}
        <View style={styles.tutoDotsRow}>
          {TUTO_SLIDES.map((_, i) => (
            <View key={i} style={[styles.tutoDot, tutoIndex === i && { backgroundColor: slide.color, width: 20 }]} />
          ))}
        </View>
      </Animated.View>

      {/* XP Banner — shown when finish is triggered */}
      {showXpBanner && (
        <Animated.View style={[styles.xpBanner, xpBannerStyle]}>
          <LinearGradient colors={['#8A2BE2', '#00BFFF']} style={styles.xpBannerGrad}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFF" />
            <Text style={styles.xpBannerText}>{t('onboarding.xp_bonus')}</Text>
          </LinearGradient>
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.bottomArea}>
        {!showXpBanner && (
          <TouchableOpacity onPress={nextStep} activeOpacity={0.85}>
            <LinearGradient
              colors={isLastSlide ? ['#00FF9D', '#00BFFF'] : ['#8A2BE2', '#00BFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.mainBtn}
            >
              <Text style={styles.mainBtnText}>
                {isLastSlide ? t('onboarding.begin') : t('onboarding.next_upper')}
              </Text>
              <MaterialCommunityIcons
                name={isLastSlide ? 'play' : 'arrow-right'}
                size={20}
                color="#FFF"
              />
            </LinearGradient>
          </TouchableOpacity>
        )}
        {tutoIndex < TUTO_SLIDES.length - 1 && !showXpBanner && (
          <TouchableOpacity onPress={finishOnboarding} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      <View style={styles.dotsRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
        ))}
      </View>

      {/* Confetti — fires on last slide completion */}
      <ConfettiCannon
        ref={confettiRef}
        count={120}
        origin={{ x: SCREEN_W / 2, y: -10 }}
        autoStart={false}
        fadeOut
        colors={['#8A2BE2', '#00BFFF', '#00FF9D', '#FFD700', '#FF6B35']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },

  // Welcome
  welcomeCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  welcomeLogoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  welcomeSub: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Steps
  stepContent: {
    flex: 1,
    paddingTop: SCREEN_H * 0.12,
    paddingHorizontal: 24,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  stepSub: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  // Themes grid
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  themeCard: {
    width: (SCREEN_W - 80) / 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  themeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  themeName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  themeMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  themeMatchCount: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },

  // Tutorial
  tutoIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  tutoTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  tutoBody: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  tutoDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
  },
  tutoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Bottom
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 32,
    alignItems: 'center',
    gap: 12,
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 28,
    gap: 8,
    width: SCREEN_W - 48,
  },
  mainBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },

  // Dots
  dotsRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#8A2BE2',
    width: 20,
  },

  // Theme selection counter
  selectedCounter: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -8,
  },
  selectedCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  selectedCounterText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },

  // XP Banner (shown on finish)
  xpBanner: {
    position: 'absolute',
    top: '40%',
    left: 40,
    right: 40,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 10,
  },
  xpBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  xpBannerText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.3,
  },
});

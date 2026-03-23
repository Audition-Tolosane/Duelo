import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList,
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

  // Animations
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);

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
    } catch {}
    setLoadingTrending(false);
  };

  const finishOnboarding = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      if (uid) {
        authFetch(`${API_URL}/api/auth/onboarding-done`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: uid }),
        }).catch(() => {});
      }
      await AsyncStorage.setItem('duelo_onboarding_done', 'true');
    } catch {}
    router.replace('/(tabs)/play');
  };

  const nextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 2) {
      setStep(step + 1);
    } else if (step === 2) {
      if (tutoIndex < TUTO_SLIDES.length - 1) {
        setTutoIndex(tutoIndex + 1);
      } else {
        finishOnboarding();
      }
    }
  };

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
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

  // -- Step 1: Trending Themes --
  if (step === 1) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A1A', '#1A0A2E', '#0A0A1A']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View entering={FadeIn.duration(500)} style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <LinearGradient colors={['#FF6B35', '#FF8F60']} style={styles.stepIconCircle}>
              <MaterialCommunityIcons name="fire" size={24} color="#FFF" />
            </LinearGradient>
            <Text style={styles.stepTitle}>{t('onboarding.trending_themes')}</Text>
            <Text style={styles.stepSub}>{t('onboarding.trending_sub')}</Text>
          </View>

          {loadingTrending ? (
            <ActivityIndicator size="large" color="#8A2BE2" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.themesGrid}>
              {trending.map((theme, idx) => (
                <Animated.View
                  key={theme.id}
                  entering={FadeInDown.delay(idx * 100).duration(400)}
                >
                  <View style={styles.themeCard}>
                    <View style={[styles.themeIconWrap, { backgroundColor: theme.color_hex + '20' }]}>
                      <CategoryIcon themeId={theme.id} size={28} />
                    </View>
                    <Text style={styles.themeName} numberOfLines={1}>{theme.name}</Text>
                    {theme.match_count > 0 && (
                      <View style={styles.themeMatchBadge}>
                        <MaterialCommunityIcons name="sword-cross" size={9} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.themeMatchCount}>{theme.match_count}</Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.bottomArea}>
          <TouchableOpacity onPress={nextStep} activeOpacity={0.85}>
            <LinearGradient
              colors={['#8A2BE2', '#00BFFF']}
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

      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.bottomArea}>
        <TouchableOpacity onPress={nextStep} activeOpacity={0.85}>
          <LinearGradient
            colors={tutoIndex === TUTO_SLIDES.length - 1 ? ['#00FF9D', '#00BFFF'] : ['#8A2BE2', '#00BFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.mainBtn}
          >
            <Text style={styles.mainBtnText}>
              {tutoIndex === TUTO_SLIDES.length - 1 ? t('onboarding.begin') : t('onboarding.next_upper')}
            </Text>
            <MaterialCommunityIcons
              name={tutoIndex === TUTO_SLIDES.length - 1 ? 'play' : 'arrow-right'}
              size={20}
              color="#FFF"
            />
          </LinearGradient>
        </TouchableOpacity>
        {tutoIndex < TUTO_SLIDES.length - 1 && (
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
});

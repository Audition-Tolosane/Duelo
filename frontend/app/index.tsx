import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Easing,
  KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator, Dimensions,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { GLASS } from '../theme/glassTheme';
import { saveToken } from '../utils/api';
import { t } from '../utils/i18n';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const DUELO_LOGO = require('../assets/header/duelo_logo.webp');
const BG_IMAGE = require('../assets/images/fond_duelo.webp');

type AuthMode = 'guest' | 'email';
type EmailMode = 'login' | 'register';

// ─── Particle components ─────────────────────────────────────────────────────
// Règles perf : useNativeDriver=true sur tout, pas de shadow sur les views
// animées, renderToHardwareTextureAndroid pour composer sur le GPU.

/** Orbe flottant — léger, pas de shadow */
function FloatingOrb({ size, color, x, y, durY, durX, delay }: {
  size: number; color: string; x: number; y: number;
  durY: number; durX: number; delay: number;
}) {
  const posY = useRef(new Animated.Value(0)).current;
  const posX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 1000, delay, useNativeDriver: true }).start();

    Animated.loop(Animated.sequence([
      Animated.timing(posY, { toValue: -18, duration: durY, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(posY, { toValue: 10, duration: durY * 0.9, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(posX, { toValue: 10, duration: durX, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(posX, { toValue: -10, duration: durX, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={{
        position: 'absolute', left: x, top: y,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity,
        transform: [{ translateY: posY }, { translateX: posX }],
      }}
    />
  );
}

/** Petite étoile qui clignote */
function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dur = 900 + (delay % 7) * 180;
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, { toValue: 1, duration: dur * 0.4, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: dur * 0.4, useNativeDriver: true }),
      Animated.delay(dur * 0.2),
    ])).start();
  }, []);

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={{
        position: 'absolute', left: x, top: y,
        width: 2.5, height: 2.5, borderRadius: 1.25,
        backgroundColor: 'rgba(255,255,255,0.9)', opacity,
      }}
    />
  );
}

/** Étoile filante diagonale */
function ShootingStar({ x, y, delay, interval }: {
  x: number; y: number; delay: number; interval: number;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const SHOOT = 500;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(tx, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(tx, { toValue: 1, duration: SHOOT, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.85, duration: 60, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: SHOOT - 60, useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(interval - delay - SHOOT),
    ])).start();
  }, []);

  const translateX = tx.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });
  const translateY = tx.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={{
        position: 'absolute', left: x, top: y,
        width: 80, height: 1.5, borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.8)',
        opacity, transform: [{ translateX }, { translateY }, { rotate: '-20deg' }],
      }}
    />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<AuthMode>('guest');
  const [emailMode, setEmailMode] = useState<EmailMode>('login');
  const [pseudo, setPseudo] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailPseudo, setEmailPseudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(50)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;

  // Logo — démarre à 0.85 (évite le premier frame à 0 qui cause une saccade)
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [_googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: makeRedirectUri({ scheme: 'duelo' }),
  });

  useEffect(() => {
    checkExistingUser();

    // Logo : scale 0.85 → 1, smooth deceleration
    Animated.timing(logoScale, {
      toValue: 1, duration: 650,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Logo float — démarre avec un léger délai pour ne pas cumuler avec l'entrée
    const floatTimer = setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(logoFloat, { toValue: -8, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 8, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();
    }, 700);

    // Halo ring
    Animated.timing(ringOpacity, { toValue: 0.5, duration: 1000, delay: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.timing(ringRotate, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Form — léger délai pour ne pas tout charger en même temps
    const formTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(taglineFade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(formFade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(formSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }, 200);

    return () => { clearTimeout(floatTimer); clearTimeout(formTimer); };
  }, []);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.authentication?.idToken;
      if (idToken) handleSocialAuth('google', idToken);
    }
  }, [googleResponse]);

  const checkExistingUser = async () => {
    try {
      const [userId, onboardingDone] = await AsyncStorage.multiGet(['duelo_user_id', 'duelo_onboarding_done']);
      if (userId[1]) {
        router.replace(onboardingDone[1] ? '/(tabs)/play' : '/onboarding');
        return;
      }
    } catch {}
    setInitialLoading(false);
  };

  useEffect(() => {
    if (authMode !== 'guest') return;
    if (pseudo.length >= 3) {
      if (checkTimeout.current) clearTimeout(checkTimeout.current);
      checkTimeout.current = setTimeout(() => checkPseudo(pseudo), 500);
    } else {
      setAvailable(null);
    }
    return () => { if (checkTimeout.current) clearTimeout(checkTimeout.current); };
  }, [pseudo, authMode]);

  const checkPseudo = async (name: string) => {
    setChecking(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/check-pseudo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: name }),
      });
      const data = await res.json();
      setAvailable(data.available);
      setError('');
    } catch {
      setAvailable(null);
      setError(t('welcome.connection_error'));
    }
    setChecking(false);
  };

  const saveUserData = async (data: any) => {
    if (data.token) await saveToken(data.token);
    await AsyncStorage.setItem('duelo_user_id', data.id);
    await AsyncStorage.setItem('duelo_pseudo', data.pseudo);
    await AsyncStorage.setItem('duelo_avatar_seed', data.avatar_seed);
    if (data.avatar_url) await AsyncStorage.setItem('duelo_avatar_url', data.avatar_url);
  };

  const handleGuestLogin = async () => {
    if (pseudo.length < 3) { setError(t('welcome.min_chars')); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/register-guest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || t('welcome.server_error')); setLoading(false); return; }
      await saveUserData(data);
      router.replace('/onboarding');
    } catch {
      setError(t('welcome.network_error'));
    }
    setLoading(false);
  };

  const handleEmailAuth = async () => {
    setError('');
    const emailTrimmed = email.trim();
    if (!emailTrimmed.includes('@')) { setError(t('welcome.invalid_email')); return; }
    if (password.length < 8) { setError(t('welcome.password_min')); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      let url: string;
      let body: object;
      if (emailMode === 'login') {
        url = `${API_URL}/api/auth/login`;
        body = { email: emailTrimmed, password };
      } else {
        if (emailPseudo.length > 0 && emailPseudo.length < 3) {
          setError(t('welcome.min_chars')); setLoading(false); return;
        }
        url = `${API_URL}/api/auth/register`;
        body = { email: emailTrimmed, password, pseudo: emailPseudo.trim() || emailTrimmed.split('@')[0] };
      }
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || t('welcome.server_error')); setLoading(false); return; }
      await saveUserData(data);
      router.replace(data.onboarding_done ? '/(tabs)/play' : '/onboarding');
    } catch {
      setError(t('welcome.network_error'));
    }
    setLoading(false);
  };

  const handleSocialAuth = async (provider: 'google' | 'apple', token: string, extra?: { email?: string; full_name?: string }) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/social`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, token, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || t('welcome.server_error')); setLoading(false); return; }
      await saveUserData(data);
      router.replace(data.onboarding_done ? '/(tabs)/play' : '/onboarding');
    } catch {
      setError(t('welcome.network_error'));
    }
    setLoading(false);
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) { setError(t('welcome.server_error')); return; }
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean).join(' ') || undefined;
      await handleSocialAuth('apple', credential.identityToken, {
        email: credential.email || undefined,
        full_name: fullName,
      });
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') setError(t('welcome.server_error'));
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google Sign In non configuré'); return; }
    await googlePromptAsync();
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
      </View>
    );
  }

  const bgTranslateY = scrollY.interpolate({ inputRange: [-100, 0, 300], outputRange: [30, 0, -90], extrapolate: 'clamp' });
  const logoOpacity = scrollY.interpolate({ inputRange: [0, 200], outputRange: [1, 0.15], extrapolate: 'clamp' });
  const ringRotation = ringRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.root}>
      {/* Parallax background */}
      <Animated.View style={[styles.bgLayer, { transform: [{ translateY: bgTranslateY }] }]}>
        <Image source={BG_IMAGE} style={styles.bgImage} resizeMode="cover" />
        <View style={styles.bgOverlay} />
      </Animated.View>

      {/* Particules — toutes avec renderToHardwareTextureAndroid, pas de shadow */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Orbes flottants */}
        <FloatingOrb size={7}  color="rgba(0,220,255,0.55)"   x={SCREEN_W*0.12} y={SCREEN_H*0.10} durY={3100} durX={3800} delay={0} />
        <FloatingOrb size={5}  color="rgba(138,43,226,0.65)"  x={SCREEN_W*0.80} y={SCREEN_H*0.08} durY={2700} durX={3200} delay={200} />
        <FloatingOrb size={9}  color="rgba(0,200,255,0.35)"   x={SCREEN_W*0.62} y={SCREEN_H*0.22} durY={3600} durX={4100} delay={400} />
        <FloatingOrb size={5}  color="rgba(255,255,255,0.28)" x={SCREEN_W*0.28} y={SCREEN_H*0.33} durY={2900} durX={3500} delay={600} />
        <FloatingOrb size={4}  color="rgba(138,43,226,0.45)"  x={SCREEN_W*0.88} y={SCREEN_H*0.52} durY={3300} durX={3900} delay={350} />
        <FloatingOrb size={6}  color="rgba(0,220,255,0.3)"    x={SCREEN_W*0.04} y={SCREEN_H*0.68} durY={3000} durX={3700} delay={550} />
        <FloatingOrb size={4}  color="rgba(255,255,255,0.22)" x={SCREEN_W*0.48} y={SCREEN_H*0.85} durY={3400} durX={4000} delay={150} />

        {/* Sparkles — 8 max */}
        <Sparkle x={SCREEN_W*0.07}  y={SCREEN_H*0.17} delay={0} />
        <Sparkle x={SCREEN_W*0.91}  y={SCREEN_H*0.14} delay={400} />
        <Sparkle x={SCREEN_W*0.33}  y={SCREEN_H*0.05} delay={700} />
        <Sparkle x={SCREEN_W*0.70}  y={SCREEN_H*0.30} delay={200} />
        <Sparkle x={SCREEN_W*0.16}  y={SCREEN_H*0.55} delay={900} />
        <Sparkle x={SCREEN_W*0.85}  y={SCREEN_H*0.63} delay={550} />
        <Sparkle x={SCREEN_W*0.53}  y={SCREEN_H*0.79} delay={1100} />
        <Sparkle x={SCREEN_W*0.75}  y={SCREEN_H*0.88} delay={300} />

        {/* Étoiles filantes — 2 */}
        <ShootingStar x={SCREEN_W*0.05} y={SCREEN_H*0.09} delay={1000} interval={6500} />
        <ShootingStar x={SCREEN_W*0.50} y={SCREEN_H*0.04} delay={3800} interval={8000} />
      </View>

      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
            scrollEventThrottle={16}
          >
            <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={styles.inner}>

              {/* Logo */}
              <Animated.View
                renderToHardwareTextureAndroid
                style={[styles.logoContainer, {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }, { translateY: logoFloat }],
                }]}
              >
                <Animated.View style={[styles.logoRing, { opacity: ringOpacity, transform: [{ rotate: ringRotation }] }]} />
                <Image source={DUELO_LOGO} style={styles.logoImage} resizeMode="contain" />
              </Animated.View>

              {/* Tagline */}
              <Animated.View style={[styles.taglinePill, { opacity: taglineFade }]}>
                <Text style={styles.taglineText}>{t('welcome.tagline')}</Text>
              </Animated.View>

              {/* Main card */}
              <Animated.View style={[styles.formContainer, { opacity: formFade, transform: [{ translateY: formSlide }] }]}>
                <View style={styles.glassCard}>

                  {/* Tabs */}
                  <View style={styles.tabs}>
                    <TouchableOpacity style={[styles.tab, authMode === 'guest' && styles.tabActive]} onPress={() => { setAuthMode('guest'); setError(''); }}>
                      <Text style={[styles.tabText, authMode === 'guest' && styles.tabTextActive]}>{t('welcome.tab_guest')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, authMode === 'email' && styles.tabActive]} onPress={() => { setAuthMode('email'); setError(''); }}>
                      <Text style={[styles.tabText, authMode === 'email' && styles.tabTextActive]}>{t('welcome.tab_email')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Guest form */}
                  {authMode === 'guest' && (
                    <>
                      <Text style={styles.formTitle}>{t('welcome.choose_pseudo')}</Text>
                      <Text style={styles.formHint}>{t('welcome.pseudo_hint')}</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={[styles.input, available === true && styles.inputValid, available === false && styles.inputError]}
                          placeholder={t('welcome.pseudo_placeholder')}
                          placeholderTextColor="#525252"
                          value={pseudo}
                          onChangeText={setPseudo}
                          autoCapitalize="none"
                          maxLength={20}
                          autoCorrect={false}
                        />
                        {checking && <ActivityIndicator style={styles.inputIcon} size="small" color="#8A2BE2" />}
                        {!checking && available === true && <Text style={[styles.inputIcon, styles.checkMark]}>✓</Text>}
                        {!checking && available === false && <Text style={[styles.inputIcon, styles.crossMark]}>✗</Text>}
                      </View>
                      {available === false && <Text style={styles.errorText}>{t('welcome.pseudo_taken')}</Text>}
                      {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      <TouchableOpacity
                        style={[styles.mainButton, (!available || loading) && styles.mainButtonDisabled]}
                        onPress={handleGuestLogin}
                        disabled={!available || loading}
                        activeOpacity={0.8}
                      >
                        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.mainButtonText}>{t('welcome.play_guest')}</Text>}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Email form */}
                  {authMode === 'email' && (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder={t('welcome.email_placeholder')}
                        placeholderTextColor="#525252"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <View style={{ height: 10 }} />
                      <TextInput
                        style={styles.input}
                        placeholder={t('welcome.password_placeholder')}
                        placeholderTextColor="#525252"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                      {emailMode === 'register' && (
                        <>
                          <View style={{ height: 10 }} />
                          <TextInput
                            style={styles.input}
                            placeholder={t('welcome.choose_pseudo_optional')}
                            placeholderTextColor="#525252"
                            value={emailPseudo}
                            onChangeText={setEmailPseudo}
                            autoCapitalize="none"
                            maxLength={20}
                            autoCorrect={false}
                          />
                        </>
                      )}
                      {error ? <Text style={[styles.errorText, { marginTop: 8 }]}>{error}</Text> : null}
                      <TouchableOpacity
                        style={[styles.mainButton, loading && styles.mainButtonDisabled, { marginTop: 16 }]}
                        onPress={handleEmailAuth}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        {loading
                          ? <ActivityIndicator color="#FFF" />
                          : <Text style={styles.mainButtonText}>{emailMode === 'login' ? t('welcome.login_btn') : t('welcome.register_btn')}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEmailMode(emailMode === 'login' ? 'register' : 'login'); setError(''); }} style={{ marginTop: 14 }}>
                        <Text style={styles.switchText}>
                          {emailMode === 'login' ? t('welcome.switch_to_register') : t('welcome.switch_to_login')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Social */}
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>{t('welcome.or_social')}</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Google */}
                  <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} activeOpacity={0.85}>
                    <View style={styles.googleIconBox}>
                      <Svg width={18} height={18} viewBox="0 0 24 24">
                        <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </Svg>
                    </View>
                    <Text style={styles.googleText}>{t('welcome.continue_google')}</Text>
                  </TouchableOpacity>

                  {/* Apple — bouton officiel (langue = langue du système iOS) */}
                  {Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync && (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={GLASS.radiusSm}
                      style={styles.appleNativeButton}
                      onPress={handleAppleSignIn}
                    />
                  )}

                </View>
              </Animated.View>

              <View style={{ height: 80 }} />
            </TouchableOpacity>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050510' },
  loadingContainer: { flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' },

  bgLayer: { ...StyleSheet.absoluteFillObject, top: -40, bottom: -40 },
  bgImage: { width: '100%' as any, height: '100%' as any },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,10,0.2)' },

  container: { flex: 1, backgroundColor: 'transparent' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 24 },

  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 24, height: 100 },
  logoRing: {
    position: 'absolute',
    width: 268, height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.45)',
  },
  logoImage: { width: 220, height: 56, zIndex: 1 },

  taglinePill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.35)',
    marginBottom: 32,
    ...Platform.select({
      web: { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any,
      default: {},
    }),
  },
  taglineText: {
    color: '#FFF', fontSize: 13, fontWeight: '600', textAlign: 'center',
    lineHeight: 20, letterSpacing: 0.3,
  },

  formContainer: { marginBottom: 32 },
  glassCard: {
    backgroundColor: GLASS.bg,
    borderRadius: GLASS.radius,
    padding: 24,
    borderWidth: 1,
    borderColor: GLASS.borderCyan,
    ...Platform.select({
      web: { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any,
      default: {},
    }),
  },

  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#8A2BE2' },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#FFF' },

  formTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  formHint: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 },

  inputWrapper: { position: 'relative', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: GLASS.radiusSm,
    padding: 16, fontSize: 16, color: '#FFF',
    borderWidth: 1, borderColor: GLASS.borderSubtle,
  },
  inputValid: { borderColor: '#00FF9D' },
  inputError: { borderColor: '#FF3B30' },
  inputIcon: { position: 'absolute', right: 16, top: 16 },
  checkMark: { color: '#00FF9D', fontSize: 20, fontWeight: '700' },
  crossMark: { color: '#FF3B30', fontSize: 20, fontWeight: '700' },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 4, marginLeft: 4 },

  mainButton: {
    backgroundColor: '#8A2BE2', borderRadius: GLASS.radiusSm,
    padding: 18, alignItems: 'center', marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.3)',
    shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  mainButtonDisabled: { opacity: 0.4 },
  mainButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 2 },

  switchText: { color: 'rgba(0,255,255,0.8)', fontSize: 13, textAlign: 'center', fontWeight: '500' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginHorizontal: 12 },

  // Google button — fond blanc, "G" coloré
  googleButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: GLASS.radiusSm,
    paddingVertical: 13, paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1, borderColor: '#dadce0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 3, elevation: 2,
  },
  googleIconBox: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1, borderColor: '#e8e8e8',
  },
  googleG: {
    fontSize: 17, fontWeight: '700',
    color: '#4285F4',          // bleu Google
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  googleText: {
    flex: 1, textAlign: 'center',
    fontSize: 15, fontWeight: '600', color: '#3c4043',
    marginRight: 28,           // compense l'icône pour centrer le texte
  },

  appleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: GLASS.radiusSm,
    height: 50,
    marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  appleNativeButton: {
    width: '100%',
    height: 50,
    marginBottom: 10,
  },
});

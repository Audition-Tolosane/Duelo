import React, { useState, useEffect, useRef } from 'react';
import {
  View, TextInput, Pressable, ScrollView, StyleSheet, Animated, Easing,
  KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator,
} from 'react-native';
import { Wordmark, Txt, Icon, Button, Chip, ScreenContainer, Loader } from '../components/ui';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { COLOR, SPACE, RADII, SIZE, BORDER, TYPO } from '../theme/tokens';
import { saveToken } from '../utils/api';
import { t } from '../utils/i18n';

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

type AuthMode = 'guest' | 'email';
type EmailMode = 'login' | 'register';

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

  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(24)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;

  // Logo — démarre à 0.85 (évite le premier frame à 0 qui cause une saccade)
  const logoScale = useRef(new Animated.Value(0.85)).current;

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

    // Form — léger délai pour ne pas tout charger en même temps
    const formTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(taglineFade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(formFade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(formSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }, 200);

    return () => {
      clearTimeout(formTimer);
    };
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
    } catch (e) { console.error(e); }
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) { setError(t('welcome.invalid_email_format')); return; }
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
    if (!GOOGLE_CLIENT_ID) { setError(t('welcome.google_not_configured')); return; }
    await googlePromptAsync();
  };

  if (initialLoading) {
    return (
      <ScreenContainer>
        <Loader fill />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.inner}>

              {/* Logotype SKILKI (renommage visuel ; logo définitif à venir) */}
              <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
                <Wordmark size="lg" />
              </Animated.View>

              <Animated.View style={{ opacity: taglineFade }}>
                <Txt variant="body" color={COLOR.text.secondary} align="center" style={styles.tagline}>{t('welcome.tagline')}</Txt>
              </Animated.View>

              <Animated.View style={[styles.form, { opacity: formFade, transform: [{ translateY: formSlide }] }]}>

                {/* Invité / E-mail : sélection jaune */}
                <View style={styles.tabs}>
                  <Chip
                    label={t('welcome.tab_guest')}
                    selected={authMode === 'guest'}
                    onPress={() => { setAuthMode('guest'); setError(''); }}
                    style={styles.tab}
                  />
                  <Chip
                    label={t('welcome.tab_email')}
                    selected={authMode === 'email'}
                    onPress={() => { setAuthMode('email'); setError(''); }}
                    style={styles.tab}
                  />
                </View>

                {/* Guest form */}
                {authMode === 'guest' && (
                  <>
                    <View style={styles.titles}>
                      <Txt variant="h2">{t('welcome.choose_pseudo')}</Txt>
                      <Txt variant="bodySmall">{t('welcome.pseudo_hint')}</Txt>
                    </View>
                    <View>
                      <TextInput
                        style={[styles.input, styles.inputWithIcon, available === true && styles.inputValid, available === false && styles.inputError]}
                        placeholder={t('welcome.pseudo_placeholder')}
                        placeholderTextColor={COLOR.text.tertiary}
                        selectionColor={COLOR.action.primary}
                        maxFontSizeMultiplier={1.3}
                        value={pseudo}
                        onChangeText={setPseudo}
                        autoCapitalize="none"
                        maxLength={20}
                        autoCorrect={false}
                      />
                      <View style={styles.inputIcon} pointerEvents="none">
                        {checking && <ActivityIndicator size="small" color={COLOR.text.secondary} />}
                        {!checking && available === true && <Icon name="success" size={20} color={COLOR.status.success} />}
                        {!checking && available === false && <Icon name="error" size={20} color={COLOR.status.errorText} />}
                      </View>
                    </View>
                    {available === false && <Txt variant="caption" color={COLOR.status.errorText}>{t('welcome.pseudo_taken')}</Txt>}
                    {error ? <Txt variant="caption" color={COLOR.status.errorText}>{error}</Txt> : null}
                    <Button
                      label={t('welcome.play_guest')}
                      onPress={handleGuestLogin}
                      disabled={!available || loading}
                      loading={loading}
                      fullWidth
                      style={styles.cta}
                    />
                  </>
                )}

                {/* Email form */}
                {authMode === 'email' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder={t('welcome.email_placeholder')}
                      placeholderTextColor={COLOR.text.tertiary}
                      selectionColor={COLOR.action.primary}
                      maxFontSizeMultiplier={1.3}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('welcome.password_placeholder')}
                      placeholderTextColor={COLOR.text.tertiary}
                      selectionColor={COLOR.action.primary}
                      maxFontSizeMultiplier={1.3}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    {emailMode === 'register' && (
                      <TextInput
                        style={styles.input}
                        placeholder={t('welcome.choose_pseudo_optional')}
                        placeholderTextColor={COLOR.text.tertiary}
                        selectionColor={COLOR.action.primary}
                        maxFontSizeMultiplier={1.3}
                        value={emailPseudo}
                        onChangeText={setEmailPseudo}
                        autoCapitalize="none"
                        maxLength={20}
                        autoCorrect={false}
                      />
                    )}
                    {error ? <Txt variant="caption" color={COLOR.status.errorText}>{error}</Txt> : null}
                    <Button
                      label={emailMode === 'login' ? t('welcome.login_btn') : t('welcome.register_btn')}
                      onPress={handleEmailAuth}
                      disabled={loading}
                      loading={loading}
                      fullWidth
                      style={styles.cta}
                    />
                    <Pressable
                      onPress={() => { setEmailMode(emailMode === 'login' ? 'register' : 'login'); setError(''); }}
                      accessibilityRole="button"
                      style={styles.switchLink}
                    >
                      <Txt variant="label" color={COLOR.action.primary} align="center">
                        {emailMode === 'login' ? t('welcome.switch_to_register') : t('welcome.switch_to_login')}
                      </Txt>
                    </Pressable>
                  </>
                )}

                {/* Social */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Txt variant="overline">{t('welcome.or_social')}</Txt>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google — gabarit du bouton « ghost » du kit (Button n'accepte que les icônes Lucide,
                    or Google impose son logo de marque : seules couleurs hors palette, logo tiers) */}
                <Pressable
                  onPress={handleGoogleSignIn}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </Svg>
                  <Txt variant="button" color={COLOR.text.primary} numberOfLines={1} style={styles.googleText}>{t('welcome.continue_google')}</Txt>
                </Pressable>

                {/* Apple — bouton officiel (langue = langue du système iOS) ; version blanche sur fond nuit */}
                {Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={RADII.md}
                    style={styles.appleNativeButton}
                    onPress={handleAppleSignIn}
                  />
                )}

              </Animated.View>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: SPACE.xxxl },
  inner: { paddingHorizontal: SPACE.xxl, width: '100%', maxWidth: 440, alignSelf: 'center' },

  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg },
  tagline: { marginBottom: SPACE.xxxl },

  // Formulaire posé sur le fond nuit (pas de carte : les erreurs restent lisibles, 5,4:1)
  form: { gap: SPACE.md },
  tabs: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.sm },
  tab: { flex: 1, justifyContent: 'center' },
  // Même pas que le reste du formulaire (gap 12) : pas de marge en plus
  titles: { gap: SPACE.xs },

  input: {
    height: SIZE.input,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.input,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    paddingHorizontal: SPACE.lg,
    ...TYPO.body,
    color: COLOR.text.primary,
  },
  inputWithIcon: { paddingRight: SPACE.huge + SPACE.sm },
  inputValid: { borderColor: COLOR.status.success },
  inputError: { borderColor: COLOR.status.error },
  inputIcon: { position: 'absolute', right: SPACE.lg, top: 0, bottom: 0, justifyContent: 'center' },

  cta: { marginTop: SPACE.sm },
  switchLink: { minHeight: SIZE.touch, alignItems: 'center', justifyContent: 'center' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: SPACE.sm },
  dividerLine: { flex: 1, height: BORDER.hair, backgroundColor: COLOR.border.subtle },

  googleButton: {
    height: SIZE.button,
    borderRadius: RADII.md,
    backgroundColor: COLOR.action.ghost,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.xl,
  },
  googleText: { flexShrink: 1 },
  pressed: { transform: [{ scale: 0.98 }] },

  appleNativeButton: {
    width: '100%',
    height: SIZE.button,
  },
});

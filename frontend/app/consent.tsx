import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, ScrollView, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { authFetch, clearToken } from '../utils/api';
import { dueloWS } from '../services/websocket';
import { t } from '../utils/i18n';
import { Txt, Icon, Button, Dialog, ScreenContainer } from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, SIZE, TYPO } from '../theme/tokens';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ── Consentement + âge, une fois par compte ───────────────────────────────────
// Affiché après la connexion tant que le compte n'a pas accepté les CGU et la
// politique de confidentialité (comptes existants compris). Année de naissance :
// moins de 13 ans → compte refusé et supprimé ; moins de 15 → pubs non personnalisées.

export default function ConsentScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [year, setYear] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tooYoung, setTooYoung] = useState(false);

  const nowYear = new Date().getFullYear();
  const yearNum = Number(year);
  const yearValid = year.length === 4 && yearNum >= nowYear - 110 && yearNum <= nowYear;

  const submit = async () => {
    Keyboard.dismiss();
    if (!yearValid) { setError(t('consent.invalid_year')); return; }
    setLoading(true); setError('');
    try {
      const res = await authFetch(`${API_URL}/api/auth/consent`, {
        method: 'POST',
        body: JSON.stringify({ birth_year: yearNum, accept_terms: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.detail === 'too_young') {
        // Le serveur a supprimé le compte : on repart d'une app vierge.
        dueloWS.disconnect();
        await clearToken();
        await AsyncStorage.clear();
        setTooYoung(true);
        setLoading(false);
        return;
      }
      if (!res.ok) { setError(data.detail || t('welcome.server_error')); setLoading(false); return; }
      await AsyncStorage.multiSet([['duelo_consent', '1'], ['duelo_ads_npa', data.minor ? '1' : '0']]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace((next || '/onboarding') as any);
    } catch {
      setError(t('welcome.network_error'));
      setLoading(false);
    }
  };

  return (
    <ScreenContainer safeTop safeBottom>
      {/* Le clavier remonte l'écran (iOS) au lieu de recouvrir le champ ; glisser le ferme. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.titles}>
          <Txt variant="overline" color={COLOR.action.primary}>{t('consent.eyebrow')}</Txt>
          <Txt variant="h1">{t('consent.title')}</Txt>
        </View>

        <View style={styles.field}>
          <Txt variant="cardTitle">{t('consent.birth_year')}</Txt>
          <TextInput
            style={[styles.input, error && !yearValid ? styles.inputError : null]}
            value={year}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 4);
              setYear(digits);
              setError('');
              // Le pavé numérique iOS n'a pas de touche « Entrée » : l'année complète ferme le clavier.
              if (digits.length === 4) Keyboard.dismiss();
            }}
            placeholder={String(nowYear - 20)}
            placeholderTextColor={COLOR.text.tertiary}
            selectionColor={COLOR.action.primary}
            keyboardType="number-pad"
            maxLength={4}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel={t('consent.birth_year')}
            testID="consent-year"
          />
          <Txt variant="caption">{t('consent.birth_year_hint')}</Txt>
        </View>

        <Pressable
          style={styles.checkRow}
          onPress={() => { Haptics.selectionAsync(); setAccepted((a) => !a); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          testID="consent-accept"
        >
          <View style={[styles.box, accepted && styles.boxOn]}>
            {accepted ? <Icon name="check" size={16} color={COLOR.text.onAction} /> : null}
          </View>
          <Txt variant="body" style={styles.flex}>{t('consent.accept')}</Txt>
        </Pressable>

        <View style={styles.links}>
          <Button label={t('consent.read_terms')} icon="book" variant="ghost" size="sm" haptic={false} onPress={() => router.push('/terms')} />
          <Button label={t('consent.read_privacy')} icon="shield" variant="ghost" size="sm" haptic={false} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)} />
        </View>

        {error ? <Txt variant="bodySmall" color={COLOR.status.errorText}>{error}</Txt> : null}

        <Button
          label={t('consent.continue')}
          onPress={submit}
          loading={loading}
          disabled={!accepted || year.length !== 4}
          fullWidth
          testID="consent-continue"
        />
      </ScrollView>
      </KeyboardAvoidingView>

      <Dialog
        visible={tooYoung}
        onClose={() => router.replace('/')}
        dismissable={false}
        icon="clock"
        title={t('consent.too_young_title')}
        message={t('consent.too_young')}
        actions={<Button label={t('common.ok')} fullWidth onPress={() => router.replace('/')} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.xxl, gap: SPACE.xxl, flexGrow: 1, justifyContent: 'center' },
  titles: { gap: SPACE.sm },
  field: { gap: SPACE.sm },
  input: {
    height: SIZE.input,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.input,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    paddingHorizontal: SPACE.lg,
    ...TYPO.body,
    color: COLOR.text.primary,
    letterSpacing: 2,
  },
  inputError: { borderColor: COLOR.status.error },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 44 },
  box: {
    width: 24, height: 24, borderRadius: RADII.sm,
    borderWidth: 2, borderColor: COLOR.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: COLOR.action.primary, borderColor: COLOR.action.primary },
  flex: { flex: 1 },
  links: { gap: SPACE.xs, alignItems: 'flex-start' },
});

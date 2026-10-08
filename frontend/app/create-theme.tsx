import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import {
  Txt, Icon, IconName, Button, Card, Chip, Loader, ThemeIcon, ScreenContainer, ScreenHeader,
} from '../components/ui';
import { COLOR, SPACE, RADII, SIZE, BORDER, TYPO, ICON_SIZE, PALETTE } from '../theme/tokens';

// Créer un thème : le joueur propose un sujet, le serveur prépare les questions, puis on joue.
// Étapes : formulaire → préparation (15–30 s) → thème prêt.

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Univers réels chargés depuis /api/explore/super-categories (même source que l'onglet Thèmes).
// `color` reste celle de l'univers renvoyée par l'API : elle est transmise telle quelle au serveur.
type Universe = { id: string; label: string; color: string };

// Pictogramme Lucide de chaque univers (même correspondance que l'onglet Social)
const UNIVERSE_ICON: Record<string, IconName> = {
  SCREEN: 'film', SOUND: 'music', ARENA: 'trophy', LEGENDS: 'landmark', LAB: 'flask',
  GLOBE: 'globe', ART: 'palette', LIFE: 'leaf', MIND: 'brain',
};

// Confettis du thème prêt : couleurs de la palette SKILKI
const CONFETTI = [PALETTE.yellow, PALETTE.coral, PALETTE.gold, PALETTE.green, PALETTE.cream];

type Phase = 'form' | 'generating' | 'done';

type Result = {
  theme_id: string;
  name: string;
  question_count: number;
  color_hex: string;
};

export default function CreateThemeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [color, setColor] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('duelo_user_id').then(uid => { if (uid) setUserId(uid); });
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/explore/super-categories`);
        const data = await res.json();
        const list: Universe[] = (Array.isArray(data) ? data : []).map((sc: any) => ({
          id: sc.id, label: sc.label, color: sc.color,
        }));
        setUniverses(list);
        if (list.length > 0) {
          setUniverse(list[0]);
          setColor(list[0].color);
        }
      } catch {}
    })();
  }, []);

  const validate = (): boolean => {
    if (name.trim().length < 2) {
      setError(t('forge.error_short_name'));
      return false;
    }
    if (description.trim().length < 10) {
      setError(t('forge.error_short_desc'));
      return false;
    }
    if (!universe) {
      setError(t('forge.error_generate'));
      return false;
    }
    return true;
  };

  const handleGenerate = async () => {
    setError('');
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('generating');

    try {
      const res = await authFetch(`${API_URL}/api/forge/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          name: name.trim(),
          description: description.trim(),
          super_category: universe!.id,
          color_hex: color,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data.detail || t('forge.error_generate');
        if (res.status === 503) {
          setError(t('forge.unavailable'));
        } else {
          setError(detail);
        }
        setPhase('form');
        return;
      }

      setResult(data);
      setPhase('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(t('forge.error_generate'));
      setPhase('form');
    }
  };

  const handlePlay = () => {
    if (!result) return;
    router.replace(`/category-detail?id=${result.theme_id}`);
  };

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('pilot.create.title')} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {phase === 'form' && (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {/* Intro */}
            <View style={s.intro}>
              <View style={s.iconDisc}><Icon name="forge" size={ICON_SIZE.xl} color={COLOR.text.primary} /></View>
              <Txt variant="h2" align="center">{t('pilot.create.intro_title')}</Txt>
              <Txt variant="body" color={COLOR.text.secondary} align="center">{t('pilot.create.intro_sub')}</Txt>
            </View>

            {/* Nom */}
            <View style={s.field}>
              <Txt variant="overline">{t('forge.name_label')}</Txt>
              <TextInput
                style={s.input}
                placeholder={t('forge.name_placeholder')}
                placeholderTextColor={COLOR.text.tertiary}
                selectionColor={COLOR.action.primary}
                maxFontSizeMultiplier={1.3}
                value={name}
                onChangeText={text => { setName(text); setError(''); }}
                maxLength={100}
              />
            </View>

            {/* Description */}
            <View style={s.field}>
              <Txt variant="overline">{t('forge.desc_label')}</Txt>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder={t('forge.desc_placeholder')}
                placeholderTextColor={COLOR.text.tertiary}
                selectionColor={COLOR.action.primary}
                maxFontSizeMultiplier={1.3}
                value={description}
                onChangeText={text => { setDescription(text); setError(''); }}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>

            {/* Univers (liste réelle depuis l'API) */}
            <View style={s.field}>
              <Txt variant="overline">{t('forge.universe_label')}</Txt>
              {universes.length === 0 ? (
                <Loader />
              ) : (
                <View style={s.chips}>
                  {universes.map(u => (
                    <Chip
                      key={u.id}
                      label={u.label}
                      icon={UNIVERSE_ICON[u.id] ?? 'compass'}
                      selected={universe?.id === u.id}
                      onPress={() => { setUniverse(u); setColor(u.color); }}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Aperçu : l'icône que le thème recevra dans l'app */}
            {name.trim().length >= 2 && universe ? (
              <Card style={s.preview}>
                <ThemeIcon themeName={name.trim()} superCategory={universe.id} size={ICON_SIZE.theme.md} />
                <View style={s.flex}>
                  <Txt variant="overline">{t('pilot.create.preview')}</Txt>
                  <Txt variant="cardTitle" numberOfLines={2}>{name.trim()}</Txt>
                  <Txt variant="caption" numberOfLines={1}>{universe.label}</Txt>
                </View>
              </Card>
            ) : null}

            {/* Erreur */}
            {!!error && (
              <View style={s.errorRow} accessibilityLiveRegion="polite">
                <Icon name="error" size={ICON_SIZE.sm} color={COLOR.status.errorText} />
                <Txt variant="bodySmall" color={COLOR.status.errorText} style={s.flex}>{error}</Txt>
              </View>
            )}

            <Button label={t('pilot.create.cta')} icon="sparkles" size="lg" fullWidth onPress={handleGenerate} haptic={false} />
          </ScrollView>
        )}

        {phase === 'generating' && (
          <View style={s.center}>
            <View style={s.iconDisc}><Icon name="forge" size={ICON_SIZE.xl} color={COLOR.text.primary} /></View>
            <Loader />
            <Txt variant="h2" align="center">{t('pilot.create.generating')}</Txt>
            <Txt variant="cardTitle" align="center" numberOfLines={2}>« {name} »</Txt>
            <Txt variant="body" color={COLOR.text.secondary} align="center">{t('pilot.create.generating_detail')}</Txt>
          </View>
        )}

        {phase === 'done' && result && (
          <View style={s.center}>
            <ConfettiCannon
              count={80}
              origin={{ x: width / 2, y: -10 }}
              autoStart
              fadeOut
              explosionSpeed={350}
              fallSpeed={2800}
              colors={CONFETTI}
            />
            <Card style={s.doneCard}>
              <ThemeIcon themeId={result.theme_id} themeName={result.name} superCategory={universe?.id} size={ICON_SIZE.theme.lg} />
              <View style={s.doneTexts}>
                <View style={s.successRow}>
                  <Icon name="success" size={ICON_SIZE.md} color={COLOR.status.success} />
                  <Txt variant="label" color={COLOR.status.success}>{t('forge.success')}</Txt>
                </View>
                <Txt variant="h2" align="center" numberOfLines={2}>{result.name}</Txt>
                <Txt variant="body" color={COLOR.text.secondary} align="center">
                  {t('pilot.create.questions_ready', { count: String(result.question_count) })}
                </Txt>
              </View>
              <Button label={t('forge.play_now')} icon="duel" size="lg" fullWidth onPress={handlePlay} />
            </Card>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.lg, paddingBottom: SPACE.huge, gap: SPACE.xl },

  intro: { alignItems: 'center', gap: SPACE.sm },
  iconDisc: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLOR.surface.card,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.xs,
  },

  field: { gap: SPACE.sm },
  input: {
    minHeight: SIZE.input,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.input,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    ...TYPO.body,
    color: COLOR.text.primary,
  },
  inputMulti: { height: 112, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },

  preview: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },

  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACE.xxl, gap: SPACE.md,
  },
  doneCard: { alignSelf: 'stretch', alignItems: 'center', gap: SPACE.xl, padding: SPACE.xxl },
  doneTexts: { alignItems: 'center', gap: SPACE.sm },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});

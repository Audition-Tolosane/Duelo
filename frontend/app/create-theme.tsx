import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Animated, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GLASS } from '../theme/glassTheme';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import DueloHeader from '../components/DueloHeader';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const UNIVERSES = [
  { id: 'SCREEN', label: 'Screen', icon: '🎬', color: '#8A2BE2' },
  { id: 'SOUND',  label: 'Sound',  icon: '🎵', color: '#FF6B35' },
  { id: 'ARENA',  label: 'Arena',  icon: '⚽', color: '#00FF9D' },
  { id: 'LEGENDS',label: 'Legends',icon: '🏛️', color: '#FFD700' },
  { id: 'LAB',    label: 'Lab',    icon: '🔬', color: '#1565C0' },
  { id: 'TASTE',  label: 'Taste',  icon: '🍽️', color: '#FF69B4' },
  { id: 'GLOBE',  label: 'Globe',  icon: '🌍', color: '#4ECDC4' },
  { id: 'PIXEL',  label: 'Pixel',  icon: '🎮', color: '#FF3B5C' },
  { id: 'STYLE',  label: 'Style',  icon: '✨', color: '#E040FB' },
  { id: 'ART',    label: 'Art',    icon: '🎨', color: '#E53935' },
  { id: 'LIFE',   label: 'Life',   icon: '🌱', color: '#2E7D32' },
  { id: 'MIND',   label: 'Mind',   icon: '🧠', color: '#FFAB40' },
];

const PRESET_COLORS = [
  '#8A2BE2', '#FF6B35', '#00FF9D', '#FFD700',
  '#FF3B5C', '#00BFFF', '#FF69B4', '#4ECDC4',
  '#E040FB', '#FFAB40', '#2E7D32', '#E53935',
];

type Phase = 'form' | 'generating' | 'done';

type Result = {
  theme_id: string;
  name: string;
  question_count: number;
  color_hex: string;
};

export default function CreateThemeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [universe, setUniverse] = useState(UNIVERSES[0]);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [phase, setPhase] = useState<Phase>('form');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('duelo_user_id').then(uid => { if (uid) setUserId(uid); });
  }, []);

  useEffect(() => {
    if (phase === 'generating') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
    if (phase === 'done') {
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [phase]);

  const validate = (): boolean => {
    if (name.trim().length < 2) {
      setError(t('forge.error_short_name'));
      return false;
    }
    if (description.trim().length < 10) {
      setError(t('forge.error_short_desc'));
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
          super_category: universe.id,
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DueloHeader title={t('forge.title')} />

        {phase === 'form' && (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header card */}
            <LinearGradient
              colors={['rgba(138,43,226,0.15)', 'rgba(138,43,226,0.05)']}
              style={styles.headerCard}
            >
              <View style={styles.headerIconWrap}>
                <MaterialCommunityIcons name="hammer-wrench" size={28} color="#8A2BE2" />
              </View>
              <Text style={styles.headerTitle}>{t('forge.title')}</Text>
              <Text style={styles.headerSub}>{t('forge.subtitle')}</Text>
            </LinearGradient>

            {/* Name */}
            <Text style={styles.label}>{t('forge.name_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('forge.name_placeholder')}
              placeholderTextColor="#555"
              value={name}
              onChangeText={text => { setName(text); setError(''); }}
              maxLength={100}
            />

            {/* Description */}
            <Text style={styles.label}>{t('forge.desc_label')}</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder={t('forge.desc_placeholder')}
              placeholderTextColor="#555"
              value={description}
              onChangeText={text => { setDescription(text); setError(''); }}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            {/* Universe */}
            <Text style={styles.label}>{t('forge.universe_label')}</Text>
            <View style={styles.universesGrid}>
              {UNIVERSES.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={[
                    styles.universeChip,
                    universe.id === u.id && { borderColor: u.color, backgroundColor: u.color + '18' },
                  ]}
                  onPress={() => { setUniverse(u); setColor(u.color); Haptics.selectionAsync(); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.universeIcon}>{u.icon}</Text>
                  <Text style={[styles.universeLabel, universe.id === u.id && { color: u.color }]}>
                    {u.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color */}
            <Text style={styles.label}>{t('forge.color_label')}</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                  onPress={() => { setColor(c); Haptics.selectionAsync(); }}
                  activeOpacity={0.8}
                />
              ))}
            </View>

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Generate button */}
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.85}>
              <LinearGradient
                colors={[color, color + 'BB']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.generateGradient}
              >
                <MaterialCommunityIcons name="creation" size={20} color="#FFF" />
                <Text style={styles.generateText}>{t('forge.generate_btn')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {phase === 'generating' && (
          <View style={styles.generatingWrap}>
            <Animated.View style={[styles.forgeIconBig, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={['#8A2BE2', '#6A1FB0']} style={styles.forgeIconGrad}>
                <MaterialCommunityIcons name="hammer-wrench" size={42} color="#FFF" />
              </LinearGradient>
            </Animated.View>
            <ActivityIndicator size="large" color="#8A2BE2" style={{ marginBottom: 20 }} />
            <Text style={styles.generatingTitle}>{t('forge.generating')}</Text>
            <Text style={styles.generatingName}>"{name}"</Text>
            <Text style={styles.generatingDetail}>{t('forge.generating_detail')}</Text>
          </View>
        )}

        {phase === 'done' && result && (
          <Animated.View style={[styles.doneWrap, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={[result.color_hex + '30', result.color_hex + '08']}
              style={styles.doneCard}
            >
              <View style={[styles.doneIconWrap, { backgroundColor: result.color_hex }]}>
                <MaterialCommunityIcons name="check-bold" size={36} color="#FFF" />
              </View>
              <Text style={styles.doneTitle}>{t('forge.success')}</Text>
              <Text style={styles.doneName}>"{result.name}"</Text>
              <Text style={[styles.doneCount, { color: result.color_hex }]}>
                {t('forge.questions_count', { count: String(result.question_count) })}
              </Text>

              <TouchableOpacity style={styles.playBtn} onPress={handlePlay} activeOpacity={0.85}>
                <LinearGradient
                  colors={[result.color_hex, result.color_hex + 'BB']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.playGradient}
                >
                  <MaterialCommunityIcons name="sword-cross" size={20} color="#FFF" />
                  <Text style={styles.playText}>{t('forge.play_now')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060611',
  },
  scroll: {
    padding: 20,
    paddingTop: 12,
  },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.2)',
  },
  headerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(138,43,226,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSub: {
    color: '#A3A3A3',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  label: {
    color: '#A3A3A3',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    ...GLASS,
    color: '#FFF',
    fontSize: 15,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputMulti: {
    height: 100,
    textAlignVertical: 'top',
  },
  universesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  universeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  universeIcon: {
    fontSize: 14,
  },
  universeLabel: {
    color: '#A3A3A3',
    fontSize: 12,
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#FFF',
    transform: [{ scale: 1.2 }],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    flex: 1,
  },
  generateBtn: {
    marginTop: 28,
    borderRadius: 16,
    overflow: 'hidden',
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  generateText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Generating
  generatingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  forgeIconBig: {
    marginBottom: 32,
  },
  forgeIconGrad: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  generatingTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  generatingName: {
    color: '#8A2BE2',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  generatingDetail: {
    color: '#525252',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Done
  doneWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  doneCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  doneIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  doneTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  doneName: {
    color: '#A3A3A3',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  doneCount: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 32,
  },
  playBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  playGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  playText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

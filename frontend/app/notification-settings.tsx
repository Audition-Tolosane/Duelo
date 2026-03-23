import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Switch,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface NotificationSettingsData {
  challenges: boolean;
  match_results: boolean;
  follows: boolean;
  messages: boolean;
  likes: boolean;
  comments: boolean;
  system: boolean;
}

const SETTINGS_CONFIG: {
  key: keyof NotificationSettingsData;
  icon: string;
  colors: [string, string];
  titleKey: string;
  descKey: string;
}[] = [
  {
    key: 'challenges',
    icon: 'sword-cross',
    colors: ['#FF6B35', '#FF8F60'],
    titleKey: 'notif_settings.challenges_title',
    descKey: 'notif_settings.challenges_desc',
  },
  {
    key: 'match_results',
    icon: 'trophy',
    colors: ['#8A2BE2', '#A855F7'],
    titleKey: 'notif_settings.match_results_title',
    descKey: 'notif_settings.match_results_desc',
  },
  {
    key: 'follows',
    icon: 'account-plus',
    colors: ['#00D4FF', '#38BDF8'],
    titleKey: 'notif_settings.follows_title',
    descKey: 'notif_settings.follows_desc',
  },
  {
    key: 'messages',
    icon: 'chat',
    colors: ['#4CAF50', '#66BB6A'],
    titleKey: 'notif_settings.messages_title',
    descKey: 'notif_settings.messages_desc',
  },
  {
    key: 'likes',
    icon: 'heart',
    colors: ['#FF3B5C', '#FF6B81'],
    titleKey: 'notif_settings.likes_title',
    descKey: 'notif_settings.likes_desc',
  },
  {
    key: 'comments',
    icon: 'comment-text',
    colors: ['#FFB800', '#FFC933'],
    titleKey: 'notif_settings.comments_title',
    descKey: 'notif_settings.comments_desc',
  },
  {
    key: 'system',
    icon: 'bell',
    colors: ['#6B7280', '#9CA3AF'],
    titleKey: 'notif_settings.system_title',
    descKey: 'notif_settings.system_desc',
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<NotificationSettingsData>({
    challenges: true,
    match_results: true,
    follows: true,
    messages: true,
    likes: true,
    comments: true,
    system: true,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const uid = await AsyncStorage.getItem('duelo_user_id');
      if (!uid) return;
      setUserId(uid);

      const res = await fetch(`${API_URL}/api/notifications/${uid}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error loading notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof NotificationSettingsData, value: boolean) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSettings(prev => ({ ...prev, [key]: value }));

    try {
      await authFetch(`${API_URL}/api/notifications/${userId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, [key]: value }),
      });
    } catch {
      setSettings(prev => ({ ...prev, [key]: !value }));
    }
  };

  const toggleAll = async (enable: boolean) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newSettings: NotificationSettingsData = {
      challenges: enable,
      match_results: enable,
      follows: enable,
      messages: enable,
      likes: enable,
      comments: enable,
      system: enable,
    };
    setSettings(newSettings);

    try {
      await authFetch(`${API_URL}/api/notifications/${userId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...newSettings }),
      });
    } catch {}
  };

  const allEnabled = Object.values(settings).every(v => v);
  const allDisabled = Object.values(settings).every(v => !v);
  const enabledCount = Object.values(settings).filter(v => v).length;

  return (
    <SwipeBackPage>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <DueloHeader />

      {/* Sub-header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="bell-cog-outline" size={18} color="#8A2BE2" />
          <Text style={styles.headerTitle}>{t('notif_settings.header')}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8A2BE2" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Master Toggle Card */}
          <View style={styles.masterCard}>
            <LinearGradient
              colors={['rgba(138,43,226,0.15)', 'rgba(138,43,226,0.05)']}
              style={styles.masterGradient}
            >
              <View style={styles.masterTop}>
                <LinearGradient colors={['#8A2BE2', '#A855F7']} style={styles.masterIconCircle}>
                  <MaterialCommunityIcons name="bell-ring" size={24} color="#FFF" />
                </LinearGradient>
                <View style={styles.masterTextWrap}>
                  <Text style={styles.masterTitle}>{t('notif_settings.all_notifications')}</Text>
                  <Text style={styles.masterSubtitle}>
                    {allEnabled
                      ? t('notif_settings.all_enabled')
                      : allDisabled
                      ? t('notif_settings.all_disabled')
                      : `${enabledCount}/${SETTINGS_CONFIG.length} ${t('notif_settings.enabled_count')}`}
                  </Text>
                </View>
                <Switch
                  value={allEnabled}
                  onValueChange={(val) => toggleAll(val)}
                  trackColor={{ false: '#333', true: 'rgba(138, 43, 226, 0.5)' }}
                  thumbColor={allEnabled ? '#A855F7' : '#666'}
                  ios_backgroundColor="#333"
                />
              </View>

              {/* Status bar */}
              <View style={styles.statusBar}>
                {SETTINGS_CONFIG.map((config) => (
                  <View
                    key={config.key}
                    style={[
                      styles.statusDot,
                      { backgroundColor: settings[config.key] ? config.colors[0] : 'rgba(255,255,255,0.1)' },
                    ]}
                  />
                ))}
              </View>
            </LinearGradient>
          </View>

          {/* Section header */}
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="tune-variant" size={14} color="rgba(255,255,255,0.4)" />
            <Text style={styles.sectionTitle}>{t('notif_settings.section_types')}</Text>
          </View>

          {/* Individual Settings */}
          {SETTINGS_CONFIG.map((config) => {
            const enabled = settings[config.key];

            return (
              <View key={config.key} style={[styles.settingRow, enabled && styles.settingRowEnabled]}>
                {/* Icon */}
                <LinearGradient
                  colors={enabled ? config.colors : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']}
                  style={styles.settingIconWrap}
                >
                  <MaterialCommunityIcons
                    name={config.icon as any}
                    size={18}
                    color={enabled ? '#FFF' : 'rgba(255,255,255,0.3)'}
                  />
                </LinearGradient>

                {/* Text */}
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, !enabled && styles.settingTitleDisabled]}>
                    {t(config.titleKey)}
                  </Text>
                  <Text style={styles.settingDesc}>{t(config.descKey)}</Text>
                </View>

                {/* Switch */}
                <Switch
                  value={enabled}
                  onValueChange={(val) => updateSetting(config.key, val)}
                  trackColor={{ false: '#333', true: `${config.colors[0]}60` }}
                  thumbColor={enabled ? config.colors[0] : '#666'}
                  ios_backgroundColor="#333"
                />
              </View>
            );
          })}

          {/* Info card */}
          <View style={styles.infoCard}>
            <LinearGradient colors={['#FFB800', '#FFC933']} style={styles.infoIconCircle}>
              <MaterialCommunityIcons name="lightbulb-on" size={14} color="#FFF" />
            </LinearGradient>
            <Text style={styles.infoText}>
              {t('notif_settings.info_challenges_priority')}
            </Text>
          </View>

          {/* Quiet hours hint */}
          <View style={styles.quietCard}>
            <LinearGradient colors={['#6B7280', '#9CA3AF']} style={styles.infoIconCircle}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={14} color="#FFF" />
            </LinearGradient>
            <View style={styles.quietText}>
              <Text style={styles.quietTitle}>{t('notif_settings.quiet_mode_title')}</Text>
              <Text style={styles.quietDesc}>
                {t('notif_settings.quiet_mode_desc')}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(138, 43, 226, 0.15)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  masterCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(138, 43, 226, 0.2)',
  },
  masterGradient: {
    padding: 18,
  },
  masterTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  masterTextWrap: {
    flex: 1,
  },
  masterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  masterSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  statusBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statusDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  settingRowEnabled: {
    borderColor: 'rgba(255,255,255,0.04)',
  },
  settingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  settingTitleDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  settingDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 185, 0, 0.06)',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 185, 0, 0.12)',
  },
  infoIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  quietCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quietText: {
    flex: 1,
  },
  quietTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  quietDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 17,
  },
});

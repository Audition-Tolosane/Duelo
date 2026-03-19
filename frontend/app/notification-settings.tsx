import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Switch,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';

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

const SETTINGS_CONFIG = [
  {
    key: 'challenges' as const,
    icon: '⚔️',
    title: 'Défis',
    description: 'Quand un joueur te défie en duel',
  },
  {
    key: 'match_results' as const,
    icon: '🏆',
    title: 'Résultats de match',
    description: 'Résumé après chaque partie',
  },
  {
    key: 'follows' as const,
    icon: '👤',
    title: 'Nouveaux followers',
    description: 'Quand quelqu\'un commence à te suivre',
  },
  {
    key: 'messages' as const,
    icon: '💬',
    title: 'Messages',
    description: 'Nouveaux messages de chat',
  },
  {
    key: 'likes' as const,
    icon: '❤️',
    title: 'Likes',
    description: 'Quand quelqu\'un aime ta publication',
  },
  {
    key: 'comments' as const,
    icon: '💬',
    title: 'Commentaires',
    description: 'Quand quelqu\'un commente ta publication',
  },
  {
    key: 'system' as const,
    icon: '🔔',
    title: 'Système',
    description: 'Mises à jour et annonces',
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
  const [saving, setSaving] = useState(false);
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
      await fetch(`${API_URL}/api/notifications/${userId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, [key]: value }),
      });
    } catch {
      // Revert on error
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
      await fetch(`${API_URL}/api/notifications/${userId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...newSettings }),
      });
    } catch {}
  };

  const allEnabled = Object.values(settings).every(v => v);
  const allDisabled = Object.values(settings).every(v => !v);

  return (
    <SwipeBackPage>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
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
          {/* Master Toggle */}
          <View style={styles.masterCard}>
            <View style={styles.masterLeft}>
              <Text style={styles.masterIcon}>🔔</Text>
              <View>
                <Text style={styles.masterTitle}>Toutes les notifications</Text>
                <Text style={styles.masterSubtitle}>
                  {allEnabled ? 'Toutes activées' : allDisabled ? 'Toutes désactivées' : 'Personnalisé'}
                </Text>
              </View>
            </View>
            <Switch
              value={allEnabled}
              onValueChange={(val) => toggleAll(val)}
              trackColor={{ false: '#333', true: 'rgba(138, 43, 226, 0.4)' }}
              thumbColor={allEnabled ? '#8A2BE2' : '#666'}
              ios_backgroundColor="#333"
            />
          </View>

          {/* Individual Settings */}
          <Text style={styles.sectionTitle}>Types de notifications</Text>

          {SETTINGS_CONFIG.map((config) => (
            <View key={config.key} style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconWrap}>
                  <Text style={styles.settingIcon}>{config.icon}</Text>
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>{config.title}</Text>
                  <Text style={styles.settingDesc}>{config.description}</Text>
                </View>
              </View>
              <Switch
                value={settings[config.key]}
                onValueChange={(val) => updateSetting(config.key, val)}
                trackColor={{ false: '#333', true: 'rgba(138, 43, 226, 0.4)' }}
                thumbColor={settings[config.key] ? '#8A2BE2' : '#666'}
                ios_backgroundColor="#333"
              />
            </View>
          ))}

          {/* Info card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>
              Les notifications de défis sont prioritaires et seront toujours affichées en premier dans ta liste.
            </Text>
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
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#FFF',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(138, 43, 226, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(138, 43, 226, 0.15)',
  },
  masterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  masterIcon: {
    fontSize: 28,
  },
  masterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  masterSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIcon: {
    fontSize: 18,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  settingDesc: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 185, 0, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 185, 0, 0.15)',
  },
  infoIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#BBB',
    lineHeight: 18,
  },
});

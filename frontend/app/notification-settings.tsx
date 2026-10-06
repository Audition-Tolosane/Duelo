import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Switch, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import { Txt, Icon, IconName, Card, ListRow, ScreenContainer, ScreenHeader, Loader } from '../components/ui';
import { COLOR, SPACE, SIZE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';

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

// Couleur d'icône = rôle (défi = corail, résultat = or), le reste en crème neutre.
const SETTINGS_CONFIG: {
  key: keyof NotificationSettingsData;
  icon: IconName;
  color: string;
  titleKey: string;
  descKey: string;
}[] = [
  { key: 'challenges',    icon: 'duel',     color: COLOR.accent.warm,    titleKey: 'notif_settings.challenges_title',    descKey: 'notif_settings.challenges_desc' },
  { key: 'match_results', icon: 'trophy',   color: COLOR.reward.gold,    titleKey: 'notif_settings.match_results_title', descKey: 'notif_settings.match_results_desc' },
  { key: 'follows',       icon: 'userPlus', color: COLOR.text.secondary, titleKey: 'notif_settings.follows_title',       descKey: 'notif_settings.follows_desc' },
  { key: 'messages',      icon: 'message',  color: COLOR.text.secondary, titleKey: 'notif_settings.messages_title',      descKey: 'notif_settings.messages_desc' },
  { key: 'likes',         icon: 'heart',    color: COLOR.text.secondary, titleKey: 'notif_settings.likes_title',         descKey: 'notif_settings.likes_desc' },
  { key: 'comments',      icon: 'message',  color: COLOR.text.secondary, titleKey: 'notif_settings.comments_title',      descKey: 'notif_settings.comments_desc' },
  { key: 'system',        icon: 'bell',     color: COLOR.text.secondary, titleKey: 'notif_settings.system_title',        descKey: 'notif_settings.system_desc' },
];

export default function NotificationSettingsScreen() {
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
    } catch (e) { console.error(e); }
  };

  const allEnabled = Object.values(settings).every(v => v);
  const allDisabled = Object.values(settings).every(v => !v);
  const enabledCount = Object.values(settings).filter(v => v).length;

  // Interrupteur SKILKI : identique aux Réglages (piste jaune quand actif, pouce crème)
  const switchProps = {
    trackColor: { false: COLOR.surface.elevated, true: COLOR.action.primary },
    thumbColor: COLOR.text.primary,
    ios_backgroundColor: COLOR.surface.elevated,
    // react-native-web colore le pouce actif à part (sinon vert-bleu par défaut)
    activeThumbColor: COLOR.text.primary,
  } as React.ComponentProps<typeof Switch>;

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('settings.notifications')} />

      {loading ? (
        <Loader fill />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Interrupteur général */}
          <Card style={styles.master}>
            <ListRow
              leadingIcon="bellRing"
              title={t('notif_settings.all_notifications')}
              subtitle={allEnabled
                ? t('notif_settings.all_enabled')
                : allDisabled
                ? t('notif_settings.all_disabled')
                : `${enabledCount}/${SETTINGS_CONFIG.length} ${t('notif_settings.enabled_count')}`}
              trailing={
                <Switch
                  value={allEnabled}
                  onValueChange={(val) => toggleAll(val)}
                  accessibilityLabel={t('notif_settings.all_notifications')}
                  {...switchProps}
                />
              }
            />
            {/* Repère : un segment par type, jaune quand il est actif */}
            <View style={styles.statusBar}>
              {SETTINGS_CONFIG.map((config) => (
                <View
                  key={config.key}
                  style={[styles.statusDot, { backgroundColor: settings[config.key] ? COLOR.action.primary : COLOR.track }]}
                />
              ))}
            </View>
          </Card>

          {/* Types de notifications */}
          <View style={styles.group}>
            <Txt variant="overline">{t('notif_settings.section_types')}</Txt>
            <Card padded={false} style={styles.groupCard}>
              {SETTINGS_CONFIG.map((config, i) => {
                const enabled = settings[config.key];
                return (
                  <View key={config.key} style={[styles.settingRow, i > 0 && styles.separated]}>
                    <Icon name={config.icon} size={22} color={enabled ? config.color : COLOR.text.disabled} />
                    <View style={styles.settingText}>
                      <Txt variant="cardTitle" color={enabled ? COLOR.text.primary : COLOR.text.secondary}>
                        {t(config.titleKey)}
                      </Txt>
                      <Txt variant="caption">{t(config.descKey)}</Txt>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={(val) => updateSetting(config.key, val)}
                      accessibilityLabel={t(config.titleKey)}
                      {...switchProps}
                    />
                  </View>
                );
              })}
            </Card>
          </View>

          {/* Bon à savoir */}
          <Card style={styles.hints}>
            <View style={styles.hintRow}>
              <Icon name="idea" size={ICON_SIZE.md} color={COLOR.text.secondary} />
              <Txt variant="bodySmall" style={styles.flex}>{t('notif_settings.info_challenges_priority')}</Txt>
            </View>
            <View style={styles.divider} />
            <View style={styles.hintRow}>
              <Icon name="moon" size={ICON_SIZE.md} color={COLOR.text.secondary} />
              <View style={styles.flex}>
                <Txt variant="label" color={COLOR.text.primary}>{t('notif_settings.quiet_mode_title')}</Txt>
                <Txt variant="bodySmall">{t('notif_settings.quiet_mode_desc')}</Txt>
              </View>
            </View>
          </Card>
        </ScrollView>
      )}
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.xxl, paddingBottom: SPACE.giant, gap: SPACE.sectionGap },
  flex: { flex: 1 },
  master: { paddingVertical: SPACE.xs, gap: SPACE.sm },
  statusBar: {
    flexDirection: 'row',
    gap: SPACE.xs,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
    borderTopWidth: BORDER.hair,
    borderTopColor: COLOR.border.subtle,
  },
  statusDot: {
    flex: 1,
    height: 4,
    borderRadius: RADII.xs,
  },
  group: { gap: SPACE.sm },
  groupCard: { paddingHorizontal: SPACE.cardPad },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: SIZE.listRow,
    paddingVertical: SPACE.md,
  },
  separated: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
  settingText: { flex: 1, gap: SPACE.xxs },
  hints: { gap: SPACE.md },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  divider: { height: BORDER.hair, backgroundColor: COLOR.border.subtle },
});

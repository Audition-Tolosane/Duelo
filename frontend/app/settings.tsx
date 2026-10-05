import SwipeBackPage from '../components/SwipeBackPage';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Switch, Share } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch, clearToken } from '../utils/api';
import { setSoundEnabled, isSoundEnabled } from '../utils/sounds';
import { t } from '../utils/i18n';
import { Txt, Icon, Button, Badge, Card, ScreenContainer, ScreenHeader, ListRow } from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';

// Réglages SKILKI (ouvert depuis l'engrenage du Profil) : parrainage, préférences, aide, compte.
// Les handlers et appels API sont ceux qui vivaient auparavant dans le Profil.
//   /settings?guest=1  → compte invité : pas de suppression de compte

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Paliers de parrainage (inchangés) : nombre de filleuls confirmés → jours de Pro.
const REFERRAL_STEPS = [
  { count: 1, days: 1 },
  { count: 2, days: 3 },
  { count: 3, days: 7 },
];

type ReferralData = {
  code: string;
  total_referrals: number;
  confirmed_referrals: number;
  milestones: { count: number; delta_days: number }[];
  total_pro_days_earned: number;
  pro_active: boolean;
  pro_expires_at: string | null;
  min_matches_required: number;
  min_age_hours: number;
};

function Divider() {
  return <View style={s.divider} />;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.group}>
      <Txt variant="overline">{title}</Txt>
      <Card padded={false} style={s.groupCard}>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { guest } = useLocalSearchParams<{ guest?: string }>();
  const isGuest = guest !== '0';
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  useEffect(() => { loadReferral(); }, []);

  const loadReferral = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/referral/my-code`);
      if (res.ok) setReferralData(await res.json());
    } catch {}
  };

  const handleShareReferral = () => {
    if (!referralData) return;
    const msg = t('pilot.settings.referral_share_message', { code: referralData.code });
    Share.share({ message: msg }).catch(() => {});
  };

  const toggleSound = (on: boolean) => {
    setSoundEnabled(on);
    setSoundOn(on);
  };

  const handleLogout = async () => {
    await clearToken();
    await AsyncStorage.multiRemove(['duelo_user_id', 'duelo_pseudo', 'duelo_avatar_seed', 'duelo_avatar_url']);
    router.replace('/');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.delete_account_title'),
      t('profile.delete_account_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.delete_account_confirm_btn'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await authFetch(`${API_URL}/api/auth/delete-account`, { method: 'DELETE' });
              if (res.ok) {
                await clearToken();
                await AsyncStorage.multiRemove(['duelo_user_id', 'duelo_pseudo', 'duelo_avatar_seed', 'duelo_avatar_url']);
                router.replace('/');
              } else {
                Alert.alert(t('common.error'), t('profile.error_network'));
              }
            } catch {
              Alert.alert(t('common.error'), t('profile.error_network'));
            }
          },
        },
      ]
    );
  };

  const pending = referralData ? referralData.total_referrals - referralData.confirmed_referrals : 0;
  const proActive = !!(referralData?.pro_active && referralData.pro_expires_at);

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('pilot.settings.title')} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Parrainage ── */}
        {referralData && (
          <View style={s.group}>
            <Txt variant="overline">{t('referral.title')}</Txt>
            <Card style={s.referral}>
              <View style={s.spread}>
                <View style={s.flex}>
                  <Txt variant="caption">{t('referral.your_code')}</Txt>
                  <Txt variant="h2" selectable style={s.code}>{referralData.code}</Txt>
                </View>
                {proActive ? <Badge label={t('pilot.settings.pro_badge')} tone="rare" /> : null}
              </View>

              <View style={s.steps}>
                {REFERRAL_STEPS.map((m) => {
                  const done = referralData.confirmed_referrals >= m.count;
                  return (
                    <View key={m.count} style={s.step}>
                      <Icon
                        name={done ? 'success' : 'lock'}
                        size={ICON_SIZE.sm}
                        color={done ? COLOR.reward.gold : COLOR.text.disabled}
                      />
                      <Txt variant="bodySmall" color={done ? COLOR.text.primary : COLOR.text.secondary}>
                        {t(m.count > 1 ? 'pilot.settings.referral_step_other' : 'pilot.settings.referral_step_one', {
                          count: String(m.count), days: String(m.days),
                        })}
                      </Txt>
                    </View>
                  );
                })}
              </View>

              <View style={s.metaBlock}>
                <Txt variant="label" color={COLOR.text.primary} style={s.tabular}>
                  {t('pilot.settings.referral_progress', { confirmed: String(referralData.confirmed_referrals), total: '3' })}
                  {pending > 0 ? ` · ${t('pilot.settings.referral_pending', { count: String(pending) })}` : ''}
                </Txt>
                <Txt variant="caption">
                  {t('pilot.settings.referral_rule', { matches: String(referralData.min_matches_required) })}
                </Txt>
                {proActive && (
                  <View style={s.inline}>
                    <Icon name="crown" size={ICON_SIZE.sm} color={COLOR.accent.rare} />
                    <Txt variant="caption" color={COLOR.text.secondary}>
                      {t('pilot.settings.pro_until', { date: new Date(referralData.pro_expires_at as string).toLocaleDateString() })}
                    </Txt>
                  </View>
                )}
              </View>

              <Button label={t('referral.share')} icon="share" onPress={handleShareReferral} fullWidth />
            </Card>
          </View>
        )}

        {/* ── Préférences ── */}
        <Group title={t('pilot.settings.section_preferences')}>
          <ListRow leadingIcon="globe" title={t('settings.language')} onPress={() => router.push('/language-settings')} />
          <Divider />
          <ListRow leadingIcon="bell" title={t('settings.notifications')} onPress={() => router.push('/notification-settings')} />
          <Divider />
          <ListRow
            leadingIcon="music"
            title={t('pilot.settings.sound')}
            subtitle={t('pilot.settings.sound_hint')}
            trailing={
              <Switch
                value={soundOn}
                onValueChange={toggleSound}
                trackColor={{ false: COLOR.surface.elevated, true: COLOR.action.primary }}
                thumbColor={COLOR.text.primary}
                ios_backgroundColor={COLOR.surface.elevated}
                accessibilityLabel={t('pilot.settings.sound')}
              />
            }
          />
        </Group>

        {/* ── Aide et informations ── */}
        <Group title={t('pilot.settings.section_help')}>
          <ListRow leadingIcon="message" title={t('settings.support')} onPress={() => router.push('/support')} />
          <Divider />
          <ListRow leadingIcon="book" title={t('settings.terms')} onPress={() => router.push('/terms')} />
        </Group>

        {/* ── Compte ── */}
        <Group title={t('pilot.settings.section_account')}>
          <ListRow leadingIcon="logout" title={t('settings.logout')} onPress={handleLogout} testID="settings-logout" />
        </Group>

        {!isGuest && (
          <Button
            label={t('profile.delete_account')}
            variant="danger"
            icon="trash"
            onPress={handleDeleteAccount}
            fullWidth
            testID="settings-delete-account"
          />
        )}
      </ScrollView>
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.xxl, paddingBottom: SPACE.giant, gap: SPACE.sectionGap },
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  tabular: { fontVariant: ['tabular-nums'] },
  divider: { height: BORDER.hair, backgroundColor: COLOR.border.subtle },
  group: { gap: SPACE.sm },
  groupCard: { paddingHorizontal: SPACE.cardPad },
  referral: { gap: SPACE.lg },
  code: { letterSpacing: 2 },
  steps: { gap: SPACE.sm, padding: SPACE.md, borderRadius: RADII.md, backgroundColor: COLOR.surface.subtle },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  metaBlock: { gap: SPACE.xs },
});

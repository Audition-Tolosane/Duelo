import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import Constants from 'expo-constants';
import SwipeBackPage from '../components/SwipeBackPage';
import { Txt, Icon, IconName, Button, Card, Chip, ListRow, EmptyState, ScreenContainer, ScreenHeader } from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, SIZE, TYPO, ICON_SIZE } from '../theme/tokens';
import { t } from '../utils/i18n';

// Support (ouvert depuis Réglages). Il n'existe pas de route backend : « Envoyer » ouvre l'app mail
// avec le message prérempli, et l'écran suivant le dit (il n'annonce plus un envoi qui n'a pas eu lieu).
const SUPPORT_EMAIL = 'support@duelo-app.com';

const CATEGORIES = ['bug', 'suggestion', 'account', 'other'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_ICON: Record<Category, IconName> = {
  bug: 'warning',
  suggestion: 'idea',
  account: 'user',
  other: 'help',
};

export default function SupportScreen() {
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  const [opened, setOpened] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const canSend = !!message.trim() && !!category;

  const openMail = (subject?: string, body?: string) => {
    const params = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join('&');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}${params ? `?${params}` : ''}`).catch(() => {});
  };

  const handleSend = () => {
    if (!canSend || !category) return;
    openMail(
      `[SKILKI] ${t(`support.${category}`)}`,
      `${message.trim()}\n\n—\n${t('support.version')} ${appVersion} · ${Platform.OS}`,
    );
    setOpened(true);
  };

  const handleReset = () => {
    setOpened(false);
    setMessage('');
    setCategory(null);
  };

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('support.title')} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {opened ? (
            <Card>
              <EmptyState
                icon="mail"
                title={t('pilot.support.opened_title')}
                message={t('pilot.support.opened_text')}
                actionLabel={t('pilot.support.new_message')}
                onAction={handleReset}
              />
            </Card>
          ) : (
            <>
              <View style={s.group}>
                <Txt variant="overline">{t('support.category')}</Txt>
                <View style={s.chips}>
                  {CATEGORIES.map(cat => (
                    <Chip
                      key={cat}
                      label={t(`support.${cat}`)}
                      icon={CATEGORY_ICON[cat]}
                      selected={category === cat}
                      onPress={() => setCategory(cat)}
                    />
                  ))}
                </View>
              </View>

              <View style={s.group}>
                <Txt variant="overline">{t('pilot.support.message')}</Txt>
                <TextInput
                  style={s.input}
                  placeholder={t('support.message_placeholder')}
                  placeholderTextColor={COLOR.text.tertiary}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  value={message}
                  onChangeText={setMessage}
                  accessibilityLabel={t('pilot.support.message')}
                />
                <Txt variant="caption">{t('pilot.support.how_it_works')}</Txt>
              </View>

              <Button label={t('support.send')} icon="send" size="lg" fullWidth disabled={!canSend} onPress={handleSend} />
            </>
          )}

          <Card padded={false} style={s.groupCard}>
            <ListRow
              leadingIcon="mail"
              title={t('support.email_label')}
              subtitle={SUPPORT_EMAIL}
              onPress={() => openMail()}
            />
          </Card>

          <View style={s.version}>
            <Icon name="info" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
            <Txt variant="caption">{t('support.version')} {appVersion}</Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.xxl, paddingBottom: SPACE.giant, gap: SPACE.xxl },
  group: { gap: SPACE.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  input: {
    minHeight: SIZE.input * 3,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.input,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    ...TYPO.body,
    color: COLOR.text.primary,
  },
  groupCard: { paddingHorizontal: SPACE.cardPad },
  version: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
});

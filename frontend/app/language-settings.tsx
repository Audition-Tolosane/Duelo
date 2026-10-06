import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import SwipeBackPage from '../components/SwipeBackPage';
import { Language, LANGUAGE_NAMES, getLanguage, setLanguage, t } from '../utils/i18n';
import { Txt, Icon, Card, ListRow, ScreenContainer, ScreenHeader } from '../components/ui';
import { COLOR, SPACE, RADII, BORDER, ICON_SIZE } from '../theme/tokens';

// Choix de la langue de l'interface (ouvert depuis Réglages). Sélection = coche jaune.
export default function LanguageSettings() {
  const [selected, setSelected] = useState<Language>(getLanguage());

  const handleSelect = (lang: Language) => {
    setSelected(lang);
    setLanguage(lang);
  };

  const languages = Object.entries(LANGUAGE_NAMES) as [Language, string][];

  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('language.title')} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Les questions ne sont pas traduites : on le dit avant le choix */}
        <View style={s.note}>
          <Icon name="info" size={ICON_SIZE.sm} color={COLOR.text.secondary} />
          <Txt variant="bodySmall" style={s.flex}>{t('language.note')}</Txt>
        </View>

        <Card padded={false} style={s.groupCard}>
          {languages.map(([code, name], i) => {
            const active = selected === code;
            return (
              <ListRow
                key={code}
                title={name}
                onPress={() => handleSelect(code)}
                trailing={active ? <Icon name="check" size={ICON_SIZE.md} color={COLOR.action.primary} /> : null}
                style={i > 0 ? s.separated : undefined}
              />
            );
          })}
        </Card>
      </ScrollView>
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.xxl, paddingBottom: SPACE.giant, gap: SPACE.lg },
  flex: { flex: 1 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.subtle,
  },
  groupCard: { paddingHorizontal: SPACE.cardPad },
  separated: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
});

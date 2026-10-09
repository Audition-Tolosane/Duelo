import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import SwipeBackPage from '../components/SwipeBackPage';
import { Txt, Card, ScreenContainer, ScreenHeader } from '../components/ui';
import { COLOR, SPACE, BORDER } from '../theme/tokens';
import { t } from '../utils/i18n';

// Conditions d'utilisation (ouvertes depuis Réglages). Texte long : lecture confortable,
// aucune couleur d'accent. Les titres portent déjà leur numéro (« 1. … ») : pas de second numéro.
const SECTION_COUNT = 11;

export default function Terms() {
  return (
    <SwipeBackPage>
    <ScreenContainer>
      <ScreenHeader title={t('terms.title')} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Txt variant="caption">{t('terms.last_update')}</Txt>

        <Card>
          {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map(n => (
            <View key={n} style={[s.section, n > 1 ? s.separated : s.first, n === SECTION_COUNT && s.last]}>
              <Txt variant="cardTitle" accessibilityRole="header">{t(`terms.section${n}_title`)}</Txt>
              <Txt variant="bodySmall" color={COLOR.text.secondary}>{t(`terms.section${n}_text`)}</Txt>
            </View>
          ))}
        </Card>
      </ScrollView>
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.xxl, paddingBottom: SPACE.giant, gap: SPACE.lg },
  section: { gap: SPACE.sm, paddingVertical: SPACE.lg },
  first: { paddingTop: 0 },
  last: { paddingBottom: 0 },
  separated: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle },
});

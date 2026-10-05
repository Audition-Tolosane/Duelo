import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import {
  Txt, Button, IconButton, Badge, Card, Chip, Section, ScreenContainer, ScreenHeader, AppHeader, StatCard, ProgressBar,
  ListRow, Loader, Dialog, BottomSheet, ThemeIcon, ThemeCard, PlayerCard, AnswerButton, ResultState, EmptyState,
  SearchField, Icon,
} from '../components/ui';
import { COLOR, SPACE, RADII, TYPO, TypoVariant } from '../theme/tokens';
import { THEME_ICONS, ThemeIconName } from '../theme/themeIcons.generated';

// Vitrine du design system SKILKI (développement uniquement) : /design-system
const SWATCHES: [string, string][] = [
  ['bg.primary', COLOR.bg.primary], ['surface.card', COLOR.surface.card], ['surface.elevated', COLOR.surface.elevated],
  ['action.primary', COLOR.action.primary], ['player.opponent', COLOR.player.opponent], ['reward.gold', COLOR.reward.gold],
  ['status.success', COLOR.status.success], ['status.error', COLOR.status.error], ['accent.rare', COLOR.accent.rare],
  ['text.primary', COLOR.text.primary],
];

export default function DesignSystemScreen() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [chip, setChip] = useState('Tous');
  const [query, setQuery] = useState('');
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ScreenContainer>
      <ScreenHeader overline="SKILKI" title="Design system" />
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader safeTop={false} actions={<>
          <IconButton icon="search" accessibilityLabel="Rechercher" />
          <IconButton icon="message" accessibilityLabel="Messages" count={2} />
          <IconButton icon="bell" accessibilityLabel="Notifications" count={12} />
        </>} />

        <Section overline="Couleurs" title="Rôles">
          <View style={styles.swatches}>
            {SWATCHES.map(([name, c]) => (
              <View key={name} style={styles.swatch}>
                <View style={[styles.swatchChip, { backgroundColor: c }]} />
                <Txt variant="caption">{name}</Txt>
              </View>
            ))}
          </View>
        </Section>

        <Section overline="Typographie" title="Échelle">
          <View style={{ gap: SPACE.sm }}>
            {(Object.keys(TYPO) as TypoVariant[]).filter((v) => v !== 'countdown').map((v) => (
              <Txt key={v} variant={v} numberOfLines={1}>{v} — Duel 128</Txt>
            ))}
          </View>
        </Section>

        <Section overline="Actions" title="Boutons">
          <View style={{ gap: SPACE.sm }}>
            <Button label="Trouver un adversaire" icon="duel" size="lg" fullWidth />
            <Button label="Rejouer" variant="secondary" icon="replay" fullWidth />
            <View style={styles.row}>
              <Button label="Annuler" variant="ghost" style={{ flex: 1 }} />
              <Button label="Supprimer" variant="danger" icon="trash" style={{ flex: 1 }} />
            </View>
            <View style={styles.row}>
              <Button label="Petit" size="sm" />
              <Button label="Chargement" size="sm" loading />
              <Button label="Inactif" size="sm" disabled />
            </View>
          </View>
        </Section>

        <Section overline="Navigation" title="Recherche et puces">
          <SearchField placeholder="Thème, film, pays…" value={query} onChangeText={setQuery} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {['Tous', 'SCREEN', 'SOUND', 'ARENA', 'LEGENDS'].map((c) => (
              <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} />
            ))}
          </ScrollView>
          <View style={styles.row}><Badge label="Nouveau" /><Badge label="+120 XP" tone="reward" /><Badge label="Premium" tone="rare" /><Badge count={3} /></View>
        </Section>

        <Section overline="Icônes de thèmes" title="Plaque crème · 12 illustrations">
          <View style={styles.iconGrid}>
            {(Object.keys(THEME_ICONS) as ThemeIconName[]).map((n) => (
              <View key={n} style={styles.iconCell}>
                <ThemeIcon name={n} size={56} />
                <Txt variant="caption" numberOfLines={1}>{n}</Txt>
              </View>
            ))}
          </View>
          <View style={styles.row}>
            {[28, 40, 56, 80].map((s) => <ThemeIcon key={s} name="cinema" size={s} />)}
            <ThemeIcon superCategory="MIND" size={56} />
            <ThemeIcon superCategory="LIFE" size={56} />
          </View>
        </Section>

        <Section overline="Contenu" title="Cartes de thèmes" onSeeAll={() => {}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <ThemeCard name="Rome antique" cluster="Antiq. & M-Â" level={12} meta="Histoire" />
            <ThemeCard name="Star Wars" cluster="Cinéma" meta="500 questions" />
            <ThemeCard name="Formule 1" superCategory="ARENA" level={3} />
          </ScrollView>
          <Card>
            <ThemeCard layout="row" name="Les Simpson" cluster="Animation & Anime" level={8} meta="Séries" />
            <ThemeCard layout="row" name="Égypte antique" superCategory="LEGENDS" meta="Histoire" />
          </Card>
        </Section>

        <Section overline="Progression" title="Statistiques">
          <Card>
            <View style={styles.row}>
              <StatCard appearance="plain" value={312} label="Duels" />
              <StatCard appearance="plain" value="58 %" label="Victoires" tone="success" />
              <StatCard appearance="plain" value={5} label="Série" icon="flame" tone="warm" />
              <StatCard appearance="plain" value={14} label="Meilleure" tone="reward" />
            </View>
            <View style={{ gap: SPACE.xs, marginTop: SPACE.lg }}>
              <Txt variant="label">Niveau 23 · 640 / 900 XP</Txt>
              <ProgressBar value={0.71} />
            </View>
          </Card>
          <Card accent="event"><ListRow leadingIcon="duel" title="Léa te défie" subtitle="Rome antique · expire dans 3 h" trailing={<Badge label="Défi" />} /></Card>
        </Section>

        <Section overline="Duel" title="Joueurs et réponses">
          <PlayerCard side="self" pseudo="Julie" subtitle="Or II · 1 240 MMR" title="Stratège" spotlight />
          <PlayerCard side="opponent" pseudo="Max" subtitle="Or I · 1 310 MMR" spotlight />
          <View style={styles.answers}>
            <View style={styles.answerRow}>
              <AnswerButton letter="A" text="Néron" state="idle" />
              <AnswerButton letter="B" text="Vespasien" state="selected" />
            </View>
            <View style={styles.answerRow}>
              <AnswerButton letter="C" text="Trajan" state="wrong" opponentPick />
              <AnswerButton letter="D" text="Auguste" state="correct" />
            </View>
          </View>
        </Section>

        <Section overline="Fin de duel" title="États">
          <Card padded={false}><ResultState outcome="victory" subtitle="5 / 7 bonnes réponses" /></Card>
          <Card padded={false}><ResultState outcome="defeat" subtitle="3 / 7 bonnes réponses" /></Card>
        </Section>

        <Section overline="Divers" title="Vide, chargement, modales">
          <Card><EmptyState icon="duel" title="Aucun défi en attente" message="Lance un duel rapide pour te mesurer à un joueur." actionLabel="Duel rapide" onAction={() => {}} /></Card>
          <Loader label="Recherche d'un adversaire…" />
          <View style={styles.row}>
            <Button label="Dialog" variant="secondary" size="sm" onPress={() => setDialog(true)} />
            <Button label="Bottom sheet" variant="secondary" size="sm" onPress={() => setSheet(true)} />
          </View>
        </Section>
        <View style={{ height: 80 }} />
      </ScrollView>

      <Dialog
        visible={dialog}
        onClose={() => setDialog(false)}
        icon="duel"
        tone="event"
        title="Max te propose une revanche"
        message="Rome antique · 15 s pour répondre"
        actions={<>
          <Button label="Accepter" onPress={() => setDialog(false)} fullWidth />
          <Button label="Refuser" variant="ghost" onPress={() => setDialog(false)} fullWidth />
        </>}
      />
      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Défier Léa"
        subtitle="Choisis un thème"
        footer={<Button label="Envoyer le défi" icon="duel" fullWidth onPress={() => setSheet(false)} />}
      >
        <ThemeCard layout="row" name="Harry Potter" cluster="Cinéma" level={4} />
        <ThemeCard layout="row" name="Breaking Bad" cluster="Séries TV" level={9} />
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.screenX, gap: SPACE.sectionGap },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  swatch: { width: 100, gap: SPACE.xs },
  swatchChip: { height: 40, borderRadius: RADII.sm, borderWidth: 1, borderColor: COLOR.border.default },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  iconCell: { width: 76, alignItems: 'center', gap: SPACE.xs },
  answers: { height: 300, gap: SPACE.sm },
  answerRow: { flex: 1, flexDirection: 'row', gap: SPACE.sm },
});

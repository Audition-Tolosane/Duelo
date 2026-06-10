import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { COLORS, RADIUS, SPACING } from '../theme/tokens';
import { FONTS } from '../theme/fonts';
import DuelButton from './DuelButton';

const TILE = 96;
const HALO = TILE + 48;

type EmptyStateProps = {
  icon: string; // emoji : '⚔', '💬', '🔍'…
  title: string;
  body: string;
  ctaLabel?: string;
  onPress?: () => void;
  accent?: string;
};

// État vide réutilisable — toujours proposer une action, jamais de page blanche
export default function EmptyState({
  icon, title, body, ctaLabel, onPress, accent = COLORS.cyan,
}: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.tileWrap}>
        <Svg width={HALO} height={HALO} style={styles.halo}>
          <Defs>
            <RadialGradient id="emptyHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={accent} stopOpacity={0.16} />
              <Stop offset="70%" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#emptyHalo)" />
        </Svg>
        <View style={[styles.tile, { borderColor: accent + '30' }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {ctaLabel ? (
        <DuelButton label={ctaLabel} onPress={onPress} size="sm" style={styles.cta} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow (et non flex:1) : se centre dans un parent contraint,
  // garde sa hauteur de contenu dans un ScrollView/ListEmptyComponent
  wrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  tileWrap: {
    width: TILE,
    height: TILE,
    marginBottom: SPACING.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    top: -(HALO - TILE) / 2,
    left: -(HALO - TILE) / 2,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 44 },
  title: {
    fontFamily: FONTS.display.bold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: COLORS.white,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.display.regular,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.dim2,
    textAlign: 'center',
    maxWidth: 260,
    marginTop: SPACING.sm,
  },
  cta: { marginTop: SPACING.xl },
});

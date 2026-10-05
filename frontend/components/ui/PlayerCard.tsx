import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import UserAvatar from '../UserAvatar';
import Txt from './Txt';
import { COLOR, RADII, SPACE, BORDER, GRADIENTS, GLOW } from '../../theme/tokens';

type Props = {
  pseudo: string;
  avatarSeed?: string;
  avatarUrl?: string | null;
  /** Mon camp = jaune, rival = corail. Jamais de violet pour l'adversaire. */
  side: 'self' | 'opponent';
  /** Ligne d'info : « Niv. 12 », « Or II · 1 240 »… */
  subtitle?: string;
  title?: string;
  /** Halo coloré (écran VS uniquement). */
  spotlight?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PlayerCard({ pseudo, avatarSeed, avatarUrl, side, subtitle, title, spotlight, compact, style }: Props) {
  const accent = side === 'self' ? COLOR.player.self : COLOR.player.opponent;
  const halo = side === 'self' ? GRADIENTS.vsSelf : GRADIENTS.vsOpponent;
  const avatar = compact ? 44 : 72;
  return (
    <View style={[styles.base, compact && styles.compact, { borderColor: accent }, spotlight && (side === 'self' ? GLOW.cta : GLOW.opponent), style]}>
      {spotlight ? <LinearGradient colors={halo.colors} style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      <UserAvatar avatarUrl={avatarUrl} avatarSeed={avatarSeed} pseudo={pseudo} size={avatar} borderColor={accent} borderWidth={BORDER.strong} />
      <View style={styles.texts}>
        <Txt variant={compact ? 'cardTitle' : 'h2'} numberOfLines={1}>{pseudo}</Txt>
        {title ? <Txt variant="overline" color={COLOR.reward.gold} numberOfLines={1}>{title}</Txt> : null}
        {subtitle ? <Txt variant="caption" numberOfLines={1}>{subtitle}</Txt> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADII.xl,
    borderWidth: BORDER.strong,
    backgroundColor: COLOR.surface.card,
    overflow: 'hidden',
  },
  compact: { padding: SPACE.md, borderRadius: RADII.lg, borderWidth: BORDER.default },
  texts: { flex: 1, gap: 2 },
});

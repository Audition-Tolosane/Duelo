import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Txt from './Txt';
import { COLOR, SPACE, GRADIENTS } from '../../theme/tokens';
import { t } from '../../utils/i18n';

type Outcome = 'victory' | 'defeat' | 'draw' | 'flawless';

type Props = { outcome: Outcome; subtitle?: string };

// En-tête de fin de duel. Victoire = halo jaune (moment spectaculaire) ; défaite = pétrole sobre
// avec filet corail (une défaite n'est pas une erreur, donc jamais rouge) ; sans-faute = violet rare.
export default function ResultState({ outcome, subtitle }: Props) {
  const halo = outcome === 'victory' ? GRADIENTS.victory
    : outcome === 'flawless' ? GRADIENTS.rare
    : outcome === 'draw' ? GRADIENTS.draw
    : GRADIENTS.defeat;
  const title = outcome === 'victory' ? t('results.victory')
    : outcome === 'defeat' ? t('results.defeat')
    : outcome === 'draw' ? t('results.draw')
    : 'FLAWLESS';
  const color = outcome === 'victory' ? COLOR.action.primary : outcome === 'flawless' ? COLOR.accent.rare : COLOR.text.primary;
  return (
    <View style={styles.root}>
      <LinearGradient colors={halo.colors} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {outcome === 'draw'
        ? <Txt variant="moment" align="center">{title}</Txt>
        : <Txt variant="display" color={color} align="center" style={styles.upper}>{title}</Txt>}
      {outcome === 'defeat' ? <View style={styles.rule} /> : null}
      {subtitle ? <Txt variant="body" color={COLOR.text.secondary} align="center">{subtitle}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.screenX, overflow: 'hidden' },
  upper: { textTransform: 'uppercase' },
  rule: { width: 48, height: 2, borderRadius: 1, backgroundColor: COLOR.accent.warm },
});

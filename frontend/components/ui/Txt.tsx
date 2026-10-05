import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import { TYPO, TYPO_COLOR, TypoVariant } from '../../theme/tokens';

type Props = TextProps & {
  variant?: TypoVariant;
  /** Rôle de couleur (COLOR.*). Par défaut : couleur de la variante. */
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
};

// Seul composant de texte des écrans SKILKI : la taille, la police et la graisse viennent
// de la variante. Le grossissement système est plafonné à 1,3 pour protéger les mises en page.
export default function Txt({ variant = 'body', color, align, style, maxFontSizeMultiplier = 1.3, ...rest }: Props) {
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[TYPO[variant], { color: color ?? TYPO_COLOR[variant] }, align ? { textAlign: align } : null, style]}
    />
  );
}

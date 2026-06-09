// Noms de polices chargées via @expo-google-fonts
// Usage : fontFamily: FONTS.display.bold  →  Space Grotesk 700

export const FONTS = {
  // Space Grotesk — UI, titres, scores, gros chiffres
  display: {
    regular:   'SpaceGrotesk_400Regular',
    medium:    'SpaceGrotesk_500Medium',
    semiBold:  'SpaceGrotesk_600SemiBold',
    bold:      'SpaceGrotesk_700Bold',
  },
  // Fraunces italic — titres hero, grandes citations
  editorial: {
    italic:       'Fraunces_400Regular_Italic',
    mediumItalic: 'Fraunces_500Medium_Italic',
  },
  // JetBrains Mono — eyebrows, labels mono, timestamps
  mono: {
    regular: 'JetBrainsMono_400Regular',
    bold:    'JetBrainsMono_700Bold',
  },
} as const;

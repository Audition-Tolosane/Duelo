import React from 'react';
import { View, TextInput, Pressable, StyleSheet, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import Txt from './Txt';
import Icon from './Icon';
import { COLOR, RADII, SIZE, SPACE, BORDER, TYPO } from '../../theme/tokens';

type Props = {
  placeholder: string;
  /** Mode « déclencheur » : champ factice qui ouvre l'écran de recherche. */
  onPressTrigger?: () => void;
  value?: string;
  onChangeText?: (v: string) => void;
  autoFocus?: boolean;
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder'>;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Barre de recherche pleine largeur (48 px), loupe jaune : la recherche doit se voir.
export default function SearchField({ placeholder, onPressTrigger, value, onChangeText, autoFocus, inputProps, testID, style }: Props) {
  const icon = <Icon name="search" size={20} color={COLOR.action.primary} />;
  if (onPressTrigger) {
    return (
      <Pressable testID={testID} onPress={onPressTrigger} accessibilityRole="search" style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}>
        {icon}
        <Txt variant="body" color={COLOR.text.tertiary} numberOfLines={1}>{placeholder}</Txt>
      </Pressable>
    );
  }
  return (
    <View style={[styles.base, style]}>
      {icon}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLOR.text.tertiary}
        autoFocus={autoFocus}
        selectionColor={COLOR.action.primary}
        returnKeyType="search"
        maxFontSizeMultiplier={1.3}
        style={styles.input}
        {...inputProps}
      />
      {value ? (
        <Pressable onPress={() => onChangeText?.('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="clear">
          <Icon name="close" size={18} color={COLOR.text.tertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: SIZE.input,
    borderRadius: RADII.md,
    backgroundColor: COLOR.surface.input,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
  },
  pressed: { backgroundColor: COLOR.surface.elevated },
  // Le champ occupe toute la hauteur de la barre : un toucher n'importe où donne le focus
  input: { flex: 1, alignSelf: 'stretch', ...TYPO.body, color: COLOR.text.primary, paddingVertical: 0 },
});

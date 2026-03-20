import React from 'react';
import { render } from '@testing-library/react-native';
import CategoryIcon from '../components/CategoryIcon';

// Mock the icon libraries — they render native components that won't work in tests
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name, size, color, ...rest }: any) => (
      <Text {...rest} testID={`mci-${name}`}>{name}</Text>
    ),
    Ionicons: ({ name, size, color, ...rest }: any) => (
      <Text {...rest} testID={`ion-${name}`}>{name}</Text>
    ),
    FontAwesome5: ({ name, size, color, ...rest }: any) => (
      <Text {...rest} testID={`fa5-${name}`}>{name}</Text>
    ),
  };
});

describe('CategoryIcon', () => {
  it('renders an MCI icon for a known super-category emoji', () => {
    const { getByTestId } = render(
      <CategoryIcon emoji="🎬" size={24} color="#fff" type="super" />
    );
    expect(getByTestId('mci-filmstrip')).toBeTruthy();
  });

  it('renders an Ionicons icon for the football emoji', () => {
    const { getByTestId } = render(
      <CategoryIcon emoji="⚽" size={24} color="#fff" type="super" />
    );
    expect(getByTestId('ion-football')).toBeTruthy();
  });

  it('renders cluster icon when type is cluster', () => {
    const { getByTestId } = render(
      <CategoryIcon emoji="📺" size={24} color="#fff" type="cluster" />
    );
    expect(getByTestId('mci-television-classic')).toBeTruthy();
  });

  it('renders the correct icon for a themeId lookup', () => {
    const { getByTestId } = render(
      <CategoryIcon themeId="CIN_STAR" size={24} color="#fff" />
    );
    expect(getByTestId('mci-star-four-points')).toBeTruthy();
  });

  it('falls back to rendering the emoji text for unknown emojis', () => {
    const { getByText } = render(
      <CategoryIcon emoji="🦄" size={24} color="#fff" type="super" />
    );
    expect(getByText('🦄')).toBeTruthy();
  });

  it('returns null when no emoji and no themeId are provided', () => {
    const { toJSON } = render(
      <CategoryIcon size={24} color="#fff" />
    );
    expect(toJSON()).toBeNull();
  });
});

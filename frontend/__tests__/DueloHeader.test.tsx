import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DueloHeader from '../components/DueloHeader';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

// Mock the WebSocket context
jest.mock('../contexts/WebSocketContext', () => ({
  useWS: () => ({ unreadMessages: 0, unreadNotifs: 0 }),
}));

// Mock the theme
jest.mock('../theme/glassTheme', () => ({
  GLASS: {
    bgDark: '#000',
    borderCyan: '#0ff',
  },
}));

// Mock image requires
jest.mock('../assets/header/search.webp', () => 'search-icon');
jest.mock('../assets/header/message.webp', () => 'message-icon');
jest.mock('../assets/header/notification.webp', () => 'notification-icon');
jest.mock('../assets/header/duelo_logo.webp', () => 'duelo-logo');

describe('DueloHeader', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders four Image components (search, logo, message, notification)', () => {
    const { UNSAFE_getAllByType } = render(<DueloHeader />);
    const { Image } = require('react-native');
    const images = UNSAFE_getAllByType(Image);
    expect(images.length).toBe(4);
  });

  it('navigates to /search when search button is pressed', () => {
    const { UNSAFE_getAllByType } = render(<DueloHeader />);
    const { TouchableOpacity } = require('react-native');
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    // First touchable is search
    fireEvent.press(buttons[0]);
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('navigates to /conversations when message button is pressed', () => {
    const { UNSAFE_getAllByType } = render(<DueloHeader />);
    const { TouchableOpacity } = require('react-native');
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    // Second touchable is messages
    fireEvent.press(buttons[1]);
    expect(mockPush).toHaveBeenCalledWith('/conversations');
  });

  it('navigates to /notifications when notification button is pressed', () => {
    const { UNSAFE_getAllByType } = render(<DueloHeader />);
    const { TouchableOpacity } = require('react-native');
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    // Third touchable is notifications
    fireEvent.press(buttons[2]);
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });
});

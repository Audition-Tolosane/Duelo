import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import DueloHeader from '../components/DueloHeader';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

// Mock the WebSocket context
jest.mock('../contexts/WebSocketContext', () => ({
  useWS: () => ({ unreadMessages: 0, unreadNotifs: 0 }),
}));

// En-tête SKILKI : logotype typographique + 4 actions (recherche, boutique, messages, notifications).
describe('DueloHeader', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('affiche le logotype SKILKI et les quatre actions', async () => {
    await render(<DueloHeader />);
    expect(screen.getByLabelText('SKILKI')).toBeTruthy();
    ['header-search', 'header-shop', 'header-messages', 'header-notifications'].forEach((id) =>
      expect(screen.getByTestId(id)).toBeTruthy()
    );
  });

  it.each([
    ['header-search', '/search'],
    ['header-shop', '/shop'],
    ['header-messages', '/conversations'],
    ['header-notifications', '/notifications'],
  ])('%s navigue vers %s', async (testID, path) => {
    await render(<DueloHeader />);
    await fireEvent.press(screen.getByTestId(testID));
    expect(mockPush).toHaveBeenCalledWith(path);
  });
});

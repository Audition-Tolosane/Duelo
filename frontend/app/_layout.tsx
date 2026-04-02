import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Platform, LogBox } from 'react-native';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SwipeBackProvider } from '../components/SwipeBackContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import RematchModal from '../components/RematchModal';
import ChallengeReadyModal from '../components/ChallengeReadyModal';

// All stack pages that support swipe-back with transparent overlay
const SWIPEABLE_SCREENS = [
  'search', 'conversations', 'notifications',
  'chat', 'player-profile', 'category-detail',
  'results', 'matchmaking', 'game',
  'super-category', 'notification-settings', 'leaderboard',
  'language-settings', 'terms', 'support', 'create-theme',
  'challenge-waiting',
];

// Platform-specific options for swipeable screens
const swipeableScreenOptions = {
  headerShown: false,
  presentation: 'transparentModal' as const,
  // On native: use native slide animation for entry; on web: SwipeBackPage handles it
  animation: Platform.OS === 'web' ? ('none' as const) : ('slide_from_right' as const),
  contentStyle: { backgroundColor: 'transparent' },
  gestureEnabled: false, // We handle gestures ourselves via SwipeBackPage
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <WebSocketProvider>
      <ErrorBoundary>
      <RematchModal />
      <ChallengeReadyModal />
      <SwipeBackProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#050510' },
            animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
            animationDuration: 300,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="admin" options={{ headerShown: false, animation: 'slide_from_bottom', contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
          {SWIPEABLE_SCREENS.map((name) => (
            <Stack.Screen key={name} name={name} options={swipeableScreenOptions} />
          ))}
        </Stack>
      </SwipeBackProvider>
      </ErrorBoundary>
      </WebSocketProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050510',
  },
});

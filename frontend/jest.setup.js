// Stockage local simulé pour tous les tests (le module natif n'existe pas sous Jest).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Reanimated (et son moteur de worklets) n'a pas de module natif sous Jest : on utilise son mock officiel.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

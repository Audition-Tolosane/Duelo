// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Fix: expo-font uses "exports" field with "default" condition.
// Expo's default config sets unstable_conditionNames:[] which prevents
// Metro from matching the "default" condition in package exports maps.
config.resolver.unstable_conditionNames = ['require', 'default'];

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;

// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Fix: expo-font uses "exports" field with "default" condition.
// Expo's default config sets unstable_conditionNames:[] which prevents
// Metro from matching the "default" condition in package exports maps.
config.resolver.unstable_conditionNames = ['require', 'default'];

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;

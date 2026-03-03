// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add missing extensions that 'uuid' (a Mixpanel dependency) relies on
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;

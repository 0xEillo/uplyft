// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs', 'cjs');

// uuid v9 inside mixpanel-react-native lists "import" before "react-native" in
// its package.json exports, so Metro (correctly, per spec) picks wrapper.mjs.
// That file does `import uuid from './dist/index.js'` — a default import from a
// CJS module that has __esModule:true but no .default, landing on undefined.
// Fix: strip the "import" condition for any resolution originating inside
// mixpanel-react-native so Metro falls through to "require" → dist/index.js.
// Pattern from facebook/metro#1278.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath.includes('mixpanel-react-native')) {
    return context.resolveRequest(
      {
        ...context,
        unstable_conditionNames: (
          config.resolver.unstable_conditionNames ?? ['require', 'import']
        ).filter((c) => c !== 'import'),
      },
      moduleName,
      platform
    );
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

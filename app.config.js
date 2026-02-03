/* eslint-env node */
const path = require('path')
const dotenv = require('dotenv')

const buildProfile =
  process.env.APP_ENV ||
  process.env.EAS_BUILD_PROFILE ||
  process.env.NODE_ENV ||
  'production'

const envFilesByProfile = {
  development: ['.env.test', '.env'],
  staging: ['.env.staging', '.env'],
  production: ['.env'],
}

const envFiles = envFilesByProfile[buildProfile] || ['.env']

envFiles
  .map((file) => path.resolve(process.cwd(), file))
  .forEach((filePath, index) => {
    dotenv.config({
      path: filePath,
      override: index === 0,
    })
  })

const appEnv = process.env.APP_ENV || 'production'
const revenueCatUseTestStoreEnv = process.env.REVENUECAT_USE_TEST_STORE

const supabaseUrl =
  appEnv === 'production'
    ? process.env.EXPO_PUBLIC_SUPABASE_URL
    : process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL

const supabaseAnonKey =
  appEnv === 'production'
    ? process.env.EXPO_PUBLIC_SUPABASE_KEY
    : process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL. Check your environment variables.')
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing Supabase anon key. Check your environment variables.',
  )
}

// Facebook SDK config (optional - only include if env vars are set)
const facebookAppId = process.env.FACEBOOK_APP_ID
const facebookClientToken = process.env.FACEBOOK_CLIENT_TOKEN
const facebookPluginConfig =
  facebookAppId && facebookClientToken
    ? [
        'react-native-fbsdk-next',
        {
          appID: facebookAppId,
          clientToken: facebookClientToken,
          displayName: 'Rep AI',
          scheme: `fb${facebookAppId}`,
          // IMPORTANT: Disable auto-tracking until ATT consent is granted
          advertiserIDCollectionEnabled: false,
          autoLogAppEventsEnabled: false,
          isAutoInitEnabled: false,
          iosUserTrackingPermission:
            'This identifier will be used to deliver personalized ads to you.',
        },
      ]
    : null

module.exports = {
  expo: {
    name: 'Rep AI',
    slug: 'repai',
    version: '1.0.16',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'repai',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSMicrophoneUsageDescription:
          'This app needs access to your microphone to record workout notes via voice.',
        NSCameraUsageDescription:
          'This app needs access to your camera to take photos of your workout notes.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to your photo library to select workout images.',
        NSUserNotificationsUsageDescription:
          'This app needs permission to send you reminders about your trial expiration.',
        // SKAdNetwork identifiers for Meta/Facebook attribution (required for iOS 14+)
        SKAdNetworkItems: [
          { SKAdNetworkIdentifier: 'v9wttpbfk9.skadnetwork' }, // Facebook
          { SKAdNetworkIdentifier: 'n38lu8286q.skadnetwork' }, // Facebook
          { SKAdNetworkIdentifier: '22mmun2rn5.skadnetwork' }, // Google
          { SKAdNetworkIdentifier: '4fzdc2evr5.skadnetwork' }, // Google
          { SKAdNetworkIdentifier: 'su67r6k2v3.skadnetwork' }, // TikTok
          { SKAdNetworkIdentifier: 'yclnxrl5pm.skadnetwork' }, // Snap
        ],
      },
      bundleIdentifier: 'com.viralstudio.repai',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      windowSoftInputMode: 'adjustPan',
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'RECORD_AUDIO',
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'POST_NOTIFICATIONS',
      ],
      package: 'com.viralstudio.repai',
    },
    updates: {
      url: 'https://u.expo.dev/d92cf9e6-0901-4a68-9f50-741decd5c10f',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    web: {
      output: 'server',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-audio',
      [
        'expo-updates',
        {
          username: 'oliver-ry',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/logo-transparent.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            image: './assets/images/logo-transparent.png',
            backgroundColor: '#000000',
          },
        },
      ],
      'expo-localization',
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#ffffff',
          sounds: [],
        },
      ],
      [
        'expo-tracking-transparency',
        {
          userTrackingPermission:
            'This identifier will be used to deliver personalized ads to you.',
        },
      ],
      // Facebook SDK - only included when env vars are configured
      ...(facebookPluginConfig ? [facebookPluginConfig] : []),
      // Override Live Activity Swift UI (lock screen + Dynamic Island)
      './plugins/with-custom-live-activity',
      // Live Activity for Dynamic Island workout timer (iOS only)
      ['expo-live-activity', { enablePushNotifications: true }],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appEnv,
      supabaseUrl,
      supabaseAnonKey,
      router: {},
      eas: {
        projectId: 'd92cf9e6-0901-4a68-9f50-741decd5c10f',
      },
      posthogApiKey: process.env.POSTHOG_API_KEY,
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      revenueCatAppleApiKey: process.env.REVENUECAT_APPLE_API_KEY,
      revenueCatGoogleApiKey: process.env.REVENUECAT_GOOGLE_API_KEY,
      revenueCatTestStoreKey: process.env.REVENUECAT_TEST_STORE_KEY,
      revenueCatUseTestStore:
        revenueCatUseTestStoreEnv === 'true'
          ? true
          : revenueCatUseTestStoreEnv === 'false'
          ? false
          : undefined,
    },
  },
}

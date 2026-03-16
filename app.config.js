/* eslint-env node */
const path = require('path')
const dotenv = require('dotenv')

const buildProfile =
  process.env.APP_ENV ||
  process.env.EAS_BUILD_PROFILE ||
  process.env.NODE_ENV ||
  'production'

const isProductionBuild = buildProfile === 'production'

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
const allowRevenueCatTestStore =
  buildProfile !== 'production' && revenueCatUseTestStoreEnv === 'true'

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
          // Keep automatic app events enabled for install/open attribution.
          // Advertiser tracking/ID collection still stays gated at runtime on iOS.
          advertiserIDCollectionEnabled: false,
          autoLogAppEventsEnabled: true,
          isAutoInitEnabled: false,
          iosUserTrackingPermission:
            'This identifier will be used to deliver personalized ads to you.',
        },
      ]
    : null

const appLinkHosts = isProductionBuild
  ? ['repaifit.app', 'www.repaifit.app']
  : []

const appLinkAssociatedDomains = appLinkHosts.map((host) => `applinks:${host}`)

const appLinkIntentFilters = appLinkHosts.map((host) => ({
  action: 'VIEW',
  autoVerify: true,
  data: [
    {
      scheme: 'https',
      host,
      pathPrefix: '/',
    },
  ],
  category: ['BROWSABLE', 'DEFAULT'],
}))

const { version: appVersion } = require('./package.json')

module.exports = {
  expo: {
    name: 'Rep AI',
    slug: 'repai',
    version: appVersion,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'repai',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: false,
      usesAppleSignIn: true,
      associatedDomains: appLinkAssociatedDomains,
      infoPlist: {
        LSApplicationQueriesSchemes: ['whatsapp', 'twitter', 'fb-messenger', 'fb', 'fbapi', 'fbauth2', 'fbshareextension'],
        ITSAppUsesNonExemptEncryption: false,
        NSMicrophoneUsageDescription:
          'This app needs access to your microphone to record workout notes via voice.',
        NSCameraUsageDescription:
          'This app needs access to your camera to take photos of your workout notes.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to your photo library to select workout images.',
        NSUserNotificationsUsageDescription:
          'This app needs permission to alert you when your rest timer ends and to send workout reminders.',
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
      intentFilters: appLinkIntentFilters,
      package: 'com.viralstudio.repai',
    },
    updates: {
      url: 'https://u.expo.dev/d92cf9e6-0901-4a68-9f50-741decd5c10f',
      enableBsdiffPatchSupport: true,
    },
    runtimeVersion: appVersion,
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      '@react-native-community/datetimepicker',
      'expo-audio',
      'expo-font',
      'expo-image',
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
          sounds: ['./assets/sounds/stopwatch.mp3'],
        },
      ],
      'expo-sharing',
      'expo-web-browser',
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
      revenueCatAppleApiKey: process.env.REVENUECAT_APPLE_API_KEY,
      revenueCatGoogleApiKey: process.env.REVENUECAT_GOOGLE_API_KEY,
      revenueCatTestStoreKey: allowRevenueCatTestStore
        ? process.env.REVENUECAT_TEST_STORE_KEY
        : undefined,
      revenueCatUseTestStore: allowRevenueCatTestStore ? true : false,
    },
  },
}

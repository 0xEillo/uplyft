require('dotenv').config()

const revenueCatUseTestStoreEnv = process.env.REVENUECAT_USE_TEST_STORE

module.exports = {
  expo: {
    name: 'Rep AI',
    slug: 'repai',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'repai',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
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
    web: {
      output: 'server',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
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
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
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

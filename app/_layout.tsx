import { getColors } from '@/constants/colors'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native'
import Constants from 'expo-constants'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { PostHogProvider } from 'posthog-react-native'
import { useEffect, useRef } from 'react'
import { Platform, UIManager } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { LoadingScreen } from '@/components/loading-screen'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { AnalyticsProvider, useAnalytics } from '@/contexts/analytics-context'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { PostsProvider } from '@/contexts/posts-context'
import { ProfileProvider } from '@/contexts/profile-context'
import { SubscriptionProvider } from '@/contexts/subscription-context'
import { ThemeProvider, useTheme } from '@/contexts/theme-context'
import { TutorialProvider } from '@/contexts/tutorial-context'
import { UnitProvider } from '@/contexts/unit-context'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import {
  initializeFacebookSDK,
  requestTrackingPermission,
} from '@/lib/facebook-sdk'
import { exerciseLookup } from '@/lib/services/exerciseLookup'

// Set global refresh control tint color for iOS
if (Platform.OS === 'ios') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
  }
}

// Initialize Facebook SDK early
initializeFacebookSDK()

// Custom navigation themes with our app colors
const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: getColors(false).background,
    card: getColors(false).backgroundWhite,
  },
}

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: getColors(true).background,
    card: getColors(true).backgroundWhite,
  },
}

function RootLayoutNav() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const { isDark } = useTheme()
  const { trackEvent } = useAnalytics()

  // Initialize push notifications
  usePushNotifications()

  // Pre-load exercise cache for faster lookups throughout the app
  useEffect(() => {
    exerciseLookup.initialize().catch((err) => {
      console.warn('[RootLayout] Failed to initialize exercise lookup:', err)
    })
  }, [])

  // Request ATT permission once when user is authenticated and enters main app
  // We use a ref to store the timer so it doesn't get cancelled on segment changes
  const hasRequestedTracking = useRef(false)
  const attTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  useEffect(() => {
    const inMainApp = segments[0] === '(tabs)'
    const isAuthenticated = !!user
    
    // Only request ATT when user is authenticated and in the main app
    // This prevents the timer from being set during the initial redirect dance
    if (inMainApp && isAuthenticated && !isLoading && !hasRequestedTracking.current) {
      hasRequestedTracking.current = true
      // Small delay so it doesn't feel jarring
      attTimerRef.current = setTimeout(() => {
        requestTrackingPermission()
      }, 1000)
    }
    
    // Only cleanup on unmount, not on every segment change
    return () => {
      // Don't clear the timer - we want it to fire even if user briefly navigates
    }
  }, [segments, isLoading, user])

  const hasTrackedAppOpen = useRef(false)

  useEffect(() => {
    // Track initial app open once per session
    if (!hasTrackedAppOpen.current) {
      trackEvent(AnalyticsEvents.APP_OPEN, {
        timestamp: Date.now(),
        segment: segments[0] ?? 'unknown',
      })
      hasTrackedAppOpen.current = true
    }
  }, [trackEvent, segments])

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const authRoute = segments[1] as string | undefined
    // Allow authenticated users (including anonymous) to stay on signup-options and trial-offer
    const allowedPostSignupRoutes = [
      'signup-options',
      'trial-offer',
      'create-account',
    ]

    if (!user && !inAuthGroup) {
      // Redirect to welcome screen if not authenticated (no session at all)
      router.replace('/(auth)/welcome')
    } else if (
      user &&
      inAuthGroup &&
      !allowedPostSignupRoutes.includes(authRoute || '')
    ) {
      // Redirect to app if authenticated (including anonymous users), unless on post-signup routes
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading, router])

  return (
    <>
      <NavigationThemeProvider
        value={isDark ? CustomDarkTheme : CustomLightTheme}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="strength-stats"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="volume-stats"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="workout-calendar"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="notifications"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="routine/[routineId]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="search"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="explore"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="routines"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="explore/program/[programId]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="create-exercise"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="select-exercise"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="user/[userId]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="workout/[workoutId]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="exercise/[exerciseId]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="workout-comments/[workoutId]"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="(stand-alone)/create-routine"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="(stand-alone)/edit-workout/[workoutId]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="body-log/index"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="body-log/[entryId]"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="body-log/capture"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              gestureEnabled: false,
            }}
          />
        </Stack>
      </NavigationThemeProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isLoading && <LoadingScreen />}
    </>
  )
}

function ThemedRootView({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {children}
    </GestureHandlerRootView>
  )
}

export default function RootLayout() {
  const posthogApiKey =
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY ||
    (Constants.expoConfig?.extra?.posthogApiKey as string | undefined)
  const posthogHost =
    process.env.EXPO_PUBLIC_POSTHOG_HOST ||
    (Constants.expoConfig?.extra?.posthogHost as string | undefined) ||
    'https://us.i.posthog.com'

  return (
    <PostHogProvider
      apiKey={posthogApiKey || ''}
      options={{
        host: posthogHost,
      }}
      autocapture={{
        captureScreens: true,
      }}
    >
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedRootView>
            <UnitProvider>
              <AuthProvider>
                <ProfileProvider>
                  <SubscriptionProvider>
                    <NotificationProvider>
                      <AnalyticsProvider>
                        <TutorialProvider>
                          <PostsProvider>
                            <RootLayoutNav />
                          </PostsProvider>
                        </TutorialProvider>
                      </AnalyticsProvider>
                    </NotificationProvider>
                  </SubscriptionProvider>
                </ProfileProvider>
              </AuthProvider>
            </UnitProvider>
          </ThemedRootView>
        </ThemeProvider>
      </SafeAreaProvider>
    </PostHogProvider>
  )
}

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native'
import Constants from 'expo-constants'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { PostHogProvider } from 'posthog-react-native'
import { useEffect, useRef } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { LoadingScreen } from '@/components/loading-screen'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { AnalyticsProvider, useAnalytics } from '@/contexts/analytics-context'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { PostsProvider } from '@/contexts/posts-context'
import { SubscriptionProvider } from '@/contexts/subscription-context'
import { ThemeProvider, useTheme } from '@/contexts/theme-context'
import { UnitProvider } from '@/contexts/unit-context'

function RootLayoutNav() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const { isDark } = useTheme()
  const { trackEvent } = useAnalytics()

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
    // Allow authenticated users to stay on signup-options and trial-offer
    const allowedPostSignupRoutes = ['signup-options', 'trial-offer']

    if (!user && !inAuthGroup) {
      // Redirect to welcome screen if not authenticated
      router.replace('/(auth)/welcome')
    } else if (
      user &&
      inAuthGroup &&
      !allowedPostSignupRoutes.includes(authRoute || '')
    ) {
      // Redirect to app if authenticated, unless on post-signup routes
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading, router])

  return (
    <>
      <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Slot />
      </NavigationThemeProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isLoading && <LoadingScreen />}
    </>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            <UnitProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <NotificationProvider>
                    <AnalyticsProvider>
                      <PostsProvider>
                        <RootLayoutNav />
                      </PostsProvider>
                    </AnalyticsProvider>
                  </NotificationProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </UnitProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  )
}

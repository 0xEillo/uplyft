import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native'
import Constants from 'expo-constants'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { PostHogProvider } from 'posthog-react-native'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AnalyticsProvider, useAnalytics } from '@/contexts/analytics-context'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
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

  useEffect(() => {
    // Track initial app open once when layout mounts
    trackEvent('App Open', {
      timestamp: Date.now(),
      segment: segments[0] ?? 'unknown',
    })
  }, [trackEvent, segments])

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) {
      // Redirect to welcome screen if not authenticated
      router.replace('/(auth)/welcome')
    } else if (user && inAuthGroup) {
      // Redirect to app if authenticated
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading, router])

  return (
    <>
      <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Slot />
      </NavigationThemeProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
                  <AnalyticsProvider>
                    <PostsProvider>
                      <RootLayoutNav />
                    </PostsProvider>
                  </AnalyticsProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </UnitProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  )
}

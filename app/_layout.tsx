import { getColors } from '@/constants/colors'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native'
import Constants from 'expo-constants'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useRef } from 'react'
import { Appearance, AppState, Platform, UIManager } from 'react-native'
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
import { initializeFacebookSDK } from '@/lib/facebook-sdk'
import { consumePendingInvite } from '@/lib/deeplinknow'
import { stopMusicPreview } from '@/lib/music-preview-player'
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
    background: getColors(false).bg,
    card: getColors(false).surface,
  },
}

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: getColors(true).bg,
    card: getColors(true).surface,
  },
}

function RootLayoutNav() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const { isDark } = useTheme()
  const { trackEvent } = useAnalytics()
  const lastRouteKey = useRef('')
  const lastInviteResolutionUserRef = useRef<string | null>(null)

  // Initialize push notifications
  usePushNotifications()

  const navigationBackground = isDark
    ? CustomDarkTheme.colors.background
    : CustomLightTheme.colors.background

  const sheetCornerRadius = -1
  const transparentModalFallback = {
    presentation: 'transparentModal' as const,
    animation: 'none' as const,
    contentStyle: { backgroundColor: 'transparent' },
    headerShown: false,
  }
  const getNativeFormSheetOptions = (sheetAllowedDetents: [number, number]) =>
    Platform.OS === 'ios'
      ? {
          presentation: 'formSheet' as const,
          headerShown: false,
          contentStyle: {
            backgroundColor: 'transparent',
            height: '100%' as const,
          },
          sheetAllowedDetents,
          sheetGrabberVisible: true,
          sheetInitialDetentIndex: 0,
          sheetCornerRadius,
          sheetExpandsWhenScrolledToEdge: false,
          sheetLargestUndimmedDetentIndex: 1,
          scrollEdgeEffects: {
            top: 'hidden' as const,
            bottom: 'hidden' as const,
            left: 'hidden' as const,
            right: 'hidden' as const,
          },
        }
      : transparentModalFallback

  // Pre-load exercise cache for faster lookups throughout the app
  useEffect(() => {
    exerciseLookup.initialize().catch((err) => {
      console.warn('[RootLayout] Failed to initialize exercise lookup:', err)
    })
  }, [])

  // ATT permission is requested during the onboarding plan-preparation loading step
  // See app/(auth)/onboarding.tsx - this keeps attribution setup before signup/purchase events

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
    const nextKey = segments.join('/')
    if (lastRouteKey.current && lastRouteKey.current !== nextKey) {
      void stopMusicPreview()
    }
    lastRouteKey.current = nextKey
  }, [segments])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void stopMusicPreview()
      }
    })

    return () => {
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    // Keep native UIKit/theme sampling in sync with app-level theme to prevent white flash on transitions.
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Appearance.setColorScheme(isDark ? 'dark' : 'light')
      void SystemUI.setBackgroundColorAsync(navigationBackground)
    }
  }, [isDark, navigationBackground])

  useEffect(() => {
    if (isLoading) return

    const firstSegment = segments[0] as string | undefined
    const inAuthGroup = firstSegment === '(auth)'
    const isInviteRoute = firstSegment === 'invite'
    const authRoute = segments[1] as string | undefined
    // Allow authenticated users (including anonymous) to stay on signup-options and trial-offer
    const allowedPostSignupRoutes = [
      'signup-options',
      'trial-offer',
      'create-account',
      'signup-email',
      'signup-password',
    ]

    if (!user && !inAuthGroup && !isInviteRoute) {
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

  useEffect(() => {
    if (!user?.id) {
      lastInviteResolutionUserRef.current = null
    }
  }, [user?.id])

  useEffect(() => {
    if (isLoading || !user?.id) return
    if (lastInviteResolutionUserRef.current === user.id) return

    lastInviteResolutionUserRef.current = user.id
    let cancelled = false

    const resolvePendingInvite = async () => {
      const invite = await consumePendingInvite()
      if (!invite || cancelled) return
      if (invite.inviterId === user.id) return

      router.replace({
        pathname: '/user/[userId]',
        params: {
          userId: invite.inviterId,
        },
      })
    }

    resolvePendingInvite().catch((error) => {
      console.warn('[Invite] Failed to resolve pending invite:', error)
    })

    return () => {
      cancelled = true
    }
  }, [isLoading, router, user?.id])

  return (
    <>
      <NavigationThemeProvider
        value={isDark ? CustomDarkTheme : CustomLightTheme}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: navigationBackground },
          }}
        >
          <Stack.Screen
            name="strength-stats"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="volume-stats"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="workout-calendar"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="notifications"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="notification-settings"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="routine/[routineId]"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="search"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="invite"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="explore"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="routines"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="explore/program/[programId]"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="create-exercise"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="select-exercise"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="user/[userId]"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="compare/[userId]"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="workout/[workoutId]"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="exercise/[exerciseId]"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="workout-comments/[workoutId]"
            options={{
              headerShown: false,
              presentation: 'card',
              animation: 'default',
            }}
          />
          <Stack.Screen
            name="(stand-alone)/create-routine"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="(stand-alone)/edit-workout/[workoutId]"
            options={{ presentation: 'card', animation: 'default' }}
          />
          <Stack.Screen
            name="body-log/index"
            options={{
              presentation: 'card',
              animation: 'default',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="body-log/[entryId]"
            options={{
              presentation: 'card',
              animation: 'default',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="body-log/daily-food-log"
            options={{
              presentation: 'card',
              animation: 'default',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="body-log/capture"
            options={{
              presentation: 'card',
              animation: 'default',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="body-log/scan"
            options={{
              presentation: 'card',
              animation: 'default',
              gestureEnabled: false,
            }}
          />
          {/* Native Bottom Sheets - using formSheet for 100% native sheet presentation */}
          <Stack.Screen
            name="chat-attachment"
            options={getNativeFormSheetOptions([0.55, 0.85])}
          />
          <Stack.Screen
            name="recovery-detail"
            options={getNativeFormSheetOptions([0.72, 0.95])}
          />
          <Stack.Screen
            name="lifter-level-info"
            options={getNativeFormSheetOptions([0.5, 0.75])}
          />
          <Stack.Screen
            name="muscle-group-detail"
            options={getNativeFormSheetOptions([0.72, 1.0])}
          />
          <Stack.Screen
            name="daily-macros-detail"
            options={getNativeFormSheetOptions([0.6, 0.95])}
          />
          <Stack.Screen
            name="chat-settings"
            options={
              Platform.OS === 'ios'
                ? {
                    ...getNativeFormSheetOptions([0.72, 0.95]),
                    sheetInitialDetentIndex: 1,
                  }
                : transparentModalFallback
            }
          />
          <Stack.Screen
            name="post-paywall-signup"
            options={getNativeFormSheetOptions([0.48, 0.75])}
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      {children}
    </GestureHandlerRootView>
  )
}

export default function RootLayout() {


  return (
    
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
    
  )
}

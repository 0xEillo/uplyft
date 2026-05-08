import { Paywall } from '@/components/paywall'
import { RatingPromptModal } from '@/components/rating-prompt-modal'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PostWorkoutCelebration } from '@/components/post-workout-celebration'
import { useAuth } from '@/contexts/auth-context'
import { RatingPromptProvider } from '@/contexts/rating-prompt-context'
import {
  useRestTimerContext,
} from '@/contexts/rest-timer-context'
import {
  ScrollToTopProvider,
  useScrollToTop,
} from '@/contexts/scroll-to-top-context'
import { useSubscription } from '@/contexts/subscription-context'
import {
  SuccessOverlayProvider,
  useSuccessOverlay,
} from '@/contexts/success-overlay-context'
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from '@/contexts/tab-bar-visibility-context'
import { useTheme } from '@/contexts/theme-context'
import { useWorkoutComposer } from '@/contexts/workout-composer-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useFeatureGate } from '@/utils/analytics-helpers'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useSegments } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import React, { useEffect, useState } from 'react'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Alert,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

const MINIMIZE_ON_SCROLL_TABS = new Set(['index', 'analytics', 'profile'])

// Re-prompt the freemium paywall at most once every PAYWALL_COOLDOWN_MS for
// non-Pro users. 3 days is a fairly standard cadence for SaaS freemium apps —
// frequent enough to remain top of mind without feeling spammy.
const PAYWALL_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000
const PAYWALL_LAST_SHOWN_KEY = '@paywall_last_shown'

function formatAccessoryElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  if (safeSeconds < 60) return `${safeSeconds}s`

  if (safeSeconds < 3600) {
    const mins = Math.floor(safeSeconds / 60)
    const secs = safeSeconds % 60
    return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`
  }

  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}

function TabLayoutContent() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const segments = useSegments()
  const router = useRouter()
  const { scrollToTop } = useScrollToTop()
  const {
    isCelebrationVisible,
    celebrationData,
    hideCelebration,
  } = useSuccessOverlay()
  const { isProMember, isLoading: isSubscriptionLoading } = useSubscription()
  const {
    isActive: isRestTimerActive,
    stop: stopRestTimer,
  } = useRestTimerContext()
  const {
    discardSession,
    elapsedSeconds: workoutElapsedSeconds,
    hasActiveSession,
  } = useWorkoutComposer()
  const { isAnonymous } = useAuth()
  const { trackPaywallShown, trackPaywallDismissed } = useFeatureGate()
  const [delayedShowPaywall, setDelayedShowPaywall] = useState(false)
  const [hasDismissedPaywall, setHasDismissedPaywall] = useState(false)
  const [hasShownSignUpPrompt, setHasShownSignUpPrompt] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    if (!isSubscriptionLoading && !isProMember) {
      ;(async () => {
        let shouldShow = true
        try {
          const stored = await AsyncStorage.getItem(PAYWALL_LAST_SHOWN_KEY)
          const lastShown = stored ? Number.parseInt(stored, 10) : 0
          if (Number.isFinite(lastShown) && lastShown > 0) {
            shouldShow = Date.now() - lastShown >= PAYWALL_COOLDOWN_MS
          }
        } catch {
          // If storage fails, fall through and show — we'd rather over-prompt
          // than silently never re-engage a user.
        }
        if (cancelled || !shouldShow) return

        timer = setTimeout(() => {
          setDelayedShowPaywall(true)
          trackPaywallShown('global_paywall', 'app_launch')
          AsyncStorage.setItem(
            PAYWALL_LAST_SHOWN_KEY,
            String(Date.now()),
          ).catch(() => {})
        }, 1000)
      })()
    } else {
      setDelayedShowPaywall(false)
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [isSubscriptionLoading, isProMember])

  // Prompt paid guest users to create an account after the paywall flow.
  // Dismissable: users can close and continue using the app as guest.
  useEffect(() => {
    if (
      isSubscriptionLoading ||
      !isProMember ||
      !isAnonymous ||
      hasShownSignUpPrompt
    ) {
      return
    }

    const timer = setTimeout(() => {
      router.push('/post-paywall-signup')
      setHasShownSignUpPrompt(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [
    hasShownSignUpPrompt,
    isAnonymous,
    isProMember,
    isSubscriptionLoading,
    router,
  ])

  // Freemium paywall: shown on launch for non-pro users, but dismissable.
  // Specific premium features will gate themselves separately.
  const showGlobalPaywall =
    delayedShowPaywall && !isProMember && !hasDismissedPaywall


  const tabBarVisibility = useTabBarVisibility()
  const hideForFullscreenOverlay =
    tabBarVisibility?.hideForFullscreenOverlay ?? false
  const currentTab = (segments[1] as string | undefined) ?? 'index'
  const isTabBarHidden =
    hideForFullscreenOverlay ||
    currentTab === 'create-speech'
  const isIOS26OrNewer =
    Platform.OS === 'ios' &&
    Number.parseInt(String(Platform.Version).split('.')[0] ?? '0', 10) >= 26
  const shouldEnableTabBarMinimize =
    isIOS26OrNewer && MINIMIZE_ON_SCROLL_TABS.has(currentTab)
  const tabBarMinimizeBehavior = shouldEnableTabBarMinimize
    ? 'onScrollDown'
    : 'never'
  const isWorkoutLive = isRestTimerActive || hasActiveSession
  const tabsWithWorkoutAccessory = new Set(['index', 'profile'])
  const showBottomAccessory =
    !isTabBarHidden && tabsWithWorkoutAccessory.has(currentTab)
  const bottomAccessoryTitle = isWorkoutLive
    ? `Workout ${formatAccessoryElapsed(workoutElapsedSeconds)}`
    : 'Start New Workout'
  const createActionColor = isWorkoutLive
    ? colors.statusError
    : colors.brandPrimary
  const handleOpenCreatePost = () => router.push('/create-post')
  const handleDiscardWorkoutProgress = () => {
    Alert.alert(
      'Discard workout?',
      'This will clear your current workout progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            stopRestTimer()
            discardSession()
          },
        },
      ],
    )
  }

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NativeTabs
        backBehavior="history"
        hidden={isTabBarHidden}
        minimizeBehavior={tabBarMinimizeBehavior}
        tintColor={colors.brandPrimary}
        iconColor={colors.textSecondary}
        backgroundColor={
          isDark ? 'rgba(17, 17, 17, 0.38)' : 'rgba(255, 255, 255, 0.56)'
        }
        blurEffect={
          isDark
            ? 'systemUltraThinMaterialDark'
            : 'systemUltraThinMaterialLight'
        }
        labelStyle={{
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: '600',
        }}
      >
        <NativeTabs.Trigger
          name="index"
          listeners={{
            tabPress: () => {
              if (currentTab === 'index') {
                scrollToTop('index')
              }
            },
          }}
        >
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            md="home"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="analytics">
          <NativeTabs.Trigger.Label>Levels</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
            md="trending_up"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="profile"
          listeners={{
            tabPress: () => {
              if (currentTab === 'profile') {
                scrollToTop('profile')
              }
            },
          }}
        >
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="gemini"
          role="search"
          listeners={{
            tabPress: () => {
              router.push('/chat')
            },
          }}
        >
          <NativeTabs.Trigger.Label hidden>Chat</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/gemini-tab.png')}
            renderingMode="template"
            selectedColor={createActionColor}
          />
        </NativeTabs.Trigger>

      </NativeTabs>

      {showBottomAccessory ? (
        <BlurView
          intensity={isWorkoutLive ? 60 : 0}
          tint={isDark ? 'dark' : 'light'}
          style={{
            position: 'absolute',
            bottom: insets.bottom + 49 + 10,
            left: isWorkoutLive ? 16 : undefined,
            right: 16,
            width: isWorkoutLive ? undefined : 224,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: isWorkoutLive
              ? isDark
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(0, 0, 0, 0.08)'
              : 'rgba(255, 255, 255, 0.22)',
            backgroundColor: isWorkoutLive
              ? isDark
                ? 'rgba(28, 28, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.92)'
              : colors.brandPrimary,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: isWorkoutLive ? (isDark ? 0.28 : 0.14) : 0.18,
            shadowRadius: isWorkoutLive ? 24 : 18,
            shadowOffset: { width: 0, height: isWorkoutLive ? 10 : 8 },
            zIndex: 50,
          }}
        >
          <BaseAccessoryAction
            title={bottomAccessoryTitle}
            textPrimary={isWorkoutLive ? colors.textPrimary : '#fff'}
            accentColor={colors.statusSuccess}
            onOpen={handleOpenCreatePost}
            onDiscard={handleDiscardWorkoutProgress}
            isInline={false}
            isLive={isWorkoutLive}
          />
        </BlurView>
      ) : null}

      <PostWorkoutCelebration
        visible={isCelebrationVisible}
        data={celebrationData}
        onClose={hideCelebration}
      />
      <RatingPromptModal />
      <Paywall
        visible={showGlobalPaywall}
        onClose={() => {
          trackPaywallDismissed('global_paywall', 'app_launch')
          setHasDismissedPaywall(true)
        }}
        title={'Unlock your full potential'}
        message="Start your free trial to access Uplyft"
        feature="global_paywall"
      />
    </>
  )
}

function BaseAccessoryAction({
  title,
  textPrimary,
  accentColor,
  onOpen,
  onDiscard,
  isInline,
  isLive,
}: {
  title: string
  textPrimary: string
  accentColor: string
  onOpen: () => void
  onDiscard: () => void
  isInline: boolean
  isLive: boolean
}) {
  const sideSlotWidth = isLive ? (isInline ? 56 : 68) : 16
  const contentTranslateY = isInline ? 3 : -2

  return (
    <View
      style={{
        width: '100%',
        height: isInline ? 42 : 52,
        paddingHorizontal: isInline ? 10 : 12,
        paddingVertical: 0,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isLive ? 'Resume workout' : 'Start new workout'}
        activeOpacity={0.85}
        onPress={onOpen}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 1,
          justifyContent: 'center',
          transform: [{ translateY: contentTranslateY }],
        }}
      >
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              width: sideSlotWidth,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isLive ? (
              <Ionicons
                name="chevron-up"
                size={isInline ? 16 : 22}
                color={textPrimary}
              />
            ) : null}
          </View>

          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isLive ? 10 : 6,
            }}
          >
            {isLive ? (
              <View
                style={{
                  width: isInline ? 7 : 11,
                  height: isInline ? 7 : 11,
                  borderRadius: 999,
                  backgroundColor: accentColor,
                }}
              />
            ) : (
              <Ionicons
                name="play"
                size={isInline ? 14 : 18}
                color={textPrimary}
              />
            )}
            <Text
              numberOfLines={1}
              style={{
                color: textPrimary,
                fontSize: isInline ? 15 : isLive ? 17 : 15,
                lineHeight: isInline ? 18 : 21,
                fontWeight: '700',
                letterSpacing: -0.2,
                textAlign: 'center',
              }}
            >
              {title}
            </Text>
          </View>

          <View style={{ width: sideSlotWidth }} />
        </View>
      </TouchableOpacity>

      {isLive ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Discard workout"
          activeOpacity={0.85}
          onPress={onDiscard}
          hitSlop={8}
          style={{
            position: 'absolute',
            right: isInline ? 10 : 12,
            top: 0,
            bottom: 0,
            zIndex: 3,
            paddingHorizontal: 6,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateY: contentTranslateY }],
          }}
        >
          <Ionicons
            name="trash-outline"
            size={isInline ? 16 : 22}
            color="#ff5a5f"
          />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export default function TabLayout() {
  return (
    <ScrollToTopProvider>
      <SuccessOverlayProvider>
        <RatingPromptProvider>
          <TabBarVisibilityProvider>
            <TabLayoutContent />
          </TabBarVisibilityProvider>
        </RatingPromptProvider>
      </SuccessOverlayProvider>
    </ScrollToTopProvider>
  )
}

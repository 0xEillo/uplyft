import { Paywall } from '@/components/paywall'
import { RatingPromptModal } from '@/components/rating-prompt-modal'
import { SubmitSuccessOverlay } from '@/components/submit-success-overlay'
import { hasUnreadWelcomeMessage } from '@/components/workout-chat'
import { WorkoutShareScreen } from '@/components/workout-share-screen'
import { useAuth } from '@/contexts/auth-context'
import { LiveActivityProvider } from '@/contexts/live-activity-context'
import {
  RatingPromptProvider,
  useRatingPrompt,
} from '@/contexts/rating-prompt-context'
import {
  RestTimerProvider,
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
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { hasStoredDraft } from '@/lib/utils/workout-draft'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useSegments } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import React, { useEffect, useState } from 'react'
import { Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native'

function TabLayoutContent() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const segments = useSegments()
  const router = useRouter()
  const { scrollToTop } = useScrollToTop()
  const {
    isVisible,
    data,
    hideOverlay,
    showShareScreen,
    setShowShareScreen,
  } = useSuccessOverlay()
  const { weightUnit } = useWeightUnits()
  const { shareWorkout, shareToInstagramStories } = useWorkoutShare()
  const { isVisible: isRatingPromptVisible } = useRatingPrompt()
  const { isProMember, isLoading: isSubscriptionLoading } = useSubscription()
  const { isActive: isRestTimerActive } = useRestTimerContext()
  const { user } = useAuth()
  const [delayedShowPaywall, setDelayedShowPaywall] = useState(false)
  const [hasUnreadChat, setHasUnreadChat] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  // Check for unread welcome message
  useEffect(() => {
    const checkUnread = async () => {
      const hasUnread = await hasUnreadWelcomeMessage(user?.id)
      setHasUnreadChat(hasUnread)
    }
    checkUnread()

    // Re-check periodically in case user reads it
    const interval = setInterval(checkUnread, 2000)
    return () => clearInterval(interval)
  }, [user?.id])

  // Keep create action state in sync with saved draft.
  useEffect(() => {
    const checkDraft = async () => {
      const draftExists = await hasStoredDraft()
      setHasDraft(draftExists)
    }

    checkDraft()
    const interval = setInterval(checkDraft, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isSubscriptionLoading && !isProMember) {
      const timer = setTimeout(() => {
        setDelayedShowPaywall(true)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setDelayedShowPaywall(false)
    }
  }, [isSubscriptionLoading, isProMember])

  // Enforce Hard Paywall
  // Use the delayed state to allow the user to see the app briefly
  const showGlobalPaywall = delayedShowPaywall && !isProMember

  // Track if we've already shown the share screen for this workout
  const shownWorkoutIdRef = React.useRef<string | null>(null)

  // Watch for workout data updates and show share screen when workout is ready
  // IMPORTANT: Don't show share screen while rating prompt is visible to avoid dual-modal freeze
  React.useEffect(() => {
    // If we have workout data and overlay is not visible (animation completed), show share screen
    // Only show once per workout ID
    // CRITICAL: Wait for rating prompt to close first to prevent iOS modal freeze
    if (
      data.workout &&
      !isVisible &&
      !showShareScreen &&
      !isRatingPromptVisible &&
      shownWorkoutIdRef.current !== data.workout.id
    ) {
      shownWorkoutIdRef.current = data.workout.id
      setShowShareScreen(true)
    }
  }, [
    data.workout,
    isVisible,
    showShareScreen,
    setShowShareScreen,
    isRatingPromptVisible,
  ])

  const handleAnimationComplete = () => {
    hideOverlay()
    // Note: Share screen will be shown by the useEffect above when workout data arrives
  }

  const handleShare = async (
    widgetIndex: number,
    shareType: 'instagram' | 'general',
    widgetRef: View,
  ) => {
    if (!data.workout) return

    const widgetTypes = ['summary', 'stats', 'achievement']
    const widgetType = widgetTypes[widgetIndex]

    try {
      if (shareType === 'instagram') {
        await shareToInstagramStories(data.workout, widgetRef, widgetType)
      } else {
        await shareWorkout(
          data.workout,
          data.workoutTitle || 'My Workout',
          widgetRef,
        )
      }
    } catch (error) {
      console.error('Error sharing workout:', error)
    }
  }

  const handleCloseShareScreen = () => {
    setShowShareScreen(false)
  }

  const currentTab = (segments[1] as string | undefined) ?? 'index'
  const isTabBarHidden =
    currentTab === 'create-post' || currentTab === 'create-speech'
  const isIOS26OrNewer =
    Platform.OS === 'ios' &&
    Number.parseInt(String(Platform.Version).split('.')[0] ?? '0', 10) >= 26
  const showNativeBottomAccessory =
    isIOS26OrNewer && !isTabBarHidden && (isRestTimerActive || hasDraft)
  const bottomAccessoryLabel = isRestTimerActive
    ? 'Workout in progress'
    : 'Continue draft'
  const bottomAccessoryIconName = isRestTimerActive ? 'timer-outline' : 'document-text-outline'
  const createActionColor =
    isRestTimerActive || hasDraft ? colors.statusError : colors.brandPrimary
  const createActionSfSymbol = isRestTimerActive
    ? 'timer'
    : hasDraft
    ? 'doc.text'
    : 'plus.circle.fill'
  const createActionMdSymbol = isRestTimerActive
    ? 'timer'
    : hasDraft
    ? 'description'
    : 'add_circle'
  const handleOpenCreatePost = () => router.push('/(tabs)/create-post')

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NativeTabs
        backBehavior="history"
        hidden={isTabBarHidden}
        minimizeBehavior="onScrollDown"
        tintColor={colors.brandPrimary}
        iconColor={colors.textSecondary}
        backgroundColor={
          isDark ? 'rgba(17, 17, 17, 0.38)' : 'rgba(255, 255, 255, 0.56)'
        }
        blurEffect={
          isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'
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
          <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
            md="bar_chart"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="chat">
          <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: 'bubble.left.and.bubble.right',
              selected: 'bubble.left.and.bubble.right.fill',
            }}
            md="chat"
          />
          <NativeTabs.Trigger.Badge hidden={!hasUnreadChat} />
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

        <NativeTabs.Trigger name="create-post" role="search">
          <NativeTabs.Trigger.Label hidden />
          <NativeTabs.Trigger.Icon
            sf={{
              default: createActionSfSymbol,
              selected: createActionSfSymbol,
            }}
            md={createActionMdSymbol}
            selectedColor={createActionColor}
          />
        </NativeTabs.Trigger>

        {showNativeBottomAccessory ? (
          <NativeTabs.BottomAccessory>
            <BottomAccessoryAction
              isDark={isDark}
              label={bottomAccessoryLabel}
              iconName={bottomAccessoryIconName}
              textPrimary={colors.textPrimary}
              textSecondary={colors.textSecondary}
              onPress={handleOpenCreatePost}
            />
          </NativeTabs.BottomAccessory>
        ) : null}
      </NativeTabs>
      <SubmitSuccessOverlay
        visible={isVisible}
        onAnimationComplete={handleAnimationComplete}
        currentStreak={data.currentStreak}
        previousStreak={data.previousStreak}
      />
      {data.workout && (
        <WorkoutShareScreen
          visible={showShareScreen}
          workout={data.workout}
          weightUnit={weightUnit}
          workoutCountThisWeek={data.workoutNumber}
          workoutTitle={data.workoutTitle}
          onClose={handleCloseShareScreen}
          onShare={handleShare}
        />
      )}
      <RatingPromptModal />
      <Paywall
        visible={showGlobalPaywall}
        onClose={() => {}} // No-op, cannot close
        allowClose={false}
        title={'Unlock your full potential'}
        message="Start your free trial to access Uplyft"
      />
    </>
  )
}

function BottomAccessoryAction({
  isDark,
  label,
  iconName,
  textPrimary,
  textSecondary,
  onPress,
}: {
  isDark: boolean
  label: string
  iconName: keyof typeof Ionicons.glyphMap
  textPrimary: string
  textSecondary: string
  onPress: () => void
}) {
  const placement = NativeTabs.BottomAccessory.usePlacement()
  const isInline = placement === 'inline'

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        alignSelf: 'center',
        marginTop: isInline ? 2 : 4,
        marginBottom: isInline ? 4 : 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: isInline ? 6 : 8,
        paddingHorizontal: isInline ? 10 : 14,
        paddingVertical: isInline ? 6 : 8,
        borderRadius: isInline ? 14 : 18,
        backgroundColor: isDark
          ? 'rgba(20, 20, 22, 0.95)'
          : 'rgba(255, 255, 255, 0.97)',
        borderWidth: 1,
        borderColor: isDark
          ? 'rgba(255, 255, 255, 0.12)'
          : 'rgba(0, 0, 0, 0.08)',
      }}
    >
      <Ionicons
        name={iconName}
        size={isInline ? 14 : 15}
        color={textSecondary}
      />
      <Text
        numberOfLines={1}
        style={{
          color: textPrimary,
          fontSize: isInline ? 12 : 13,
          fontWeight: '600',
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export default function TabLayout() {
  return (
    <LiveActivityProvider>
      <RestTimerProvider>
        <ScrollToTopProvider>
          <SuccessOverlayProvider>
            <RatingPromptProvider>
              <TabLayoutContent />
            </RatingPromptProvider>
          </SuccessOverlayProvider>
        </ScrollToTopProvider>
      </RestTimerProvider>
    </LiveActivityProvider>
  )
}

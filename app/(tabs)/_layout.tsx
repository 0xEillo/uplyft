import { Paywall } from '@/components/paywall'
import { PointsGainOverlay } from '@/components/points-gain-overlay'
import { RatingPromptModal } from '@/components/rating-prompt-modal'
import { SubmitSuccessOverlay } from '@/components/submit-success-overlay'
import { hasUnreadWelcomeMessage } from '@/components/workout-chat'
import { WorkoutShareScreen } from '@/components/workout-share-screen'
import { useAuth } from '@/contexts/auth-context'
import {
  LiveActivityProvider,
  useLiveActivity,
} from '@/contexts/live-activity-context'
import { RatingPromptProvider } from '@/contexts/rating-prompt-context'
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
import {
  clearDraft as clearWorkoutDraft,
  loadDraft as loadWorkoutDraft,
} from '@/lib/utils/workout-draft'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useSegments } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import React, { useEffect, useState } from 'react'
import {
  Alert,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

const MINIMIZE_ON_SCROLL_TABS = new Set(['index', 'analytics', 'profile'])

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
  const segments = useSegments()
  const router = useRouter()
  const { scrollToTop } = useScrollToTop()
  const {
    isVisible,
    data,
    hideOverlay,
    showShareScreen,
    setShowShareScreen,
    isPointsOverlayVisible,
    pointsData,
    hidePointsOverlay,
  } = useSuccessOverlay()
  const { weightUnit } = useWeightUnits()
  const { shareWorkout, shareToInstagramStories } = useWorkoutShare()
  const { isProMember, isLoading: isSubscriptionLoading } = useSubscription()
  const {
    isActive: isRestTimerActive,
    stop: stopRestTimer,
  } = useRestTimerContext()
  const { stopWorkoutActivity } = useLiveActivity()
  const { user } = useAuth()
  const [delayedShowPaywall, setDelayedShowPaywall] = useState(false)
  const [hasUnreadChat, setHasUnreadChat] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [workoutElapsedSeconds, setWorkoutElapsedSeconds] = useState(0)
  const [isDraftCheckComplete, setIsDraftCheckComplete] = useState(false)

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
      const draft = await loadWorkoutDraft()
      if (!draft) {
        setHasDraft(false)
        setWorkoutElapsedSeconds(0)
        setIsDraftCheckComplete(true)
        return
      }

      setHasDraft(true)

      const baseSeconds =
        typeof draft.timerElapsedSeconds === 'number'
          ? draft.timerElapsedSeconds
          : 0
      const startedAtMs =
        typeof draft.timerStartedAt === 'string'
          ? Date.parse(draft.timerStartedAt)
          : Number.NaN
      const runningSeconds = Number.isNaN(startedAtMs)
        ? 0
        : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))

      setWorkoutElapsedSeconds(Math.max(0, baseSeconds + runningSeconds))
      setIsDraftCheckComplete(true)
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
  const shouldEnableTabBarMinimize =
    isIOS26OrNewer && MINIMIZE_ON_SCROLL_TABS.has(currentTab)
  const tabBarMinimizeBehavior = shouldEnableTabBarMinimize
    ? 'onScrollDown'
    : 'never'
  const showNativeBottomAccessory =
    isIOS26OrNewer &&
    !isTabBarHidden &&
    currentTab !== 'chat' &&
    (isRestTimerActive || hasDraft)
  const bottomAccessoryTitle = `Workout ${formatAccessoryElapsed(
    workoutElapsedSeconds,
  )}`
  const createActionColor =
    isRestTimerActive || hasDraft ? colors.statusError : colors.brandPrimary
  const handleOpenCreatePost = () => router.push('/(tabs)/create-post')
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
            void (async () => {
              await clearWorkoutDraft('bottom-accessory-discard')
              stopRestTimer()
              stopWorkoutActivity()
              setHasDraft(false)
              setWorkoutElapsedSeconds(0)
            })()
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
          <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
            md="bar_chart"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="chat">
          <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
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
            src={Ionicons.getImageSource('add-circle', 38, '#FFFFFF')}
            renderingMode="template"
            selectedColor={createActionColor}
          />
        </NativeTabs.Trigger>

        {showNativeBottomAccessory ? (
          <NativeTabs.BottomAccessory>
            <BottomAccessoryAction
              title={bottomAccessoryTitle}
              textPrimary={colors.textPrimary}
              accentColor={colors.statusSuccess}
              onOpen={handleOpenCreatePost}
              onDiscard={handleDiscardWorkoutProgress}
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
      {pointsData && (
        <PointsGainOverlay
          visible={isPointsOverlayVisible}
          onAnimationComplete={hidePointsOverlay}
          previousScore={pointsData.previousScore}
          currentScore={pointsData.currentScore}
          previousLevel={pointsData.previousLevel}
          currentLevel={pointsData.currentLevel}
          nextLevel={pointsData.nextLevel}
          progress={pointsData.progress}
          pointsGained={pointsData.pointsGained}
        />
      )}
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
  title,
  textPrimary,
  accentColor,
  onOpen,
  onDiscard,
}: {
  title: string
  textPrimary: string
  accentColor: string
  onOpen: () => void
  onDiscard: () => void
}) {
  const placement = NativeTabs.BottomAccessory.usePlacement()
  const isInline = placement === 'inline'
  const sideSlotWidth = isInline ? 56 : 68
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
        accessibilityLabel="Resume workout"
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
            <Ionicons
              name="chevron-up"
              size={isInline ? 16 : 22}
              color={textPrimary}
            />
          </View>

          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <View
              style={{
                width: isInline ? 7 : 11,
                height: isInline ? 7 : 11,
                borderRadius: 999,
                backgroundColor: accentColor,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                color: textPrimary,
                fontSize: isInline ? 15 : 17,
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
    </View>
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

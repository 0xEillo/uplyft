import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { BlurView } from 'expo-blur'
import { Tabs, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HapticTab } from '@/components/haptic-tab'
import { RatingPromptModal } from '@/components/rating-prompt-modal'
import { SubmitSuccessOverlay } from '@/components/submit-success-overlay'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { WorkoutShareScreen } from '@/components/workout-share-screen'
import { RatingPromptProvider, useRatingPrompt } from '@/contexts/rating-prompt-context'
import {
  RestTimerProvider,
  useRestTimerContext,
} from '@/contexts/rest-timer-context'
import {
  ScrollToTopProvider,
  useScrollToTop,
} from '@/contexts/scroll-to-top-context'
import {
  SuccessOverlayProvider,
  useSuccessOverlay,
} from '@/contexts/success-overlay-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'

import { hasStoredDraft } from '@/lib/utils/workout-draft'

const PENDING_POST_KEY = '@pending_workout_post'

const formatTimerCompact = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `${secs}`
}

function TikTokPlusButton() {
  const router = useRouter()
  const colors = useThemedColors()
  const [hasDraft, setHasDraft] = useState(false)
  const {
    isActive: isRestTimerActive,
    remainingSeconds,
  } = useRestTimerContext()

  // Check for draft on mount and when returning from create-post
  useEffect(() => {
    const checkDraft = async () => {
      const draftExists = await hasStoredDraft()
      setHasDraft(draftExists)
    }

    checkDraft()

    // Check every second while mounted
    const interval = setInterval(checkDraft, 1000)

    return () => clearInterval(interval)
  }, [])

  // Timer takes priority over draft state for button color
  const buttonColor = isRestTimerActive
    ? colors.error
    : hasDraft
    ? colors.error
    : colors.primary
  const styles = createButtonStyles(colors, buttonColor)

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/(tabs)/create-post')}
      activeOpacity={0.8}
    >
      <View style={styles.leftLayer} />
      <View style={styles.rightLayer} />
      <View style={styles.centerLayer}>
        {isRestTimerActive ? (
          <View style={styles.timerContent}>
            <Ionicons name="timer-outline" size={14} color={colors.white} />
            <View style={styles.timerTextContainer}>
              <Text style={styles.timerText}>
                {formatTimerCompact(remainingSeconds)}
              </Text>
            </View>
          </View>
        ) : (
          <Ionicons
            name={hasDraft ? 'document-text' : 'add'}
            size={22}
            color={colors.white}
          />
        )}
      </View>
    </TouchableOpacity>
  )
}

function TabLayoutContent() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const navigation = useNavigation()
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
  }, [data.workout, isVisible, showShareScreen, setShowShareScreen, isRatingPromptVisible])

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

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Tabs
        backBehavior="history"
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          headerShown: false,
          tabBarHideOnKeyboard: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
          tabBarBackground: () => (
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ),
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            height: 79,
            paddingBottom: 30,
            paddingTop: 2,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            elevation: 0, // Remove shadow on Android
          },
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: -4,
          },
        }}
      >
        {/* Home tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <View style={{ marginTop: 5 }}>
                <IconSymbol
                  size={32}
                  name={focused ? 'house.fill' : 'house'}
                  color={color}
                />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              // If already on home tab (index route), scroll to top
              const state = navigation.getState()
              const currentRoute = state?.routes[state.index]
              const currentRouteState = currentRoute?.state
              const isOnHomeTab =
                currentRoute?.name === '(tabs)' &&
                (currentRouteState?.index !== undefined
                  ? currentRouteState.routes[currentRouteState.index]?.name ===
                    'index'
                  : true)
              if (isOnHomeTab) {
                e.preventDefault()
                scrollToTop('index')
              }
            },
          }}
        />
        {/* Progress tab */}
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, focused }) => (
              <View style={{ overflow: 'visible', marginBottom: -1 }}>
                <Ionicons
                  name={focused ? 'bar-chart' : 'bar-chart-outline'}
                  size={30}
                  color={color}
                />
              </View>
            ),
          }}
        />
        {/* Create tab */}
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            tabBarIcon: () => null,
            tabBarButton: () => (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <TikTokPlusButton />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault()
            },
          }}
        />
        {/* Chat tab */}
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused
                    ? 'chatbubble-ellipses'
                    : 'chatbubble-ellipses-outline'
                }
                size={30}
                color={color}
              />
            ),
          }}
        />
        {/* Profile tab */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={30}
                color={color}
              />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              // If already on profile tab, scroll to top
              const state = navigation.getState()
              const currentRoute = state?.routes[state.index]
              const currentRouteState = currentRoute?.state
              const isOnProfileTab =
                currentRoute?.name === '(tabs)' &&
                currentRouteState?.index !== undefined &&
                currentRouteState.routes[currentRouteState.index]?.name ===
                  'profile'

              if (isOnProfileTab) {
                e.preventDefault()
                scrollToTop('profile')
              }
            },
          }}
        />
        {/* Hidden screens */}
        <Tabs.Screen
          name="create-post"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="create-speech"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
      <SubmitSuccessOverlay
        visible={isVisible}
        onAnimationComplete={handleAnimationComplete}
        workoutNumber={data.workoutNumber}
        weeklyTarget={data.weeklyTarget}
        currentStreak={data.currentStreak}
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
    </>
  )
}

export default function TabLayout() {
  return (
    <RestTimerProvider>
      <ScrollToTopProvider>
        <SuccessOverlayProvider>
          <RatingPromptProvider>
            <TabLayoutContent />
          </RatingPromptProvider>
        </SuccessOverlayProvider>
      </ScrollToTopProvider>
    </RestTimerProvider>
  )
}

const createButtonStyles = (
  colors: ReturnType<typeof useThemedColors>,
  buttonColor: string,
) =>
  StyleSheet.create({
    container: {
      width: 55,
      height: 33,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    leftLayer: {
      position: 'absolute',
      left: 0,
      width: 46,
      height: 33,
      backgroundColor: buttonColor,
      borderRadius: 10,
    },
    rightLayer: {
      position: 'absolute',
      right: 0,
      width: 46,
      height: 33,
      backgroundColor: buttonColor,
      borderRadius: 10,
    },
    centerLayer: {
      width: 46,
      height: 33,
      backgroundColor: buttonColor,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    timerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    timerTextContainer: {
      minWidth: 24,
      alignItems: 'center',
    },
    timerText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
  })

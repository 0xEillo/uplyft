import { Ionicons } from '@expo/vector-icons'
import { Tabs, useRouter } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import { StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HapticTab } from '@/components/haptic-tab'
import { RatingPromptModal } from '@/components/rating-prompt-modal'
import { SubmitSuccessOverlay } from '@/components/submit-success-overlay'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { WorkoutShareScreen } from '@/components/workout-share-screen'
import { RatingPromptProvider } from '@/contexts/rating-prompt-context'
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

function ElevatedPlusButton() {
  const colors = useThemedColors()
  const router = useRouter()
  const [hasDraft, setHasDraft] = useState(false)

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

  const styles = createStyles(colors, hasDraft)

  return (
    <TouchableOpacity
      style={styles.elevatedButton}
      onPress={() => router.push('/(tabs)/create-post')}
      activeOpacity={0.8}
    >
      <Ionicons
        name={hasDraft ? 'document-text' : 'add'}
        size={25}
        color={colors.white}
      />
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

  // Track if we've already shown the share screen for this workout
  const shownWorkoutIdRef = React.useRef<string | null>(null)

  // Watch for workout data updates and show share screen when workout is ready
  React.useEffect(() => {
    // If we have workout data and overlay is not visible (animation completed), show share screen
    // Only show once per workout ID
    if (
      data.workout &&
      !isVisible &&
      !showShareScreen &&
      shownWorkoutIdRef.current !== data.workout.id
    ) {
      shownWorkoutIdRef.current = data.workout.id
      setShowShareScreen(true)
    }
  }, [data.workout, isVisible, showShareScreen, setShowShareScreen])

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
          tabBarHideOnKeyboard: true,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.08)',
            height: 84,
            paddingBottom: 24,
            paddingTop: 2,
          },
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 4,
          },
        }}
      >
        {/* Home tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="house.fill" color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              // If already on home tab (index route), scroll to top
              const state = navigation.getState()
              const currentRoute = state?.routes[state.index]
              const isOnHomeTab = currentRoute?.name === '(tabs)' && 
                (currentRoute.state?.routes[currentRoute.state.index]?.name === 'index' || 
                 !currentRoute.state?.routes[currentRoute.state.index])
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
            tabBarIcon: ({ color }) => (
              <Ionicons name="bar-chart" size={26} color={color} />
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
                  marginTop: -4,
                }}
              >
                <ElevatedPlusButton />
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
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubble-ellipses" size={26} color={color} />
            ),
          }}
        />
        {/* Profile tab */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-circle" size={26} color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              // If already on profile tab, scroll to top
              const state = navigation.getState()
              const currentRoute = state?.routes[state.index]
              const isOnProfileTab = currentRoute?.name === '(tabs)' && 
                currentRoute.state?.routes[currentRoute.state.index]?.name === 'profile'
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
        message={data.message}
        workoutNumber={data.workoutNumber}
        weeklyTarget={data.weeklyTarget}
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
    <ScrollToTopProvider>
      <SuccessOverlayProvider>
        <RatingPromptProvider>
          <TabLayoutContent />
        </RatingPromptProvider>
      </SuccessOverlayProvider>
    </ScrollToTopProvider>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  hasDraft: boolean = false,
) =>
  StyleSheet.create({
    elevatedButton: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: hasDraft ? '#EF4444' : colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: hasDraft ? '#EF4444' : colors.primary,
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 12,
    },
  })

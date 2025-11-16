import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Tabs, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'

import { HapticTab } from '@/components/haptic-tab'
import { RatingPromptModal } from '@/components/rating-prompt-modal'
import { SubmitSuccessOverlay } from '@/components/submit-success-overlay'
import { WorkoutShareScreen } from '@/components/workout-share-screen'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { RatingPromptProvider } from '@/contexts/rating-prompt-context'
import {
  SuccessOverlayProvider,
  useSuccessOverlay,
} from '@/contexts/success-overlay-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { useWeightUnits } from '@/hooks/useWeightUnits'
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
      console.log('[ElevatedPlusButton] Draft exists:', draftExists)
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
        name={hasDraft ? "document-text" : "add"}
        size={28}
        color={colors.white}
      />
    </TouchableOpacity>
  )
}

function TabLayoutContent() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { isVisible, data, hideOverlay, showShareScreen, setShowShareScreen } = useSuccessOverlay()
  const { weightUnit } = useWeightUnits()
  const { shareWorkout, shareToInstagramStories } = useWorkoutShare()

  // Track if we've already shown the share screen for this workout
  const shownWorkoutIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    console.log('[TabLayout] Tabs configured with backBehavior="history"')
  }, [])

  // Watch for workout data updates and show share screen when workout is ready
  React.useEffect(() => {
    // If we have workout data and overlay is not visible (animation completed), show share screen
    // Only show once per workout ID
    if (data.workout && !isVisible && !showShareScreen && shownWorkoutIdRef.current !== data.workout.id) {
      shownWorkoutIdRef.current = data.workout.id
      setShowShareScreen(true)
    }
  }, [data.workout, isVisible, showShareScreen, setShowShareScreen])

  const handleAnimationComplete = () => {

    hideOverlay()
    // Note: Share screen will be shown by the useEffect above when workout data arrives
  }

  const handleShare = async (widgetIndex: number, shareType: 'instagram' | 'general', widgetRef: View) => {
    if (!data.workout) return

    const widgetTypes = ['summary', 'stats', 'achievement']
    const widgetType = widgetTypes[widgetIndex]

    try {
      if (shareType === 'instagram') {
        await shareToInstagramStories(data.workout, widgetRef, widgetType)
      } else {
        await shareWorkout(data.workout, data.workoutTitle || 'My Workout', widgetRef)
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
            height: 90,
            paddingBottom: 30,
            paddingTop: 8,
          },
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 12,
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
              <IconSymbol size={28} name="house.fill" color={color} />
            ),
          }}
        />
        {/* Progress tab */}
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => (
              <Ionicons name="bar-chart" size={28} color={color} />
            ),
          }}
        />
        {/* Profile tab */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-circle" size={28} color={color} />
            ),
          }}
        />
        {/* Elevated + button */}
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
                  paddingTop: 8,
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
    <SuccessOverlayProvider>
      <RatingPromptProvider>
        <TabLayoutContent />
      </RatingPromptProvider>
    </SuccessOverlayProvider>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, hasDraft: boolean = false) =>
  StyleSheet.create({
    elevatedButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
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
      marginTop: -72,
    },
  })

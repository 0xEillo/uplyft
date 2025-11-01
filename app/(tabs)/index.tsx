import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { EmptyFeedState } from '@/components/empty-feed-state'
import { NotificationBadge } from '@/components/notification-badge'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useTheme } from '@/contexts/theme-context'
import { useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { isApiError, mapApiErrorToMessage } from '@/lib/api/errors'
import { database } from '@/lib/database'
import { loadPlaceholderWorkout } from '@/lib/utils/workout-draft'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// Custom animation for sleek, elegant card slide-in
// Mimics high-end apps like Instagram with smooth spring physics
const CustomSlideAnimation = {
  duration: 600, // Slower, more luxurious feel
  create: {
    type: LayoutAnimation.Types.spring,
    property: LayoutAnimation.Properties.opacity,
    springDamping: 0.75, // Slightly bouncier for premium feel
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.75,
    delay: 0,
  },
  delete: {
    type: LayoutAnimation.Types.spring,
    property: LayoutAnimation.Properties.opacity,
    springDamping: 0.8,
  },
}

// Even smoother variant for card deletion
const CardDeleteAnimation = {
  duration: 400,
  delete: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.7,
  },
}

export default function FeedScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { trackEvent } = useAnalytics()
  const { unreadCount } = useNotifications()
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [newWorkoutId, setNewWorkoutId] = useState<string | null>(null)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  )
  const { processPendingWorkout, isProcessingPending } = useSubmitWorkout()

  const loadWorkouts = useCallback(
    async (showLoading = false) => {
      if (!user) return

      try {
        if (showLoading) {
          setIsLoading(true)
        }
        const data = await database.workoutSessions.getRecent(user.id, 20)

        // Load placeholder workout if it exists
        const placeholder = await loadPlaceholderWorkout()

        // Use animation when updating existing list
        if (!isInitialLoad && workouts.length > 0) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        }

        // Add placeholder at the top if it exists
        const workoutsWithPlaceholder: WorkoutSessionWithDetails[] = placeholder
          ? ([
              (placeholder as unknown) as WorkoutSessionWithDetails,
              ...data,
            ] as WorkoutSessionWithDetails[])
          : data

        setWorkouts(workoutsWithPlaceholder)
        setIsInitialLoad(false)
      } catch (error) {
        console.error('Error loading workouts:', error)
      } finally {
        setIsLoading(false)
      }
    },
    [user, isInitialLoad, workouts.length],
  )

  const handlePendingPost = useCallback(async () => {
    if (!user || isProcessingPending) return

    try {
      const result = await processPendingWorkout()

      if (result.status === 'none' || result.status === 'skipped') {
        return
      }

      if (result.status === 'success') {
        const { workout, placeholder } = result

        setNewWorkoutId(workout.id)
        LayoutAnimation.configureNext(CustomSlideAnimation)

        setWorkouts((prev) => {
          if (placeholder) {
            const index = prev.findIndex((item) => item.id === placeholder.id)
            if (index >= 0) {
              const clone = [...prev]
              clone.splice(index, 1, workout)
              return clone
            }
          }

          if (prev.length > 0 && (prev[0] as any).isPending) {
            return [workout, ...prev.slice(1)]
          }

          return [workout, ...prev]
        })

        setTimeout(() => setNewWorkoutId(null), 1000)
        return
      }

      const { error, placeholder } = result
      console.error('Error creating post:', error)

      const isTimeout = error instanceof Error && error.name === 'AbortError'
      const isKnownApiError = isApiError(error)

      const message = isKnownApiError
        ? mapApiErrorToMessage(error)
        : isTimeout
        ? 'The request took too long. This usually happens with slow internet or large workouts. Your draft has been saved - please try again.'
        : 'Something went wrong while saving your workout. Please try again.'

      const title =
        isKnownApiError &&
        (error.code === 'CONTENT_REFUSED' || error.code === 'ZOD_INVALID')
          ? 'Unable to Parse Workout'
          : 'Error'

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setWorkouts((prev) => {
        if (placeholder) {
          return prev.filter((item) => item.id !== placeholder.id)
        }
        return prev.filter((item: any) => !item.isPending)
      })

      Alert.alert(title, message, [
        {
          text: 'Edit & Try Again',
          onPress: () => router.push('/(tabs)/create-post'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ])
    } catch (error) {
      console.error('Error processing pending post:', error)
    }
  }, [user, isProcessingPending, processPendingWorkout, router])

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.FEED_VIEWED, {
        timestamp: Date.now(),
        workoutCount: workouts.length,
      })

      // Load existing workouts immediately (non-blocking)
      loadWorkouts(isInitialLoad)

      // Process pending post in background (non-blocking)
      // CreateButton spinner in tab bar responds via shared pending status
      handlePendingPost()
    }, [
      handlePendingPost,
      loadWorkouts,
      isInitialLoad,
      workouts.length,
      trackEvent,
    ]),
  )

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={
              isDark
                ? require('@/llm/repai-logo-white.png')
                : require('@/llm/repai-logo-black.png')
            }
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Rep AI</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={{ position: 'relative' }}
        >
          <Ionicons
            name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
            size={24}
            color={colors.text}
          />
          <NotificationBadge count={unreadCount} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : workouts.length === 0 ? (
        <EmptyFeedState />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Feed Posts */}
          <View style={styles.feed}>
            {workouts.map((workout, index) => (
              <AnimatedFeedCard
                key={workout.id}
                workout={workout}
                index={index}
                isNew={workout.id === newWorkoutId}
                isDeleting={workout.id === deletingWorkoutId}
                onDelete={() => {
                  // If already marked for deletion, actually remove from state
                  if (workout.id === deletingWorkoutId) {
                    // Smooth layout animation for remaining cards sliding up
                    LayoutAnimation.configureNext(CardDeleteAnimation)
                    setWorkouts((prev) =>
                      prev.filter((w) => w.id !== workout.id),
                    )
                    setDeletingWorkoutId(null)

                    trackEvent(AnalyticsEvents.WORKOUT_DELETE_CONFIRMED, {
                      workout_id: workout.id,
                    })
                  } else {
                    // Mark for deletion to trigger exit animation
                    setDeletingWorkoutId(workout.id)

                    trackEvent(AnalyticsEvents.WORKOUT_DELETE_REQUESTED, {
                      workout_id: workout.id,
                    })
                  }
                }}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    headerIcon: {
      width: 27,
      height: 27,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    feed: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })

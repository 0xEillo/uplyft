import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { EmptyFeedState } from '@/components/empty-feed-state'
import { NotificationBadge } from '@/components/notification-badge'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
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
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

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
  const { updateWorkoutData } = useSuccessOverlay()
  const insets = useSafeAreaInsets()
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [newWorkoutId, setNewWorkoutId] = useState<string | null>(null)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  )
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const { processPendingWorkout, isProcessingPending } = useSubmitWorkout()

  const loadWorkouts = useCallback(
    async (showLoading = false, loadMore = false) => {
      if (!user) return

      // Prevent concurrent load-more operations (but allow initial loads)
      if (loadMore && isLoadingMore) {
        return
      }

      try {
        if (loadMore) {
          setIsLoadingMore(true)
        } else if (showLoading) {
          setIsLoading(true)
        }

        const currentOffset = loadMore ? offset : 0
        const limit = 10
        const data = await database.workoutSessions.getRecent(
          user.id,
          limit,
          currentOffset,
        )

        // Check if we have more workouts to load
        const hasMoreWorkouts = data.length === limit

        if (loadMore) {
          // Append new workouts to existing list
          setWorkouts((prev) => {
            // Filter out placeholder before appending
            const filtered = prev.filter((w: any) => !w.isPending)

            // Deduplicate: only add workouts that aren't already in the list
            const existingIds = new Set(filtered.map((w) => w.id))
            const newWorkouts = data.filter((w) => !existingIds.has(w.id))

            return [...filtered, ...newWorkouts]
          })
          const nextOffset = currentOffset + data.length
          setOffset(nextOffset)
          setHasMore(hasMoreWorkouts)
        } else {
          // Initial load or refresh
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
          setOffset(data.length)
          setHasMore(hasMoreWorkouts)
          setIsInitialLoad(false)
        }
      } catch (error) {
        console.error('Error loading workouts:', error)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [user, isInitialLoad, offset],
  )

  const handlePendingPost = useCallback(async () => {
    if (!user || isProcessingPending) return

    try {
      const result = await processPendingWorkout()

      if (result.status === 'none' || result.status === 'skipped') {
        return
      }

      if (result.status === 'success') {
        const { workout } = result

        // Update success overlay context with workout data for share screen
        updateWorkoutData(workout)

        setNewWorkoutId(workout.id)
        LayoutAnimation.configureNext(CustomSlideAnimation)

        // Reload the feed from scratch to ensure consistency with pagination
        // Reset pagination state
        setOffset(0)
        setHasMore(true)
        loadWorkouts(false, false)

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
  }, [user, isProcessingPending, processPendingWorkout, router, updateWorkoutData])

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      loadWorkouts(false, true)
    }
  }, [isLoadingMore, hasMore, isLoading, loadWorkouts])

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.FEED_VIEWED, {
        timestamp: Date.now(),
        workoutCount: workouts.length,
      })

      // Check for placeholder and load it before processing
      const checkAndLoadPlaceholder = async () => {
        const placeholder = await loadPlaceholderWorkout()
        if (placeholder) {
          // Add placeholder to top of feed immediately
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setWorkouts((prev) => {
            // Remove any existing placeholder first
            const filtered = prev.filter((w: any) => !w.isPending)
            return [(placeholder as unknown) as WorkoutSessionWithDetails, ...filtered]
          })
        }
      }

      // Only load on initial mount, don't reload on every focus
      if (isInitialLoad) {
        loadWorkouts(true)
      } else {
        // When returning from create-post, check for placeholder
        checkAndLoadPlaceholder()
      }

      // Process pending post in background (non-blocking)
      // CreateButton spinner in tab bar responds via shared pending status
      handlePendingPost()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handlePendingPost, loadWorkouts, isInitialLoad, trackEvent]),
  )

  const styles = createStyles(colors)

  const renderWorkoutItem = useCallback(
    ({
      item: workout,
      index,
    }: {
      item: WorkoutSessionWithDetails
      index: number
    }) => (
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
            setWorkouts((prev) => prev.filter((w) => w.id !== workout.id))
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
    ),
    [newWorkoutId, deletingWorkoutId, trackEvent],
  )

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }, [isLoadingMore, colors.primary, styles.loadingMoreContainer])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Status bar background to match navbar */}
      <View style={[styles.statusBarBackground, { height: insets.top }]} />
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
        <FlatList
          data={workouts}
          renderItem={renderWorkoutItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
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
    statusBarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.white,
      zIndex: 0,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.08)',
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
      paddingTop: 2,
      paddingBottom: 2,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingMoreContainer: {
      paddingVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })

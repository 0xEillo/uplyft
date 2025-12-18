import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { EmptyState } from '@/components/EmptyState'
import { NotificationBadge } from '@/components/notification-badge'
import { Paywall } from '@/components/paywall'
import { TutorialChecklist } from '@/components/Tutorial/TutorialChecklist'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useRatingPrompt } from '@/contexts/rating-prompt-context'
import { useScrollToTop } from '@/contexts/scroll-to-top-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { registerForPushNotifications } from '@/hooks/usePushNotifications'
import { useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { getAndClearDeletedWorkoutIds } from '@/lib/utils/deleted-workouts'
import { loadPlaceholderWorkout } from '@/lib/utils/workout-draft'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    FlatList,
    LayoutAnimation,
    Platform,
    RefreshControl,
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
  const { isProMember } = useSubscription()
  const { trackEvent } = useAnalytics()
  const { unreadCount } = useNotifications()
  const { updateWorkoutData } = useSuccessOverlay()
  const { showPrompt } = useRatingPrompt()
  const { registerScrollRef } = useScrollToTop()
  const { isTutorialDismissed, isLoading: isTutorialLoading } = useTutorial()
  const flatListRef = useRef<FlatList>(null)
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [showPaywall, setShowPaywall] = useState(false)
  const [newWorkoutId, setNewWorkoutId] = useState<string | null>(null)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  )
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { processPendingWorkout, isProcessingPending } = useSubmitWorkout()

  // Register FlatList ref for scroll-to-top functionality
  useEffect(() => {
    registerScrollRef('index', flatListRef)
  }, [registerScrollRef])

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
        const data = await database.workoutSessions.getSocialFeed(
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

  const handleRefresh = useCallback(async () => {
    if (!user || isRefreshing) return

    setIsRefreshing(true)
    try {
      // Reset pagination and reload from scratch
      setOffset(0)
      setHasMore(true)
      await loadWorkouts(false, false)
    } finally {
      setIsRefreshing(false)
    }
  }, [user, isRefreshing, loadWorkouts])

  const handlePendingPost = useCallback(async () => {
    if (!user || isProcessingPending) return

    try {
      const result = await processPendingWorkout()

      if (result.status === 'none' || result.status === 'skipped') {
        return
      }

      if (result.status === 'success') {
        let { workout } = result

        // Ensure workout has profile attached for share screen
        if (!workout.profile && user) {
          try {
            const profile = await database.profiles.getById(user.id)
            workout = { ...workout, profile }
          } catch (error) {
            console.error('Error fetching profile for new workout:', error)
          }
        }

        // Update success overlay context with workout data for share screen
        updateWorkoutData(workout)

        setNewWorkoutId(workout.id)
        LayoutAnimation.configureNext(CustomSlideAnimation)

        // Reload the feed from scratch to ensure consistency with pagination
        // Reset pagination state
        setOffset(0)
        setHasMore(true)
        loadWorkouts(false, false)

        // Show rating prompt if applicable (after first workout, then every 10 workouts)
        // IMPORTANT: Delay this to avoid overlap with WorkoutShareScreen modal
        // The share screen shows immediately after updateWorkoutData, so we need to wait
        // for the user to have time to see/dismiss it before showing the rating prompt
        setTimeout(async () => {
          try {
            const workoutCount = await database.workoutSessions.getCountByUserId(
              user.id,
            )
            await showPrompt(workoutCount)
          } catch (error) {
            console.error(
              'Error checking workout count for rating prompt:',
              error,
            )
          }
        }, 5000) // 5 second delay to give share screen time to be viewed

        // Check if this is the first workout and prompt for push notifications
        try {
          const profile = await database.profiles.getById(user.id)
          const workoutCount = await database.workoutSessions.getCountByUserId(
            user.id,
          )

          // Only prompt if this is the first workout and we haven't asked before
          if (
            workoutCount === 1 &&
            profile &&
            !profile.has_requested_push_notifications
          ) {
            // Delay the prompt slightly so the success animation completes first
            setTimeout(() => {
              Alert.alert(
                'Stay Connected',
                'Enable notifications to get updates when friends like and comment on your workouts!',
                [
                  {
                    text: 'Not Now',
                    style: 'cancel',
                    onPress: async () => {
                      // Mark as requested even if they decline
                      await database.profiles.update(user.id, {
                        has_requested_push_notifications: true,
                      })
                    },
                  },
                  {
                    text: 'Enable',
                    onPress: async () => {
                      await registerForPushNotifications()
                      await database.profiles.update(user.id, {
                        has_requested_push_notifications: true,
                      })
                    },
                  },
                ],
              )
            }, 1500)
          }
        } catch (error) {
          console.error('Error checking for push notification prompt:', error)
        }

        setTimeout(() => setNewWorkoutId(null), 1000)
        return
      }

      const { error, placeholder } = result
    } catch (error) {
      console.error('Error processing pending post:', error)
    }
  }, [
    user,
    isProcessingPending,
    processPendingWorkout,
    router,
    updateWorkoutData,
    showPrompt,
  ])

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

      // Remove any workouts that were deleted from detail pages
      const deletedIds = getAndClearDeletedWorkoutIds()
      if (deletedIds.length > 0) {
        LayoutAnimation.configureNext(CardDeleteAnimation)
        setWorkouts((prev) => prev.filter((w) => !deletedIds.includes(w.id)))
      }

      // Check for placeholder and load it before processing
      const checkAndLoadPlaceholder = async () => {
        const placeholder = await loadPlaceholderWorkout()
        if (placeholder) {
          // Add placeholder to top of feed immediately
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setWorkouts((prev) => {
            // Remove any existing placeholder first
            const filtered = prev.filter((w: any) => !w.isPending)
            return [
              (placeholder as unknown) as WorkoutSessionWithDetails,
              ...filtered,
            ]
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
        isFirst={index === 0}
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
      <BaseNavbar
        leftContent={
          <View style={styles.headerTitleContainer}>
            {isProMember ? (
              <NavbarIsland>
                <TouchableOpacity
                  style={styles.repAiBadge}
                  onPress={() => router.push('/(tabs)/chat')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.repAiBadgeText}>Rep AI</Text>
                </TouchableOpacity>
              </NavbarIsland>
            ) : (
              <TouchableOpacity
                style={styles.proBadge}
                onPress={() => setShowPaywall(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.proBadgeText}>PRO</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        rightContent={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/search')}
              style={styles.iconButton}
            >
              <Ionicons name="search-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={{ position: 'relative', padding: 4 }}
            >
              <Ionicons
                name={
                  unreadCount > 0 ? 'notifications' : 'notifications-outline'
                }
                size={24}
                color={colors.text}
              />
              <NotificationBadge count={unreadCount} />
            </TouchableOpacity>
          </View>
        }
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={workouts}
          renderItem={renderWorkoutItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.feed,
            workouts.length === 0 && styles.emptyFeed,
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            !isTutorialDismissed && !isTutorialLoading && workouts.length === 0 ? (
              <TutorialChecklist />
            ) : null
          }
          ListEmptyComponent={
            (isTutorialDismissed || isTutorialLoading) && !isLoading ? (
              <EmptyState
                icon="barbell-outline"
                title="Your feed is empty"
                description="Follow friends or log your first workout to see activity here."
                buttonText="Log Your First Workout"
                onPress={() => router.push('/(tabs)/create-post')}
              />
            ) : null
          }
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      )}
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    proBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    proBadgeText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.buttonText,
    },
    repAiBadge: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginLeft: 0,
    },
    repAiBadgeText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      padding: 4,
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
    emptyFeed: {
      flexGrow: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 100,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  })

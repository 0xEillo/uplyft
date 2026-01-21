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

import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { EmptyState } from '@/components/EmptyState'
import { NotificationBadge } from '@/components/notification-badge'
import { TutorialChecklist } from '@/components/Tutorial/TutorialChecklist'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
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

// Extended type to include pending workouts (placeholders)
type WorkoutWithPending = WorkoutSessionWithDetails & { isPending?: boolean }

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
  const { registerScrollRef } = useScrollToTop()
  const { isTutorialDismissed, isLoading: isTutorialLoading } = useTutorial()
  const flatListRef = useRef<FlatList>(null)
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [isOffline, setIsOffline] = useState(false)
  const { processPendingWorkout, isProcessingPending } = useSubmitWorkout()

  const loadStreak = useCallback(async () => {
    if (!user) return
    try {
      const { currentStreak } = await database.stats.calculateStreak(user.id)
      setCurrentStreak(currentStreak)
    } catch {
      // Silently fail - streak is not critical and may fail offline
    }
  }, [user])

  // Register FlatList ref for scroll-to-top functionality
  useEffect(() => {
    registerScrollRef('index', flatListRef)
  }, [registerScrollRef])

  // Hard Paywall is handled globally in (tabs)/_layout.tsx with a 0.4s delay

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
            const filtered = prev.filter((w: WorkoutWithPending) => !w.isPending)

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
          setIsOffline(false) // Clear offline state on successful load
        }
      } catch (error) {
        console.error('Error loading workouts:', error)
        // Detect network errors
        const isNetworkError =
          error instanceof Error &&
          (error.message.includes('Network request failed') ||
            error.message.includes('network') ||
            error.message.includes('fetch') ||
            error.message.includes('Failed to fetch'))
        setIsOffline(isNetworkError)

        // Even when offline, show placeholder if it exists (from AsyncStorage)
        if (isNetworkError) {
          try {
            const placeholder = await loadPlaceholderWorkout()
            if (placeholder) {
              setWorkouts([
                (placeholder as unknown) as WorkoutSessionWithDetails,
              ])
            }
          } catch {
            // Placeholder load failed, that's fine
          }
        }
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isLoadingMore/workouts.length intentionally omitted to prevent infinite re-renders
    [user, isInitialLoad, offset],
  )

  const handleRefresh = useCallback(async () => {
    if (!user || isRefreshing) return

    trackEvent(AnalyticsEvents.FEED_REFRESHED)
    setIsRefreshing(true)
    try {
      // Reset pagination and reload from scratch
      setOffset(0)
      setHasMore(true)
      await loadWorkouts(false, false)

      // Also retry any pending workout (manual retry via pull-to-refresh)
      handlePendingPost()
    } finally {
      setIsRefreshing(false)
    }
  }, [user, isRefreshing, loadWorkouts, trackEvent, handlePendingPost])

  const handlePendingPost = useCallback(async () => {
    if (!user || isProcessingPending) return

    try {
      const result = await processPendingWorkout()

      if (
        result.status === 'none' ||
        result.status === 'skipped' ||
        result.status === 'offline'
      ) {
        // 'offline' - pending workout kept for retry, placeholder stays showing "Queued"
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

      const { error } = result
      setWorkouts((prev) => prev.filter((w: WorkoutWithPending) => !w.isPending))

      if (error instanceof Error && error.message.includes('idempotency')) {
        // Silent fail for idempotency errors - they mean it's already working
        return
      }

      Alert.alert(
        'Submission Failed',
        'We couldn\'t save your workout right now. We\'ve saved a draft so you don\'t lose your work.',
        [{ text: 'OK' }]
      )
    } catch (error) {
      console.error('Error processing pending post:', error)
      // Also ensure placeholder is removed if an unexpected error occurs
      setWorkouts((prev) => prev.filter((w: WorkoutWithPending) => !w.isPending))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadWorkouts intentionally omitted to prevent re-creation
  }, [
    user,
    isProcessingPending,
    processPendingWorkout,
    router,
    updateWorkoutData,
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
            const filtered = prev.filter((w: WorkoutWithPending) => !w.isPending)
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

      // Always refresh streak when screen is focused
      loadStreak()

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
        isProcessingPending={
          (workout as WorkoutWithPending).isPending && isProcessingPending
        }
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
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      </View>
    )
  }, [isLoadingMore, colors.brandPrimary, styles.loadingMoreContainer])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <View style={styles.headerTitleContainer}>
            {isProMember ? (
              <NavbarIsland>
                <TouchableOpacity
                  style={styles.repAiBadge}
                  onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.repAiBadgeText}>Home</Text>
                </TouchableOpacity>
              </NavbarIsland>
            ) : (
              <TouchableOpacity
                style={styles.proBadge}
                activeOpacity={1}
              >
                <Text style={styles.proBadgeText}>PRO</Text>
              </TouchableOpacity>
            )}
            {currentStreak > 0 && (
              <TouchableOpacity
                style={styles.streakButton}
                onPress={() => router.push('/workout-calendar')}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="flame" 
                  size={24} 
                  color={colors.brandPrimary} 
                  style={{ marginTop: 2 }} // Moved down by 2px (1px requested, but 2 looks better usually)
                />
                <View style={[styles.streakBadge, { bottom: -3 }]}> 
                  <Text style={styles.streakBadgeText}>{currentStreak}</Text>
                </View>
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
              <Ionicons name="search-outline" size={24} color={colors.textPrimary} />
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
                color={colors.textPrimary}
              />
              <NotificationBadge count={unreadCount} />
            </TouchableOpacity>
          </View>
        }
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={workouts}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 8,
                backgroundColor: colors.separator,
              }}
            />
          )}
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
            // Don't show tutorial when offline - show offline empty state instead
            !isTutorialDismissed &&
            !isTutorialLoading &&
            !isOffline &&
            workouts.length === 0 ? (
              <TutorialChecklist />
            ) : null
          }
          ListEmptyComponent={
            // Show empty state when:
            // 1. Tutorial is dismissed/loading OR we're offline, AND
            // 2. Feed is not loading
            (isTutorialDismissed || isTutorialLoading || isOffline) && !isLoading ? (
              isOffline ? (
                <EmptyState
                  icon="cloud-offline-outline"
                  title="You're offline"
                  description="Your feed will load when you're back online. You can still log workouts and they'll sync automatically."
                  buttonText="Log a Workout"
                  onPress={() => router.push('/(tabs)/create-post')}
                />
              ) : (
                <EmptyState
                  icon="barbell-outline"
                  title="Your feed is empty"
                  description="Follow friends or log your first workout to see activity here."
                  buttonText="Log Your First Workout"
                  onPress={() => router.push('/(tabs)/create-post')}
                />
              )
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
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    streakButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    streakBadge: {
      position: 'absolute',
      bottom: -4,
      right: -6,
      backgroundColor: colors.bg,
      borderRadius: 8,
      paddingHorizontal: 2,
      borderWidth: 1,
      borderColor: colors.bg,
    },
    streakBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    proBadge: {
      backgroundColor: colors.brandPrimary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    proBadgeText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    repAiBadge: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginLeft: 0,
    },
    repAiBadgeText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
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
      paddingBottom: 90,
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
      backgroundColor: colors.brandPrimary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.brandPrimary,
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

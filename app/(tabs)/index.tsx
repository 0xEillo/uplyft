import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { FlashList, FlashListRef } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Animated,
    LayoutAnimation,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { AppPostCard } from '@/components/app-post-card'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { EmptyState } from '@/components/EmptyState'
import type { ExerciseRankUpgrade } from '@/components/exercise-rank-overlay'
import { InviteFriendsPrompt } from '@/components/InviteFriendsPrompt'
import { NotificationBadge } from '@/components/notification-badge'
import { TutorialChecklist } from '@/components/Tutorial/TutorialChecklist'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useScrollToTop } from '@/contexts/scroll-to-top-context'
import type { StrengthScoreData } from '@/contexts/success-overlay-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { APP_POSTS, type AppPost } from '@/data/app-posts'
import { registerForPushNotifications } from '@/hooks/usePushNotifications'
import { useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { calculateOverallStrengthScore, scoreToOverallLevelProgress } from '@/lib/overall-strength-score'
import { getStrengthGender } from '@/lib/strength-progress'
import type { StrengthLevel } from '@/lib/strength-standards'
import { getStrengthStandard } from '@/lib/strength-standards'
import { getAndClearDeletedWorkoutIds } from '@/lib/utils/deleted-workouts'
import {
    prependProcessedWorkoutToFeed,
    replaceWorkoutInFeedById,
    shouldHydratePostedWorkout,
} from '@/lib/utils/posted-workout-optimizations'
import { loadPlaceholderWorkout } from '@/lib/utils/workout-draft'
import { WorkoutSessionWithDetails } from '@/types/database.types'

// Extended type to include pending workouts (placeholders)
type WorkoutWithPending = WorkoutSessionWithDetails & { isPending?: boolean }

type FeedItem =
  | { type: 'workout'; workout: WorkoutSessionWithDetails }
  | { type: 'app_post'; post: AppPost }

type AppPostState = {
  dismissed: Record<string, boolean>
  seenAtWorkoutCount: Record<string, number>
}

const DEFAULT_APP_POST_STATE: AppPostState = {
  dismissed: {},
  seenAtWorkoutCount: {},
}

const APP_POST_STORAGE_KEY = '@app_post_state'
const APP_POST_HIDE_AFTER_WORKOUTS = 6

const FEED_APP_POST_FIRST_AFTER = 2
const FEED_APP_POST_INTERVAL = 2
const FEED_APP_POST_BASE_COUNT = 5
const FEED_APP_POST_PER_WORKOUTS = 2

// BaseNavbar min-height (60) + vertical padding (8 * 2) = ~76
const NAVBAR_HEIGHT = 76

const buildFeedItems = (
  workouts: WorkoutSessionWithDetails[],
  appPosts: AppPost[],
): FeedItem[] => {
  if (workouts.length === 0) {
    return appPosts.map((post) => ({ type: 'app_post', post }))
  }

  const items: FeedItem[] = []
  let postIndex = 0
  let nextInsertAfter = FEED_APP_POST_FIRST_AFTER

  workouts.forEach((workout, index) => {
    items.push({ type: 'workout', workout })

    const workoutsSeen = index + 1
    if (postIndex < appPosts.length && workoutsSeen === nextInsertAfter) {
      items.push({ type: 'app_post', post: appPosts[postIndex] })
      postIndex += 1
      nextInsertAfter += FEED_APP_POST_INTERVAL
    }
  })

  return items
}

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

// --- Scroll Animations ---

export default function FeedScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const { unreadCount } = useNotifications()
  const { updateWorkoutData, showPointsGainOverlay, showExerciseRankOverlays } = useSuccessOverlay()
  const { registerScrollRef } = useScrollToTop()
  const { isTutorialDismissed, isLoading: isTutorialLoading } = useTutorial()
  const flatListRef = useRef<FlashListRef<FeedItem>>(null)
  const scrollY = useRef(new Animated.Value(0)).current
  const handleFeedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.setValue(event.nativeEvent.contentOffset.y)
    },
    [scrollY],
  )

  // --- Navigation Header Animations ---

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
  const [userWorkoutCount, setUserWorkoutCount] = useState(0)
  const [appPostState, setAppPostState] = useState<AppPostState>(
    DEFAULT_APP_POST_STATE,
  )
  const { processPendingWorkout, isProcessingPending } = useSubmitWorkout()
  const appPosts = useMemo(() => {
    const unlockedCount = Math.min(
      APP_POSTS.length,
      FEED_APP_POST_BASE_COUNT +
        Math.floor(userWorkoutCount / FEED_APP_POST_PER_WORKOUTS),
    )
    const unlockedPosts = APP_POSTS.slice(0, unlockedCount)
    return unlockedPosts.filter((post) => {
      if (appPostState.dismissed[post.id]) return false
      const seenAt = appPostState.seenAtWorkoutCount[post.id]
      if (seenAt === undefined) return true
      return userWorkoutCount - seenAt < APP_POST_HIDE_AFTER_WORKOUTS
    })
  }, [userWorkoutCount, appPostState])

  const persistAppPostState = useCallback(
    (nextState: AppPostState) => {
      setAppPostState(nextState)
      if (!user) return
      const storageKey = `${APP_POST_STORAGE_KEY}:${user.id}`
      AsyncStorage.setItem(storageKey, JSON.stringify(nextState)).catch(
        (error) => {
          console.error('Error saving app post state:', error)
        },
      )
    },
    [user],
  )

  const loadAppPostState = useCallback(async () => {
    if (!user) {
      setAppPostState(DEFAULT_APP_POST_STATE)
      return
    }
    const storageKey = `${APP_POST_STORAGE_KEY}:${user.id}`
    try {
      const stored = await AsyncStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppPostState>
        setAppPostState({
          dismissed: parsed.dismissed ?? {},
          seenAtWorkoutCount: parsed.seenAtWorkoutCount ?? {},
        })
      } else {
        setAppPostState(DEFAULT_APP_POST_STATE)
      }
    } catch (error) {
      console.error('Error loading app post state:', error)
      setAppPostState(DEFAULT_APP_POST_STATE)
    }
  }, [user])

  const handleAppPostCta = useCallback(
    (postId: string) => {
      const nextState: AppPostState = {
        dismissed: { ...appPostState.dismissed, [postId]: true },
        seenAtWorkoutCount: { ...appPostState.seenAtWorkoutCount },
      }
      persistAppPostState(nextState)
    },
    [appPostState, persistAppPostState],
  )

  const handleAppPostDismiss = useCallback(
    (post: AppPost) => {
      LayoutAnimation.configureNext(CardDeleteAnimation)
      handleAppPostCta(post.id)
    },
    [handleAppPostCta],
  )

  const loadUserWorkoutCount = useCallback(async () => {
    if (!user) return
    try {
      const count = await database.workoutSessions.getCountByUserId(user.id)
      setUserWorkoutCount(count)
    } catch (error) {
      console.error('Error loading workout count:', error)
    }
  }, [user])

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

  useEffect(() => {
    loadUserWorkoutCount()
  }, [loadUserWorkoutCount])

  useEffect(() => {
    loadAppPostState()
  }, [loadAppPostState])

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
        let cachedProfile = workout.profile ?? null

        setNewWorkoutId(workout.id)
        LayoutAnimation.configureNext(CustomSlideAnimation)

        // Optimistically prepend immediately so the feed updates as soon as the
        // server confirms creation. Hydration/profile work continues afterward.
        setWorkouts((prev) => prependProcessedWorkoutToFeed(prev, workout))
        setOffset((prev) => prev + 1)

        // Hydrate full workout details if the server returned a lightweight
        // payload (workout_exercises omitted for faster parse-workout response).
        try {
          const needsWorkoutHydration = shouldHydratePostedWorkout(workout)

          const [hydratedWorkout, fetchedProfile] = await Promise.all([
            needsWorkoutHydration
              ? database.workoutSessions.getById(workout.id).catch((error) => {
                  console.error('Error hydrating new workout details:', error)
                  return null
                })
              : Promise.resolve(null),
            cachedProfile
              ? Promise.resolve(cachedProfile)
              : database.profiles.getById(user.id).catch((error) => {
                  console.error('Error fetching profile for new workout:', error)
                  return null
                }),
          ])

          if (fetchedProfile) {
            cachedProfile = fetchedProfile
          }

          if (hydratedWorkout) {
            workout = {
              ...hydratedWorkout,
              profile: hydratedWorkout.profile ?? cachedProfile ?? undefined,
            }
          } else if (cachedProfile && !workout.profile) {
            workout = { ...workout, profile: cachedProfile }
          }

          if (hydratedWorkout || fetchedProfile) {
            setWorkouts((prev) => replaceWorkoutInFeedById(prev, workout))
          }
        } catch (error) {
          console.error('Error hydrating newly posted workout:', error)
        }

        // Update success overlay context with workout data for share screen
        updateWorkoutData(workout)

        // Compute strength score delta for points gain overlay
        try {
          console.log('[Overlay] index: computing strength score delta for workout', workout.id)
          const prof =
            cachedProfile ??
            workout.profile ??
            await database.profiles.getById(user.id)
          if (prof && !cachedProfile) {
            cachedProfile = prof
          }
          const strengthGender = getStrengthGender(prof?.gender ?? null)

          if (!strengthGender || !prof?.weight_kg) {
            console.log('[Overlay] index: skipping overlays - no strengthGender or weight', { strengthGender: !!strengthGender, hasWeight: !!prof?.weight_kg })
          }
          if (strengthGender && prof?.weight_kg) {
            // Get current exercise data (after this workout) and snapshots
            const [exerciseData, snapshots] = await Promise.all([
              database.stats.getMajorCompoundLiftsData(user.id),
              database.stats.getExerciseCurrentAndPreviousBest1RMs(user.id),
            ])
            if (exerciseData.length === 0) {
              console.log('[Overlay] index: skipping overlays - no exercise data')
            }
            if (exerciseData.length > 0) {
              // Current score (with new workout PRs)
              const currentResult = calculateOverallStrengthScore({
                gender: strengthGender,
                bodyweightKg: prof.weight_kg,
                exercises: exerciseData,
              })

              // Baseline score (using previous best 1RMs where available)
              const baselineExercises = exerciseData.map((ex) => {
                const snapshot = snapshots[ex.exerciseId]
                const isNewPR = snapshot?.lastIncreaseSessionId === workout.id

                if (isNewPR) {
                  return {
                    ...ex,
                    max1RM: snapshot.previousBest1RM,
                  }
                }

                return {
                  ...ex,
                  max1RM: ex.max1RM,
                }
              })

              const baselineResult = calculateOverallStrengthScore({
                gender: strengthGender,
                bodyweightKg: prof.weight_kg,
                exercises: baselineExercises,
              })

              const pointsGained = Math.max(0, Math.round(currentResult.score - baselineResult.score))

              // Detect per-exercise rank upgrades
              const exerciseUpgrades: ExerciseRankUpgrade[] = []
              const genderKey = strengthGender === 'male' ? 'male' : ('female' as 'male' | 'female')
              console.log('[Overlay] index: checking', exerciseData.length, 'exercises for rank upgrades, workoutId=', workout.id)
              for (const ex of exerciseData) {
                const snapshot = snapshots[ex.exerciseId]
                const isNewPR = snapshot?.lastIncreaseSessionId === workout.id
                const skipReason = !isNewPR ? 'not a new PR' : snapshot?.previousBest1RM == null ? 'no previousBest1RM snapshot' : null
                if (skipReason) {
                  console.log('[Overlay] index: skip', ex.exerciseName, '-', skipReason, { lastIncreaseSessionId: snapshot?.lastIncreaseSessionId, previousBest1RM: snapshot?.previousBest1RM })
                  continue
                }

                const LEVEL_ORDER = ['Untrained', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'World Class']
                const currentStd = getStrengthStandard(ex.exerciseName, genderKey, prof.weight_kg, ex.max1RM)
                // previousBest1RM can be 0 (never tracked before = Untrained)
                const prevStd = snapshot.previousBest1RM > 0
                  ? getStrengthStandard(ex.exerciseName, genderKey, prof.weight_kg, snapshot.previousBest1RM)
                  : null
                const prevLevel = prevStd?.level ?? 'Untrained'
                const currLevel = currentStd?.level

                console.log('[Overlay] index: exercise', ex.exerciseName, '| prev1RM=', snapshot.previousBest1RM, 'curr1RM=', ex.max1RM, '| prevLevel=', prevLevel, 'currLevel=', currLevel)

                if (currentStd && currLevel && currLevel !== prevLevel) {
                  const prevIdx = LEVEL_ORDER.indexOf(prevLevel)
                  const currIdx = LEVEL_ORDER.indexOf(currLevel)
                  if (currIdx > prevIdx) {
                    console.log('[Overlay] index: RANK UP', ex.exerciseName, prevLevel, '->', currLevel)
                    exerciseUpgrades.push({
                      exerciseName: ex.exerciseName,
                      previousLevel: prevLevel as StrengthLevel,
                      currentLevel: currLevel as StrengthLevel,
                    })
                  } else {
                    console.log('[Overlay] index: level changed but downgrade/same idx, skipping', ex.exerciseName)
                  }
                } else if (!currentStd) {
                  console.log('[Overlay] index: no std found for', ex.exerciseName, '(exercise not in standards config)')
                }
              }

              if (!(pointsGained > 0 && currentResult.liftsTracked > 0) && exerciseUpgrades.length === 0) {
                console.log('[Overlay] index: no overlays - pointsGained=', pointsGained, 'liftsTracked=', currentResult.liftsTracked, 'exerciseUpgrades=', exerciseUpgrades.length)
              }
              if (pointsGained > 0 && currentResult.liftsTracked > 0) {
                const levelProgress = scoreToOverallLevelProgress(currentResult.score)
                const baselineLevelProgress = scoreToOverallLevelProgress(baselineResult.score)
                const scoreData: StrengthScoreData = {
                  previousScore: baselineResult.score,
                  currentScore: currentResult.score,
                  pointsGained,
                  previousLevel: baselineLevelProgress.level,
                  currentLevel: levelProgress.level,
                  nextLevel: levelProgress.nextLevel,
                  progress: levelProgress.progress,
                }
                if (exerciseUpgrades.length > 0) {
                  // Show exercise rank overlays first, then points gain overlay
                  console.log('[Overlay] index: showing exercise rank overlays first, points queued', { exerciseUpgrades: exerciseUpgrades.length, pointsGained })
                  showExerciseRankOverlays(exerciseUpgrades, scoreData)
                } else {
                  // Delay to show after streak overlay fades
                  console.log('[Overlay] index: scheduling points overlay in 800ms', { pointsGained })
                  setTimeout(() => showPointsGainOverlay(scoreData), 800)
                }
              } else if (exerciseUpgrades.length > 0) {
                // Exercise rank upgrades but no overall points — just show rank overlays
                console.log('[Overlay] index: exercise rank upgrades only (no points)', { exerciseUpgrades: exerciseUpgrades.length })
                showExerciseRankOverlays(exerciseUpgrades)
              }
            }
          }
        } catch (err) {
          console.error('[Feed] Error computing strength score delta:', err)
        }

        // Check if this is the first workout and prompt for push notifications
        try {
          const [profile, workoutCount] = await Promise.all([
            cachedProfile
              ? Promise.resolve(cachedProfile)
              : database.profiles.getById(user.id),
            database.workoutSessions.getCountByUserId(user.id),
          ])
          if (profile && !cachedProfile) {
            cachedProfile = profile
          }
          setUserWorkoutCount(workoutCount)

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
    showPointsGainOverlay,
    showExerciseRankOverlays,
  ])

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
      loadUserWorkoutCount()

      // Process pending post in background (non-blocking)
      // CreateButton spinner in tab bar responds via shared pending status
      handlePendingPost()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      handlePendingPost,
      loadWorkouts,
      isInitialLoad,
      trackEvent,
      loadUserWorkoutCount,
    ]),
  )

  const styles = createStyles(colors)
  const feedItems = useMemo(
    () => buildFeedItems(workouts, appPosts),
    [workouts, appPosts],
  )

  useEffect(() => {
    if (!user || appPosts.length === 0) return
    const unseenPosts = appPosts.filter(
      (post) =>
        appPostState.seenAtWorkoutCount[post.id] === undefined &&
        !appPostState.dismissed[post.id],
    )
    if (unseenPosts.length === 0) return

    const nextState: AppPostState = {
      dismissed: { ...appPostState.dismissed },
      seenAtWorkoutCount: { ...appPostState.seenAtWorkoutCount },
    }

    unseenPosts.forEach((post) => {
      nextState.seenAtWorkoutCount[post.id] = userWorkoutCount
    })

    persistAppPostState(nextState)
  }, [appPosts, appPostState, persistAppPostState, user, userWorkoutCount])

  const renderFeedItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => {
      if (item.type === 'app_post') {
        return (
          <AppPostCard
            post={item.post}
            isFirst={index === 0}
            onCtaPress={(post) => handleAppPostCta(post.id)}
            onDismiss={handleAppPostDismiss}
          />
        )
      }

      const workout = item.workout
      return (
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
      )
    },
    [newWorkoutId, deletingWorkoutId, trackEvent, isProcessingPending, handleAppPostCta, handleAppPostDismiss],
  )

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      </View>
    )
  }, [isLoadingMore, colors.brandPrimary, styles.loadingMoreContainer])

  const insets = useSafeAreaInsets()
  const headerTotalHeight = insets.top + NAVBAR_HEIGHT

  return (
    <View
      collapsable={false}
      style={styles.container}
    >
      {/* Blurred navbar overlay */}
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <View style={styles.headerTitleContainer}>
              {/* Small title — fades IN when scrolled */}
              <Text
                style={styles.navbarSmallTitle}
                numberOfLines={1}
                onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              >
                Home
              </Text>
              {currentStreak > 0 && (
                <View>
                  <TouchableOpacity
                    onPress={() => router.push('/workout-calendar')}
                    activeOpacity={0.7}
                  >
                    <NavbarIsland style={styles.circleActionIsland}>
                      <View style={styles.streakButton}>
                        <Ionicons
                          name="flame"
                          size={24}
                          color={colors.brandPrimary}
                          style={{ marginTop: 2 }}
                        />
                      </View>
                    </NavbarIsland>
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakBadgeText}>{currentStreak}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          rightContent={
            <NavbarIsland style={styles.actionsIsland}>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => router.push('/search')}
                  style={styles.iconButton}
                >
                  <Ionicons name="search-outline" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/notifications')}
                  style={styles.notificationButton}
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
            </NavbarIsland>
          }
        />
      </BlurredHeader>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlashList<FeedItem>
          ref={flatListRef}
          data={feedItems}
          estimatedItemSize={320}
          getItemType={(item: FeedItem) => item.type}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 8,
                backgroundColor: colors.separator,
              }}
            />
          )}
          renderItem={renderFeedItem}
          keyExtractor={(item: FeedItem) =>
            item.type === 'workout'
              ? `workout-${item.workout.id}`
              : `app-post-${item.post.id}`
          }
          contentContainerStyle={[
            styles.feed,
            { paddingTop: headerTotalHeight },
            feedItems.length === 0 && styles.emptyFeed,
          ]}
          scrollIndicatorInsets={{ top: headerTotalHeight }}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={handleFeedScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <>
              <InviteFriendsPrompt />
              {/* Tutorial checklist (existing) */}
              {/* Tutorial checklist (existing) */}
              {!isTutorialDismissed &&
                !isTutorialLoading &&
                !isOffline &&
                workouts.length === 0 ? (
                <TutorialChecklist />
              ) : null}
            </>
          }
          ListEmptyComponent={
            // Show empty state when:
            // 1. Tutorial is dismissed/loading OR we're offline, AND
            // 2. Feed is not loading
            (isTutorialDismissed || isTutorialLoading || isOffline) &&
            !isLoading &&
            feedItems.length === 0 ? (
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
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          progressViewOffset={headerTotalHeight}
        />
      )}
    </View>
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
      gap: 8,
    },
    navbarSmallTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      marginLeft: 2,
    },
    largeTitleContainer: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 10,
    },
    largeTitleText: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    streakButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleActionIsland: {
      width: 44,
      height: 44,
      borderRadius: 22,
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    streakBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 2,
      borderWidth: 1,
      borderColor: colors.bg,
    },
    streakBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    actionsIsland: {
      height: 44,
      borderRadius: 22,
      paddingHorizontal: 10,
      width: 'auto',
      minWidth: 0,
      overflow: 'visible',
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationButton: {
      position: 'relative',
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
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

import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { NotificationBadge } from '@/components/notification-badge'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

const PENDING_POST_KEY = '@pending_workout_post'
const DRAFT_KEY = '@workout_draft'
const TITLE_DRAFT_KEY = '@workout_title_draft'

export default function FeedScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { weightUnit } = useWeightUnits()
  const { trackEvent } = useAnalytics()
  const { unreadCount } = useNotifications()
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [newWorkoutId, setNewWorkoutId] = useState<string | null>(null)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  )

  const loadWorkouts = useCallback(
    async (showLoading = false) => {
      if (!user) return

      try {
        if (showLoading) {
          setIsLoading(true)
        }
        const data = await database.workoutSessions.getRecent(user.id, 20)

        // Use animation when updating existing list
        if (!isInitialLoad && workouts.length > 0) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        }

        setWorkouts(data)
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
    if (!user) return

    try {
      const pendingData = await AsyncStorage.getItem(PENDING_POST_KEY)
      if (!pendingData) return

      const { notes, title, imageUrl = null } = JSON.parse(pendingData)

      // Get the access token for authenticated API calls
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Parse workout and create it in database with AI-enriched exercises
      // Use AbortController to set a generous timeout for AI processing
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 second timeout

      const { callSupabaseFunction } = await import(
        '@/lib/supabase-functions-client'
      )

      const response = await callSupabaseFunction(
        'parse-workout',
        'POST',
        {
          notes,
          weightUnit,
          createWorkout: true,
          userId: user.id,
          workoutTitle: title,
          imageUrl,
        },
        {},
        accessToken,
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to parse workout'

        // Restore notes to draft for user to retry
        await AsyncStorage.setItem(DRAFT_KEY, notes)
        if (title) {
          await AsyncStorage.setItem(TITLE_DRAFT_KEY, title)
        }
        await AsyncStorage.removeItem(PENDING_POST_KEY)

        // Show friendly error with actionable options
        Alert.alert('Unable to Parse Workout', errorMessage, [
          {
            text: 'Edit & Try Again',
            onPress: () => router.push('/(tabs)/create-post'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ])
        return
      }

      const data = await response.json()

      // Check if there was a DB error during workout creation
      if (data.error) {
        throw new Error(data.details || data.error)
      }

      // Get the created workout (with AI-enriched exercises)
      const newWorkout = data.createdWorkout

      // Clear pending post and draft on success
      await AsyncStorage.removeItem(PENDING_POST_KEY)
      await AsyncStorage.removeItem(DRAFT_KEY)
      await AsyncStorage.removeItem(TITLE_DRAFT_KEY)

      // Mark this workout as new for animation
      setNewWorkoutId(newWorkout.id)

      // Smooth layout animation for existing cards sliding down
      LayoutAnimation.configureNext(CustomSlideAnimation)

      // Add new workout to the top of the list
      setWorkouts((prev) => [newWorkout, ...prev])

      // Clear new workout flag after animation completes
      setTimeout(() => setNewWorkoutId(null), 1000)
    } catch (error) {
      console.error('Error creating post:', error)

      // Restore notes and title to draft for user to retry
      try {
        const pendingData = await AsyncStorage.getItem(PENDING_POST_KEY)
        if (pendingData) {
          const { notes, title } = JSON.parse(pendingData)
          await AsyncStorage.setItem(DRAFT_KEY, notes)
          if (title) {
            await AsyncStorage.setItem(TITLE_DRAFT_KEY, title)
          }
          await AsyncStorage.removeItem(PENDING_POST_KEY)
        }
      } catch (restoreError) {
        console.error('Error restoring draft:', restoreError)
      }

      // Provide specific error message for timeout
      const isTimeout = error instanceof Error && error.name === 'AbortError'
      const errorMessage = isTimeout
        ? 'The request took too long. This usually happens with slow internet or large workouts. Your draft has been saved - please try again.'
        : 'Something went wrong while saving your workout. Please try again.'

      Alert.alert('Error', errorMessage, [
        {
          text: 'Try Again',
          onPress: () => router.push('/(tabs)/create-post'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ])
    }
  }, [user, router, weightUnit])

  useFocusEffect(
    useCallback(() => {
      trackEvent('Feed Viewed', {
        timestamp: Date.now(),
        workoutCount: workouts.length,
      })

      handlePendingPost().then(() => {
        // Only show loading spinner on initial load
        loadWorkouts(isInitialLoad)
      })
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feed Posts */}
        <View style={styles.feed}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="barbell-outline"
                size={64}
                color={colors.textPlaceholder}
              />
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to log your first workout
              </Text>
            </View>
          ) : (
            workouts.map((workout, index) => (
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

                    trackEvent('Workout Create Saved', {
                      workoutId: workout.id,
                      action: 'delete_confirmed',
                    })
                  } else {
                    // Mark for deletion to trigger exit animation
                    setDeletingWorkoutId(workout.id)

                    trackEvent('Workout Create Saved', {
                      workoutId: workout.id,
                      action: 'delete_requested',
                    })
                  }
                }}
              />
            ))
          )}
        </View>
      </ScrollView>
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
      paddingVertical: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      paddingVertical: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 15,
      color: colors.textLight,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
  })

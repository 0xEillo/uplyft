import { AnimatedFeedCard } from '@/components/animated-feed-card'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
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

export default function FeedScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const { isDark } = useTheme()
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

      const { notes, title } = JSON.parse(pendingData)

      // Parse workout
      const response = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to parse workout'

        // Restore notes to draft for user to retry
        await AsyncStorage.setItem(DRAFT_KEY, notes)
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
      const { workout } = data

      // Override type with user-provided title
      workout.type = title

      // Save to database and get the created workout back
      const createdSession = await database.workoutSessions.create(
        user.id,
        workout,
        notes,
      )

      // Clear pending post on success
      await AsyncStorage.removeItem(PENDING_POST_KEY)

      // Fetch the complete workout with all details
      const newWorkout = await database.workoutSessions.getById(
        createdSession.id,
      )

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

      // Restore notes to draft for user to retry
      try {
        const pendingData = await AsyncStorage.getItem(PENDING_POST_KEY)
        if (pendingData) {
          const { notes } = JSON.parse(pendingData)
          await AsyncStorage.setItem(DRAFT_KEY, notes)
          await AsyncStorage.removeItem(PENDING_POST_KEY)
        }
      } catch (restoreError) {
        console.error('Error restoring draft:', restoreError)
      }

      Alert.alert(
        'Error',
        'Something went wrong while saving your workout. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => router.push('/(tabs)/create-post'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      )
    }
  }, [user, router])

  useFocusEffect(
    useCallback(() => {
      handlePendingPost().then(() => {
        // Only show loading spinner on initial load
        loadWorkouts(isInitialLoad)
      })
    }, [handlePendingPost, loadWorkouts, isInitialLoad]),
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
                ? require('@/llm/bellwhite.png')
                : require('@/llm/bellblack.png')
            }
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Rep AI</Text>
        </View>
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
                  } else {
                    // Mark for deletion to trigger exit animation
                    setDeletingWorkoutId(workout.id)
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
      justifyContent: 'center',
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
      gap: 8,
    },
    headerIcon: {
      width: 28,
      height: 28,
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

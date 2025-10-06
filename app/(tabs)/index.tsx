import { FeedCard } from '@/components/feed-card'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const PENDING_POST_KEY = '@pending_workout_post'
const DRAFT_KEY = '@workout_draft'

export default function FeedScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const [workouts, setWorkouts] = useState<WorkoutSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadWorkouts = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      const data = await database.workoutSessions.getRecent(user.id, 20)
      setWorkouts(data)
    } catch (error) {
      console.error('Error loading workouts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

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
        throw new Error('Failed to parse workout')
      }

      const data = await response.json()
      const { workout } = data

      // Override type with user-provided title
      workout.type = title

      // Save to database
      await database.workoutSessions.create(user.id, workout, notes)

      // Clear pending post on success
      await AsyncStorage.removeItem(PENDING_POST_KEY)

      // Reload workouts to show new post
      await loadWorkouts()
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

      Alert.alert('Error', 'Failed to create workout post. Please try again.')
      router.push('/(tabs)/create-post')
    }
  }, [user, loadWorkouts, router])

  useFocusEffect(
    useCallback(() => {
      handlePendingPost().then(() => loadWorkouts())
    }, [handlePendingPost, loadWorkouts]),
  )

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Flex AI</Text>
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
            workouts.map((workout) => (
              <AsyncPrFeedCard
                key={workout.id}
                workout={workout}
                onDelete={loadWorkouts}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function AsyncPrFeedCard({
  workout,
  onDelete,
}: {
  workout: WorkoutSessionWithDetails
  onDelete: () => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const [prs, setPrs] = useState<number>(0)
  const [prInfo, setPrInfo] = useState<any[]>([])
  const [isComputed, setIsComputed] = useState(false)

  const compute = useCallback(async () => {
    if (!user || isComputed) return
    try {
      const ctx = {
        sessionId: workout.id,
        userId: user.id,
        createdAt: workout.created_at,
        exercises: (workout.workout_exercises || []).map((we) => ({
          exerciseId: we.exercise_id,
          exerciseName: we.exercise?.name || 'Exercise',
          sets: (we.sets || []).map((s) => ({
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      }
      const result = await PrService.computePrsForSession(ctx)
      setPrs(result.totalPrs)

      // Build PR info for the feed card
      const prData = result.perExercise.map((exPr) => ({
        exerciseName: exPr.exerciseName,
        prSetIndices: new Set(exPr.prs.flatMap((pr) => pr.setIndices || [])),
        prLabels: exPr.prs.map((pr) => pr.label),
        hasCurrentPR: exPr.prs.some((pr) => pr.isCurrent),
      }))
      setPrInfo(prData)
      setIsComputed(true)
    } catch (error) {
      console.error('Error computing PRs:', error)
      setPrs(0)
      setPrInfo([])
    }
  }, [user, workout, isComputed])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  const exercises = formatWorkoutForDisplay(workout)

  const handleUserPress = () => {
    if (workout.user_id && workout.user_id !== user?.id) {
      router.push(`/user/${workout.user_id}`)
    }
  }

  const handleEdit = () => {
    router.push(`/edit-workout/${workout.id}`)
  }

  const handleDelete = async () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.workoutSessions.delete(workout.id)
              onDelete()
            } catch (error) {
              console.error('Error deleting workout:', error)
              Alert.alert(
                'Error',
                'Failed to delete workout. Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  return (
    <FeedCard
      userName="You"
      userAvatar=""
      timeAgo={formatTimeAgo(workout.created_at)}
      workoutTitle={
        workout.type || workout.notes?.split('\n')[0] || 'Workout Session'
      }
      workoutDescription={workout.notes}
      exercises={exercises}
      stats={{
        exercises: (workout.workout_exercises || []).length,
        sets:
          workout.workout_exercises?.reduce(
            (sum, we) => sum + (we.sets?.length || 0),
            0,
          ) || 0,
        prs,
      }}
      likes={0}
      comments={0}
      userId={workout.user_id}
      workoutId={workout.id}
      onUserPress={workout.user_id !== user?.id ? handleUserPress : undefined}
      onEdit={handleEdit}
      onDelete={handleDelete}
      prInfo={prInfo}
    />
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

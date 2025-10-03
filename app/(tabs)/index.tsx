import { FeedCard } from '@/components/feed-card'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

// -------- Helpers (module scope) --------
function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

function formatExerciseDetails(workout: WorkoutSessionWithDetails) {
  if (!workout.workout_exercises || workout.workout_exercises.length === 0) {
    return workout.notes || 'No exercises logged'
  }

  return workout.workout_exercises
    .map((we) => {
      const exercise = we.exercise
      const sets = we.sets || []

      if (sets.length === 0) {
        return `• ${exercise.name}`
      }

      const allSame = sets.every(
        (s) => s.reps === sets[0].reps && s.weight === sets[0].weight,
      )

      let setsSummary = ''
      if (allSame && sets.length > 1) {
        const weight = sets[0].weight ? ` @ ${sets[0].weight}lbs` : ''
        setsSummary = `${sets.length}x${sets[0].reps}${weight}`
      } else {
        setsSummary = sets
          .map((set) => {
            const weight = set.weight ? ` @ ${set.weight}lbs` : ''
            return `${set.reps}${weight}`
          })
          .join(', ')
      }

      return `• ${exercise.name}: ${setsSummary}`
    })
    .join('\n')
}

export default function FeedScreen() {
  const { user } = useAuth()
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

  useFocusEffect(
    useCallback(() => {
      loadWorkouts()
    }, [loadWorkouts]),
  )

  const formatExerciseDetails = (workout: WorkoutSessionWithDetails) => {
    if (!workout.workout_exercises || workout.workout_exercises.length === 0) {
      return workout.notes || 'No exercises logged'
    }

    return workout.workout_exercises
      .map((we, index) => {
        const exercise = we.exercise
        const sets = we.sets || []

        if (sets.length === 0) {
          return `• ${exercise.name}`
        }

        // Check if all sets have the same reps and weight (like 5x5)
        const allSame = sets.every(
          (s) => s.reps === sets[0].reps && s.weight === sets[0].weight,
        )

        let setsSummary = ''
        if (allSame && sets.length > 1) {
          // Format as "5x5 @ 225lbs"
          const weight = sets[0].weight ? ` @ ${sets[0].weight}lbs` : ''
          setsSummary = `${sets.length}x${sets[0].reps}${weight}`
        } else {
          // Format as individual sets: "5, 5, 5, 4, 3 @ 225lbs" or list each
          setsSummary = sets
            .map((set) => {
              const weight = set.weight ? ` @ ${set.weight}lbs` : ''
              return `${set.reps}${weight}`
            })
            .join(', ')
        }

        return `• ${exercise.name}: ${setsSummary}`
      })
      .join('\n')
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uplyft</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feed Posts */}
        <View style={styles.feed}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="barbell-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to log your first workout
              </Text>
            </View>
          ) : (
            workouts.map((workout) => (
              <AsyncPrFeedCard key={workout.id} workout={workout} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function AsyncPrFeedCard({ workout }: { workout: WorkoutSessionWithDetails }) {
  const { user } = useAuth()
  const [prs, setPrs] = useState<number>(0)

  const compute = useCallback(async () => {
    if (!user) return
    const ctx = {
      sessionId: workout.id,
      userId: user.id,
      createdAt: workout.created_at,
      exercises: (workout.workout_exercises || []).map((we) => ({
        exerciseId: we.exercise_id,
        exerciseName: we.exercise?.name || 'Exercise',
        sets: (we.sets || []).map((s) => ({ reps: s.reps, weight: s.weight })),
      })),
    }
    const result = await PrService.computePrsForSession(ctx)
    setPrs(result.totalPrs)
  }, [user, workout])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  return (
    <FeedCard
      userName="You"
      userAvatar=""
      timeAgo={formatTimeAgo(workout.created_at)}
      workoutTitle={workout.notes?.split('\n')[0] || 'Workout Session'}
      description={formatExerciseDetails(workout)}
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
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
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
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})

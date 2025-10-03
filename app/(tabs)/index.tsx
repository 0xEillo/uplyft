import { FeedCard } from '@/components/feed-card'
import { AppColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import {
  formatTimeAgo,
  formatWorkoutForDisplay,
} from '@/lib/utils/formatters'
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uplyft</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color={AppColors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feed Posts */}
        <View style={styles.feed}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="barbell-outline"
                size={64}
                color={AppColors.textPlaceholder}
              />
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
          sets: (we.sets || []).map((s) => ({ reps: s.reps, weight: s.weight })),
        })),
      }
      const result = await PrService.computePrsForSession(ctx)
      setPrs(result.totalPrs)
      setIsComputed(true)
    } catch (error) {
      console.error('Error computing PRs:', error)
      setPrs(0)
    }
  }, [user, workout, isComputed])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  const exercises = formatWorkoutForDisplay(workout)

  return (
    <FeedCard
      userName="You"
      userAvatar=""
      timeAgo={formatTimeAgo(workout.created_at)}
      workoutTitle={workout.notes?.split('\n')[0] || 'Workout Session'}
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
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.text,
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
    color: AppColors.textTertiary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: AppColors.textLight,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})

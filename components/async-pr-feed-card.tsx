import { FeedCard } from '@/components/feed-card'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { memo, useCallback, useState } from 'react'
import { Alert } from 'react-native'

interface PrInfo {
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  hasCurrentPR: boolean
}

interface AsyncPrFeedCardProps {
  workout: WorkoutSessionWithDetails
  onDelete: () => void
}

/**
 * Feed card component that asynchronously computes PRs for a workout session.
 * Memoized to prevent unnecessary re-renders and PR recomputations.
 */
export const AsyncPrFeedCard = memo(function AsyncPrFeedCard({
  workout,
  onDelete,
}: AsyncPrFeedCardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [prs, setPrs] = useState<number>(0)
  const [prInfo, setPrInfo] = useState<PrInfo[]>([])
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
  }, [user?.id, workout.id, workout.created_at, isComputed])

  useFocusEffect(
    useCallback(() => {
      compute()
    }, [compute]),
  )

  const exercises = formatWorkoutForDisplay(workout)

  const handleUserPress = useCallback(() => {
    if (workout.user_id && workout.user_id !== user?.id) {
      router.push(`/user/${workout.user_id}`)
    }
  }, [workout.user_id, user?.id, router])

  const handleEdit = useCallback(() => {
    router.push(`/edit-workout/${workout.id}`)
  }, [workout.id, router])

  const handleDelete = useCallback(async () => {
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
  }, [workout.id, onDelete])

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
})

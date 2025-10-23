import { FeedCard } from '@/components/feed-card'
import { useAuth } from '@/contexts/auth-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'

interface PrDetailForDisplay {
  label: string
  previous?: number
  current: number
  isCurrent: boolean
}

interface PrInfo {
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  prDetails: PrDetailForDisplay[]
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
  const { weightUnit } = useWeightUnits()
  const [prs, setPrs] = useState<number>(0)
  const [prInfo, setPrInfo] = useState<PrInfo[]>([])
  const computeContext = useMemo(() => {
    if (!user) return null
    return {
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
  }, [user, workout])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const loadProfile = async () => {
      try {
        const profile = await database.profiles.getById(user.id)
        setAvatarUrl(profile.avatar_url)
      } catch (error) {
        console.error('Error loading profile:', error)
        setAvatarUrl(null)
      }
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    if (!computeContext) return

    let isMounted = true

    const compute = async () => {
      try {
        const result = await PrService.computePrsForSession(computeContext)
        if (!isMounted) return

        setPrs(result.totalPrs)

        const prData = result.perExercise.map((exPr) => ({
          exerciseName: exPr.exerciseName,
          prSetIndices: new Set(exPr.prs.flatMap((pr) => pr.setIndices || [])),
          prLabels: exPr.prs.map((pr) => pr.label),
          prDetails: exPr.prs.map((pr) => ({
            label: pr.label,
            previous: pr.previous,
            current: pr.current,
            isCurrent: pr.isCurrent,
          })),
          hasCurrentPR: exPr.prs.some((pr) => pr.isCurrent),
        }))
        setPrInfo(prData)
      } catch (error) {
        console.error('Error computing PRs:', error)
        if (isMounted) {
          setPrs(0)
          setPrInfo([])
        }
      }
    }

    compute()

    return () => {
      isMounted = false
    }
  }, [computeContext])

  const exercises = formatWorkoutForDisplay(workout, weightUnit)

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
      userAvatar={avatarUrl || ''}
      timeAgo={formatTimeAgo(workout.created_at)}
      workoutTitle={
        workout.type || workout.notes?.split('\n')[0] || 'Workout Session'
      }
      workoutDescription={workout.notes}
      workoutImageUrl={workout.image_url}
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
      userId={workout.user_id}
      workoutId={workout.id}
      onUserPress={workout.user_id !== user?.id ? handleUserPress : undefined}
      onEdit={handleEdit}
      onDelete={handleDelete}
      prInfo={prInfo}
    />
  )
})

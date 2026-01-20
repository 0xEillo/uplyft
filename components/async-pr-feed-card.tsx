import { FeedCard } from '@/components/feed-card'
import { useAuth } from '@/contexts/auth-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { calculateTotalVolume } from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { usePathname, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'

interface PrDetailForDisplay {
  label: string
  weight: number
  previousReps?: number
  currentReps: number
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
  isFirst?: boolean
  /** Whether a pending workout is actively being processed (vs just queued) */
  isProcessingPending?: boolean
}

/**
 * Feed card component that asynchronously computes PRs for a workout session.
 * Memoized to prevent unnecessary re-renders and PR recomputations.
 */
export const AsyncPrFeedCard = memo(function AsyncPrFeedCard({
  workout,
  onDelete,
  isFirst = false,
  isProcessingPending = false,
}: AsyncPrFeedCardProps) {
  const { user, isAnonymous } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
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

  // Determine if this workout belongs to the current user
  const isOwnWorkout = user?.id === workout.user_id

  // Get user display info from the workout's profile data
  const userName = isOwnWorkout
    ? 'You'
    : workout.profile?.display_name || 'User'
  const avatarUrl = workout.profile?.avatar_url || null

  // Social interaction states
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)

  // Fetch social stats
  useEffect(() => {
    if (!user || !workout.id || workout.isPending) return

    const fetchSocialStats = async () => {
      try {
        // Fetch like count and check if user has liked
        const [
          likeCountResult,
          hasLikedResult,
          commentCountResult,
        ] = await Promise.all([
          database.workoutLikes.getCount(workout.id),
          database.workoutLikes.hasLiked(workout.id, user.id),
          database.workoutComments.getCount(workout.id),
        ])

        setLikeCount(likeCountResult)
        setIsLiked(hasLikedResult)
        setCommentCount(commentCountResult)
      } catch (error) {
        console.error('Error fetching social stats:', error)
      }
    }

    fetchSocialStats()
  }, [user, workout.id, workout.isPending])

  // Handle like toggle
  const handleLike = useCallback(async () => {
    if (!user || !workout.id) return

    // Block anonymous users from liking
    if (isAnonymous) {
      router.push('/(auth)/create-account')
      return
    }

    try {
      if (isLiked) {
        await database.workoutLikes.unlike(workout.id, user.id)
        setIsLiked(false)
        setLikeCount((prev) => Math.max(0, prev - 1))
      } else {
        await database.workoutLikes.like(workout.id, user.id)
        setIsLiked(true)
        setLikeCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }, [user, workout.id, isLiked, isAnonymous, router])

  // Handle comment - navigate to comments screen
  const handleComment = useCallback(() => {
    router.push(`/workout-comments/${workout.id}`)
  }, [workout.id, router])

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
            weight: pr.weight,
            previousReps: pr.previousReps,
            currentReps: pr.currentReps,
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
    if (!workout.user_id) return
    router.push(`/user/${workout.user_id}`)
  }, [workout.user_id, router])

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

  const handleCreateRoutine = useCallback(() => {
    router.push(`/create-routine?from=${workout.id}`)
  }, [workout.id, router])

  const handleCardPress = useCallback(() => {
    router.push({
      pathname: '/workout/[workoutId]',
      params: {
        workoutId: workout.id,
        returnTo: pathname,
      },
    })
  }, [workout.id, router, pathname])

  const handleRoutinePress = useCallback(() => {
    if (workout.routine?.id) {
      router.push({
        pathname: '/routine/[routineId]',
        params: { routineId: workout.routine.id },
      })
    }
  }, [workout.routine, router])

  // Check if this is a pending placeholder workout
  const isPending = workout.isPending === true

  return (
    <FeedCard
      userName={userName}
      userAvatar={avatarUrl || ''}
      timeAgo={isPending ? 'Just now' : formatTimeAgo(workout.created_at)}
      workoutTitle={
        isPending
          ? (workout as any).title || 'Workout'
          : workout.type || workout.notes?.split('\n')[0] || 'Workout Session'
      }
      workoutDescription={isPending ? null : workout.notes}
      workoutImageUrl={
        isPending ? (workout as any).imageUrl || null : workout.image_url
      }
      exercises={exercises}
      stats={{
        exercises: (workout.workout_exercises || []).length,
        sets:
          workout.workout_exercises?.reduce(
            (sum, we) => sum + (we.sets?.length || 0),
            0,
          ) || 0,
        prs,
        durationSeconds: workout.duration ?? undefined,
        volume: calculateTotalVolume(workout, 'kg'),
      }}
      userId={workout.user_id}
      workoutId={workout.id}
      workout={isPending ? undefined : workout}
      onUserPress={workout.user_id ? handleUserPress : undefined}
      onCardPress={isPending ? undefined : handleCardPress}
      onEdit={isPending ? undefined : handleEdit}
      onDelete={isPending ? undefined : handleDelete}
      onCreateRoutine={isPending ? undefined : handleCreateRoutine}
      onRoutinePress={handleRoutinePress}
      prInfo={prInfo}
      isPending={isPending}
      isProcessingPending={isProcessingPending}
      likeCount={likeCount}
      commentCount={commentCount}
      isLiked={isLiked}
      onLike={handleLike}
      onComment={handleComment}
      isFirst={isFirst}
    />
  )
})

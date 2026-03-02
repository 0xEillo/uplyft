import { FeedCard } from '@/components/feed-card'
import { useAuth } from '@/contexts/auth-context'
import { useUserLevel } from '@/hooks/useUserLevel'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { getShowWarmupSets } from '@/lib/utils/create-post-settings'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { mapSetsToPrContext, resolvePrContextUserId } from '@/lib/utils/pr-context'
import { calculateTotalVolume } from '@/lib/utils/workout-stats'
import { Profile, WorkoutSessionWithDetails } from '@/types/database.types'
import { usePathname, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'

interface PrDetailForDisplay {
  kind: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
  label: string
  value: number
  previousValue?: number
  weight: number
  previousReps?: number
  currentReps: number
  setIndices?: number[]
  isCurrent: boolean
}

interface PrInfo {
  exerciseId: string
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
  const { level: userLevel, isLoading: isLevelLoading } = useUserLevel(
    workout.user_id ?? undefined,
  )
  const [prs, setPrs] = useState<number>(0)
  const [prInfo, setPrInfo] = useState<PrInfo[]>([])
  const computeContext = useMemo(() => {
    if (workout.isPending || !workout.created_at || !workout.date) return null
    const prUserId = resolvePrContextUserId(workout.user_id, user?.id)
    if (!prUserId) return null
    return {
      sessionId: workout.id,
      userId: prUserId,
      createdAt: workout.created_at,
      date: workout.date,
      exercises: (workout.workout_exercises || []).map((we) => ({
        exerciseId: we.exercise_id,
        exerciseName: we.exercise?.name || 'Exercise',
        sets: mapSetsToPrContext(we.sets),
      })),
    }
  }, [user?.id, workout])

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
  const [recentLikers, setRecentLikers] = useState<Partial<Profile>[]>([])

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
          recentLikersResult,
        ] = await Promise.all([
          database.workoutLikes.getCount(workout.id),
          database.workoutLikes.hasLiked(workout.id, user.id),
          database.workoutComments.getCount(workout.id),
          database.workoutLikes.getRecentLikers(workout.id),
        ])

        setLikeCount(likeCountResult)
        setIsLiked(hasLikedResult)
        setCommentCount(commentCountResult)
        setRecentLikers(recentLikersResult)
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
    router.push({
      pathname: '/workout-comments/[workoutId]',
      params: {
        workoutId: workout.id,
        returnTo: pathname,
      },
    })
  }, [workout.id, pathname, router])

  useEffect(() => {
    if (!computeContext) return

    let isMounted = true

    const compute = async () => {
      try {
        const result = await PrService.computePrsForSession(computeContext)
        if (!isMounted) return

        setPrs(result.totalPrs)

        const prData = result.perExercise.map((exPr) => ({
          exerciseId: exPr.exerciseId,
          exerciseName: exPr.exerciseName,
          prSetIndices: new Set(exPr.prs.flatMap((pr) => pr.setIndices || [])),
          prLabels: exPr.prs.map((pr) => pr.label),
          prDetails: exPr.prs.map((pr) => ({
            kind: pr.kind,
            label: pr.label,
            value: pr.value,
            previousValue: pr.previousValue,
            weight: pr.weight,
            previousReps: pr.previousReps,
            currentReps: pr.currentReps,
            setIndices: pr.setIndices,
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

  const exercises = formatWorkoutForDisplay(workout, weightUnit, !getShowWarmupSets())

  const handleUserPress = useCallback(() => {
    if (!workout.user_id) return
    router.push(`/user/${workout.user_id}`)
  }, [workout.user_id, router])

  const handleEdit = useCallback(() => {
    router.push(`/edit-workout/${workout.id}`)
  }, [workout.id, router])

  const handleDelete = useCallback(async () => {
    // FeedCard already shows confirmation - this is the "confirmed" callback
    try {
      await database.workoutSessions.delete(workout.id)
      onDelete()
    } catch (error) {
      console.error('Error deleting workout:', error)
      Alert.alert('Error', 'Failed to delete workout. Please try again.')
    }
  }, [workout.id, onDelete])

  const handleCreateRoutine = useCallback(() => {
    router.push({
      pathname: '/create-routine',
      params: { from: workout.id },
    })
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
      userLevel={isLevelLoading ? null : userLevel}
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
      workoutSong={workout.song ?? null}
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
      recentLikers={recentLikers}
    />
  )
})

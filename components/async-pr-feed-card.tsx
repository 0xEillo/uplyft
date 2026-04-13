import { FeedCard } from '@/components/feed-card'
import type { WorkoutContext } from '@/components/workout-chat'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { buildWorkoutAnalysisPrompt } from '@/lib/ai/workoutPrompt'
import { setPendingChatAttachment } from '@/lib/chat-attachment-handoff'
import { getCoach } from '@/lib/coaches'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database, OwnershipError } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { PrService } from '@/lib/pr'
import { getShowWarmupSets } from '@/lib/utils/create-post-settings'
import { formatTimeAgo, formatWorkoutForDisplay } from '@/lib/utils/formatters'
import { mapSetsToPrContext, resolvePrContextUserId } from '@/lib/utils/pr-context'
import {
  consumeWorkoutSocialUpdate,
  subscribeWorkoutSocialUpdates,
  type PendingWorkoutSocialUpdate,
  type WorkoutSocialUpdate,
} from '@/lib/utils/workout-social-updates'
import { calculateTotalVolume } from '@/lib/utils/workout-stats'
import type {
  FeedWorkoutSocial,
  Profile,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
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
  workout: WorkoutSessionWithDetails & {
    social?: FeedWorkoutSocial
  }
  onDeleteWorkout: (workoutId: string) => void
  isFirst?: boolean
  /** Whether a pending workout is actively being processed (vs just queued) */
  isProcessingPending?: boolean
}

/**
 * Feed card component that keeps list-item work light by consuming
 * preloaded social metadata and deferring heavier PR analysis until needed.
 */
export const AsyncPrFeedCard = memo(function AsyncPrFeedCard({
  workout,
  onDeleteWorkout,
  isFirst = false,
  isProcessingPending = false,
}: AsyncPrFeedCardProps) {
  const { user, isAnonymous } = useAuth()
  const { coachId, profile } = useProfile()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const pathname = usePathname()
  const { weightUnit } = useWeightUnits()

  // Determine if this workout belongs to the current user
  const isOwnWorkout = user?.id === workout.user_id

  // Get user display info from the workout's profile data
  const userName = isOwnWorkout
    ? 'You'
    : workout.profile?.display_name || 'User'
  const avatarUrl = workout.profile?.avatar_url || null
  const coach = getCoach(coachId)

  // Social interaction states
  const [likeCount, setLikeCount] = useState(workout.social?.likeCount ?? 0)
  const [commentCount, setCommentCount] = useState(
    workout.social?.commentCount ?? 0,
  )
  const [isLiked, setIsLiked] = useState(workout.social?.isLiked ?? false)
  const [recentLikers, setRecentLikers] = useState<Partial<Profile>[]>([])

  const currentUserAsLiker = useMemo<Partial<Profile> | null>(() => {
    if (!user?.id) return null

    return {
      id: user.id,
      display_name: profile?.display_name ?? undefined,
      user_tag: profile?.user_tag ?? undefined,
      avatar_url: profile?.avatar_url ?? null,
    }
  }, [profile?.avatar_url, profile?.display_name, profile?.user_tag, user?.id])

  useEffect(() => {
    setLikeCount(workout.social?.likeCount ?? 0)
    setCommentCount(workout.social?.commentCount ?? 0)
    setIsLiked(workout.social?.isLiked ?? false)
  }, [
    workout.id,
    workout.social?.commentCount,
    workout.social?.isLiked,
    workout.social?.likeCount,
  ])

  useEffect(() => {
    setRecentLikers([])
  }, [workout.id])

  const applySocialUpdate = useCallback(
    (
      update:
        | Pick<
            WorkoutSocialUpdate,
            | 'likeCountDelta'
            | 'commentCountDelta'
            | 'isLiked'
            | 'likerToAdd'
            | 'likerIdToRemove'
          >
        | PendingWorkoutSocialUpdate,
    ) => {
      const likeCountDelta =
        typeof update.likeCountDelta === 'number' ? update.likeCountDelta : 0
      if (likeCountDelta !== 0) {
        setLikeCount((prev) => Math.max(0, prev + likeCountDelta))
      }
      const commentCountDelta =
        typeof update.commentCountDelta === 'number'
          ? update.commentCountDelta
          : 0
      if (commentCountDelta !== 0) {
        setCommentCount((prev) => Math.max(0, prev + commentCountDelta))
      }
      if (typeof update.isLiked === 'boolean') {
        setIsLiked(update.isLiked)
      }
      if (update.likerIdToRemove) {
        setRecentLikers((prev) =>
          prev.filter((liker) => liker.id !== update.likerIdToRemove),
        )
      }
      if (update.likerToAdd?.id) {
        setRecentLikers((prev) => {
          const filtered = prev.filter((liker) => liker.id !== update.likerToAdd?.id)
          return [update.likerToAdd!, ...filtered].slice(0, 3)
        })
      }
    },
    [],
  )

  // Keep this card in sync with social changes made from other screens
  useEffect(() => {
    if (!workout.id || workout.isPending) return

    const pendingUpdate = consumeWorkoutSocialUpdate(workout.id)
    if (pendingUpdate) {
      applySocialUpdate(pendingUpdate)
    }

    const unsubscribe = subscribeWorkoutSocialUpdates((update) => {
      if (update.workoutId !== workout.id) return
      applySocialUpdate(update)
    })

    return unsubscribe
  }, [applySocialUpdate, workout.id, workout.isPending])

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
        setRecentLikers((prev) =>
          prev.filter((liker) => liker.id !== user.id),
        )
      } else {
        await database.workoutLikes.like(workout.id, user.id)
        setIsLiked(true)
        setLikeCount((prev) => prev + 1)
        if (currentUserAsLiker?.id) {
          setRecentLikers((prev) => {
            const filtered = prev.filter(
              (liker) => liker.id !== currentUserAsLiker.id,
            )
            return [currentUserAsLiker, ...filtered].slice(0, 3)
          })
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }, [
    user,
    workout.id,
    isLiked,
    isAnonymous,
    router,
    currentUserAsLiker,
  ])

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

  const exercises = useMemo(
    () =>
      formatWorkoutForDisplay(workout, weightUnit, {
        hideWarmupSets: !getShowWarmupSets(),
        limit: 5,
        includeSetDetails: false,
      }),
    [weightUnit, workout],
  )

  const totalSetCount = useMemo(
    () =>
      workout.workout_exercises?.reduce(
        (sum, exercise) => sum + (exercise.sets?.length || 0),
        0,
      ) || 0,
    [workout],
  )

  const feedStats = useMemo(
    () => ({
      sets: totalSetCount,
      records:
        typeof workout.record_count === 'number' ? workout.record_count : 0,
      durationSeconds: workout.duration ?? undefined,
      volume: calculateTotalVolume(workout, 'kg'),
    }),
    [totalSetCount, workout.duration, workout.record_count, workout],
  )

  const handleUserPress = useCallback(() => {
    if (!workout.user_id) return
    router.push(`/user/${workout.user_id}`)
  }, [workout.user_id, router])

  const handleEdit = useCallback(() => {
    if (!isOwnWorkout) return
    router.push(`/edit-workout/${workout.id}`)
  }, [isOwnWorkout, workout.id, router])

  const handleDelete = useCallback(async () => {
    if (!isOwnWorkout || !user?.id) return

    // FeedCard already shows confirmation - this is the "confirmed" callback
    try {
      await database.workoutSessions.delete(workout.id, user.id)
      onDeleteWorkout(workout.id)
    } catch (error) {
      console.error('Error deleting workout:', error)
      if (error instanceof OwnershipError) {
        Alert.alert('Access denied', error.message)
        return
      }
      Alert.alert('Error', 'Failed to delete workout. Please try again.')
    }
  }, [isOwnWorkout, onDeleteWorkout, user?.id, workout.id])

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

  const handleCoachPress = useCallback(async () => {
    if (!isOwnWorkout || workout.isPending) return

    const workingSetCount = (workout.workout_exercises || []).reduce(
      (sum, exercise) =>
        sum +
        (exercise.sets?.filter((set) => !set.is_warmup).length ||
          exercise.sets?.length ||
          0),
      0,
    )

    let workoutPrInfo: PrInfo[] = []
    const prUserId = resolvePrContextUserId(workout.user_id, user?.id)
    if (prUserId && workout.created_at && workout.date) {
      try {
        const result = await PrService.computePrsForSession({
          sessionId: workout.id,
          userId: prUserId,
          createdAt: workout.created_at,
          date: workout.date,
          exercises: (workout.workout_exercises || []).map((exercise) => ({
            exerciseId: exercise.exercise_id,
            exerciseName: exercise.exercise?.name || 'Exercise',
            sets: mapSetsToPrContext(exercise.sets),
          })),
        })

        workoutPrInfo = result.perExercise.map((exercisePr) => ({
          exerciseId: exercisePr.exerciseId,
          exerciseName: exercisePr.exerciseName,
          prSetIndices: new Set(
            exercisePr.prs.flatMap((detail) => detail.setIndices || []),
          ),
          prLabels: exercisePr.prs.map((detail) => detail.label),
          prDetails: exercisePr.prs.map((detail) => ({
            kind: detail.kind,
            label: detail.label,
            value: detail.value,
            previousValue: detail.previousValue,
            weight: detail.weight,
            previousReps: detail.previousReps,
            currentReps: detail.currentReps,
            setIndices: detail.setIndices,
            isCurrent: detail.isCurrent,
          })),
          hasCurrentPR: exercisePr.prs.some((detail) => detail.isCurrent),
        }))
      } catch (error) {
        console.error('Error computing PRs for coach analysis:', error)
      }
    }

    const workoutContext: WorkoutContext = {
      sessionId: workout.id,
      mode: 'analysis',
      title: workout.type || workout.notes?.split('\n')[0] || 'Workout Session',
      notes: workout.notes || '',
      exercises: (workout.workout_exercises || []).map((exercise) => ({
        name: exercise.exercise?.name || exercise.exercise_name || 'Exercise',
        setsCount: exercise.sets?.length || 0,
        sets:
          exercise.sets?.map((set) => {
            const weight =
              typeof set.weight === 'number' ? `${set.weight} kg` : undefined
            const reps =
              typeof set.reps === 'number' ? `${set.reps}` : undefined

            return {
              ...(weight ? { weight } : {}),
              ...(reps ? { reps } : {}),
            }
          }) || [],
      })),
      stats: {
        exerciseCount: (workout.workout_exercises || []).length,
        totalSetCount,
        workingSetCount,
        durationSeconds: workout.duration ?? null,
        volumeKg: calculateTotalVolume(workout, 'kg'),
        completedAt: workout.created_at ?? null,
      },
      prs: workoutPrInfo.flatMap((exercisePr) =>
        exercisePr.prDetails.map((detail) => ({
          exerciseName: exercisePr.exerciseName,
          kind: detail.kind,
          label: detail.label,
          value: detail.value,
          previousValue: detail.previousValue,
          weight: detail.weight,
          currentReps: detail.currentReps,
          isCurrent: detail.isCurrent,
        })),
      ),
    }

    await setPendingChatAttachment({
      action: 'analyze_workout',
      prompt: buildWorkoutAnalysisPrompt({
        workoutTitle: workoutContext.title,
        exerciseCount: workoutContext.stats?.exerciseCount,
        totalSetCount: workoutContext.stats?.totalSetCount,
        workingSetCount: workoutContext.stats?.workingSetCount,
        durationSeconds: workoutContext.stats?.durationSeconds,
      }),
      workoutContext,
    })

    haptic('medium')
    trackEvent(AnalyticsEvents.AI_CHAT_OPENED, {
      source: 'feed_workout_analysis',
      workout_id: workout.id,
    })
    router.push('/(tabs)/chat' as any)
  }, [isOwnWorkout, router, trackEvent, totalSetCount, user?.id, workout])

  // Check if this is a pending placeholder workout
  const isPending = workout.isPending === true

  return (
    <FeedCard
      userName={userName}
      userAvatar={avatarUrl || ''}
      coachAvatarSource={coach.image}
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
      totalExerciseCount={workout.workout_exercises?.length || 0}
      stats={feedStats}
      userId={workout.user_id}
      workoutId={workout.id}
      workout={isPending ? undefined : workout}
      onUserPress={workout.user_id ? handleUserPress : undefined}
      onCardPress={isPending ? undefined : handleCardPress}
      onEdit={isPending || !isOwnWorkout ? undefined : handleEdit}
      onDelete={isPending || !isOwnWorkout ? undefined : handleDelete}
      onCreateRoutine={isPending ? undefined : handleCreateRoutine}
      onRoutinePress={handleRoutinePress}
      isPending={isPending}
      isProcessingPending={isProcessingPending}
      likeCount={likeCount}
      commentCount={commentCount}
      isLiked={isLiked}
      onLike={handleLike}
      onComment={handleComment}
      onCoachPress={isPending || !isOwnWorkout ? undefined : handleCoachPress}
      isFirst={isFirst}
      recentLikers={recentLikers}
    />
  )
})

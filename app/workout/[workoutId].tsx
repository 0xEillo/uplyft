import { WorkoutShareScreen } from '@/components/workout-share-screen'
import { WorkoutDetailView } from '@/components/WorkoutDetail/WorkoutDetailView'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useTheme } from '@/contexts/theme-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { database } from '@/lib/database'
import { PrService } from '@/lib/pr'
import { mapSetsToPrContext, resolvePrContextUserId } from '@/lib/utils/pr-context'
import { markWorkoutAsDeleted } from '@/lib/utils/deleted-workouts'
import { getWorkoutMuscleGroups } from '@/lib/utils/muscle-split'
import { publishWorkoutSocialUpdate } from '@/lib/utils/workout-social-updates'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, View } from 'react-native'

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

export interface ExercisePRInfo {
  exerciseId: string
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  prDetails: PrDetailForDisplay[]
  hasCurrentPR: boolean
}

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams<{
    workoutId: string
    returnTo?: string
  }>()
  const { workoutId } = params
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { profile } = useProfile()
  useTheme() // for theme context subscription
  const { shareWorkoutWidget } = useWorkoutShare()
  const { weightUnit } = useWeightUnits()

  const [workout, setWorkout] = useState<WorkoutSessionWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [prInfo, setPrInfo] = useState<ExercisePRInfo[]>([])
  const [
    previousMax1RMByExerciseId,
    setPreviousMax1RMByExerciseId,
  ] = useState<Record<string, number> | null>(null)
  const [showShareScreen, setShowShareScreen] = useState(false)
  const [workoutCount, setWorkoutCount] = useState(1)

  // Log when component mounts/unmounts
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    }
  }, [workoutId, params])

  // Compute context for PR calculation
  const computeContext = useMemo(() => {
    if (!workout || !workout.created_at || !workout.date) return null
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
  }, [user, workout])

  // Load workout data
  const loadWorkout = useCallback(async () => {
    if (!workoutId) return

    try {
      setIsLoading(true)
      const data = await database.workoutSessions.getById(workoutId)
      setWorkout(data)

      // Fetch profile data in the background so the workout details can render immediately.
      if (data.user_id) {
        void database.profiles
          .getById(data.user_id)
          .then((profile) => {
            setWorkout((current) => {
              if (!current || current.id !== data.id) return current
              return { ...current, profile }
            })
          })
          .catch((profileError) => {
            console.error('Error loading profile:', profileError)
          })
      }
    } catch (error) {
      console.error('Error loading workout:', error)
      Alert.alert('Error', 'Failed to load workout')
      router.back()
    } finally {
      setIsLoading(false)
    }
  }, [workoutId, router])

  // Load social stats
  const loadSocialStats = useCallback(async () => {
    if (!workoutId || !user) return

    try {
      const [stats, liked] = await Promise.all([
        database.workoutSocial.getStatsForWorkout(workoutId),
        database.workoutLikes.hasLiked(workoutId, user.id),
      ])
      setLikeCount(stats?.like_count || 0)
      setCommentCount(stats?.comment_count || 0)
      setIsLiked(liked)
    } catch (error) {
      console.error('Error loading social stats:', error)
    }
  }, [workoutId, user])

  useEffect(() => {
    loadWorkout()
  }, [loadWorkout])

  useEffect(() => {
    loadSocialStats()
  }, [loadSocialStats])

  // Compute PRs and Baseline Max 1RMs
  useEffect(() => {
    if (!computeContext) return

    let isMounted = true
    setPreviousMax1RMByExerciseId(null)

    const compute = async () => {
      try {
        const result = await PrService.computePrsForSession(computeContext)
        if (!isMounted) return

        // 1. Process PR Info (for badges)
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

        // 2. Process Baseline 1RMs (for green triangle progress)
        const baselineMap: Record<string, number> = {}
        result.perExercise.forEach((ex) => {
          if (ex.baseline1RM > 0) {
            baselineMap[ex.exerciseId] = ex.baseline1RM
          }
        })
        setPreviousMax1RMByExerciseId(baselineMap)
      } catch (error) {
        console.error('Error computing PRs and stats:', error)
        if (isMounted) {
          setPrInfo([])
          setPreviousMax1RMByExerciseId({})
        }
      }
    }

    compute()

    return () => {
      isMounted = false
    }
  }, [computeContext])

  // Load workout count for the week
  useEffect(() => {
    if (!workout?.date || !user?.id) return

    const fetchCount = async () => {
      try {
        const count = await database.workoutSessions.getWeeklyWorkoutCount(
          user.id,
          new Date(workout.date),
          workout.id,
        )
        setWorkoutCount(count)
      } catch (error) {
        console.error('Error fetching workout count:', error)
      }
    }

    fetchCount()
  }, [workout?.date, workout?.id, user?.id])



  // Handle like toggle
  const handleLike = useCallback(async () => {
    if (!user || !workoutId) return

    try {
      if (isLiked) {
        await database.workoutLikes.unlike(workoutId, user.id)
        setIsLiked(false)
        setLikeCount((prev) => Math.max(0, prev - 1))
        publishWorkoutSocialUpdate({
          workoutId,
          likeCountDelta: -1,
          isLiked: false,
          likerIdToRemove: user.id,
        })
      } else {
        await database.workoutLikes.like(workoutId, user.id)
        setIsLiked(true)
        setLikeCount((prev) => prev + 1)
        publishWorkoutSocialUpdate({
          workoutId,
          likeCountDelta: 1,
          isLiked: true,
          likerToAdd: {
            id: user.id,
            display_name: profile?.display_name ?? undefined,
            user_tag: profile?.user_tag ?? undefined,
            avatar_url: profile?.avatar_url ?? null,
          },
        })
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }, [
    isLiked,
    profile?.avatar_url,
    profile?.display_name,
    profile?.user_tag,
    user,
    workoutId,
  ])

  // Handle comment - navigate to comments screen
  const handleComment = useCallback(() => {
    if (!workoutId) return

    router.push({
      pathname: '/workout-comments/[workoutId]',
      params: {
        workoutId,
        returnTo: pathname,
      },
    })
  }, [pathname, workoutId, router])

  // Handle share
  const handleShare = useCallback(() => {
    if (!workout) return
    setShowShareScreen(true)
  }, [workout])

  // Handle share widget
  const handleShareWidget = useCallback(
    async (
      widgetIndex: number,
      shareType: 'instagram' | 'general',
      widgetRef: View,
    ) => {
      await shareWorkoutWidget(widgetRef, shareType)
    },
    [shareWorkoutWidget],
  )

  // Handle close share screen
  const handleCloseShareScreen = useCallback(() => {
    setShowShareScreen(false)
  }, [])

  // Handle edit
  const handleEdit = useCallback(() => {
    router.push(`/edit-workout/${workoutId}`)
  }, [workoutId, router])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!workoutId) return

    try {
      await database.workoutSessions.delete(workoutId)
      markWorkoutAsDeleted(workoutId)
      router.back()
    } catch (error) {
      console.error('Error deleting workout:', error)
      Alert.alert('Error', 'Failed to delete workout')
    }
  }, [workoutId, router])

  // Handle create routine
  const handleCreateRoutine = useCallback(() => {
    router.push({
      pathname: '/create-routine',
      params: { from: workoutId },
    })
  }, [workoutId, router])

  // Handle exercise press - navigate to exercise detail
  const handleExercisePress = useCallback(
    (exerciseId: string) => {
      if (workout?.user_id) {
        router.push({
          pathname: '/exercise/[exerciseId]',
          params: {
            exerciseId,
            statsUserId: workout.user_id,
          },
        })
        return
      }

      router.push(`/exercise/${exerciseId}`)
    },
    [router, workout?.user_id],
  )

  // Only show edit/delete/create routine for own workouts
  const isOwnWorkout = workout ? user?.id === workout.user_id : false

  // Get workout title for sharing
  const workoutTitle = workout ? getWorkoutMuscleGroups(workout) : ''

  return (
    <>
      <WorkoutDetailView
        workout={workout}
        prInfo={prInfo}
        likeCount={likeCount}
        commentCount={commentCount}
        isLiked={isLiked}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onEdit={isOwnWorkout ? handleEdit : undefined}
        onDelete={isOwnWorkout ? handleDelete : undefined}
        onCreateRoutine={handleCreateRoutine}
        onExercisePress={handleExercisePress}
        previousMax1RMByExerciseId={previousMax1RMByExerciseId}
        isLoading={isLoading}
      />

      {/* Workout Share Screen Modal */}
      {workout && showShareScreen && (
        <WorkoutShareScreen
          visible={showShareScreen}
          workout={workout}
          weightUnit={weightUnit}
          workoutCountThisWeek={workoutCount}
          workoutTitle={workoutTitle}
          onClose={handleCloseShareScreen}
          onShare={handleShareWidget}
        />
      )}
    </>
  )
}

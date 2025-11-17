import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { WorkoutDetailView } from '@/components/WorkoutDetail/WorkoutDetailView'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { database } from '@/lib/database'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { getColors } from '@/constants/colors'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { WorkoutShareScreen } from '@/components/workout-share-screen'
import { getWorkoutMuscleGroups } from '@/lib/utils/muscle-split'
import { PrService } from '@/lib/pr'

interface PrDetailForDisplay {
  label: string
  weight: number
  previousReps?: number
  currentReps: number
  isCurrent: boolean
}

export interface ExercisePRInfo {
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  prDetails: PrDetailForDisplay[]
  hasCurrentPR: boolean
}

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams<{ workoutId: string; returnTo?: string }>()
  const { workoutId } = params
  const router = useRouter()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const { shareWorkoutWidget } = useWorkoutShare()
  const { weightUnit } = useWeightUnits()

  const [workout, setWorkout] = useState<WorkoutSessionWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [prInfo, setPrInfo] = useState<ExercisePRInfo[]>([])
  const [showShareScreen, setShowShareScreen] = useState(false)

  // Log when component mounts/unmounts
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    }
  }, [workoutId, params])

  // Compute context for PR calculation
  const computeContext = useMemo(() => {
    if (!user || !workout) return null
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

  // Load workout data
  const loadWorkout = useCallback(async () => {
    if (!workoutId) return

    try {
      setIsLoading(true)
      const data = await database.workoutSessions.getById(workoutId)

      // Fetch the profile data separately
      if (data.user_id) {
        try {
          const profile = await database.profiles.getById(data.user_id)
          setWorkout({
            ...data,
            profile,
          })
        } catch (profileError) {
          console.error('Error loading profile:', profileError)
          // Set workout without profile if profile fetch fails
          setWorkout(data)
        }
      } else {
        setWorkout(data)
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
      const stats = await database.workoutSocial.getStatsForWorkout(workoutId)
      setLikeCount(stats?.like_count || 0)
      setCommentCount(stats?.comment_count || 0)

      const liked = await database.workoutLikes.hasLiked(workoutId, user.id)
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

  // Compute PRs
  useEffect(() => {
    if (!computeContext) return

    let isMounted = true

    const compute = async () => {
      try {
        const result = await PrService.computePrsForSession(computeContext)
        if (!isMounted) return

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
          setPrInfo([])
        }
      }
    }

    compute()

    return () => {
      isMounted = false
    }
  }, [computeContext])

  // Handle like toggle
  const handleLike = useCallback(async () => {
    if (!user || !workoutId) return

    try {
      if (isLiked) {
        await database.workoutLikes.unlike(workoutId, user.id)
        setIsLiked(false)
        setLikeCount((prev) => Math.max(0, prev - 1))
      } else {
        await database.workoutLikes.like(workoutId, user.id)
        setIsLiked(true)
        setLikeCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }, [user, workoutId, isLiked])

  // Handle comment - navigate to comments screen
  const handleComment = useCallback(() => {
    router.push(`/workout-comments/${workoutId}`)
  }, [workoutId, router])

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
        isLoading={isLoading}
      />

      {/* Workout Share Screen Modal */}
      {workout && showShareScreen && (
        <WorkoutShareScreen
          visible={showShareScreen}
          workout={workout}
          weightUnit={weightUnit}
          workoutCountThisWeek={1}
          workoutTitle={workoutTitle}
          onClose={handleCloseShareScreen}
          onShare={handleShareWidget}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

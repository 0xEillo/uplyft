import { useAuth } from '@/contexts/auth-context'
import { getExerciseGroup, type ExerciseGroup } from '@/lib/exercise-standards-config'
import type {
  OverallStrengthGroup,
  OverallStrengthGroupBreakdown,
} from '@/lib/overall-strength-score'
import { buildDisplayStrengthGroupData } from '@/lib/strength-display-groups'
import {
    calculateStrengthScoreDelta,
    loadStrengthScoreDeltaContext,
    STRENGTH_SCORE_DELTA_SEMANTICS,
} from '@/lib/strength-score-delta'
import {
    getStrengthGender,
    getLevelIntensity as getStrengthLevelIntensity,
    scoreToLevelProgress,
    toLevelScore,
} from '@/lib/strength-progress'
import {
    getStrengthStandard,
    hasStrengthStandards,
    type StrengthLevel,
} from '@/lib/strength-standards'
import { Profile } from '@/types/database.types'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ExerciseRecord {
  weight: number
  maxReps: number
  date: string
  estimated1RM: number
}

export interface ExerciseData {
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  max1RM: number
  lastTrainedAt?: string | null
  gifUrl?: string | null
  records: ExerciseRecord[]
}

export interface ExerciseBest1RMSnapshot {
  currentBest1RM: number
  previousBest1RM: number
  lastIncreaseAt: string | null
  lastIncreaseSessionId: string | null
}

export interface MuscleGroupData {
  name: string
  level: StrengthLevel
  progress: number
  exercises: ExerciseData[]
  averageScore: number
}

export interface OverallLevelData {
  currentLevel: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
  progressDelta: number
  liftsTracked: number
  balancedLevel: StrengthLevel
  balancedNextLevel: StrengthLevel | null
  balancedProgress: number
  balancedScore: number
  score: number
  weakestGroup: string | null
  lastIncreaseAt: string | null
  groupBreakdown: Record<OverallStrengthGroup, OverallStrengthGroupBreakdown>
}

export interface GroupLevelData {
  group: ExerciseGroup
  level: StrengthLevel
  progress: number
  averageScore: number
  exercises: ExerciseData[]
}
export function useStrengthData() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exerciseData, setExerciseData] = useState<ExerciseData[]>([])
  const [best1RMSnapshotByExerciseId, setBest1RMSnapshotByExerciseId] =
    useState<Record<string, ExerciseBest1RMSnapshot>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    if (!user?.id) return

    try {
      const strengthContext = await loadStrengthScoreDeltaContext<ExerciseData>(
        user.id,
      )
      setProfile(strengthContext.profile)
      setBest1RMSnapshotByExerciseId(
        strengthContext.best1RMSnapshotByExerciseId,
      )

      // Sort by max1RM descending
      const sorted = [...strengthContext.exercises].sort(
        (a, b) => b.max1RM - a.max1RM,
      )
      setExerciseData(sorted)
    } catch (error) {
      console.error('Error loading strength stats:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData]),
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  const getStrengthInfo = useCallback(
    (exerciseName: string, max1RM: number) => {
      const strengthGender = getStrengthGender(profile?.gender)
      if (!strengthGender || !profile?.weight_kg) {
        return null
      }

      if (!hasStrengthStandards(exerciseName)) {
        return null
      }

      return getStrengthStandard(
        exerciseName,
        strengthGender,
        profile.weight_kg,
        max1RM,
      )
    },
    [profile?.gender, profile?.weight_kg],
  )

  // Calculate levels by exercise group (Push/Pull/Lower)
  const groupLevels = useMemo((): Map<ExerciseGroup, GroupLevelData> => {
    const result = new Map<ExerciseGroup, GroupLevelData>()

    if (!profile?.weight_kg || exerciseData.length === 0) {
      return result
    }

    // Group exercises by ExerciseGroup
    const groupedExercises = new Map<ExerciseGroup, ExerciseData[]>()
    
    exerciseData.forEach((exercise) => {
      const group = getExerciseGroup(exercise.exerciseName)
      if (!groupedExercises.has(group)) {
        groupedExercises.set(group, [])
      }
      groupedExercises.get(group)?.push(exercise)
    })

    // Calculate stats for each group
    groupedExercises.forEach((exercises, group) => {
      let totalScore = 0
      let count = 0

      exercises.forEach((exercise) => {
        const info = getStrengthInfo(exercise.exerciseName, exercise.max1RM)
        if (info) {
          totalScore += toLevelScore(info.level, info.progress)
          count++
        }
      })

      if (count > 0) {
        const averageScore = totalScore / count
        const { level, progress } = scoreToLevelProgress(averageScore)

        result.set(group, {
          group,
          level,
          progress,
          averageScore,
          exercises,
        })
      }
    })

    return result
  }, [exerciseData, profile, getStrengthInfo])

  const overallLevel = useMemo((): OverallLevelData | null => {
    if (!profile?.weight_kg || exerciseData.length === 0) {
      return null
    }

    const scoreDelta = calculateStrengthScoreDelta({
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.latestIncreaseSession,
      context: {
        profile,
        strengthGender: getStrengthGender(profile.gender),
        exercises: exerciseData,
        best1RMSnapshotByExerciseId,
      },
    })

    if (!scoreDelta) {
      return null
    }

    const { currentResult, pointsGained, lastIncreaseAt } = scoreDelta

    return {
      currentLevel: currentResult.level,
      nextLevel: currentResult.nextLevel,
      progress: currentResult.progress,
      progressDelta: pointsGained,
      liftsTracked: currentResult.liftsTracked,
      balancedLevel: currentResult.level,
      balancedNextLevel: currentResult.nextLevel,
      balancedProgress: currentResult.progress,
      balancedScore: currentResult.score,
      score: currentResult.score,
      weakestGroup: currentResult.weakestGroup,
      lastIncreaseAt,
      groupBreakdown: currentResult.groupBreakdown,
    }
  }, [best1RMSnapshotByExerciseId, exerciseData, profile?.gender, profile?.weight_kg])

  const displayMuscleGroups = useMemo((): MuscleGroupData[] => {
    if (!overallLevel || exerciseData.length === 0) {
      return []
    }

    return buildDisplayStrengthGroupData({
      exercises: exerciseData,
      groupBreakdown: overallLevel.groupBreakdown,
    })
  }, [exerciseData, overallLevel])

  return {
    profile,
    exerciseData,
    isLoading,
    refreshing,
    onRefresh,
    getStrengthInfo,
    overallLevel,
    displayMuscleGroups,
    groupLevels,
    best1RMSnapshotByExerciseId,
  }
}

// Get intensity value for body highlighter (2-7 based on level, 1 reserved for "no rank")
// KEY MAPPING ARCHITECTURE:
// The react-native-body-highlighter library uses `colors[intensity - 1]` to pick a color.
// Our BODY_COLORS array is structured as:
// Index 0: Unranked (Dark)
// Index 1: Beginner (Gray)
// Index 2: Novice (Blue)
// ...
// Therefore, we must map levels to intensities as follows:
// Unranked -> Intensity 1 (for Index 0)
// Beginner -> Intensity 2 (for Index 1)
// ...
export function getLevelIntensity(level: StrengthLevel): number {
  return getStrengthLevelIntensity(level)
}

export const LEVEL_COLORS: Record<StrengthLevel, string> = {
  Untrained: '#6B7280',   // Darker Gray
  Beginner: '#9CA3AF',    // Gray - matches BODY_COLORS index 2
  Novice: '#3B82F6',      // Blue - matches BODY_COLORS index 3
  Intermediate: '#10B981', // Green - matches BODY_COLORS index 4
  Advanced: '#8B5CF6',    // Purple - matches BODY_COLORS index 5
  Elite: '#F59E0B',       // Orange - matches BODY_COLORS index 6
  'World Class': '#EF4444', // Red - matches BODY_COLORS index 7
}

export function getLevelColor(level: StrengthLevel): string {
  return LEVEL_COLORS[level]
}

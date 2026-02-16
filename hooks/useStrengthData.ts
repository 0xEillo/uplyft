import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { EXERCISE_MUSCLE_MAPPING, getExerciseGroup, type ExerciseGroup } from '@/lib/exercise-standards-config'
import { calculateOverallStrengthScore } from '@/lib/overall-strength-score'
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
      const [profileData, data, snapshots] = await Promise.all([
        database.profiles.getById(user.id),
        database.stats.getMajorCompoundLiftsData(user.id),
        database.stats.getExerciseCurrentAndPreviousBest1RMs(user.id),
      ])
      setProfile(profileData)
      setBest1RMSnapshotByExerciseId(snapshots)

      // Sort by max1RM descending
      const sorted = data.sort((a, b) => b.max1RM - a.max1RM)
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

    const strengthGender = getStrengthGender(profile.gender)
    if (!strengthGender) {
      return null
    }

    const currentOverall = calculateOverallStrengthScore({
      gender: strengthGender,
      bodyweightKg: profile.weight_kg,
      exercises: exerciseData,
    })

    if (currentOverall.liftsTracked === 0) {
      return null
    }

    const baselineExercises = exerciseData.map((exercise) => {
      const previousBest1RM =
        best1RMSnapshotByExerciseId[exercise.exerciseId]?.previousBest1RM ?? 0
      const baseline1RM = previousBest1RM > 0 ? previousBest1RM : exercise.max1RM

      return {
        ...exercise,
        max1RM: baseline1RM,
      }
    })

    const baselineOverall = calculateOverallStrengthScore({
      gender: strengthGender,
      bodyweightKg: profile.weight_kg,
      exercises: baselineExercises,
    })

    const progressDelta = Math.max(
      0,
      Math.round(currentOverall.score - baselineOverall.score),
    )

    return {
      currentLevel: currentOverall.level,
      nextLevel: currentOverall.nextLevel,
      progress: currentOverall.progress,
      progressDelta,
      liftsTracked: currentOverall.liftsTracked,
      balancedLevel: currentOverall.level,
      balancedNextLevel: currentOverall.nextLevel,
      balancedProgress: currentOverall.progress,
      balancedScore: currentOverall.score,
      score: currentOverall.score,
      weakestGroup: currentOverall.weakestGroup,
    }
  }, [best1RMSnapshotByExerciseId, exerciseData, profile?.gender, profile?.weight_kg])

  // Calculate muscle groups data (for backward compatibility)
  const muscleGroups = useMemo((): MuscleGroupData[] => {
    if (!profile?.weight_kg || exerciseData.length === 0) {
      return []
    }

    const groups = new Map<string, ExerciseData[]>()
    
    // Group exercises
    exerciseData.forEach((exercise) => {
      // Prioritize our canonical mapping, then fallback to database value
      const groupName = EXERCISE_MUSCLE_MAPPING[exercise.exerciseName] || exercise.muscleGroup || 'Other'
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)?.push(exercise)
    })

    // Calculate stats for each group
    const result: MuscleGroupData[] = []

    groups.forEach((exercises, name) => {
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
        const { level: currentLevel, progress } =
          scoreToLevelProgress(averageScore)

        result.push({
          name,
          level: currentLevel,
          progress,
          exercises,
          averageScore,
        })
      }
    })

    // Sort by average score descending
    return result.sort((a, b) => b.averageScore - a.averageScore)
  }, [exerciseData, profile, getStrengthInfo])

  return {
    profile,
    exerciseData,
    isLoading,
    refreshing,
    onRefresh,
    getStrengthInfo,
    overallLevel,
    muscleGroups,
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

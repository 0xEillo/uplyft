import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { getExerciseGroup, type ExerciseGroup } from '@/lib/exercise-standards-config'
import {
    getStrengthStandard,
    hasStrengthStandards,
    type StrengthLevel
} from '@/lib/strength-standards'
import { Profile } from '@/types/database.types'
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
  records: ExerciseRecord[]
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
  liftsTracked: number
  balancedLevel: StrengthLevel
  balancedNextLevel: StrengthLevel | null
  balancedProgress: number
  balancedScore: number
  weakestGroup: string | null
}

export interface GroupLevelData {
  group: ExerciseGroup
  level: StrengthLevel
  progress: number
  averageScore: number
  exercises: ExerciseData[]
}

const LEVEL_ORDER: StrengthLevel[] = [
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

const LEVEL_SCORES: Record<StrengthLevel, number> = {
  Beginner: 1,
  Novice: 2,
  Intermediate: 3,
  Advanced: 4,
  Elite: 5,
  'World Class': 6,
}

export function useStrengthData() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exerciseData, setExerciseData] = useState<ExerciseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    if (!user?.id) return

    try {
      // Load profile data
      const profileData = await database.profiles.getById(user.id)
      setProfile(profileData)

      // Load exercise data
      const data = await database.stats.getMajorCompoundLiftsData(user.id)
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

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  const getStrengthInfo = useCallback(
    (exerciseName: string, max1RM: number) => {
      if (!profile?.gender || !profile?.weight_kg) {
        return null
      }

      if (!hasStrengthStandards(exerciseName)) {
        return null
      }

      return getStrengthStandard(
        exerciseName,
        profile.gender as 'male' | 'female',
        profile.weight_kg,
        max1RM,
      )
    },
    [profile?.gender, profile?.weight_kg],
  )

  // Calculate levels by exercise group (Push/Pull/Lower)
  const groupLevels = useMemo((): Map<ExerciseGroup, GroupLevelData> => {
    const result = new Map<ExerciseGroup, GroupLevelData>()
    
    if (!profile?.gender || !profile?.weight_kg || exerciseData.length === 0) {
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
          const baseScore = LEVEL_SCORES[info.level]
          const exactScore = baseScore + info.progress / 100
          totalScore += exactScore
          count++
        }
      })

      if (count > 0) {
        const averageScore = totalScore / count
        const levelIndex = Math.floor(averageScore) - 1
        const level = LEVEL_ORDER[Math.max(0, Math.min(levelIndex, LEVEL_ORDER.length - 1))]
        const progress = averageScore >= 6 ? 100 : (averageScore - Math.floor(averageScore)) * 100

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
    if (!profile?.gender || !profile?.weight_kg || exerciseData.length === 0) {
      return null
    }

    let totalScore = 0
    let count = 0

    const groupTotals: Record<ExerciseGroup | string, { total: number; count: number }> = {
      'Push': { total: 0, count: 0 },
      'Pull': { total: 0, count: 0 },
      'Lower': { total: 0, count: 0 },
    }

    exerciseData.forEach((exercise) => {
      const info = getStrengthInfo(exercise.exerciseName, exercise.max1RM)
      if (info) {
        const baseScore = LEVEL_SCORES[info.level]
        // progress is 0-100, we want 0-1 added to base score
        const exactScore = baseScore + info.progress / 100
        totalScore += exactScore
        count++

        const group = getExerciseGroup(exercise.exerciseName)
        if (group in groupTotals) {
          groupTotals[group].total += exactScore
          groupTotals[group].count++
        }
      }
    })

    if (count === 0) return null

    const averageScore = totalScore / count
    const levelIndex = Math.floor(averageScore) - 1
    const currentLevel =
      LEVEL_ORDER[Math.max(0, Math.min(levelIndex, LEVEL_ORDER.length - 1))]
    const nextLevel =
      LEVEL_ORDER[Math.min(levelIndex + 1, LEVEL_ORDER.length - 1)]

    // Calculate progress to next level (fractional part of averageScore)
    const progress =
      averageScore >= 6 ? 100 : (averageScore - Math.floor(averageScore)) * 100

    // Calculate Balanced Level (Harmonic Mean of group averages)
    const validGroups = Object.entries(groupTotals)
      .filter(([_, data]) => data.count > 0)
      .map(([name, data]) => ({
        name,
        average: data.total / data.count,
      }))

    let balancedScore = 0
    let balancedLevel: StrengthLevel = currentLevel
    let weakestGroup: string | null = null

    if (validGroups.length > 0) {
      // Harmonic mean: n / (1/x1 + 1/x2 + ... + 1/xn)
      const denominator = validGroups.reduce(
        (sum, g) => sum + 1 / g.average,
        0,
      )
      balancedScore = validGroups.length / denominator

      // Find weakest group
      const weakest = validGroups.reduce(
        (min, g) => (g.average < min.average ? g : min),
        validGroups[0],
      )
      
      const strongest = validGroups.reduce(
        (max, g) => (g.average > max.average ? g : max),
        validGroups[0],
      )

      // Only flag as weak if it's significantly dragging down the score (>= 1 full level difference)
      if (strongest.average - weakest.average >= 1.0) {
        weakestGroup = weakest.name
      }

      const balancedIndex = Math.floor(balancedScore) - 1
      balancedLevel =
        LEVEL_ORDER[Math.max(0, Math.min(balancedIndex, LEVEL_ORDER.length - 1))]
    }

    const balancedProgress =
        balancedScore >= 6 ? 100 : (balancedScore - Math.floor(balancedScore)) * 100
    
    const balancedLevelIndex = LEVEL_ORDER.indexOf(balancedLevel)
    const balancedNextLevel = 
        balancedLevelIndex < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[balancedLevelIndex + 1] : null

    return {
      currentLevel,
      nextLevel: currentLevel === 'World Class' ? null : nextLevel,
      progress,
      liftsTracked: count,
      balancedLevel,
      balancedNextLevel,
      balancedProgress,
      balancedScore,
      weakestGroup,
    }
  }, [exerciseData, profile, getStrengthInfo])

  // Calculate muscle groups data (for backward compatibility)
  const muscleGroups = useMemo((): MuscleGroupData[] => {
    if (!profile?.gender || !profile?.weight_kg || exerciseData.length === 0) {
      return []
    }

    const groups = new Map<string, ExerciseData[]>()
    
    // Group exercises
    exerciseData.forEach((exercise) => {
      const groupName = exercise.muscleGroup || 'Other'
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
          const baseScore = LEVEL_SCORES[info.level]
          const exactScore = baseScore + info.progress / 100
          totalScore += exactScore
          count++
        }
      })

      if (count > 0) {
        const averageScore = totalScore / count
        const levelIndex = Math.floor(averageScore) - 1
        const currentLevel =
          LEVEL_ORDER[Math.max(0, Math.min(levelIndex, LEVEL_ORDER.length - 1))]
        
        const progress =
          averageScore >= 6 ? 100 : (averageScore - Math.floor(averageScore)) * 100

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
  }
}

export function getLevelColor(level: StrengthLevel): string {
  const levelColors = {
    Beginner: '#9CA3AF',
    Novice: '#3B82F6',
    Intermediate: '#10B981',
    Advanced: '#8B5CF6',
    Elite: '#F59E0B',
    'World Class': '#EF4444',
  }
  return levelColors[level]
}

// Get intensity value for body highlighter (1-6 based on level)
export function getLevelIntensity(level: StrengthLevel): number {
  return LEVEL_SCORES[level]
}

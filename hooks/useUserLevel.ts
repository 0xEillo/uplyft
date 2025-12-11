import { database } from '@/lib/database'
import {
    getStrengthStandard,
    hasStrengthStandards,
    type StrengthLevel,
} from '@/lib/strength-standards'
import { useCallback, useEffect, useState } from 'react'

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

interface UseUserLevelResult {
  level: StrengthLevel | null
  isLoading: boolean
  refresh: () => void
}

export function useUserLevel(userId: string | undefined): UseUserLevelResult {
  const [level, setLevel] = useState<StrengthLevel | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadLevel = useCallback(async () => {
    if (!userId) {
      setLevel(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Load profile and exercise data in parallel
      const [profile, exerciseData] = await Promise.all([
        database.profiles.getByIdOrNull(userId),
        database.stats.getMajorCompoundLiftsData(userId),
      ])

      if (!profile?.gender || !profile?.weight_kg || exerciseData.length === 0) {
        setLevel(null)
        setIsLoading(false)
        return
      }

      // Calculate overall level (same logic as StrengthStandardsView)
      let totalScore = 0
      let count = 0

      exerciseData.forEach((exercise) => {
        if (!hasStrengthStandards(exercise.exerciseName)) return

        const info = getStrengthStandard(
          exercise.exerciseName,
          profile.gender as 'male' | 'female',
          profile.weight_kg!,
          exercise.max1RM,
        )

        if (info) {
          const baseScore = LEVEL_SCORES[info.level]
          const exactScore = baseScore + info.progress / 100
          totalScore += exactScore
          count++
        }
      })

      if (count === 0) {
        setLevel(null)
        setIsLoading(false)
        return
      }

      const averageScore = totalScore / count
      const levelIndex = Math.floor(averageScore) - 1
      const currentLevel =
        LEVEL_ORDER[Math.max(0, Math.min(levelIndex, LEVEL_ORDER.length - 1))]

      setLevel(currentLevel)
    } catch (error) {
      console.error('Error calculating user level:', error)
      setLevel(null)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadLevel()
  }, [loadLevel])

  return { level, isLoading, refresh: loadLevel }
}



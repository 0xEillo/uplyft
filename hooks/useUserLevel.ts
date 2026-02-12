import { database } from '@/lib/database'
import {
  getStrengthGender,
  scoreToLevelProgress,
  toLevelScore,
} from '@/lib/strength-progress'
import {
  getStrengthStandard,
  hasStrengthStandards,
  type StrengthLevel,
} from '@/lib/strength-standards'
import { useCallback, useEffect, useState } from 'react'

interface UseUserLevelResult {
  level: StrengthLevel | null
  progress: number | null
  isLoading: boolean
  refresh: () => void
}

export function useUserLevel(userId: string | undefined): UseUserLevelResult {
  const [level, setLevel] = useState<StrengthLevel | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadLevel = useCallback(async () => {
    if (!userId) {
      setLevel(null)
      setProgress(null)
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

      const strengthGender = getStrengthGender(profile?.gender)
      if (!strengthGender || !profile?.weight_kg || exerciseData.length === 0) {
        setLevel(null)
        setProgress(null)
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
          strengthGender,
          profile.weight_kg!,
          exercise.max1RM,
        )

        if (info) {
          totalScore += toLevelScore(info.level, info.progress)
          count++
        }
      })

      if (count === 0) {
        setLevel(null)
        setProgress(null)
        setIsLoading(false)
        return
      }

      const averageScore = totalScore / count
      const { level: currentLevel, progress: progressPct } =
        scoreToLevelProgress(averageScore)

      setLevel(currentLevel)
      setProgress(Math.round(progressPct))
    } catch (error) {
      console.error('Error calculating user level:', error)
      setLevel(null)
      setProgress(null)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadLevel()
  }, [loadLevel])

  return { level, progress, isLoading, refresh: loadLevel }
}


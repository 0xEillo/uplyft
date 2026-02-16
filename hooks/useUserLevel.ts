import { database } from '@/lib/database'
import {
    calculateOverallStrengthScore,
    scoreToOverallLevelProgress,
} from '@/lib/overall-strength-score'
import {
    getStrengthGender,
} from '@/lib/strength-progress'
import { type StrengthLevel } from '@/lib/strength-standards'
import { useCallback, useEffect, useState } from 'react'

interface UseUserLevelResult {
  level: StrengthLevel | null
  progress: number | null
  score: number | null
  scoreDelta: number
  isLoading: boolean
  refresh: () => void
}

export function useUserLevel(userId: string | undefined): UseUserLevelResult {
  const [level, setLevel] = useState<StrengthLevel | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [scoreDelta, setScoreDelta] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadLevel = useCallback(async () => {
    if (!userId) {
      setLevel(null)
      setProgress(null)
      setScore(null)
      setScoreDelta(0)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Load profile, exercise data, and best 1RM snapshots in parallel
      const [profile, exerciseData, best1RMSnapshots] = await Promise.all([
        database.profiles.getByIdOrNull(userId),
        database.stats.getMajorCompoundLiftsData(userId),
        database.stats.getExerciseCurrentAndPreviousBest1RMs(userId),
      ])

      const strengthGender = getStrengthGender(profile?.gender)
      if (!strengthGender || !profile?.weight_kg || exerciseData.length === 0) {
        setLevel(null)
        setProgress(null)
        setScore(null)
        setScoreDelta(0)
        setIsLoading(false)
        return
      }

      // 1. Calculate current overall score
      const currentOverall = calculateOverallStrengthScore({
        gender: strengthGender,
        bodyweightKg: profile.weight_kg,
        exercises: exerciseData,
      })

      if (currentOverall.liftsTracked === 0) {
        setLevel(null)
        setProgress(null)
        setScore(null)
        setScoreDelta(0)
        setIsLoading(false)
        return
      }

      // 2. Calculate baseline overall score (using previous PRs)
      const baselineExercises = exerciseData.map((exercise) => {
        const previousBest1RM =
          best1RMSnapshots[exercise.exerciseId]?.previousBest1RM ?? 0
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

      const delta = Math.max(
        0,
        Math.round(currentOverall.score - baselineOverall.score),
      )

      const { level: currentLevel, progress: progressPct } =
        scoreToOverallLevelProgress(currentOverall.score)

      setLevel(currentLevel)
      setProgress(Math.round(progressPct))
      setScore(currentOverall.score)
      setScoreDelta(delta)
    } catch (error) {
      console.error('Error calculating user level:', error)
      setLevel(null)
      setProgress(null)
      setScore(null)
      setScoreDelta(0)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadLevel()
  }, [loadLevel])

  return { level, progress, score, scoreDelta, isLoading, refresh: loadLevel }
}

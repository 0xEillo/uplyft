import {
    loadAndCalculateStrengthScoreDelta,
    STRENGTH_SCORE_DELTA_SEMANTICS,
} from '@/lib/strength-score-delta'
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

      const scoreDelta = await loadAndCalculateStrengthScoreDelta({
        userId,
        semantics: STRENGTH_SCORE_DELTA_SEMANTICS.latestIncreaseSession,
      })

      if (!scoreDelta) {
        setLevel(null)
        setProgress(null)
        setScore(null)
        setScoreDelta(0)
        setIsLoading(false)
        return
      }

      const { currentResult, pointsGained } = scoreDelta

      setLevel(currentResult.level)
      setProgress(Math.round(currentResult.progress))
      setScore(currentResult.score)
      setScoreDelta(pointsGained)
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

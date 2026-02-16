import { clampStrengthProgress, type StrengthLevel } from './strength-standards'

export type StrengthGender = 'male' | 'female'

export const STRENGTH_LEVEL_ORDER: StrengthLevel[] = [
  'Untrained',
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

export const STRENGTH_LEVEL_SCORES: Record<StrengthLevel, number> = {
  Untrained: 0,
  Beginner: 1,
  Novice: 2,
  Intermediate: 3,
  Advanced: 4,
  Elite: 5,
  'World Class': 6,
}

const MAX_LEVEL_INDEX = STRENGTH_LEVEL_ORDER.length - 1

export interface StrengthProgressSnapshot {
  level: StrengthLevel
  progress: number
}

export function getStrengthGender(
  gender: string | null | undefined,
): StrengthGender | null {
  return gender === 'male' || gender === 'female' ? gender : null
}

export function toLevelScore(level: StrengthLevel, progress: number): number {
  const clamped = clampStrengthProgress(progress)
  return STRENGTH_LEVEL_SCORES[level] + clamped / 100
}

export function scoreToLevelProgress(score: number): {
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
} {
  const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0
  const levelIndex = Math.min(MAX_LEVEL_INDEX, Math.floor(safeScore))
  const level = STRENGTH_LEVEL_ORDER[levelIndex]
  const progress = clampStrengthProgress(
    safeScore >= MAX_LEVEL_INDEX
      ? 100
      : (safeScore - Math.floor(safeScore)) * 100,
  )
  return {
    level,
    nextLevel:
      levelIndex < MAX_LEVEL_INDEX ? STRENGTH_LEVEL_ORDER[levelIndex + 1] : null,
    progress,
  }
}

export function getProgressDeltaPoints(
  previous: StrengthProgressSnapshot | null | undefined,
  current: StrengthProgressSnapshot | null | undefined,
): number {
  if (!previous || !current) {
    return 0
  }

  return Math.max(
    0,
    Math.round(
      (toLevelScore(current.level, current.progress) -
        toLevelScore(previous.level, previous.progress)) *
        100,
    ),
  )
}

export function getLevelIntensity(level: StrengthLevel): number {
  return STRENGTH_LEVEL_SCORES[level] + 1
}

export function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return 0
  }

  if (weightKg <= 0 || reps <= 0) {
    return 0
  }

  return weightKg * (1 + reps / 30)
}

import {
    EXERCISE_MUSCLE_MAPPING,
    getExerciseNameMap,
    type StrengthLevel,
} from './exercise-standards-config'
import { type StrengthGender } from './strength-progress'
import {
    clampStrengthProgress,
    getStandardsLadder,
    hasStrengthStandards,
    type StrengthStandard,
} from './strength-standards'

export type OverallStrengthGroup =
  | 'Legs'
  | 'Back'
  | 'Chest'
  | 'Shoulders'
  | 'Arms'

export interface OverallStrengthExerciseInput {
  exerciseId: string
  exerciseName: string
  muscleGroup?: string | null
  max1RM: number
  lastTrainedAt?: string | null
}

export interface OverallStrengthGroupBreakdown {
  group: OverallStrengthGroup
  weight: number
  topExerciseScore: number
  decayFactor: number
  effectiveScore: number
  weightedContribution: number
  lastTrainedAt: string | null
  trackedExerciseCount: number
}

export interface OverallStrengthScoreResult {
  score: number
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
  liftsTracked: number
  weakestGroup: OverallStrengthGroup | null
  groupBreakdown: Record<OverallStrengthGroup, OverallStrengthGroupBreakdown>
}

export const OVERALL_STRENGTH_SCORE_CAP = 1000
const DECAY_GRACE_DAYS = 14
const DECAY_RATE_PER_WEEK = 0.05

const OVERALL_GROUP_WEIGHTS: Record<OverallStrengthGroup, number> = {
  Legs: 0.25,
  Back: 0.25,
  Chest: 0.2,
  Shoulders: 0.2, // Increased from 10%
  Arms: 0.1,
}

export const LEVEL_POINT_ANCHORS: Record<StrengthLevel, number> = {
  Untrained: 0,
  Beginner: 100,
  Novice: 200,
  Intermediate: 400,
  Advanced: 600,
  Elite: 825,
  'World Class': OVERALL_STRENGTH_SCORE_CAP,
}

const SCORE_LEVEL_STEPS: { level: StrengthLevel; score: number }[] = [
  { level: 'Untrained', score: LEVEL_POINT_ANCHORS.Untrained },
  { level: 'Beginner', score: LEVEL_POINT_ANCHORS.Beginner },
  { level: 'Novice', score: LEVEL_POINT_ANCHORS.Novice },
  { level: 'Intermediate', score: LEVEL_POINT_ANCHORS.Intermediate },
  { level: 'Advanced', score: LEVEL_POINT_ANCHORS.Advanced },
  { level: 'Elite', score: LEVEL_POINT_ANCHORS.Elite },
  { level: 'World Class', score: LEVEL_POINT_ANCHORS['World Class'] },
]

const exerciseNameMap = getExerciseNameMap()

function asDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toOverallGroup(specificMuscle: string | null): OverallStrengthGroup | null {
  if (!specificMuscle) return null

  switch (specificMuscle) {
    case 'Quads':
    case 'Hamstrings':
    case 'Glutes':
    case 'Calves':
    case 'Adductors':
      return 'Legs'
    case 'Back':
    case 'Traps':
    case 'Lower Back':
      return 'Back'
    case 'Chest':
      return 'Chest'
    case 'Shoulders':
      return 'Shoulders'
    case 'Biceps':
    case 'Triceps':
    case 'Forearms':
      return 'Arms'
    default:
      return null
  }
}

function resolveSpecificMuscleName(
  exerciseName: string,
  fallbackMuscle: string | null | undefined,
): string | null {
  const canonicalName = exerciseNameMap.get(exerciseName)?.name ?? exerciseName

  return (
    EXERCISE_MUSCLE_MAPPING[canonicalName] ??
    EXERCISE_MUSCLE_MAPPING[exerciseName] ??
    fallbackMuscle ??
    null
  )
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(OVERALL_STRENGTH_SCORE_CAP, score))
}

function computeDecayFactor(
  lastTrainedAt: string | null,
  now: Date,
): number {
  if (!lastTrainedAt) return 1
  const trainedAt = asDateOrNull(lastTrainedAt)
  if (!trainedAt) return 1

  const diffMs = now.getTime() - trainedAt.getTime()
  if (diffMs <= 0) return 1

  const daysSinceLastTrain = diffMs / (1000 * 60 * 60 * 24)
  if (daysSinceLastTrain <= DECAY_GRACE_DAYS) return 1

  const overdueWeeks = (daysSinceLastTrain - DECAY_GRACE_DAYS) / 7
  return Math.max(0, 1 - overdueWeeks * DECAY_RATE_PER_WEEK)
}

function interpolatePointsFromStandards(
  ratio: number,
  standards: StrengthStandard[],
): number {
  if (!Number.isFinite(ratio) || ratio <= 0 || standards.length === 0) return 0

  const first = standards[0]
  if (ratio < first.multiplier) {
    const beginnerPoints = LEVEL_POINT_ANCHORS.Beginner
    return first.multiplier > 0 ? (ratio / first.multiplier) * beginnerPoints : 0
  }

  for (let i = 0; i < standards.length - 1; i++) {
    const current = standards[i]
    const next = standards[i + 1]

    if (ratio < next.multiplier) {
      const lowPoints = LEVEL_POINT_ANCHORS[current.level]
      const highPoints = LEVEL_POINT_ANCHORS[next.level]
      const range = next.multiplier - current.multiplier
      const progress = range > 0 ? (ratio - current.multiplier) / range : 0
      return lowPoints + progress * (highPoints - lowPoints)
    }
  }

  return OVERALL_STRENGTH_SCORE_CAP
}

export function calculateExerciseStrengthPoints(input: {
  exerciseName: string
  gender: StrengthGender
  bodyweightKg: number
  estimated1RMKg: number
}): number | null {
  const { exerciseName, gender, bodyweightKg, estimated1RMKg } = input
  if (
    !hasStrengthStandards(exerciseName) ||
    !Number.isFinite(bodyweightKg) ||
    !Number.isFinite(estimated1RMKg) ||
    bodyweightKg <= 0 ||
    estimated1RMKg <= 0
  ) {
    return null
  }

  const standards = getStandardsLadder(exerciseName, gender)
  if (!standards || standards.length === 0) return null

  const ratio = estimated1RMKg / bodyweightKg
  const rawPoints = interpolatePointsFromStandards(ratio, standards)
  return clampScore(rawPoints)
}

export function scoreToOverallLevelProgress(score: number): {
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
} {
  const safeScore = clampScore(score)

  for (let i = SCORE_LEVEL_STEPS.length - 1; i >= 0; i--) {
    const current = SCORE_LEVEL_STEPS[i]
    if (safeScore < current.score) continue

    const next = SCORE_LEVEL_STEPS[i + 1]
    if (!next) {
      return { level: current.level, nextLevel: null, progress: 100 }
    }

    const range = next.score - current.score
    const progress =
      range > 0 ? ((safeScore - current.score) / range) * 100 : 100
    const clampedProgress = clampStrengthProgress(progress)
    return {
      level: current.level,
      nextLevel: next.level,
      progress: clampedProgress,
    }
  }

  return {
    level: 'Untrained',
    nextLevel: 'Beginner',
    progress: 0,
  }
}

export function calculateOverallStrengthScore(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: OverallStrengthExerciseInput[]
  now?: Date
}): OverallStrengthScoreResult {
  const { gender, bodyweightKg, exercises } = input
  const now = input.now ?? new Date()

  const groupState: Record<
    OverallStrengthGroup,
    { topExerciseScore: number; lastTrainedAt: string | null; trackedExerciseCount: number }
  > = {
    Legs: { topExerciseScore: 0, lastTrainedAt: null, trackedExerciseCount: 0 },
    Back: { topExerciseScore: 0, lastTrainedAt: null, trackedExerciseCount: 0 },
    Chest: { topExerciseScore: 0, lastTrainedAt: null, trackedExerciseCount: 0 },
    Shoulders: { topExerciseScore: 0, lastTrainedAt: null, trackedExerciseCount: 0 },
    Arms: { topExerciseScore: 0, lastTrainedAt: null, trackedExerciseCount: 0 },
  }

  let liftsTracked = 0

  exercises.forEach((exercise, idx) => {
    const points = calculateExerciseStrengthPoints({
      exerciseName: exercise.exerciseName,
      gender,
      bodyweightKg,
      estimated1RMKg: exercise.max1RM,
    })
    if (points === null) return

    const specificMuscle = resolveSpecificMuscleName(
      exercise.exerciseName,
      exercise.muscleGroup,
    )
    const overallGroup = toOverallGroup(specificMuscle)
    if (!overallGroup) return

    liftsTracked += 1

    const state = groupState[overallGroup]
    state.trackedExerciseCount += 1
    if (points > state.topExerciseScore) {
      state.topExerciseScore = points
    }

    const currentLast = asDateOrNull(state.lastTrainedAt)
    const nextLast = asDateOrNull(exercise.lastTrainedAt)
    if (!currentLast || (nextLast && nextLast.getTime() > currentLast.getTime())) {
      state.lastTrainedAt = nextLast ? nextLast.toISOString() : state.lastTrainedAt
    }
  })

  const groupBreakdown = {} as Record<OverallStrengthGroup, OverallStrengthGroupBreakdown>
  let totalScore = 0

  ;(Object.keys(OVERALL_GROUP_WEIGHTS) as OverallStrengthGroup[]).forEach((group) => {
    const weight = OVERALL_GROUP_WEIGHTS[group]
    const topExerciseScore = groupState[group].topExerciseScore
    const decayFactor =
      topExerciseScore > 0
        ? computeDecayFactor(groupState[group].lastTrainedAt, now)
        : 1
    const effectiveScore = topExerciseScore * decayFactor
    const weightedContribution = effectiveScore * weight
    totalScore += weightedContribution

    groupBreakdown[group] = {
      group,
      weight,
      topExerciseScore: clampScore(topExerciseScore),
      decayFactor,
      effectiveScore: clampScore(effectiveScore),
      weightedContribution,
      lastTrainedAt: groupState[group].lastTrainedAt,
      trackedExerciseCount: groupState[group].trackedExerciseCount,
    }
  })

  const cappedScore = clampScore(totalScore)
  const roundedScore = Math.round(cappedScore)

  const { level, nextLevel, progress } = scoreToOverallLevelProgress(cappedScore)

  const trainedGroups = (Object.keys(groupBreakdown) as OverallStrengthGroup[])
    .map((group) => groupBreakdown[group])
    .filter((group) => group.trackedExerciseCount > 0)

  const weakestGroup =
    trainedGroups.length >= 2
      ? trainedGroups.reduce((weakest, current) =>
          current.effectiveScore < weakest.effectiveScore ? current : weakest,
        ).group
      : null

  return {
    score: roundedScore,
    level,
    nextLevel,
    progress,
    liftsTracked,
    weakestGroup,
    groupBreakdown,
  }
}

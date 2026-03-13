import {
    EXERCISE_MUSCLE_MAPPING,
    getExerciseNameMap,
    TIER2_WEIGHT,
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
  | 'Core'

export interface OverallStrengthExerciseInput {
  exerciseId: string
  exerciseName: string
  muscleGroup?: string | null
  max1RM: number
  lastTrainedAt?: string | null
}

export interface OverallStrengthBest1RMSnapshot {
  currentBest1RM: number
  previousBest1RM: number
  lastIncreaseAt: string | null
  lastIncreaseSessionId: string | null
}

export interface LatestStrengthIncreaseSession {
  sessionId: string | null
  lastIncreaseAt: string | null
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

export interface OverallStrengthScoreDeltaForSessionResult {
  currentResult: OverallStrengthScoreResult
  baselineResult: OverallStrengthScoreResult
  pointsGained: number
}

export const OVERALL_STRENGTH_SCORE_CAP = 1000
const DECAY_GRACE_DAYS = 14
const DECAY_RATE_PER_WEEK = 0.05
// Geometric decay for normalized weighted average across exercises in a group.
// Each subsequent exercise gets 0.5x the weight of the previous, then all weights
// are normalized to sum to 1. This means the group score reflects balanced strength
// across all tracked exercises — a single outlier lift can't dominate the group.
const SECONDARY_EXERCISE_DECAY = 0.5

const OVERALL_GROUP_WEIGHTS: Record<OverallStrengthGroup, number> = {
  Legs: 0.24,
  Back: 0.24,
  Chest: 0.19,
  Shoulders: 0.19,
  Arms: 0.09,
  Core: 0.05,
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
    case 'Lats':
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
    case 'Abs':
    case 'Core':
      return 'Core'
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

function buildSessionBaselineExercises(input: {
  exercises: OverallStrengthExerciseInput[]
  best1RMSnapshotByExerciseId: Record<
    string,
    OverallStrengthBest1RMSnapshot | undefined
  >
  baselineSessionId: string | null | undefined
}): OverallStrengthExerciseInput[] {
  const { exercises, best1RMSnapshotByExerciseId, baselineSessionId } = input
  if (!baselineSessionId) return exercises

  return exercises.map((exercise) => {
    const snapshot = best1RMSnapshotByExerciseId[exercise.exerciseId]
    if (!snapshot || snapshot.lastIncreaseSessionId !== baselineSessionId) {
      return exercise
    }

    return {
      ...exercise,
      max1RM: snapshot.previousBest1RM,
    }
  })
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

export function getOverallStrengthGroupLevelProgress(
  breakdown: Pick<OverallStrengthGroupBreakdown, 'effectiveScore'>,
): {
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
} {
  return scoreToOverallLevelProgress(breakdown.effectiveScore)
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
    { exerciseScores: number[]; lastTrainedAt: string | null; trackedExerciseCount: number }
  > = {
    Legs: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Back: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Chest: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Shoulders: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Arms: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Core: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
  }

  let liftsTracked = 0

  exercises.forEach((exercise) => {
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

    const config = exerciseNameMap.get(exercise.exerciseName)
    const tier = config?.tier || 2
    const tierWeight = tier === 1 ? 1.0 : TIER2_WEIGHT
    const weightedPoints = points * tierWeight

    const state = groupState[overallGroup]
    state.trackedExerciseCount += 1
    state.exerciseScores.push(weightedPoints)

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
    const state = groupState[group]

    // Sort descending, then compute a normalized weighted average so every exercise
    // contributes proportionally — a single outlier can't inflate the group.
    const sortedScores = [...state.exerciseScores].sort((a, b) => b - a)
    const topExerciseScore = sortedScores[0] ?? 0
    const weights = sortedScores.map((_, i) => Math.pow(SECONDARY_EXERCISE_DECAY, i))
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    const groupRawScore = totalWeight > 0
      ? sortedScores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalWeight
      : 0

    const decayFactor =
      groupRawScore > 0
        ? computeDecayFactor(state.lastTrainedAt, now)
        : 1
    const effectiveScore = groupRawScore * decayFactor
    const weightedContribution = effectiveScore * weight
    totalScore += weightedContribution

    groupBreakdown[group] = {
      group,
      weight,
      topExerciseScore: clampScore(topExerciseScore),
      decayFactor,
      effectiveScore: clampScore(effectiveScore),
      weightedContribution,
      lastTrainedAt: state.lastTrainedAt,
      trackedExerciseCount: state.trackedExerciseCount,
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

export function getLatestStrengthIncreaseSession(input: {
  exercises: OverallStrengthExerciseInput[]
  best1RMSnapshotByExerciseId: Record<
    string,
    OverallStrengthBest1RMSnapshot | undefined
  >
}): LatestStrengthIncreaseSession {
  const { exercises, best1RMSnapshotByExerciseId } = input

  let latestSessionId: string | null = null
  let latestIncreaseAt: string | null = null
  let latestIncreaseTime = Number.NEGATIVE_INFINITY

  exercises.forEach((exercise) => {
    const snapshot = best1RMSnapshotByExerciseId[exercise.exerciseId]
    if (!snapshot?.lastIncreaseSessionId || !snapshot.lastIncreaseAt) {
      return
    }

    const increaseDate = asDateOrNull(snapshot.lastIncreaseAt)
    if (!increaseDate) {
      return
    }
    const increaseTime = increaseDate.getTime()

    if (increaseTime > latestIncreaseTime) {
      latestIncreaseTime = increaseTime
      latestSessionId = snapshot.lastIncreaseSessionId
      latestIncreaseAt = snapshot.lastIncreaseAt
    }
  })

  return {
    sessionId: latestSessionId,
    lastIncreaseAt: latestIncreaseAt,
  }
}

export function calculateOverallStrengthScoreDeltaForSession(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: OverallStrengthExerciseInput[]
  best1RMSnapshotByExerciseId: Record<
    string,
    OverallStrengthBest1RMSnapshot | undefined
  >
  baselineSessionId: string | null | undefined
  now?: Date
}): OverallStrengthScoreDeltaForSessionResult {
  const {
    gender,
    bodyweightKg,
    exercises,
    best1RMSnapshotByExerciseId,
    baselineSessionId,
    now,
  } = input

  const currentResult = calculateOverallStrengthScore({
    gender,
    bodyweightKg,
    exercises,
    now,
  })

  const baselineExercises = buildSessionBaselineExercises({
    exercises,
    best1RMSnapshotByExerciseId,
    baselineSessionId,
  })

  const baselineResult = calculateOverallStrengthScore({
    gender,
    bodyweightKg,
    exercises: baselineExercises,
    now,
  })

  const pointsGained = Math.max(
    0,
    Math.round(currentResult.score - baselineResult.score),
  )

  return {
    currentResult,
    baselineResult,
    pointsGained,
  }
}

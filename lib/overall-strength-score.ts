import {
    EXERCISE_MUSCLE_MAPPING,
    EXERCISE_TIER_WEIGHTS,
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

export interface StrengthScoreProjectionResult {
  currentResult: OverallStrengthScoreResult
  projectedResult: OverallStrengthScoreResult
  currentScore: number
  projectedScore: number
  rawPointsGained: number
  pointsGained: number
  currentPerformance: number
  targetPerformance: number
  targetGroup: OverallStrengthGroup | null
  projectedExercises: OverallStrengthExerciseInput[]
}

export const OVERALL_STRENGTH_SCORE_CAP = 1000
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

function getPreciseOverallScore(result: OverallStrengthScoreResult): number {
  return clampScore(
    (Object.keys(result.groupBreakdown) as OverallStrengthGroup[]).reduce(
      (sum, group) => sum + result.groupBreakdown[group].weightedContribution,
      0,
    ),
  )
}

function sameCanonicalExerciseName(left: string, right: string): boolean {
  const leftCanonical = exerciseNameMap.get(left)?.name ?? left
  const rightCanonical = exerciseNameMap.get(right)?.name ?? right
  return leftCanonical === rightCanonical
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

export function calculateStrengthAggregateFromScores(input: {
  weightedExerciseScores: number[]
  lastTrainedAt: string | null
  now?: Date
}): {
  topExerciseScore: number
  decayFactor: number
  effectiveScore: number
} {
  const { weightedExerciseScores, lastTrainedAt } = input

  const sortedScores = [...weightedExerciseScores].sort((a, b) => b - a)
  const topExerciseScore = sortedScores[0] ?? 0
  const weights = sortedScores.map((_, i) =>
    Math.pow(SECONDARY_EXERCISE_DECAY, i),
  )
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  const groupRawScore =
    totalWeight > 0
      ? sortedScores.reduce((sum, s, i) => sum + s * weights[i], 0) /
        totalWeight
      : 0

  const decayFactor = 1
  const effectiveScore = groupRawScore

  return {
    topExerciseScore: clampScore(topExerciseScore),
    decayFactor,
    effectiveScore: clampScore(effectiveScore),
  }
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

  const config = exerciseNameMap.get(exerciseName)
  const ratio = config?.isRepBased
    ? estimated1RMKg
    : estimated1RMKg / bodyweightKg
  const rawPoints = interpolatePointsFromStandards(ratio, standards)
  return clampScore(rawPoints)
}

export function getStrengthLevelTargetPerformance(input: {
  exerciseName: string
  gender: StrengthGender
  bodyweightKg: number
  targetLevel: StrengthLevel
}): number | null {
  const { exerciseName, gender, bodyweightKg, targetLevel } = input
  if (
    !Number.isFinite(bodyweightKg) ||
    bodyweightKg <= 0 ||
    !hasStrengthStandards(exerciseName)
  ) {
    return null
  }

  const standards = getStandardsLadder(exerciseName, gender)
  const targetStandard = standards?.find(
    (standard) => standard.level === targetLevel,
  )
  if (!targetStandard) return null

  const config = exerciseNameMap.get(exerciseName)
  return config?.isRepBased
    ? Math.ceil(targetStandard.multiplier)
    : Math.ceil(bodyweightKg * targetStandard.multiplier)
}

export function calculateStrengthScoreProjectionForExerciseTarget(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: OverallStrengthExerciseInput[]
  exercise: Pick<
    OverallStrengthExerciseInput,
    'exerciseId' | 'exerciseName' | 'muscleGroup' | 'lastTrainedAt'
  >
  targetPerformance: number
  now?: Date
}): StrengthScoreProjectionResult | null {
  const { gender, bodyweightKg, exercises, exercise, targetPerformance } = input
  const now = input.now ?? new Date()

  if (
    !hasStrengthStandards(exercise.exerciseName) ||
    !Number.isFinite(bodyweightKg) ||
    bodyweightKg <= 0 ||
    !Number.isFinite(targetPerformance) ||
    targetPerformance <= 0
  ) {
    return null
  }

  const existingIndex = exercises.findIndex(
    (candidate) =>
      candidate.exerciseId === exercise.exerciseId ||
      sameCanonicalExerciseName(
        candidate.exerciseName,
        exercise.exerciseName,
      ),
  )
  const existingExercise =
    existingIndex >= 0 ? exercises[existingIndex] : null
  const currentPerformance = existingExercise?.max1RM ?? 0
  const projectedPerformance = Math.max(currentPerformance, targetPerformance)
  const projectedLastTrainedAt = now.toISOString()
  const projectedExercise: OverallStrengthExerciseInput = {
    ...(existingExercise ?? exercise),
    max1RM: projectedPerformance,
    lastTrainedAt: projectedLastTrainedAt,
  }
  const projectedExercises =
    existingIndex >= 0
      ? exercises.map((candidate, index) =>
          index === existingIndex ? projectedExercise : candidate,
        )
      : [...exercises, projectedExercise]

  const currentResult = calculateOverallStrengthScore({
    gender,
    bodyweightKg,
    exercises,
    now,
  })
  const projectedResult = calculateOverallStrengthScore({
    gender,
    bodyweightKg,
    exercises: projectedExercises,
    now,
  })

  const currentScore = getPreciseOverallScore(currentResult)
  const projectedScore = getPreciseOverallScore(projectedResult)
  const rawPointsGained = Math.max(0, projectedScore - currentScore)
  const specificMuscle = resolveSpecificMuscleName(
    exercise.exerciseName,
    exercise.muscleGroup,
  )

  return {
    currentResult,
    projectedResult,
    currentScore,
    projectedScore,
    rawPointsGained,
    pointsGained: Math.max(0, projectedResult.score - currentResult.score),
    currentPerformance,
    targetPerformance: projectedPerformance,
    targetGroup: toOverallGroup(specificMuscle),
    projectedExercises,
  }
}

export function calculateStrengthScoreProjectionForExerciseLevel(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: OverallStrengthExerciseInput[]
  exercise: Pick<
    OverallStrengthExerciseInput,
    'exerciseId' | 'exerciseName' | 'muscleGroup' | 'lastTrainedAt'
  >
  targetLevel: StrengthLevel
  now?: Date
}): StrengthScoreProjectionResult | null {
  const targetPerformance = getStrengthLevelTargetPerformance({
    exerciseName: input.exercise.exerciseName,
    gender: input.gender,
    bodyweightKg: input.bodyweightKg,
    targetLevel: input.targetLevel,
  })
  if (targetPerformance === null) return null

  return calculateStrengthScoreProjectionForExerciseTarget({
    gender: input.gender,
    bodyweightKg: input.bodyweightKg,
    exercises: input.exercises,
    exercise: input.exercise,
    targetPerformance,
    now: input.now,
  })
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
    const tier = config?.tier ?? 3
    const tierWeight = EXERCISE_TIER_WEIGHTS[tier]
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

    const { topExerciseScore, decayFactor, effectiveScore } =
      calculateStrengthAggregateFromScores({
        weightedExerciseScores: state.exerciseScores,
        lastTrainedAt: state.lastTrainedAt,
        now,
      })
    const weightedContribution = effectiveScore * weight
    totalScore += weightedContribution

    groupBreakdown[group] = {
      group,
      weight,
      topExerciseScore,
      decayFactor,
      effectiveScore,
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

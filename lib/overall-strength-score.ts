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
  /**
   * Number of workouts this lift has been logged in. Lifts trained more often
   * count more in their muscle group. Leave undefined to treat the lift as
   * fully established.
   */
  sessionCount?: number | null
}

/**
 * One logged workout, used to replay how the strength score evolved.
 * Sessions must be supplied in chronological order.
 */
export interface StrengthHistorySession {
  sessionId: string | null
  /** Best performance (rounded estimated 1RM in kg, or reps for rep-based lifts) per exerciseId. */
  exerciseBests: Record<string, number>
}

export interface StrengthScoreHistoryStep {
  sessionId: string | null
  hadRecord: boolean
  scoreBefore: number
  scoreAfter: number
  /** Unrounded score after this workout. */
  preciseScoreAfter: number
}

export interface StrengthScoreHistoryResult {
  /** Final result. `score`, `level`, `nextLevel` and `progress` reflect the displayed score. */
  result: OverallStrengthScoreResult
  steps: StrengthScoreHistoryStep[]
  /** Result just before `captureBeforeSessionId`, when requested and found. */
  capturedBefore: OverallStrengthScoreResult | null
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

// Scores run 0-10000. Before 1.0.33 they ran 0-1000; the old-scale value is
// still cached in profiles.overall_strength_score for older app versions.
export const OVERALL_STRENGTH_SCORE_CAP = 10000
export const LEGACY_STRENGTH_SCORE_SCALE = 10

/** Converts a score to the pre-1.0.33 0-1000 scale. */
export function toLegacyStrengthScore(score: number): number {
  return Math.round(score / LEGACY_STRENGTH_SCORE_SCALE)
}

/**
 * Reads a cached profile score on the current scale, falling back to the
 * old-scale column for profiles not yet refreshed by 1.0.33+.
 */
export function resolveCachedStrengthPoints(profile: {
  overall_strength_points?: number | null
  overall_strength_score?: number | null
}): number | null {
  if (typeof profile.overall_strength_points === 'number') {
    return profile.overall_strength_points
  }
  if (typeof profile.overall_strength_score === 'number') {
    return profile.overall_strength_score * LEGACY_STRENGTH_SCORE_SCALE
  }
  return null
}
// Each muscle group's score is a weighted average of its lifts' scores.
// A lift's weight = tier weight (EXERCISE_TIER_WEIGHTS) x training-frequency
// weight x rank decay. Lifts are ranked by score, and each lower rank gets 0.7x
// the weight of the one above, so stronger lifts lead without accessories
// becoming irrelevant.
const SECONDARY_EXERCISE_DECAY = 0.7

// Multiplier applied to a lift's score. Big free-weight compounds keep a small
// bonus; every other lift counts at its real level. Tier only reduces how much
// a lift counts in the average, never its score.
const EXERCISE_TIER_SCORE_MULTIPLIERS: Record<1 | 2 | 3, number> = {
  1: 1.1,
  2: 1,
  3: 1,
}

// A lift's frequency weight is 1 - e^(-sessions / scale): ~0.49 after one
// workout, ~0.86 after three, ~0.96 after five. Lifts you train regularly
// count fully; a lift tried once counts about half.
const TRAINING_FREQUENCY_SCALE_SESSIONS = 1.5

// The displayed score may run this many points ahead of the precise score, so
// small records can still award a whole point. Later gains pay it back.
export const STRENGTH_SCORE_MAX_AHEAD = 3

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
  Beginner: 1000,
  Novice: 2000,
  Intermediate: 4000,
  Advanced: 6000,
  Elite: 8250,
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

interface GroupExerciseEntry {
  score: number
  weight: number
}

export function getTrainingFrequencyWeight(
  sessionCount: number | null | undefined,
): number {
  if (sessionCount === null || sessionCount === undefined) return 1
  if (!Number.isFinite(sessionCount)) return 1
  const sessions = Math.max(1, sessionCount)
  return 1 - Math.exp(-sessions / TRAINING_FREQUENCY_SCALE_SESSIONS)
}

function calculateStrengthAggregateFromScores(entries: GroupExerciseEntry[]): {
  topExerciseScore: number
  decayFactor: number
  effectiveScore: number
} {
  // Rank by score; ties broken by weight so the result doesn't depend on input order.
  const sorted = [...entries].sort(
    (a, b) => b.score - a.score || b.weight - a.weight,
  )
  const topExerciseScore = sorted[0]?.score ?? 0

  let weightedSum = 0
  let totalWeight = 0
  sorted.forEach((entry, rank) => {
    const weight = entry.weight * Math.pow(SECONDARY_EXERCISE_DECAY, rank)
    weightedSum += entry.score * weight
    totalWeight += weight
  })
  const effectiveScore = totalWeight > 0 ? weightedSum / totalWeight : 0

  return {
    topExerciseScore: clampScore(topExerciseScore),
    decayFactor: 1,
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

  const groupState: Record<
    OverallStrengthGroup,
    { entries: GroupExerciseEntry[]; lastTrainedAt: string | null; trackedExerciseCount: number }
  > = {
    Legs: { entries: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Back: { entries: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Chest: { entries: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Shoulders: { entries: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Arms: { entries: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Core: { entries: [], lastTrainedAt: null, trackedExerciseCount: 0 },
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

    const state = groupState[overallGroup]
    state.trackedExerciseCount += 1
    state.entries.push({
      score: points * EXERCISE_TIER_SCORE_MULTIPLIERS[tier],
      weight:
        EXERCISE_TIER_WEIGHTS[tier] *
        getTrainingFrequencyWeight(exercise.sessionCount),
    })

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
      calculateStrengthAggregateFromScores(state.entries)
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
  /** Workout history. When provided, points come from the history replay. */
  sessions?: StrengthHistorySession[]
  now?: Date
}): OverallStrengthScoreDeltaForSessionResult {
  const {
    gender,
    bodyweightKg,
    exercises,
    best1RMSnapshotByExerciseId,
    baselineSessionId,
    sessions,
    now,
  } = input

  if (sessions) {
    const history = calculateStrengthScoreHistory({
      gender,
      bodyweightKg,
      exercises,
      sessions,
      captureBeforeSessionId: baselineSessionId ?? null,
      now,
    })
    const currentResult = history.result
    const step = baselineSessionId
      ? history.steps.find((candidate) => candidate.sessionId === baselineSessionId)
      : undefined
    const pointsGained = step
      ? Math.max(0, step.scoreAfter - step.scoreBefore)
      : 0
    // Keep "before + gained = now" so the UI's before/after numbers always add up.
    const baselineScore = currentResult.score - pointsGained
    const baselineSource = history.capturedBefore ?? currentResult

    return {
      currentResult,
      baselineResult: {
        ...baselineSource,
        score: baselineScore,
        ...scoreToOverallLevelProgress(baselineScore),
      },
      pointsGained,
    }
  }

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

/**
 * Moves the displayed score after a workout. Every workout with a record
 * earns at least +1, but the displayed score never falls below the rounded
 * precise score and never runs more than STRENGTH_SCORE_MAX_AHEAD points
 * ahead of it, so extra points are paid back by later gains.
 *
 * A workout with a record also never lowers the displayed score. In the rare
 * case where it would (a weak lift gaining weight in its group), the score is
 * held and the next workout without a record brings it back within the limit.
 */
export function applyStrengthScoreRounding(input: {
  previousDisplayedScore: number
  preciseScore: number
  hadRecord: boolean
}): number {
  const { previousDisplayedScore, preciseScore, hadRecord } = input
  const minimum = Math.round(preciseScore)
  const maximum = Math.min(
    OVERALL_STRENGTH_SCORE_CAP,
    Math.max(minimum, Math.floor(preciseScore + STRENGTH_SCORE_MAX_AHEAD)),
  )
  const candidate = previousDisplayedScore + (hadRecord ? 1 : 0)
  const displayed = Math.min(maximum, Math.max(minimum, candidate))
  return hadRecord ? Math.max(previousDisplayedScore, displayed) : displayed
}

function withDisplayedScore(
  result: OverallStrengthScoreResult,
  displayedScore: number,
): OverallStrengthScoreResult {
  return {
    ...result,
    score: displayedScore,
    ...scoreToOverallLevelProgress(displayedScore),
  }
}

function isScoredExercise(exercise: OverallStrengthExerciseInput): boolean {
  if (!hasStrengthStandards(exercise.exerciseName)) return false
  const specificMuscle = resolveSpecificMuscleName(
    exercise.exerciseName,
    exercise.muscleGroup,
  )
  return toOverallGroup(specificMuscle) !== null
}

/**
 * Replays the workout history in order to produce the displayed strength
 * score. The precise score after each workout comes from
 * calculateOverallStrengthScore; the displayed score follows it using
 * applyStrengthScoreRounding. Replaying from history keeps every device and
 * the server in agreement without storing extra state.
 *
 * `exercises` is the current state (it supplies names, muscle groups and any
 * best not present in the sessions, e.g. one entered during onboarding).
 */
export function calculateStrengthScoreHistory(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: OverallStrengthExerciseInput[]
  sessions: StrengthHistorySession[]
  captureBeforeSessionId?: string | null
  now?: Date
}): StrengthScoreHistoryResult {
  const { gender, bodyweightKg, exercises, sessions, captureBeforeSessionId, now } =
    input

  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.exerciseId, exercise]),
  )
  const scoredExerciseIds = new Set(
    exercises.filter(isScoredExercise).map((exercise) => exercise.exerciseId),
  )

  const bestInSessions = new Map<string, number>()
  sessions.forEach((session) => {
    Object.entries(session.exerciseBests).forEach(([exerciseId, value]) => {
      if (!exerciseById.has(exerciseId) || !(value > 0)) return
      bestInSessions.set(
        exerciseId,
        Math.max(bestInSessions.get(exerciseId) ?? 0, value),
      )
    })
  })

  // Bests that never appear in a logged workout (e.g. onboarding) are known
  // from the start.
  const bestByExerciseId = new Map<string, number>()
  const sessionCountByExerciseId = new Map<string, number>()
  exercises.forEach((exercise) => {
    if (exercise.max1RM > (bestInSessions.get(exercise.exerciseId) ?? 0)) {
      bestByExerciseId.set(exercise.exerciseId, exercise.max1RM)
    }
  })

  const buildState = (): OverallStrengthExerciseInput[] =>
    Array.from(bestByExerciseId.entries()).map(([exerciseId, best]) => {
      const exercise = exerciseById.get(exerciseId) as OverallStrengthExerciseInput
      return {
        ...exercise,
        max1RM: best,
        sessionCount:
          exercise.sessionCount === null || exercise.sessionCount === undefined
            ? exercise.sessionCount
            : sessionCountByExerciseId.get(exerciseId) ?? 0,
      }
    })
  const scoreState = () =>
    calculateOverallStrengthScore({
      gender,
      bodyweightKg,
      exercises: buildState(),
      now,
    })

  let currentResult = scoreState()
  let displayedScore = Math.round(getPreciseOverallScore(currentResult))
  let capturedBefore: OverallStrengthScoreResult | null = null
  const steps: StrengthScoreHistoryStep[] = []

  sessions.forEach((session) => {
    if (
      captureBeforeSessionId &&
      session.sessionId === captureBeforeSessionId
    ) {
      capturedBefore = withDisplayedScore(currentResult, displayedScore)
    }

    let changed = false
    let hadRecord = false
    Object.entries(session.exerciseBests).forEach(([exerciseId, value]) => {
      if (!exerciseById.has(exerciseId) || !(value > 0)) return
      changed = true
      sessionCountByExerciseId.set(
        exerciseId,
        (sessionCountByExerciseId.get(exerciseId) ?? 0) + 1,
      )
      if (value > (bestByExerciseId.get(exerciseId) ?? 0)) {
        bestByExerciseId.set(exerciseId, value)
        if (scoredExerciseIds.has(exerciseId)) hadRecord = true
      }
    })

    const scoreBefore = displayedScore
    if (changed) {
      currentResult = scoreState()
      displayedScore = applyStrengthScoreRounding({
        previousDisplayedScore: displayedScore,
        preciseScore: getPreciseOverallScore(currentResult),
        hadRecord,
      })
    }

    steps.push({
      sessionId: session.sessionId,
      hadRecord,
      scoreBefore,
      scoreAfter: displayedScore,
      preciseScoreAfter: getPreciseOverallScore(currentResult),
    })
  })

  return {
    result: withDisplayedScore(currentResult, displayedScore),
    steps,
    capturedBefore,
  }
}

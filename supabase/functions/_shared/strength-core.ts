/**
 * Strength score core, shared by the app and the edge functions.
 *
 * The app imports this file through lib/overall-strength-score.ts and
 * lib/strength-standards.ts; edge functions import it from strength.ts. Keep it
 * pure TypeScript: no Deno, Supabase or npm imports, and relative imports with
 * explicit `.ts` extensions only (Deno needs them; Metro and tsc accept them).
 *
 * Standards data comes from generated-strength-standards.ts, generated from
 * lib/exercise-standards-config.ts by scripts/generate-strength-standards.mjs.
 */
import {
  GENERATED_EXERCISES_WITH_STANDARDS,
  GENERATED_EXERCISE_MUSCLE_MAPPING,
  GENERATED_EXERCISE_TIER_WEIGHTS,
} from './generated-strength-standards.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StrengthLevel =
  | 'Untrained'
  | 'Beginner'
  | 'Novice'
  | 'Intermediate'
  | 'Advanced'
  | 'Elite'
  | 'World Class'

export type StrengthGender = 'male' | 'female'

export type ExerciseTier = 1 | 2 | 3

export type OverallStrengthGroup =
  | 'Legs'
  | 'Back'
  | 'Chest'
  | 'Shoulders'
  | 'Arms'
  | 'Core'

export interface StrengthStandard {
  level: StrengthLevel
  multiplier: number
  color: string
  description: string
}

export interface StrengthStandardsConfig {
  id: string
  name: string
  aliases?: readonly string[]
  gifUrl?: string | null
  male: readonly StrengthStandard[]
  female: readonly StrengthStandard[]
  tier?: ExerciseTier
  isRepBased?: boolean
}

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Scores run 0-10000. Before 1.0.33 they ran 0-1000; the old-scale value is
// still cached in profiles.overall_strength_score for older app versions.
export const OVERALL_STRENGTH_SCORE_CAP = 10000
export const LEGACY_STRENGTH_SCORE_SCALE = 10

// The displayed score may run this many points ahead of the precise score, so
// small records can still award a whole point. Later gains pay it back.
export const STRENGTH_SCORE_MAX_AHEAD = 3

// Each muscle group's score is a weighted average of its lifts' scores.
// A lift's weight = tier weight (EXERCISE_TIER_WEIGHTS) x training-frequency
// weight x rank decay. Lifts are ranked by score, and each lower rank gets 0.7x
// the weight of the one above, so stronger lifts lead without accessories
// becoming irrelevant.
const SECONDARY_EXERCISE_DECAY = 0.7

// Multiplier applied to a lift's score. Big free-weight compounds keep a small
// bonus; every other lift counts at its real level. Tier only reduces how much
// a lift counts in the average, never its score.
const EXERCISE_TIER_SCORE_MULTIPLIERS: Record<ExerciseTier, number> = {
  1: 1.1,
  2: 1,
  3: 1,
}

// A lift's frequency weight is 1 - e^(-sessions / scale): ~0.49 after one
// workout, ~0.86 after three, ~0.96 after five. Lifts you train regularly
// count fully; a lift tried once counts about half.
const TRAINING_FREQUENCY_SCALE_SESSIONS = 1.5

/** Weights applied to each exercise tier when averaging a muscle group. */
export const EXERCISE_TIER_WEIGHTS: Record<ExerciseTier, number> = {
  1: GENERATED_EXERCISE_TIER_WEIGHTS['1'],
  2: GENERATED_EXERCISE_TIER_WEIGHTS['2'],
  3: GENERATED_EXERCISE_TIER_WEIGHTS['3'],
}

export const OVERALL_GROUP_WEIGHTS: Record<OverallStrengthGroup, number> = {
  Legs: 0.24,
  Back: 0.24,
  Chest: 0.19,
  Shoulders: 0.19,
  Arms: 0.09,
  Core: 0.05,
}

export const STRENGTH_LEVEL_ORDER: StrengthLevel[] = [
  'Untrained',
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

export const LEVEL_POINT_ANCHORS: Record<StrengthLevel, number> = {
  Untrained: 0,
  Beginner: 1000,
  Novice: 2000,
  Intermediate: 4000,
  Advanced: 6000,
  Elite: 8250,
  'World Class': OVERALL_STRENGTH_SCORE_CAP,
}

const SCORE_LEVEL_STEPS: { level: StrengthLevel; score: number }[] =
  STRENGTH_LEVEL_ORDER.map((level) => ({
    level,
    score: LEVEL_POINT_ANCHORS[level],
  }))

// ---------------------------------------------------------------------------
// Exercise lookup: names, muscles and groups
// ---------------------------------------------------------------------------

export const STRENGTH_STANDARDS_EXERCISES =
  GENERATED_EXERCISES_WITH_STANDARDS as unknown as readonly StrengthStandardsConfig[]

const EXERCISE_MUSCLE_MAPPING = GENERATED_EXERCISE_MUSCLE_MAPPING as Record<
  string,
  string | undefined
>

/** Exercise names match case- and whitespace-insensitively everywhere. */
export function normaliseExerciseName(name: string): string {
  return name.trim().toLowerCase()
}

const configByNormalisedName = (() => {
  const map = new Map<string, StrengthStandardsConfig>()
  STRENGTH_STANDARDS_EXERCISES.forEach((config) => {
    map.set(normaliseExerciseName(config.name), config)
    config.aliases?.forEach((alias) => {
      map.set(normaliseExerciseName(alias), config)
    })
  })
  return map
})()

/** Standards config for an exercise name or alias, or null. */
export function getStrengthStandardsConfig(
  exerciseName: string | null | undefined,
): StrengthStandardsConfig | null {
  if (!exerciseName) return null
  return configByNormalisedName.get(normaliseExerciseName(exerciseName)) ?? null
}

export function hasStrengthStandards(exerciseName: string): boolean {
  return getStrengthStandardsConfig(exerciseName) !== null
}

export function isRepBasedStrengthExercise(exerciseName: string): boolean {
  return getStrengthStandardsConfig(exerciseName)?.isRepBased ?? false
}

export function getStrengthExerciseTier(exerciseName: string): ExerciseTier {
  return getStrengthStandardsConfig(exerciseName)?.tier ?? 3
}

export function getCanonicalStrengthExerciseName(exerciseName: string): string {
  return getStrengthStandardsConfig(exerciseName)?.name ?? exerciseName
}

export function sameCanonicalExerciseName(left: string, right: string): boolean {
  return (
    getCanonicalStrengthExerciseName(left) ===
    getCanonicalStrengthExerciseName(right)
  )
}

export function getStandardsLadder(
  exerciseName: string,
  gender: StrengthGender,
): readonly StrengthStandard[] | null {
  const config = getStrengthStandardsConfig(exerciseName)
  if (!config) return null
  return gender === 'male' ? config.male : config.female
}

/** The specific muscle (e.g. 'Quads') a standards lift counts towards. */
export function resolveExerciseSpecificMuscle(
  exerciseName: string,
  fallbackMuscle: string | null | undefined,
): string | null {
  const canonicalName = getCanonicalStrengthExerciseName(exerciseName)

  return (
    EXERCISE_MUSCLE_MAPPING[canonicalName] ??
    EXERCISE_MUSCLE_MAPPING[exerciseName] ??
    fallbackMuscle ??
    null
  )
}

/** Maps a specific muscle to the overall strength group it scores in. */
export function muscleToStrengthGroup(
  specificMuscle: string | null | undefined,
): OverallStrengthGroup | null {
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

export function resolveExerciseStrengthGroup(
  exerciseName: string,
  fallbackMuscle: string | null | undefined,
): OverallStrengthGroup | null {
  return muscleToStrengthGroup(
    resolveExerciseSpecificMuscle(exerciseName, fallbackMuscle),
  )
}

// ---------------------------------------------------------------------------
// Per-lift levels and points
// ---------------------------------------------------------------------------

/** Epley estimated one-rep max. */
export function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return 0
  }

  if (weightKg <= 0 || reps <= 0) {
    return 0
  }

  return weightKg * (1 + reps / 30)
}

export function clampStrengthProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, progress))
}

export function clampStrengthScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(OVERALL_STRENGTH_SCORE_CAP, score))
}

/**
 * The level a lift sits at, given its performance (estimated 1RM in kg, or
 * reps for rep-based lifts), and progress (0-100) to the next level.
 */
export function getStrengthStandard(
  exerciseName: string,
  gender: StrengthGender,
  bodyweight: number,
  oneRepMax: number,
): {
  level: StrengthLevel
  standard: StrengthStandard
  nextLevel: StrengthStandard | null
  progress: number
} | null {
  const config = getStrengthStandardsConfig(exerciseName)
  if (!config) {
    return null
  }

  const standards = gender === 'male' ? config.male : config.female
  const isRepBased = config.isRepBased ?? false
  const ratio = isRepBased ? oneRepMax : oneRepMax / bodyweight

  let currentLevel = standards[0]
  let nextLevel: StrengthStandard | null = null
  let levelIndex = -1

  for (let i = standards.length - 1; i >= 0; i--) {
    if (ratio >= standards[i].multiplier) {
      currentLevel = standards[i]
      levelIndex = i
      nextLevel = i < standards.length - 1 ? standards[i + 1] : null
      break
    }
  }

  let progress = 100 // At the top level.

  if (levelIndex === -1 && standards.length > 0) {
    // Below the first milestone.
    nextLevel = standards[0]
    const nextThreshold = nextLevel.multiplier
    progress = nextThreshold > 0 ? (ratio / nextThreshold) * 100 : 0
  } else if (nextLevel) {
    const currentThreshold = currentLevel.multiplier
    const nextThreshold = nextLevel.multiplier
    const range = nextThreshold - currentThreshold
    const currentProgress = ratio - currentThreshold
    progress = range > 0 ? (currentProgress / range) * 100 : 0
  }

  return {
    level: levelIndex === -1 ? 'Untrained' : currentLevel.level,
    standard: currentLevel,
    nextLevel,
    progress: clampStrengthProgress(progress),
  }
}

function interpolatePointsFromStandards(
  ratio: number,
  standards: readonly StrengthStandard[],
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

/** Points (0-10000) for one lift, or null if it has no standards. */
export function calculateExerciseStrengthPoints(input: {
  exerciseName: string
  gender: StrengthGender
  bodyweightKg: number
  /** Estimated 1RM in kg, or reps for rep-based lifts. */
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

  const ratio = isRepBasedStrengthExercise(exerciseName)
    ? estimated1RMKg
    : estimated1RMKg / bodyweightKg
  return clampStrengthScore(interpolatePointsFromStandards(ratio, standards))
}

/** Performance needed to reach `targetLevel` (kg 1RM, or reps), rounded up. */
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

  return isRepBasedStrengthExercise(exerciseName)
    ? Math.ceil(targetStandard.multiplier)
    : Math.ceil(bodyweightKg * targetStandard.multiplier)
}

// ---------------------------------------------------------------------------
// Overall score
// ---------------------------------------------------------------------------

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

function asDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Unrounded overall score: the sum of each group's weighted contribution. */
export function getPreciseOverallScore(
  result: Pick<OverallStrengthScoreResult, 'groupBreakdown'>,
): number {
  return clampStrengthScore(
    (Object.keys(result.groupBreakdown) as OverallStrengthGroup[]).reduce(
      (sum, group) => sum + result.groupBreakdown[group].weightedContribution,
      0,
    ),
  )
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

  // Clamp before weighting, so a capped lift with the tier-1 bonus can't push
  // a group past the cap.
  return {
    topExerciseScore: clampStrengthScore(topExerciseScore),
    decayFactor: 1,
    effectiveScore: clampStrengthScore(effectiveScore),
  }
}

export function scoreToOverallLevelProgress(score: number): {
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
} {
  const safeScore = clampStrengthScore(score)

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
    return {
      level: current.level,
      nextLevel: next.level,
      progress: clampStrengthProgress(progress),
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

    const overallGroup = resolveExerciseStrengthGroup(
      exercise.exerciseName,
      exercise.muscleGroup,
    )
    if (!overallGroup) return

    liftsTracked += 1

    const tier = getStrengthExerciseTier(exercise.exerciseName)

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

  const cappedScore = clampStrengthScore(totalScore)
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

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

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

  return {
    currentResult,
    projectedResult,
    currentScore,
    projectedScore,
    rawPointsGained,
    pointsGained: Math.max(0, projectedResult.score - currentResult.score),
    currentPerformance,
    targetPerformance: projectedPerformance,
    targetGroup: resolveExerciseStrengthGroup(
      exercise.exerciseName,
      exercise.muscleGroup,
    ),
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

// ---------------------------------------------------------------------------
// History replay and per-workout deltas
// ---------------------------------------------------------------------------

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
  return (
    resolveExerciseStrengthGroup(exercise.exerciseName, exercise.muscleGroup) !==
    null
  )
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

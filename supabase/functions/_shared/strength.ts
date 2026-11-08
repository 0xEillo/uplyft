import {
  LEVEL_POINT_ANCHORS,
  OVERALL_STRENGTH_SCORE_CAP,
  STRENGTH_LEVEL_ORDER,
  STRENGTH_STANDARDS_EXERCISES,
  calculateExerciseStrengthPoints,
  calculateOverallStrengthScore,
  calculateStrengthScoreHistory,
  calculateStrengthScoreProjectionForExerciseTarget,
  estimateOneRepMaxKg,
  getStandardsLadder,
  getStrengthStandard,
  getStrengthStandardsConfig,
  isRepBasedStrengthExercise,
  normaliseExerciseName,
  resolveExerciseSpecificMuscle,
  resolveExerciseStrengthGroup,
  toLegacyStrengthScore,
  type ExerciseTier,
  type OverallStrengthGroup,
  type OverallStrengthGroupBreakdown,
  type OverallStrengthScoreResult,
  type StrengthGender,
  type StrengthLevel,
  type StrengthStandardsConfig,
} from './strength-core.ts'
import {
  buildStrengthInputsFromRows,
  getBestSetFromRecords,
  ONBOARDING_STRENGTH_SNAPSHOT_SELECT,
  parseOnboardingStrengthSnapshotRow,
  resolveStrengthBodyweightKg,
  STRENGTH_SESSIONS_SELECT,
  type OnboardingStrengthSnapshotRow,
  type StrengthInputExercise,
  type StrengthInputs,
  type StrengthSessionRow,
} from './strength-inputs.ts'
import { getLatestDailyWeightKg } from './daily-weight.ts'
import type { SupabaseClient } from './supabase.ts'

// Scoring lives in strength-core.ts, shared with the app. This module loads a
// user's data and builds the chat tools' views of it.
export type { OverallStrengthGroup, StrengthGender, StrengthLevel }

export type LifterLevelGroupBreakdown = OverallStrengthGroupBreakdown

export interface LifterLevelDetails {
  points: number
  maxPoints: number
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
  liftsTracked: number
  weakestGroup: OverallStrengthGroup | null
  groupBreakdown: Record<OverallStrengthGroup, LifterLevelGroupBreakdown>
}

export interface ExerciseRankDetails {
  exerciseId: string
  exerciseName: string
  canonicalExerciseName: string
  muscleGroup: string | null
  lastTrainedAt: string | null
  isRepBased: boolean
  tier: ExerciseTier
  sessionCount: number | null
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
  scorePoints: number
  pointsToNextLevel: number | null
  currentValue: number
  currentMetric: 'estimated_1rm_kg' | 'reps'
  estimated1RMKg: number | null
  bestSetWeightKg: number | null
  bestSetReps: number | null
  targetValue: number | null
  targetMetric: 'estimated_1rm_kg' | 'reps'
  gapToNextLevel: number | null
  ratioToBodyweight: number | null
}

export interface ExerciseStandardsLadderEntry {
  level: StrengthLevel
  description: string
  color: string
  multiplier: number
  targetValue: number
  targetMetric: 'estimated_1rm_kg' | 'reps'
}

export interface ExerciseStandardsLookup {
  exerciseName: string
  canonicalExerciseName: string
  gender: StrengthGender
  bodyweightKg: number
  isRepBased: boolean
  tier: ExerciseTier
  levels: ExerciseStandardsLadderEntry[]
}

export interface UserStrengthProfile {
  profile: {
    gender: StrengthGender | null
    bodyweightKg: number | null
  }
  overallLevel: LifterLevelDetails | null
  exerciseRanks: ExerciseRankDetails[]
  missingRequirements: string[]
}

export interface StrengthProfileCacheUpdate {
  overall_strength_points: number | null
  overall_strength_score: number | null
  overall_strength_level: StrengthLevel | null
  overall_strength_progress: number | null
  overall_strength_updated_at: string
}

export interface PracticalRepTarget {
  weightKg: number
  reps: number
  estimated1RMKg: number
}

export interface LifterPointTargetCandidate {
  exerciseId: string
  exerciseName: string
  canonicalExerciseName: string
  source: 'tracked' | 'unlogged'
  muscleGroup: string | null
  targetGroup: OverallStrengthGroup | null
  isRepBased: boolean
  tier: ExerciseTier
  currentValue: number
  currentMetric: 'estimated_1rm_kg' | 'reps'
  targetValue: number
  targetMetric: 'estimated_1rm_kg' | 'reps'
  targetEstimated1RMKg: number | null
  practicalTargets: PracticalRepTarget[]
  projectedPoints: number
  projectedLevel: StrengthLevel
  projectedNextLevel: StrengthLevel | null
  projectedProgress: number
  pointsGained: number
  requestedPoints: number
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
  relevanceScore: number
}

export interface LifterPointTargetsResult {
  available: boolean
  profile: UserStrengthProfile['profile']
  missingRequirements?: string[]
  reason?: string
  requestedPoints: number
  currentPoints: number
  currentLevel: StrengthLevel
  currentNextLevel: StrengthLevel | null
  currentProgress: number
  trackedExercises: number
  bestTarget: LifterPointTargetCandidate | null
  alternatives: LifterPointTargetCandidate[]
}

interface SupportedExerciseSnapshot {
  exerciseId: string
  exerciseName: string
  canonicalExerciseName: string
  muscleGroup: string | null
  max1RM: number
  lastTrainedAt: string | null
  bestSetWeightKg: number | null
  bestSetReps: number | null
  isRepBased: boolean
  tier: ExerciseTier
  sessionCount?: number | null
}

function getStrengthGender(
  gender: string | null | undefined,
): StrengthGender | null {
  return gender === 'male' || gender === 'female' ? gender : null
}
function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function roundUpToIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.ceil(value / increment) * increment
}
function toLifterLevelDetails(
  result: OverallStrengthScoreResult,
): LifterLevelDetails {
  return {
    points: result.score,
    maxPoints: OVERALL_STRENGTH_SCORE_CAP,
    level: result.level,
    nextLevel: result.nextLevel,
    progress: result.progress,
    liftsTracked: result.liftsTracked,
    weakestGroup: result.weakestGroup,
    groupBreakdown: result.groupBreakdown,
  }
}

function buildSnapshotFromRank(
  rank: ExerciseRankDetails,
): SupportedExerciseSnapshot {
  return {
    exerciseId: rank.exerciseId,
    exerciseName: rank.exerciseName,
    canonicalExerciseName: rank.canonicalExerciseName,
    muscleGroup: rank.muscleGroup,
    max1RM: rank.currentValue,
    lastTrainedAt: rank.lastTrainedAt,
    bestSetWeightKg: rank.bestSetWeightKg,
    bestSetReps: rank.bestSetReps,
    isRepBased: rank.isRepBased,
    tier: rank.tier,
    sessionCount: rank.sessionCount,
  }
}

function projectExercisePerformance(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: SupportedExerciseSnapshot[]
  exercise: SupportedExerciseSnapshot
  targetValue: number
  now?: Date
}): {
  currentResult: LifterLevelDetails
  projectedResult: LifterLevelDetails
  rawPointsGained: number
  pointsGained: number
} | null {
  const projection = calculateStrengthScoreProjectionForExerciseTarget({
    gender: input.gender,
    bodyweightKg: input.bodyweightKg,
    exercises: input.exercises,
    exercise: input.exercise,
    targetPerformance: input.targetValue,
    now: input.now ?? new Date(),
  })
  if (!projection) return null

  return {
    currentResult: toLifterLevelDetails(projection.currentResult),
    projectedResult: toLifterLevelDetails(projection.projectedResult),
    rawPointsGained: projection.rawPointsGained,
    pointsGained: projection.pointsGained,
  }
}

function getNextLevelAnchor(nextLevel: StrengthLevel | null): number | null {
  if (!nextLevel) return null
  return LEVEL_POINT_ANCHORS[nextLevel] ?? null
}

function buildExerciseRanks(input: {
  exercises: SupportedExerciseSnapshot[]
  gender: StrengthGender
  bodyweightKg: number
}): ExerciseRankDetails[] {
  const { exercises, gender, bodyweightKg } = input

  return exercises
    .map((exercise) => {
      const strengthInfo = getStrengthStandard(
        exercise.exerciseName,
        gender,
        bodyweightKg,
        exercise.max1RM,
      )
      const scorePoints = calculateExerciseStrengthPoints({
        exerciseName: exercise.exerciseName,
        gender,
        bodyweightKg,
        estimated1RMKg: exercise.max1RM,
      })

      if (!strengthInfo || scorePoints === null) {
        return null
      }

      const nextLevelAnchor = getNextLevelAnchor(
        strengthInfo.nextLevel?.level ?? null,
      )
      const targetValue = strengthInfo.nextLevel
        ? exercise.isRepBased
          ? strengthInfo.nextLevel.multiplier
          : Math.ceil(bodyweightKg * strengthInfo.nextLevel.multiplier)
        : null
      const gapToNextLevel =
        targetValue === null ? null : Math.max(0, targetValue - exercise.max1RM)
      const ratioToBodyweight = exercise.isRepBased
        ? null
        : exercise.max1RM / bodyweightKg

      return {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        canonicalExerciseName: exercise.canonicalExerciseName,
        muscleGroup: exercise.muscleGroup,
        lastTrainedAt: exercise.lastTrainedAt,
        isRepBased: exercise.isRepBased,
        tier: exercise.tier,
        sessionCount: exercise.sessionCount ?? null,
        level: strengthInfo.level,
        nextLevel: strengthInfo.nextLevel?.level ?? null,
        progress: strengthInfo.progress,
        scorePoints: Math.round(scorePoints),
        pointsToNextLevel:
          nextLevelAnchor === null
            ? null
            : Math.max(0, Math.round(nextLevelAnchor - scorePoints)),
        currentValue: exercise.max1RM,
        currentMetric: exercise.isRepBased ? 'reps' : 'estimated_1rm_kg',
        estimated1RMKg: exercise.isRepBased ? null : exercise.max1RM,
        bestSetWeightKg: exercise.bestSetWeightKg,
        bestSetReps: exercise.bestSetReps,
        targetValue,
        targetMetric: exercise.isRepBased ? 'reps' : 'estimated_1rm_kg',
        gapToNextLevel:
          gapToNextLevel === null ? null : Math.ceil(gapToNextLevel),
        ratioToBodyweight:
          ratioToBodyweight === null
            ? null
            : Math.round(ratioToBodyweight * 1000) / 1000,
      }
    })
    .filter((exercise): exercise is ExerciseRankDetails => Boolean(exercise))
}

export function getExerciseStandardsForProfile(input: {
  exerciseName: string
  gender: StrengthGender
  bodyweightKg: number
}): ExerciseStandardsLookup | null {
  const { exerciseName, gender, bodyweightKg } = input
  const config = getStrengthStandardsConfig(exerciseName)

  if (
    !config ||
    !Number.isFinite(bodyweightKg) ||
    bodyweightKg <= 0
  ) {
    return null
  }

  const isRepBased = config.isRepBased ?? false
  const targetMetric: 'estimated_1rm_kg' | 'reps' = isRepBased
    ? 'reps'
    : 'estimated_1rm_kg'
  const levels = (gender === 'male' ? config.male : config.female).map(
    (standard) => ({
      level: standard.level,
      description: standard.description,
      color: standard.color,
      multiplier: standard.multiplier,
      targetValue: isRepBased
        ? Math.ceil(standard.multiplier)
        : Math.ceil(bodyweightKg * standard.multiplier),
      targetMetric,
    }),
  )

  return {
    exerciseName,
    canonicalExerciseName: config.name,
    gender,
    bodyweightKg,
    isRepBased,
    tier: config.tier ?? 3,
    levels,
  }
}

function getLevelSortScore(level: StrengthLevel): number {
  return STRENGTH_LEVEL_ORDER.indexOf(level)
}

function compareNullableDatesDesc(a: string | null, b: string | null): number {
  const aTime = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY
  const bTime = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY
  return bTime - aTime
}

function sortExerciseRanksByDefault(
  left: ExerciseRankDetails,
  right: ExerciseRankDetails,
): number {
  const levelDelta = getLevelSortScore(right.level) - getLevelSortScore(left.level)
  if (levelDelta !== 0) return levelDelta

  if (right.progress !== left.progress) {
    return right.progress - left.progress
  }

  if (right.scorePoints !== left.scorePoints) {
    return right.scorePoints - left.scorePoints
  }

  return compareNullableDatesDesc(left.lastTrainedAt, right.lastTrainedAt)
}

function getPracticalRepTargets(targetEstimated1RMKg: number): PracticalRepTarget[] {
  if (!Number.isFinite(targetEstimated1RMKg) || targetEstimated1RMKg <= 0) {
    return []
  }

  return [5, 6, 8].map((reps) => {
    const exactWeight = targetEstimated1RMKg / (1 + reps / 30)
    const weightKg = roundUpToIncrement(exactWeight, 2.5)
    return {
      weightKg: roundTo(weightKg, 1),
      reps,
      estimated1RMKg: roundTo(estimateOneRepMaxKg(weightKg, reps), 1),
    }
  })
}

function getExerciseLevelAtValue(input: {
  exerciseName: string
  gender: StrengthGender
  bodyweightKg: number
  value: number
}): {
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
} {
  const standard = getStrengthStandard(
    input.exerciseName,
    input.gender,
    input.bodyweightKg,
    input.value,
  )

  return {
    level: standard?.level ?? 'Untrained',
    nextLevel: standard?.nextLevel?.level ?? null,
    progress: standard?.progress ?? 0,
  }
}

function buildUnloggedSnapshot(config: StrengthStandardsConfig): SupportedExerciseSnapshot {
  const specificMuscle = resolveExerciseSpecificMuscle(config.name, null)

  return {
    exerciseId: config.id,
    exerciseName: config.name,
    canonicalExerciseName: config.name,
    muscleGroup: specificMuscle,
    max1RM: 0,
    lastTrainedAt: null,
    bestSetWeightKg: null,
    bestSetReps: null,
    isRepBased: config.isRepBased ?? false,
    tier: config.tier ?? 3,
  }
}

function exerciseMatchesQuery(
  exercise: Pick<SupportedExerciseSnapshot, 'exerciseName' | 'canonicalExerciseName'>,
  query: string,
): boolean {
  const normalizedQuery = normaliseExerciseName(query)
  const name = normaliseExerciseName(exercise.exerciseName)
  const canonical = normaliseExerciseName(exercise.canonicalExerciseName)
  return name.includes(normalizedQuery) || canonical.includes(normalizedQuery)
}

function buildPointTargetCandidatePool(input: {
  profile: UserStrengthProfile
  exerciseName?: string
}): { exercise: SupportedExerciseSnapshot; source: 'tracked' | 'unlogged' }[] {
  const tracked = input.profile.exerciseRanks.map((rank) => ({
    exercise: buildSnapshotFromRank(rank),
    source: 'tracked' as const,
  }))
  const trackedCanonical = new Set(
    tracked.map((candidate) => candidate.exercise.canonicalExerciseName),
  )

  const unlogged = STRENGTH_STANDARDS_EXERCISES
    .filter((config) => !trackedCanonical.has(config.name))
    .filter((config) => (config.tier ?? 3) <= 2)
    .map((config) => ({
      exercise: buildUnloggedSnapshot(config),
      source: 'unlogged' as const,
    }))

  const pool = [...tracked, ...unlogged]
  if (!input.exerciseName?.trim()) return pool

  const exactMatches = pool.filter((candidate) => {
    const normalizedInput = normaliseExerciseName(input.exerciseName as string)
    return (
      normaliseExerciseName(candidate.exercise.exerciseName) === normalizedInput ||
      normaliseExerciseName(candidate.exercise.canonicalExerciseName) === normalizedInput
    )
  })
  if (exactMatches.length > 0) return exactMatches

  return pool.filter((candidate) =>
    exerciseMatchesQuery(candidate.exercise, input.exerciseName as string),
  )
}

function findMinimumTargetForPointGain(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: SupportedExerciseSnapshot[]
  exercise: SupportedExerciseSnapshot
  requestedPoints: number
  now?: Date
}): {
  targetValue: number
  projection: NonNullable<ReturnType<typeof projectExercisePerformance>>
} | null {
  const { gender, bodyweightKg, exercises, exercise, requestedPoints } = input
  const now = input.now ?? new Date()
  const standards = getStandardsLadder(exercise.exerciseName, gender)
  if (!standards || standards.length === 0) return null

  const highestStandard = standards[standards.length - 1]
  const standardsMaxValue = exercise.isRepBased
    ? highestStandard.multiplier
    : bodyweightKg * highestStandard.multiplier
  const currentValue = Math.max(0, exercise.max1RM)
  const upperBound = Math.max(
    standardsMaxValue,
    currentValue > 0 ? currentValue * 1.5 : standardsMaxValue,
  )

  const maxProjection = projectExercisePerformance({
    gender,
    bodyweightKg,
    exercises,
    exercise,
    targetValue: upperBound,
    now,
  })
  if (!maxProjection || maxProjection.pointsGained < requestedPoints) {
    return null
  }

  let low = currentValue
  let high = upperBound

  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2
    const projection = projectExercisePerformance({
      gender,
      bodyweightKg,
      exercises,
      exercise,
      targetValue: mid,
      now,
    })

    if (projection && projection.pointsGained >= requestedPoints) {
      high = mid
    } else {
      low = mid
    }
  }

  const targetValue = exercise.isRepBased
    ? Math.ceil(high)
    : roundTo(roundUpToIncrement(high, 0.1), 1)
  const projection = projectExercisePerformance({
    gender,
    bodyweightKg,
    exercises,
    exercise,
    targetValue,
    now,
  })

  if (!projection || projection.pointsGained < requestedPoints) return null

  return {
    targetValue,
    projection,
  }
}

function calculatePointTargetRelevance(input: {
  source: 'tracked' | 'unlogged'
  exercise: SupportedExerciseSnapshot
  targetGroup: OverallStrengthGroup | null
  pointsGained: number
  requestedPoints: number
  currentLevel: StrengthLevel
  weakestGroup: OverallStrengthGroup | null
  hasExerciseFilter: boolean
}): number {
  let score = 0
  score += Math.min(input.pointsGained / input.requestedPoints, 1.75) * 40
  score += input.exercise.tier === 1 ? 24 : input.exercise.tier === 2 ? 14 : 4
  score += input.source === 'tracked' ? 28 : 0
  score += input.targetGroup === input.weakestGroup ? 18 : 0
  score += getLevelSortScore(input.currentLevel) * 3
  score += input.hasExerciseFilter ? 30 : 0
  score += input.source === 'unlogged' ? -10 : 0
  return roundTo(score, 2)
}

export function calculateLifterPointTargets(input: {
  profile: UserStrengthProfile
  requestedPoints: number
  exerciseName?: string
  includeAlternatives?: boolean
  now?: Date
}): LifterPointTargetsResult {
  const requestedPoints = Math.max(1, Math.round(input.requestedPoints))
  const { profile } = input

  if (profile.missingRequirements.length > 0) {
    return {
      available: false,
      profile: profile.profile,
      missingRequirements: profile.missingRequirements,
      requestedPoints,
      currentPoints: profile.overallLevel?.points ?? 0,
      currentLevel: profile.overallLevel?.level ?? 'Untrained',
      currentNextLevel: profile.overallLevel?.nextLevel ?? 'Beginner',
      currentProgress: profile.overallLevel?.progress ?? 0,
      trackedExercises: profile.exerciseRanks.length,
      bestTarget: null,
      alternatives: [],
    }
  }

  const gender = profile.profile.gender as StrengthGender
  const bodyweightKg = profile.profile.bodyweightKg as number
  const now = input.now ?? new Date()
  const trackedExercises = profile.exerciseRanks.map(buildSnapshotFromRank)
  const currentResult = calculateOverallStrengthScore({
    gender,
    bodyweightKg,
    exercises: trackedExercises,
    now,
  })
  const candidatePool = buildPointTargetCandidatePool({
    profile,
    exerciseName: input.exerciseName,
  })

  const candidates = candidatePool
    .map(({ exercise, source }) => {
      const target = findMinimumTargetForPointGain({
        gender,
        bodyweightKg,
        exercises: trackedExercises,
        exercise,
        requestedPoints,
        now,
      })
      if (!target) return null

      const targetGroup = resolveExerciseStrengthGroup(
        exercise.exerciseName,
        exercise.muscleGroup,
      )
      const exerciseLevel = getExerciseLevelAtValue({
        exerciseName: exercise.exerciseName,
        gender,
        bodyweightKg,
        value: target.targetValue,
      })
      const targetMetric = exercise.isRepBased ? 'reps' : 'estimated_1rm_kg'

      return {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        canonicalExerciseName: exercise.canonicalExerciseName,
        source,
        muscleGroup: exercise.muscleGroup,
        targetGroup,
        isRepBased: exercise.isRepBased,
        tier: exercise.tier,
        currentValue: roundTo(exercise.max1RM, exercise.isRepBased ? 0 : 1),
        currentMetric: targetMetric,
        targetValue: roundTo(target.targetValue, exercise.isRepBased ? 0 : 1),
        targetMetric,
        targetEstimated1RMKg: exercise.isRepBased
          ? null
          : roundTo(target.targetValue, 1),
        practicalTargets: exercise.isRepBased
          ? []
          : getPracticalRepTargets(target.targetValue),
        projectedPoints: target.projection.projectedResult.points,
        projectedLevel: target.projection.projectedResult.level,
        projectedNextLevel: target.projection.projectedResult.nextLevel,
        projectedProgress: target.projection.projectedResult.progress,
        pointsGained: target.projection.pointsGained,
        requestedPoints,
        level: exerciseLevel.level,
        nextLevel: exerciseLevel.nextLevel,
        progress: exerciseLevel.progress,
        relevanceScore: calculatePointTargetRelevance({
          source,
          exercise,
          targetGroup,
          pointsGained: target.projection.pointsGained,
          requestedPoints,
          currentLevel: exerciseLevel.level,
          weakestGroup: currentResult.weakestGroup,
          hasExerciseFilter: Boolean(input.exerciseName?.trim()),
        }),
      } satisfies LifterPointTargetCandidate
    })
    .filter(
      (candidate): candidate is LifterPointTargetCandidate =>
        candidate !== null,
    )
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore
      }
      if (right.pointsGained !== left.pointsGained) {
        return right.pointsGained - left.pointsGained
      }
      if (left.source !== right.source) {
        return left.source === 'tracked' ? -1 : 1
      }
      return left.targetValue - right.targetValue
    })

  const bestTarget = candidates[0] ?? null
  const alternatives = (input.includeAlternatives ?? true)
    ? candidates.slice(1, 4)
    : []

  return {
    available: bestTarget !== null,
    profile: profile.profile,
    ...(bestTarget
      ? {}
      : {
          reason: input.exerciseName?.trim()
            ? 'No matching exercise can reach that point target.'
            : 'No exercise target can reach that point target.',
        }),
    requestedPoints,
    currentPoints: currentResult.score,
    currentLevel: currentResult.level,
    currentNextLevel: currentResult.nextLevel,
    currentProgress: currentResult.progress,
    trackedExercises: profile.exerciseRanks.length,
    bestTarget,
    alternatives,
  }
}

function getMissingRequirements(input: {
  gender: StrengthGender | null
  bodyweightKg: number | null
}): string[] {
  const missing: string[] = []
  if (!input.gender) {
    missing.push('profile gender')
  }
  if (
    typeof input.bodyweightKg !== 'number' ||
    !Number.isFinite(input.bodyweightKg) ||
    input.bodyweightKg <= 0
  ) {
    missing.push('profile bodyweight')
  }
  return missing
}

function toSupportedExerciseSnapshot(
  exercise: StrengthInputExercise,
): SupportedExerciseSnapshot {
  const config = getStrengthStandardsConfig(exercise.exerciseName)
  const bestSet = getBestSetFromRecords(exercise)
  return {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    canonicalExerciseName: config?.name ?? exercise.exerciseName,
    muscleGroup: exercise.muscleGroup,
    max1RM: exercise.max1RM,
    lastTrainedAt: exercise.lastTrainedAt,
    bestSetWeightKg: bestSet.weightKg,
    bestSetReps: bestSet.reps,
    isRepBased: isRepBasedStrengthExercise(exercise.exerciseName),
    tier: config?.tier ?? 3,
    // Undefined for an onboarding-only lift, so it counts as established.
    ...(exercise.sessionCount === undefined
      ? {}
      : { sessionCount: exercise.sessionCount }),
  }
}

export interface UserStrengthInputs extends StrengthInputs {
  gender: StrengthGender | null
  /** Latest daily-log weight, else profiles.weight_kg. */
  bodyweightKg: number | null
}

/**
 * Loads a user's strength score inputs. Same rows, shaping, onboarding merge
 * and bodyweight rule as the app's loader (lib/strength-inputs.ts).
 */
export async function loadUserStrengthInputs(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserStrengthInputs> {
  const [profileResult, sessionsResult, latestDailyWeightKg, onboardingResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('gender, weight_kg')
        .eq('id', userId)
        .single(),
      supabase
        .from('workout_sessions')
        .select(STRENGTH_SESSIONS_SELECT)
        .eq('user_id', userId)
        .not('workout_exercises.sets.reps', 'is', null)
        .gt('workout_exercises.sets.reps', 0)
        .order('created_at', { ascending: true }),
      getLatestDailyWeightKg(supabase, userId),
      supabase
        .from('onboarding_strength_snapshots')
        .select(ONBOARDING_STRENGTH_SNAPSHOT_SELECT)
        .eq('user_id', userId)
        .maybeSingle(),
    ])

  if (profileResult.error) throw profileResult.error
  if (sessionsResult.error) throw sessionsResult.error

  const profile = profileResult.data as {
    gender: string | null
    weight_kg: number | string | null
  } | null
  const onboarding = onboardingResult.error
    ? null
    : parseOnboardingStrengthSnapshotRow(
        onboardingResult.data as OnboardingStrengthSnapshotRow | null,
      )

  return {
    gender: getStrengthGender(profile?.gender ?? null),
    bodyweightKg: resolveStrengthBodyweightKg({
      latestDailyWeightKg,
      profileWeightKg: profile?.weight_kg,
    }),
    ...buildStrengthInputsFromRows({
      sessionRows: (sessionsResult.data as unknown as StrengthSessionRow[]) ?? [],
      onboarding,
    }),
  }
}

export async function buildUserStrengthProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserStrengthProfile> {
  const inputs = await loadUserStrengthInputs(supabase, userId)
  const { gender, bodyweightKg, sessions } = inputs
  const supportedExercises = inputs.exercises.map(toSupportedExerciseSnapshot)

  const missingRequirements = getMissingRequirements({
    gender,
    bodyweightKg,
  })

  if (missingRequirements.length > 0) {
    return {
      profile: {
        gender,
        bodyweightKg,
      },
      overallLevel: null,
      exerciseRanks: [],
      missingRequirements,
    }
  }

  const resolvedBodyweightKg = bodyweightKg as number
  const resolvedGender = gender as StrengthGender
  const exerciseRanks = buildExerciseRanks({
    exercises: supportedExercises,
    gender: resolvedGender,
    bodyweightKg: resolvedBodyweightKg,
  }).sort(sortExerciseRanksByDefault)

  const overallLevel =
    supportedExercises.length > 0
      ? toLifterLevelDetails(
          calculateStrengthScoreHistory({
            gender: resolvedGender,
            bodyweightKg: resolvedBodyweightKg,
            exercises: supportedExercises,
            sessions,
          }).result,
        )
      : null

  return {
    profile: {
      gender: resolvedGender,
      bodyweightKg: resolvedBodyweightKg,
    },
    overallLevel,
    exerciseRanks,
    missingRequirements,
  }
}

export async function refreshUserStrengthProfileCache(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrengthProfileCacheUpdate> {
  const strengthProfile = await buildUserStrengthProfile(supabase, userId)
  const cacheUpdate: StrengthProfileCacheUpdate = strengthProfile.overallLevel
    ? {
        overall_strength_points: strengthProfile.overallLevel.points,
        // Old 0-1000 scale for app versions before 1.0.33.
        overall_strength_score: toLegacyStrengthScore(
          strengthProfile.overallLevel.points,
        ),
        overall_strength_level: strengthProfile.overallLevel.level,
        overall_strength_progress: Math.round(
          strengthProfile.overallLevel.progress,
        ),
        overall_strength_updated_at: new Date().toISOString(),
      }
    : {
        overall_strength_points: null,
        overall_strength_score: null,
        overall_strength_level: null,
        overall_strength_progress: null,
        overall_strength_updated_at: new Date().toISOString(),
      }

  const { error } = await supabase
    .from('profiles')
    .update(cacheUpdate)
    .eq('id', userId)

  if (error) throw error
  return cacheUpdate
}

import {
  GENERATED_EXERCISES_WITH_STANDARDS,
  GENERATED_EXERCISE_MUSCLE_MAPPING,
  GENERATED_TIER2_WEIGHT,
} from './generated-strength-standards.ts'
import type { SupabaseClient } from './supabase.ts'

export type StrengthLevel =
  | 'Untrained'
  | 'Beginner'
  | 'Novice'
  | 'Intermediate'
  | 'Advanced'
  | 'Elite'
  | 'World Class'

export type StrengthGender = 'male' | 'female'

export type OverallStrengthGroup =
  | 'Legs'
  | 'Back'
  | 'Chest'
  | 'Shoulders'
  | 'Arms'
  | 'Core'

type ExerciseStandardsConfig = (typeof GENERATED_EXERCISES_WITH_STANDARDS)[number]
type StrengthStandard = ExerciseStandardsConfig['male'][number]

interface SetRow {
  reps: number | null
  weight: number | null
}

interface WorkoutExerciseRow {
  exercise_id?: string | null
  exercise?:
    | {
        id?: string | null
        name?: string | null
        muscle_group?: string | null
      }
    | null
  sets?: SetRow[] | null
}

interface WorkoutSessionRow {
  created_at: string
  workout_exercises?: WorkoutExerciseRow[] | null
}

interface ProfileStrengthRow {
  gender: string | null
  weight_kg: number | null
}

export interface LifterLevelGroupBreakdown {
  group: OverallStrengthGroup
  weight: number
  topExerciseScore: number
  decayFactor: number
  effectiveScore: number
  weightedContribution: number
  lastTrainedAt: string | null
  trackedExerciseCount: number
}

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
  tier: 1 | 2
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
  tier: 1 | 2
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
  tier: 1 | 2
}

const OVERALL_STRENGTH_SCORE_CAP = 1000
const DECAY_GRACE_DAYS = 14
const DECAY_RATE_PER_WEEK = 0.05
const SECONDARY_EXERCISE_DECAY = 0.5

const LEVEL_POINT_ANCHORS: Record<StrengthLevel, number> = {
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

const OVERALL_GROUP_WEIGHTS: Record<OverallStrengthGroup, number> = {
  Legs: 0.24,
  Back: 0.24,
  Chest: 0.19,
  Shoulders: 0.19,
  Arms: 0.09,
  Core: 0.05,
}

const STRENGTH_LEVEL_ORDER: StrengthLevel[] = [
  'Untrained',
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

const exerciseNameMap = buildExerciseNameMap()

function buildExerciseNameMap(): Map<string, ExerciseStandardsConfig> {
  const map = new Map<string, ExerciseStandardsConfig>()

  GENERATED_EXERCISES_WITH_STANDARDS.forEach((config) => {
    map.set(normaliseName(config.name), config)
    config.aliases?.forEach((alias) => {
      map.set(normaliseName(alias), config)
    })
  })

  return map
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase()
}

function clampStrengthProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, progress))
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(OVERALL_STRENGTH_SCORE_CAP, score))
}

function asDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getStrengthGender(
  gender: string | null | undefined,
): StrengthGender | null {
  return gender === 'male' || gender === 'female' ? gender : null
}

function getExerciseConfig(
  exerciseName: string,
): ExerciseStandardsConfig | null {
  return exerciseNameMap.get(normaliseName(exerciseName)) ?? null
}

function hasStrengthStandards(exerciseName: string): boolean {
  return getExerciseConfig(exerciseName) !== null
}

function getStandardsLadder(
  exerciseName: string,
  gender: StrengthGender,
): readonly StrengthStandard[] | null {
  const config = getExerciseConfig(exerciseName)
  if (!config) return null

  return gender === 'male' ? config.male : config.female
}

function isRepBasedExercise(exerciseName: string): boolean {
  return getExerciseConfig(exerciseName)?.isRepBased ?? false
}

function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return 0
  }

  if (weightKg <= 0 || reps <= 0) {
    return 0
  }

  return weightKg * (1 + reps / 30)
}

function getStrengthStandard(input: {
  exerciseName: string
  gender: StrengthGender
  bodyweightKg: number
  oneRepMax: number
}): {
  level: StrengthLevel
  nextLevel: StrengthStandard | null
  progress: number
} | null {
  const { exerciseName, gender, bodyweightKg, oneRepMax } = input
  const config = getExerciseConfig(exerciseName)
  if (!config) return null

  const standards = gender === 'male' ? config.male : config.female
  const ratio = config.isRepBased ? oneRepMax : oneRepMax / bodyweightKg

  let currentLevel = standards[0]
  let nextLevel: StrengthStandard | null = null
  let levelIndex = -1

  for (let i = standards.length - 1; i >= 0; i -= 1) {
    if (ratio >= standards[i].multiplier) {
      currentLevel = standards[i]
      levelIndex = i
      nextLevel = i < standards.length - 1 ? standards[i + 1] : null
      break
    }
  }

  let progress = 100

  if (levelIndex === -1 && standards.length > 0) {
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
    nextLevel,
    progress: clampStrengthProgress(progress),
  }
}

function interpolatePointsFromStandards(
  ratio: number,
  standards: readonly StrengthStandard[],
): number {
  if (!Number.isFinite(ratio) || ratio <= 0 || standards.length === 0) {
    return 0
  }

  const first = standards[0]
  if (ratio < first.multiplier) {
    const beginnerPoints = LEVEL_POINT_ANCHORS.Beginner
    return first.multiplier > 0 ? (ratio / first.multiplier) * beginnerPoints : 0
  }

  for (let i = 0; i < standards.length - 1; i += 1) {
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

function calculateExerciseStrengthPoints(input: {
  exerciseName: string
  gender: StrengthGender
  bodyweightKg: number
  performanceValue: number
}): number | null {
  const { exerciseName, gender, bodyweightKg, performanceValue } = input

  if (
    !hasStrengthStandards(exerciseName) ||
    !Number.isFinite(bodyweightKg) ||
    !Number.isFinite(performanceValue) ||
    bodyweightKg <= 0 ||
    performanceValue <= 0
  ) {
    return null
  }

  const standards = getStandardsLadder(exerciseName, gender)
  if (!standards || standards.length === 0) return null

  const ratio = isRepBasedExercise(exerciseName)
    ? performanceValue
    : performanceValue / bodyweightKg

  return clampScore(interpolatePointsFromStandards(ratio, standards))
}

function scoreToOverallLevelProgress(score: number): {
  level: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
} {
  const safeScore = clampScore(score)

  for (let i = SCORE_LEVEL_STEPS.length - 1; i >= 0; i -= 1) {
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

function resolveSpecificMuscleName(
  exerciseName: string,
  fallbackMuscle: string | null | undefined,
): string | null {
  const config = getExerciseConfig(exerciseName)
  const canonicalName = config?.name ?? exerciseName

  return (
    GENERATED_EXERCISE_MUSCLE_MAPPING[canonicalName] ??
    GENERATED_EXERCISE_MUSCLE_MAPPING[exerciseName] ??
    fallbackMuscle ??
    null
  )
}

function toOverallGroup(
  specificMuscle: string | null,
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

function computeDecayFactor(lastTrainedAt: string | null, now: Date): number {
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

function calculateOverallStrengthScore(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: SupportedExerciseSnapshot[]
  now?: Date
}): LifterLevelDetails {
  const { gender, bodyweightKg, exercises } = input
  const now = input.now ?? new Date()

  const groupState: Record<
    OverallStrengthGroup,
    {
      exerciseScores: number[]
      lastTrainedAt: string | null
      trackedExerciseCount: number
    }
  > = {
    Legs: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Back: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Chest: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Shoulders: {
      exerciseScores: [],
      lastTrainedAt: null,
      trackedExerciseCount: 0,
    },
    Arms: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
    Core: { exerciseScores: [], lastTrainedAt: null, trackedExerciseCount: 0 },
  }

  let liftsTracked = 0

  exercises.forEach((exercise) => {
    const points = calculateExerciseStrengthPoints({
      exerciseName: exercise.exerciseName,
      gender,
      bodyweightKg,
      performanceValue: exercise.max1RM,
    })

    if (points === null) return

    const specificMuscle = resolveSpecificMuscleName(
      exercise.exerciseName,
      exercise.muscleGroup,
    )
    const overallGroup = toOverallGroup(specificMuscle)
    if (!overallGroup) return

    liftsTracked += 1

    const weightedPoints =
      points * (exercise.tier === 1 ? 1 : GENERATED_TIER2_WEIGHT)

    const state = groupState[overallGroup]
    state.trackedExerciseCount += 1
    state.exerciseScores.push(weightedPoints)

    const currentLast = asDateOrNull(state.lastTrainedAt)
    const nextLast = asDateOrNull(exercise.lastTrainedAt)
    if (!currentLast || (nextLast && nextLast.getTime() > currentLast.getTime())) {
      state.lastTrainedAt = nextLast ? nextLast.toISOString() : state.lastTrainedAt
    }
  })

  const groupBreakdown = {} as Record<
    OverallStrengthGroup,
    LifterLevelGroupBreakdown
  >
  let totalScore = 0

  ;(Object.keys(OVERALL_GROUP_WEIGHTS) as OverallStrengthGroup[]).forEach(
    (group) => {
      const weight = OVERALL_GROUP_WEIGHTS[group]
      const state = groupState[group]

      const sortedScores = [...state.exerciseScores].sort((a, b) => b - a)
      const topExerciseScore = sortedScores[0] ?? 0
      const weights = sortedScores.map((_, index) =>
        Math.pow(SECONDARY_EXERCISE_DECAY, index),
      )
      const totalWeight = weights.reduce((sum, value) => sum + value, 0)
      const groupRawScore =
        totalWeight > 0
          ? sortedScores.reduce(
              (sum, score, index) => sum + score * weights[index],
              0,
            ) / totalWeight
          : 0

      const decayFactor =
        groupRawScore > 0 ? computeDecayFactor(state.lastTrainedAt, now) : 1
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
    },
  )

  const cappedScore = clampScore(totalScore)
  const roundedScore = Math.round(cappedScore)
  const { level, nextLevel, progress } =
    scoreToOverallLevelProgress(cappedScore)

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
    points: roundedScore,
    maxPoints: OVERALL_STRENGTH_SCORE_CAP,
    level,
    nextLevel,
    progress,
    liftsTracked,
    weakestGroup,
    groupBreakdown,
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
      const strengthInfo = getStrengthStandard({
        exerciseName: exercise.exerciseName,
        gender,
        bodyweightKg,
        oneRepMax: exercise.max1RM,
      })
      const scorePoints = calculateExerciseStrengthPoints({
        exerciseName: exercise.exerciseName,
        gender,
        bodyweightKg,
        performanceValue: exercise.max1RM,
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
  const config = getExerciseConfig(exerciseName)

  if (
    !config ||
    !Number.isFinite(bodyweightKg) ||
    bodyweightKg <= 0
  ) {
    return null
  }

  const isRepBased = config.isRepBased ?? false
  const targetMetric = isRepBased ? 'reps' : 'estimated_1rm_kg'
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
    tier: config.tier ?? 2,
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

async function loadSupportedExercises(
  supabase: SupabaseClient,
  userId: string,
): Promise<SupportedExerciseSnapshot[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      `
        created_at,
        workout_exercises!inner (
          exercise_id,
          exercise:exercises!inner (id, name, muscle_group),
          sets!inner (reps, weight)
        )
      `,
    )
    .eq('user_id', userId)
    .not('workout_exercises.sets.reps', 'is', null)
    .gt('workout_exercises.sets.reps', 0)

  if (error) throw error

  const byExerciseId = new Map<string, SupportedExerciseSnapshot>()
  const sessions = (data as WorkoutSessionRow[]) ?? []

  sessions.forEach((session) => {
    session.workout_exercises?.forEach((workoutExercise) => {
      const exerciseId = workoutExercise.exercise_id ?? workoutExercise.exercise?.id
      const exerciseName = workoutExercise.exercise?.name
      if (!exerciseId || !exerciseName || !hasStrengthStandards(exerciseName)) {
        return
      }

      const isRepBased = isRepBasedExercise(exerciseName)
      const config = getExerciseConfig(exerciseName)
      const tier = config?.tier ?? 2
      const canonicalExerciseName = config?.name ?? exerciseName

      if (!byExerciseId.has(exerciseId)) {
        byExerciseId.set(exerciseId, {
          exerciseId,
          exerciseName,
          canonicalExerciseName,
          muscleGroup: workoutExercise.exercise?.muscle_group ?? null,
          max1RM: 0,
          lastTrainedAt: session.created_at,
          bestSetWeightKg: null,
          bestSetReps: null,
          isRepBased,
          tier,
        })
      }

      const current = byExerciseId.get(exerciseId)
      if (!current) return

      const currentLast = asDateOrNull(current.lastTrainedAt)
      const nextLast = asDateOrNull(session.created_at)
      if (!currentLast || (nextLast && nextLast.getTime() > currentLast.getTime())) {
        current.lastTrainedAt = nextLast ? nextLast.toISOString() : current.lastTrainedAt
      }

      workoutExercise.sets?.forEach((set) => {
        if (!set.reps || set.reps <= 0) {
          return
        }

        if (!isRepBased && (!set.weight || set.weight <= 0)) {
          return
        }

        const performanceValue = isRepBased
          ? set.reps
          : estimateOneRepMaxKg(set.weight as number, set.reps)

        if (performanceValue > current.max1RM) {
          current.max1RM = Math.round(performanceValue)
          current.bestSetWeightKg = isRepBased ? null : set.weight
          current.bestSetReps = set.reps
        }
      })
    })
  })

  return Array.from(byExerciseId.values()).filter((exercise) => exercise.max1RM > 0)
}

export async function buildUserStrengthProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserStrengthProfile> {
  const [{ data: profile, error: profileError }, supportedExercises] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('gender, weight_kg')
        .eq('id', userId)
        .single(),
      loadSupportedExercises(supabase, userId),
    ])

  if (profileError) throw profileError

  const typedProfile = profile as ProfileStrengthRow
  const gender = getStrengthGender(typedProfile?.gender ?? null)
  const bodyweightKg = typedProfile?.weight_kg ?? null
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
      ? calculateOverallStrengthScore({
          gender: resolvedGender,
          bodyweightKg: resolvedBodyweightKg,
          exercises: supportedExercises,
        })
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

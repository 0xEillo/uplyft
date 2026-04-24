import {
  EXERCISE_MUSCLE_MAPPING,
  getExerciseNameMap,
  getTrackableExercisesForMuscle,
} from './exercise-standards-config'
import {
  getOverallStrengthGroupLevelProgress,
  type OverallStrengthGroup,
  type OverallStrengthGroupBreakdown,
} from './overall-strength-score'
import type { ExerciseStandardsConfig, StrengthLevel } from './exercise-standards-config'
import {
  scoreToLevelProgress,
  toLevelScore,
  type StrengthGender,
} from './strength-progress'
import { getStrengthStandard } from './strength-standards'

export type DisplayStrengthGroup = OverallStrengthGroup

export interface DisplayStrengthGroupData<TExercise> {
  name: DisplayStrengthGroup
  level: StrengthLevel
  progress: number
  exercises: TExercise[]
  averageScore: number
}

export interface SpecificMuscleGroupData<TExercise> {
  name: string
  level: StrengthLevel
  progress: number
  exercises: TExercise[]
  averageScore: number
}

const exerciseNameMap = getExerciseNameMap()
const DISPLAY_DECAY_GRACE_DAYS = 14
const DISPLAY_DECAY_RATE_PER_WEEK = 0.05
const REPRESENTATIVE_ANCHOR_EXERCISE_DECAY = 0.75
const REPRESENTATIVE_SUPPORT_UPLIFT_FACTOR = 0.95
const REPRESENTATIVE_SUPPORT_MAX_UPLIFT = 1
const REPRESENTATIVE_SUPPORT_TIER_WEIGHTS: Record<1 | 2 | 3, number> = {
  1: 1,
  2: 0.7,
  3: 0.5,
}

export const DISPLAY_STRENGTH_GROUP_ORDER: DisplayStrengthGroup[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
]

export function isDisplayStrengthGroup(
  value: string | null | undefined,
): value is DisplayStrengthGroup {
  return DISPLAY_STRENGTH_GROUP_ORDER.includes(
    value as DisplayStrengthGroup,
  )
}

const DISPLAY_GROUP_TO_SPECIFIC_MUSCLES: Record<
  DisplayStrengthGroup,
  string[]
> = {
  Chest: ['Chest'],
  Back: ['Back', 'Lats', 'Traps', 'Lower Back'],
  Shoulders: ['Shoulders'],
  Arms: ['Biceps', 'Triceps', 'Forearms'],
  Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'],
  Core: ['Abs', 'Core'],
}

export function mapMuscleToDisplayGroup(
  muscle: string | null | undefined,
): DisplayStrengthGroup | null {
  if (!muscle) return null

  switch (muscle) {
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

export function resolveExerciseSpecificMuscle(
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

export function resolveDatabaseMuscleToDisplayGroup(
  muscleName: string | null | undefined,
): DisplayStrengthGroup | null {
  return mapMuscleToDisplayGroup(muscleName)
}

export function getTrackableExercisesForDisplayGroup(
  group: DisplayStrengthGroup,
): ExerciseStandardsConfig[] {
  const seen = new Map<string, ExerciseStandardsConfig>()

  DISPLAY_GROUP_TO_SPECIFIC_MUSCLES[group].forEach((muscle) => {
    getTrackableExercisesForMuscle(muscle).forEach((exercise) => {
      seen.set(exercise.name, exercise)
    })
  })

  return Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

function asDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function computeDisplayDecayFactor(
  lastTrainedAt: string | null,
  now: Date,
): number {
  const trainedAt = asDateOrNull(lastTrainedAt)
  if (!trainedAt) return 1

  const diffMs = now.getTime() - trainedAt.getTime()
  if (diffMs <= 0) return 1

  const daysSinceLastTrain = diffMs / (1000 * 60 * 60 * 24)
  if (daysSinceLastTrain <= DISPLAY_DECAY_GRACE_DAYS) return 1

  const overdueWeeks = (daysSinceLastTrain - DISPLAY_DECAY_GRACE_DAYS) / 7
  return Math.max(0, 1 - overdueWeeks * DISPLAY_DECAY_RATE_PER_WEEK)
}

function calculateWeightedAverage(
  values: number[],
  weights: number[],
): number {
  if (values.length === 0 || values.length !== weights.length) {
    return 0
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight <= 0) return 0

  return values.reduce((sum, value, index) => sum + value * weights[index], 0) /
    totalWeight
}

export function buildDisplayStrengthGroupData<
  TExercise extends { exerciseName: string; muscleGroup?: string | null },
>(input: {
  exercises: TExercise[]
  groupBreakdown: Record<
    DisplayStrengthGroup,
    Pick<OverallStrengthGroupBreakdown, 'effectiveScore'>
  >
}): DisplayStrengthGroupData<TExercise>[] {
  const groupedExercises = new Map<DisplayStrengthGroup, TExercise[]>()

  DISPLAY_STRENGTH_GROUP_ORDER.forEach((group) => {
    groupedExercises.set(group, [])
  })

  input.exercises.forEach((exercise) => {
    const specificMuscle = resolveExerciseSpecificMuscle(
      exercise.exerciseName,
      exercise.muscleGroup,
    )
    const group = mapMuscleToDisplayGroup(specificMuscle)
    if (!group) return
    groupedExercises.get(group)?.push(exercise)
  })

  return DISPLAY_STRENGTH_GROUP_ORDER.map((group) => {
    const breakdown = input.groupBreakdown[group]
    const aggregateRank = getOverallStrengthGroupLevelProgress(breakdown)

    return {
      name: group,
      level: aggregateRank.level,
      progress: aggregateRank.progress,
      exercises: groupedExercises.get(group) ?? [],
      averageScore: breakdown.effectiveScore,
    }
  })
}

export function buildSpecificMuscleGroupData<
  TExercise extends {
    exerciseName: string
    muscleGroup?: string | null
    max1RM: number
    lastTrainedAt?: string | null
  },
>(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: TExercise[]
  now?: Date
}): SpecificMuscleGroupData<TExercise>[] {
  const now = input.now ?? new Date()
  const groupState = new Map<
    string,
    {
      exercises: TExercise[]
      representativeScores: Array<{ score: number; tier: 1 | 2 | 3 }>
      lastTrainedAt: string | null
    }
  >()

  input.exercises.forEach((exercise) => {
    const strengthInfo = getStrengthStandard(
      exercise.exerciseName,
      input.gender,
      input.bodyweightKg,
      exercise.max1RM,
    )
    if (!strengthInfo) return

    const primaryMuscle = resolveExerciseSpecificMuscle(
      exercise.exerciseName,
      exercise.muscleGroup,
    )

    const config = exerciseNameMap.get(exercise.exerciseName)
    const tier = config?.tier ?? 3
    const representativeScore = toLevelScore(
      strengthInfo.level,
      strengthInfo.progress,
    )

    ;[primaryMuscle].forEach((muscle) => {
      if (!muscle) return

      const existing = groupState.get(muscle) ?? {
        exercises: [],
        representativeScores: [],
        lastTrainedAt: null,
      }

      existing.exercises.push(exercise)
      existing.representativeScores.push({
        score: representativeScore,
        tier,
      })

      const existingTime = existing.lastTrainedAt
        ? new Date(existing.lastTrainedAt).getTime()
        : Number.NEGATIVE_INFINITY
      const nextTime = exercise.lastTrainedAt
        ? new Date(exercise.lastTrainedAt).getTime()
        : Number.NEGATIVE_INFINITY

      if (Number.isFinite(nextTime) && nextTime > existingTime) {
        existing.lastTrainedAt = exercise.lastTrainedAt ?? null
      }

      groupState.set(muscle, existing)
    })
  })

  return Array.from(groupState.entries())
    .map(([name, state]) => {
      const bestTier = state.representativeScores.reduce<1 | 2 | 3>(
        (currentBest, entry) => Math.min(currentBest, entry.tier) as 1 | 2 | 3,
        3,
      )
      const anchorScores = state.representativeScores
        .filter((entry) => entry.tier === bestTier)
        .map((entry) => entry.score)
        .sort((a, b) => b - a)
      const anchorScore = calculateWeightedAverage(
        anchorScores.slice(0, 2),
        anchorScores.slice(0, 2).map((_, index) =>
          Math.pow(REPRESENTATIVE_ANCHOR_EXERCISE_DECAY, index),
        ),
      )
      const supportScore = calculateWeightedAverage(
        state.representativeScores.map((entry) => entry.score),
        state.representativeScores.map(
          (entry) => REPRESENTATIVE_SUPPORT_TIER_WEIGHTS[entry.tier],
        ),
      )
      // Anchor on the best available tier, then let broader support nudge the
      // displayed muscle level upward without allowing lower-tier work to drag it down.
      const supportLift = Math.max(0, supportScore - anchorScore)
      const uplift = Math.min(
        REPRESENTATIVE_SUPPORT_MAX_UPLIFT,
        supportLift * REPRESENTATIVE_SUPPORT_UPLIFT_FACTOR,
      )
      const decayFactor = computeDisplayDecayFactor(state.lastTrainedAt, now)
      const effectiveScore = (anchorScore + uplift) * decayFactor
      const rank = scoreToLevelProgress(effectiveScore)

      return {
        name,
        level: rank.level,
        progress: rank.progress,
        exercises: state.exercises,
        averageScore: effectiveScore,
      }
    })
    .sort((a, b) => b.averageScore - a.averageScore)
}

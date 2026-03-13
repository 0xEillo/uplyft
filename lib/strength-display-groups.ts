import {
  EXERCISE_MUSCLE_MAPPING,
  getExerciseNameMap,
  getTrackableExercisesForMuscle,
  TIER2_WEIGHT,
} from './exercise-standards-config'
import { SECONDARY_EXERCISE_MUSCLE_MAPPING } from './exercise-standards-config-secondary'
import {
  calculateExerciseStrengthPoints,
  calculateStrengthAggregateFromScores,
  getOverallStrengthGroupLevelProgress,
  type OverallStrengthGroup,
  type OverallStrengthGroupBreakdown,
} from './overall-strength-score'
import type { ExerciseStandardsConfig, StrengthLevel } from './exercise-standards-config'
import type { StrengthGender } from './strength-progress'

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
      weightedExerciseScores: number[]
      lastTrainedAt: string | null
    }
  >()

  input.exercises.forEach((exercise) => {
    const points = calculateExerciseStrengthPoints({
      exerciseName: exercise.exerciseName,
      gender: input.gender,
      bodyweightKg: input.bodyweightKg,
      estimated1RMKg: exercise.max1RM,
    })
    if (points === null) return

    const canonicalName = exerciseNameMap.get(exercise.exerciseName)?.name ?? exercise.exerciseName
    const primaryMuscle = resolveExerciseSpecificMuscle(
      exercise.exerciseName,
      exercise.muscleGroup,
    )
    const secondaryMuscle =
      SECONDARY_EXERCISE_MUSCLE_MAPPING[canonicalName] ??
      SECONDARY_EXERCISE_MUSCLE_MAPPING[exercise.exerciseName] ??
      null

    const tier = exerciseNameMap.get(exercise.exerciseName)?.tier ?? 2
    const weightedPoints = points * (tier === 1 ? 1 : TIER2_WEIGHT)

    ;[primaryMuscle, secondaryMuscle].forEach((muscle, index) => {
      if (!muscle) return
      if (index === 1 && muscle === primaryMuscle) return

      const existing = groupState.get(muscle) ?? {
        exercises: [],
        weightedExerciseScores: [],
        lastTrainedAt: null,
      }

      existing.exercises.push(exercise)
      existing.weightedExerciseScores.push(weightedPoints)

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
      const aggregate = calculateStrengthAggregateFromScores({
        weightedExerciseScores: state.weightedExerciseScores,
        lastTrainedAt: state.lastTrainedAt,
        now,
      })
      const rank = getOverallStrengthGroupLevelProgress({
        effectiveScore: aggregate.effectiveScore,
      })

      return {
        name,
        level: rank.level,
        progress: rank.progress,
        exercises: state.exercises,
        averageScore: aggregate.effectiveScore,
      }
    })
    .sort((a, b) => b.averageScore - a.averageScore)
}

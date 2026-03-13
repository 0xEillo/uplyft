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

export type DisplayStrengthGroup = OverallStrengthGroup

export interface DisplayStrengthGroupData<TExercise> {
  name: DisplayStrengthGroup
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

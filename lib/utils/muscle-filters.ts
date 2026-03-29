export const EXERCISE_MUSCLE_FILTER_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Traps',
  'Lower Back',
] as const

export const EXERCISE_MUSCLE_GROUPS = [
  ...EXERCISE_MUSCLE_FILTER_GROUPS,
  'Cardio',
  'Full Body',
] as const

const MUSCLE_FILTER_GROUP_ALIASES: Record<string, string> = {
  Abs: 'Core',
  Lats: 'Back',
}

const MUSCLE_FILTER_TARGETS: Record<string, string[]> = {
  Back: ['Back', 'Lats'],
  Core: ['Core', 'Abs'],
}

function normalizeMuscleGroup(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeMuscleFilterGroup(
  muscleGroup: string | null | undefined,
): string | null {
  const normalized = normalizeMuscleGroup(muscleGroup)
  if (!normalized) return null

  return MUSCLE_FILTER_GROUP_ALIASES[normalized] ?? normalized
}

export function getMuscleFilterTargets(muscleGroup: string): string[] {
  const normalized = normalizeMuscleFilterGroup(muscleGroup)
  if (!normalized) return []

  return MUSCLE_FILTER_TARGETS[normalized] ?? [normalized]
}

export function matchesMuscleGroupFilter(
  exerciseMuscleGroup: string | null | undefined,
  selectedMuscleGroups: readonly string[],
): boolean {
  const normalizedExerciseMuscle = normalizeMuscleGroup(exerciseMuscleGroup)
  if (!normalizedExerciseMuscle) return false
  if (selectedMuscleGroups.length === 0) return true

  return selectedMuscleGroups.some((selectedGroup) =>
    getMuscleFilterTargets(selectedGroup).includes(normalizedExerciseMuscle),
  )
}

export function isMuscleFilterAvailable(
  muscleGroup: string,
  availableMuscleGroups: ReadonlySet<string>,
): boolean {
  return getMuscleFilterTargets(muscleGroup).some((target) =>
    availableMuscleGroups.has(target),
  )
}

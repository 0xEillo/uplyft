import type { Exercise } from '@/types/database.types'

export const EXERCISE_EQUIPMENT_OPTIONS = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'resistance band',
  'other',
] as const

export type ExerciseEquipment = (typeof EXERCISE_EQUIPMENT_OPTIONS)[number]

const EXERCISE_EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  'resistance band': 'Resistance Band',
  other: 'Other',
}

const EXACT_EQUIPMENT_ALIASES: Record<string, ExerciseEquipment> = {
  barbell: 'barbell',
  barbells: 'barbell',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  machine: 'machine',
  machines: 'machine',
  cable: 'cable',
  cables: 'cable',
  bodyweight: 'bodyweight',
  'body weight': 'bodyweight',
  'body-weight': 'bodyweight',
  bw: 'bodyweight',
  kettlebell: 'kettlebell',
  kettlebells: 'kettlebell',
  'resistance band': 'resistance band',
  'resistance bands': 'resistance band',
  band: 'resistance band',
  bands: 'resistance band',
  other: 'other',
  none: 'bodyweight',
  weighted: 'bodyweight',
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function normalizeExerciseEquipment(
  value: string | null | undefined,
): ExerciseEquipment | null {
  if (!value) return null

  const normalized = normalizeToken(value)
  if (!normalized) return null

  const exactMatch = EXACT_EQUIPMENT_ALIASES[normalized]
  if (exactMatch) return exactMatch

  if (
    normalized.includes('smith') ||
    normalized.includes('machine') ||
    normalized.includes('leverage') ||
    normalized.includes('sled')
  ) {
    return 'machine'
  }

  if (normalized.includes('cable') || normalized.includes('pulley')) {
    return 'cable'
  }

  if (normalized.includes('kettlebell')) {
    return 'kettlebell'
  }

  if (normalized.includes('dumbbell')) {
    return 'dumbbell'
  }

  if (
    normalized.includes('barbell') ||
    normalized.includes('ez bar') ||
    normalized.includes('trap bar') ||
    normalized.includes('olympic bar')
  ) {
    return 'barbell'
  }

  if (
    normalized.includes('bodyweight') ||
    normalized.includes('body weight')
  ) {
    return 'bodyweight'
  }

  if (
    normalized.includes('resistance band') ||
    normalized.endsWith(' band') ||
    normalized.includes(' band ') ||
    normalized.includes('bands')
  ) {
    return 'resistance band'
  }

  return 'other'
}

export function getExerciseEquipmentLabel(value: ExerciseEquipment) {
  return EXERCISE_EQUIPMENT_LABELS[value]
}

export function formatExerciseEquipmentLabel(
  value: string | null | undefined,
): string | null {
  if (!value) return null

  const normalized = normalizeExerciseEquipment(value)
  if (normalized) {
    return getExerciseEquipmentLabel(normalized)
  }

  const token = normalizeToken(value)
  return token ? toTitleCase(token) : null
}

export function getNormalizedExerciseEquipment(
  exercise: Pick<Exercise, 'equipment' | 'equipments'>,
): ExerciseEquipment[] {
  const normalizedEquipment = new Set<ExerciseEquipment>()

  const primaryEquipment = normalizeExerciseEquipment(exercise.equipment)
  if (primaryEquipment) {
    normalizedEquipment.add(primaryEquipment)
  }

  if (Array.isArray(exercise.equipments)) {
    exercise.equipments.forEach((value) => {
      const normalizedValue = normalizeExerciseEquipment(value)
      if (normalizedValue) {
        normalizedEquipment.add(normalizedValue)
      }
    })
  }

  return EXERCISE_EQUIPMENT_OPTIONS.filter((value) =>
    normalizedEquipment.has(value),
  )
}

export function getAvailableExerciseEquipment(
  exercises: Pick<Exercise, 'equipment' | 'equipments'>[],
): ExerciseEquipment[] {
  const availableEquipment = new Set<ExerciseEquipment>()

  exercises.forEach((exercise) => {
    getNormalizedExerciseEquipment(exercise).forEach((value) => {
      availableEquipment.add(value)
    })
  })

  return EXERCISE_EQUIPMENT_OPTIONS.filter((value) =>
    availableEquipment.has(value),
  )
}

export function matchesExerciseEquipmentFilter(
  exercise: Pick<Exercise, 'equipment' | 'equipments'>,
  selectedEquipment: ReadonlySet<string>,
) {
  if (selectedEquipment.size === 0) return true

  return getNormalizedExerciseEquipment(exercise).some((value) =>
    selectedEquipment.has(value),
  )
}

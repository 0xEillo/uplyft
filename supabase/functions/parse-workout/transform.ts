import { KG_TO_LB } from './constants.ts'
import {
    NormalizedExercise,
    NormalizedSet,
    NormalizedWorkout,
    ParsedWorkout,
} from './schemas.ts'

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    // First, normalize locale-specific decimal separators:
    // - Commas (European locales use ',' as decimal separator: "7,5" → "7.5")
    // - Unicode middle dots (·) that may be input on some keyboards
    // - Other Unicode decimal-like characters
    const normalized = value
      .replace(/,/g, '.')        // European decimal comma
      .replace(/·/g, '.')        // Middle dot (U+00B7)
      .replace(/٫/g, '.')        // Arabic decimal separator (U+066B)
      .replace(/、/g, '.')       // Japanese comma that might be used

    // Then remove everything except digits, periods, and minus signs
    const cleaned = normalized.replace(/[^0-9.\-]/g, '')
    if (!cleaned) return null

    // Handle multiple periods (e.g., "7.5.2" is invalid - keep only first decimal)
    const parts = cleaned.split('.')
    const finalValue = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned

    const parsed = Number(finalValue)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function normalizeWeightToKg(
  weight: unknown,
  sourceUnit: 'kg' | 'lb',
): number | null {
  const numeric = coerceNumber(weight)
  if (numeric === null) return null

  if (sourceUnit === 'kg') {
    return numeric
  }

  const converted = numeric / KG_TO_LB
  return Number.isFinite(converted) ? converted : null
}

function normalizeReps(value: unknown): number | null {
  const numeric = coerceNumber(value)
  if (numeric === null) return null
  return numeric >= 1 ? numeric : null
}

function normalizeRpe(value: unknown): number | null {
  const numeric = coerceNumber(value)
  if (numeric === null) return null
  return numeric >= 0 ? numeric : null
}

function normalizeSet(
  set: Record<string, unknown>,
  index: number,
  weightUnit: 'kg' | 'lb',
): NormalizedSet {
  const normalizedWeight = normalizeWeightToKg(set.weight, weightUnit)
  const normalizedRpe = normalizeRpe(set.rpe)

  return {
    set_number: typeof set.set_number === 'number' ? set.set_number : index + 1,
    reps: normalizeReps(set.reps),
    weight: normalizedWeight ?? undefined,
    rpe: normalizedRpe ?? undefined,
    notes: (set.notes as string | null | undefined) ?? undefined,
    is_warmup: set.is_warmup === true,
  }
}

function normalizeExercise(
  exercise: Record<string, unknown>,
  weightUnit: 'kg' | 'lb',
): NormalizedExercise {
  const setsArray = Array.isArray(exercise.sets) ? exercise.sets : []
  const normalizedSets = setsArray.map((set, index) =>
    normalizeSet(set as Record<string, unknown>, index, weightUnit),
  )

  return {
    name: String(exercise.name ?? ''),
    order_index:
      typeof exercise.order_index === 'number'
        ? exercise.order_index
        : normalizedSets.length,
    notes: (exercise.notes as string | null | undefined) ?? undefined,
    hasRepGaps: normalizedSets.some((set) => set.reps == null),
    sets: normalizedSets,
  }
}

export function normalizeWorkout(
  workout: ParsedWorkout,
  weightUnit: 'kg' | 'lb',
): NormalizedWorkout {
  const exercises = (Array.isArray(workout.exercises)
    ? workout.exercises
    : []) as Record<string, unknown>[]

  return {
    notes: workout.notes ?? undefined,
    type: workout.type ?? undefined,
    exercises: exercises.map((exercise) =>
      normalizeExercise(exercise, weightUnit),
    ),
  }
}

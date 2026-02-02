import { KG_TO_LB } from './constants.ts'
import {
  NormalizedExercise,
  NormalizedSet,
  NormalizedWorkout,
  ParsedWorkout,
} from './schemas.ts'

function coerceNumber(value: unknown, context?: string): number | null {
  // DEBUG: Log input value and type
  const debugContext = context ?? 'unknown'
  console.log(`[transform][coerceNumber][${debugContext}] Input:`, {
    value,
    type: typeof value,
    isNull: value === null,
    isUndefined: value === undefined,
  })

  if (value === null || value === undefined) {
    console.log(`[transform][coerceNumber][${debugContext}] Result: null (null/undefined input)`)
    return null
  }

  if (typeof value === 'number') {
    const result = Number.isFinite(value) ? value : null
    console.log(`[transform][coerceNumber][${debugContext}] Result (from number):`, result)
    return result
  }

  if (typeof value === 'string') {
    // DEBUG: Log the string being parsed
    console.log(`[transform][coerceNumber][${debugContext}] Parsing string:`, {
      original: value,
      charCodes: value.split('').map(c => c.charCodeAt(0)),
      length: value.length,
    })

    // First, normalize locale-specific decimal separators:
    // - Commas (European locales use ',' as decimal separator: "7,5" → "7.5")
    // - Unicode middle dots (·) that may be input on some keyboards
    // - Other Unicode decimal-like characters
    const normalized = value
      .replace(/,/g, '.')        // European decimal comma
      .replace(/·/g, '.')        // Middle dot (U+00B7)
      .replace(/٫/g, '.')        // Arabic decimal separator (U+066B)
      .replace(/、/g, '.')       // Japanese comma that might be used

    console.log(`[transform][coerceNumber][${debugContext}] After normalization:`, {
      normalized,
      charCodes: normalized.split('').map(c => c.charCodeAt(0)),
    })

    // Then remove everything except digits, periods, and minus signs
    const cleaned = normalized.replace(/[^0-9.\-]/g, '')
    console.log(`[transform][coerceNumber][${debugContext}] After cleaning:`, {
      cleaned,
      charCodes: cleaned.split('').map(c => c.charCodeAt(0)),
    })

    if (!cleaned) {
      console.log(`[transform][coerceNumber][${debugContext}] Result: null (empty after cleaning)`)
      return null
    }

    // Handle multiple periods (e.g., "7.5.2" is invalid - keep only first decimal)
    const parts = cleaned.split('.')
    const finalValue = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned

    console.log(`[transform][coerceNumber][${debugContext}] Final value before parsing:`, {
      finalValue,
      parts,
      partsCount: parts.length,
    })

    const parsed = Number(finalValue)
    const result = Number.isFinite(parsed) ? parsed : null
    
    console.log(`[transform][coerceNumber][${debugContext}] Result:`, {
      parsed,
      isFinite: Number.isFinite(parsed),
      result,
    })

    // ALERT: Check for suspicious parsing (decimal might have been lost)
    if (result !== null && value.includes('.') || value.includes(',')) {
      const originalHasDecimal = value.includes('.') || value.includes(',')
      const resultHasDecimal = result !== null && result % 1 !== 0
      if (originalHasDecimal && !resultHasDecimal && result !== null && result > 10) {
        console.warn(`[transform][coerceNumber][${debugContext}] SUSPICIOUS: Decimal may have been stripped!`, {
          originalValue: value,
          parsedResult: result,
          expectedDecimal: true,
          gotDecimal: resultHasDecimal,
        })
      }
    }

    return result
  }

  console.log(`[transform][coerceNumber][${debugContext}] Result: null (unsupported type)`)
  return null
}

export function normalizeWeightToKg(
  weight: unknown,
  sourceUnit: 'kg' | 'lb',
  exerciseContext?: string,
): number | null {
  const contextStr = exerciseContext ? `weight-${exerciseContext}` : 'weight'
  const numeric = coerceNumber(weight, contextStr)
  
  console.log(`[transform][normalizeWeightToKg] Processing:`, {
    rawWeight: weight,
    numericResult: numeric,
    sourceUnit,
    context: exerciseContext,
  })

  if (numeric === null) return null

  if (sourceUnit === 'kg') {
    return numeric
  }

  const converted = numeric / KG_TO_LB
  return Number.isFinite(converted) ? converted : null
}

function normalizeReps(value: unknown, context?: string): number | null {
  const numeric = coerceNumber(value, context ?? 'reps')
  if (numeric === null) return null
  return numeric >= 1 ? numeric : null
}

function normalizeRpe(value: unknown, context?: string): number | null {
  const numeric = coerceNumber(value, context ?? 'rpe')
  if (numeric === null) return null
  return numeric >= 0 ? numeric : null
}

function normalizeSet(
  set: Record<string, unknown>,
  index: number,
  weightUnit: 'kg' | 'lb',
  exerciseName?: string,
): NormalizedSet {
  const setContext = exerciseName ? `${exerciseName}-set${index + 1}` : `set${index + 1}`
  
  console.log(`[transform][normalizeSet] Processing set:`, {
    setNumber: index + 1,
    exerciseName,
    rawWeight: set.weight,
    rawReps: set.reps,
    weightType: typeof set.weight,
  })

  const normalizedWeight = normalizeWeightToKg(set.weight, weightUnit, setContext)
  const normalizedRpe = normalizeRpe(set.rpe, setContext)

  const result = {
    set_number: typeof set.set_number === 'number' ? set.set_number : index + 1,
    reps: normalizeReps(set.reps, setContext),
    weight: normalizedWeight ?? undefined,
    rpe: normalizedRpe ?? undefined,
    notes: (set.notes as string | null | undefined) ?? undefined,
    is_warmup: set.is_warmup === true,
  }

  console.log(`[transform][normalizeSet] Result:`, {
    setNumber: result.set_number,
    exerciseName,
    normalizedWeight: result.weight,
    normalizedReps: result.reps,
  })

  return result
}

function normalizeExercise(
  exercise: Record<string, unknown>,
  weightUnit: 'kg' | 'lb',
): NormalizedExercise {
  const exerciseName = String(exercise.name ?? '')
  const setsArray = Array.isArray(exercise.sets) ? exercise.sets : []
  
  console.log(`[transform][normalizeExercise] Processing exercise:`, {
    name: exerciseName,
    setsCount: setsArray.length,
    weightUnit,
  })

  const normalizedSets = setsArray.map((set, index) =>
    normalizeSet(set as Record<string, unknown>, index, weightUnit, exerciseName),
  )

  return {
    name: exerciseName,
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

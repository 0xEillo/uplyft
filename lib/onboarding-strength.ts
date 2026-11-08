import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'

// Loading and merging the onboarding lift lives with the other strength
// inputs (lib/strength-inputs.ts and the shared strength-inputs module).
export { getOnboardingStrengthSnapshot } from '@/lib/strength-inputs'
export {
  mergeOnboardingStrengthSnapshotIntoExerciseData,
  type OnboardingStrengthSnapshot,
  type StrengthExerciseDataShape,
  type StrengthRecordShape,
} from '../supabase/functions/_shared/strength-inputs'
export type { OverallStrengthBest1RMSnapshot as StrengthBest1RMSnapshotShape } from '../supabase/functions/_shared/strength-core'

export interface OnboardingStrengthSnapshotInput {
  exerciseName: string
  workingWeightKg: number
  reps: number
  estimated1RMKg: number
}

const isValidPositiveNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isValidReps = (value: number | null | undefined): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  Number.isFinite(value) &&
  value > 0

function normalizeInput(
  input: OnboardingStrengthSnapshotInput | null | undefined,
): OnboardingStrengthSnapshotInput | null {
  if (!input?.exerciseName?.trim()) {
    return null
  }

  if (
    !isValidPositiveNumber(input.workingWeightKg) ||
    !isValidReps(input.reps) ||
    !isValidPositiveNumber(input.estimated1RMKg)
  ) {
    return null
  }

  return {
    exerciseName: input.exerciseName.trim(),
    workingWeightKg: Math.round(input.workingWeightKg * 100) / 100,
    reps: input.reps,
    estimated1RMKg: Math.round(input.estimated1RMKg * 100) / 100,
  }
}

export async function persistOnboardingStrengthSnapshot(
  userId: string,
  input: OnboardingStrengthSnapshotInput | null | undefined,
) {
  if (!userId) {
    return
  }

  const normalizedInput = normalizeInput(input)
  if (!normalizedInput) {
    return
  }

  try {
    const exercise = await database.exercises.getOrCreate(
      normalizedInput.exerciseName,
      userId,
    )

    const { error } = await supabase
      .from('onboarding_strength_snapshots')
      .upsert(
        {
          user_id: userId,
          exercise_id: exercise.id,
          working_weight_kg: normalizedInput.workingWeightKg,
          reps: normalizedInput.reps,
          estimated_1rm_kg: normalizedInput.estimated1RMKg,
        },
        { onConflict: 'user_id' },
      )

    if (error) {
      throw error
    }
  } catch (error) {
    console.warn(
      '[OnboardingStrength] Failed to save onboarding strength snapshot:',
      error,
    )
  }
}

import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import type { Exercise } from '@/types/database.types'

export interface OnboardingStrengthSnapshotInput {
  exerciseName: string
  workingWeightKg: number
  reps: number
  estimated1RMKg: number
}

export interface OnboardingStrengthSnapshot
  extends OnboardingStrengthSnapshotInput {
  exerciseId: string
  muscleGroup: Exercise['muscle_group']
  gifUrl: string | null
  recordedAt: string
}

export interface StrengthRecordShape {
  weight: number
  maxReps: number
  date: string
  estimated1RM: number
}

export interface StrengthExerciseDataShape {
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  max1RM: number
  lastTrainedAt?: string | null
  gifUrl?: string | null
  records: StrengthRecordShape[]
}

export interface StrengthBest1RMSnapshotShape {
  currentBest1RM: number
  previousBest1RM: number
  lastIncreaseAt: string | null
  lastIncreaseSessionId: string | null
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

function resolveLaterTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null {
  if (!left) return right ?? null
  if (!right) return left

  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()

  if (!Number.isFinite(leftTime)) return right
  if (!Number.isFinite(rightTime)) return left

  return rightTime > leftTime ? right : left
}

function mergeRecords(
  records: StrengthRecordShape[],
  onboardingRecord: StrengthRecordShape,
): StrengthRecordShape[] {
  const existingIndex = records.findIndex(
    (record) =>
      record.weight === onboardingRecord.weight &&
      record.date === onboardingRecord.date,
  )

  if (existingIndex === -1) {
    return [...records, onboardingRecord].sort((a, b) => b.weight - a.weight)
  }

  return records.map((record, index) => {
    if (index !== existingIndex) {
      return record
    }

    return {
      ...record,
      maxReps: Math.max(record.maxReps, onboardingRecord.maxReps),
      estimated1RM: Math.max(record.estimated1RM, onboardingRecord.estimated1RM),
    }
  })
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

export async function getOnboardingStrengthSnapshot(
  userId: string,
): Promise<OnboardingStrengthSnapshot | null> {
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('onboarding_strength_snapshots')
      .select(
        `
        exercise_id,
        working_weight_kg,
        reps,
        estimated_1rm_kg,
        created_at,
        updated_at,
        exercise:exercises!inner (
          id,
          name,
          muscle_group,
          gif_url
        )
      `,
      )
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return null
    }

    const exercise = Array.isArray(data.exercise)
      ? data.exercise[0]
      : data.exercise

    if (!exercise) {
      return null
    }

    return {
      exerciseId: data.exercise_id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscle_group,
      gifUrl: exercise.gif_url ?? null,
      workingWeightKg: data.working_weight_kg,
      reps: data.reps,
      estimated1RMKg: data.estimated_1rm_kg,
      recordedAt: data.updated_at ?? data.created_at,
    }
  } catch (error) {
    console.warn(
      '[OnboardingStrength] Failed to load onboarding strength snapshot:',
      error,
    )
    return null
  }
}

export function mergeOnboardingStrengthSnapshotIntoExerciseData(input: {
  exercises: StrengthExerciseDataShape[]
  best1RMSnapshotByExerciseId: Record<string, StrengthBest1RMSnapshotShape>
  snapshot: OnboardingStrengthSnapshot | null
}): {
  exercises: StrengthExerciseDataShape[]
  best1RMSnapshotByExerciseId: Record<string, StrengthBest1RMSnapshotShape>
} {
  const { exercises, best1RMSnapshotByExerciseId, snapshot } = input

  if (!snapshot) {
    return {
      exercises,
      best1RMSnapshotByExerciseId,
    }
  }

  const estimated1RM = Math.round(snapshot.estimated1RMKg)
  const onboardingRecord: StrengthRecordShape = {
    weight: snapshot.workingWeightKg,
    maxReps: snapshot.reps,
    date: snapshot.recordedAt,
    estimated1RM,
  }

  const existingIndex = exercises.findIndex(
    (exercise) => exercise.exerciseId === snapshot.exerciseId,
  )

  const nextExercises =
    existingIndex === -1
      ? [
          ...exercises,
          {
            exerciseId: snapshot.exerciseId,
            exerciseName: snapshot.exerciseName,
            muscleGroup: snapshot.muscleGroup,
            max1RM: estimated1RM,
            lastTrainedAt: snapshot.recordedAt,
            gifUrl: snapshot.gifUrl,
            records: [onboardingRecord],
          },
        ]
      : exercises.map((exercise, index) => {
          if (index !== existingIndex) {
            return exercise
          }

          return {
            ...exercise,
            max1RM: Math.max(exercise.max1RM, estimated1RM),
            lastTrainedAt: resolveLaterTimestamp(
              exercise.lastTrainedAt,
              snapshot.recordedAt,
            ),
            gifUrl: exercise.gifUrl ?? snapshot.gifUrl,
            records: mergeRecords(exercise.records, onboardingRecord),
          }
        })

  const existingBest = best1RMSnapshotByExerciseId[snapshot.exerciseId]
  const nextBest1RMSnapshotByExerciseId = {
    ...best1RMSnapshotByExerciseId,
  }
  const mergedExerciseMax1RM =
    nextExercises.find((exercise) => exercise.exerciseId === snapshot.exerciseId)
      ?.max1RM ?? estimated1RM

  if (!existingBest) {
    nextBest1RMSnapshotByExerciseId[snapshot.exerciseId] = {
      currentBest1RM: mergedExerciseMax1RM,
      previousBest1RM: 0,
      lastIncreaseAt: snapshot.recordedAt,
      lastIncreaseSessionId: null,
    }
  } else if (estimated1RM > existingBest.currentBest1RM) {
    nextBest1RMSnapshotByExerciseId[snapshot.exerciseId] = {
      currentBest1RM: estimated1RM,
      previousBest1RM: existingBest.currentBest1RM,
      lastIncreaseAt: snapshot.recordedAt,
      lastIncreaseSessionId: null,
    }
  }

  return {
    exercises: nextExercises,
    best1RMSnapshotByExerciseId: nextBest1RMSnapshotByExerciseId,
  }
}

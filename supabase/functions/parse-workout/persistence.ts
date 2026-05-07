import { createServiceClient } from '../_shared/supabase.ts'
import { refreshUserStrengthProfileCache } from '../_shared/strength.ts'
import {
  isWorkoutSessionIdempotencyConflict,
  normalizeIdempotencyKey,
} from './idempotency.ts'
import { logWithCorrelation } from './metrics.ts'
import { resolveExercises } from './resolver/agent.ts'
import { NormalizedWorkout, WorkoutMetrics, WorkoutSong } from './schemas.ts'

export interface CreatedWorkoutResult {
  session: any
  metrics: WorkoutMetrics
}

const EXISTING_SESSION_READY_DELAYS_MS = [
  0,
  250,
  500,
  1000,
  2000,
  4000,
  8000,
  16000,
]

async function waitForExistingSession(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  normalizedIdempotencyKey: string,
): Promise<any | null> {
  for (const delayMs of EXISTING_SESSION_READY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('client_idempotency_key', normalizedIdempotencyKey)
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    if (data.is_processing !== true) {
      return data
    }
  }

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('client_idempotency_key', normalizedIdempotencyKey)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function createWorkoutSession(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  workout: NormalizedWorkout,
  rawText: string,
  description: string | null | undefined,
  imageUrl: string | null | undefined,
  routineId: string | null | undefined,
  durationSeconds: number | null | undefined,
  song: WorkoutSong | null | undefined,
  idempotencyKey: string | null | undefined,
  performedAt: string | null | undefined,
  correlationId: string,
): Promise<CreatedWorkoutResult> {
  const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey)

  logWithCorrelation(correlationId, 'Creating workout session', {
    userId,
    routineId,
    workoutType: workout.type,
    durationSeconds,
    idempotencyKey: normalizedIdempotencyKey,
    performedAt: performedAt ?? 'now',
  })

  let session: any

  try {
    const { data, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        raw_text: rawText,
        notes: description || null, // Use user-provided description, not AI-parsed notes
        type: workout.type ?? null,
        image_url: imageUrl ?? null,
        song: song ?? null,
        routine_id: routineId ?? null,
        duration: typeof durationSeconds === 'number' ? durationSeconds : null,
        client_idempotency_key: normalizedIdempotencyKey,
        is_processing: true,
        // Use client-provided timestamp for offline support, fallback to server time
        date: performedAt ?? new Date().toISOString(),
      })
      .select()
      .single()

    if (sessionError) throw sessionError
    session = data
  } catch (error) {
    if (!normalizedIdempotencyKey || !isWorkoutSessionIdempotencyConflict(error)) {
      throw error
    }

    logWithCorrelation(
      correlationId,
      'Duplicate workout submission detected, returning existing session',
      {
        userId,
        idempotencyKey: normalizedIdempotencyKey,
      },
    )

    const existingSession = await waitForExistingSession(
      supabase,
      userId,
      normalizedIdempotencyKey,
    )

    if (!existingSession) {
      throw error
    }

    return {
      session: existingSession,
      metrics: {
        totalExercises: workout.exercises.length,
        matchedExercises: 0,
        createdExercises: 0,
        totalSets: workout.exercises.reduce(
          (sum, exercise) => sum + exercise.sets.length,
          0,
        ),
      },
    }
  }

  if (!Array.isArray(workout.exercises)) {
    throw new Error('Invalid workout data: exercises must be an array')
  }

  try {
    logWithCorrelation(
      correlationId,
      `Processing workout ${session.id} with ${workout.exercises.length} exercise(s)`,
    )

    const exerciseNames = workout.exercises.map((exercise) => exercise.name)

    const exerciseResolutions = await resolveExercises(
      exerciseNames,
      userId,
      correlationId,
    )

    logWithCorrelation(
      correlationId,
      `Resolved ${exerciseResolutions.size} exercises`,
    )

    const workoutExercisesToInsert = workout.exercises.map((exercise) => {
      const resolution = exerciseResolutions.get(exercise.name)

      if (!resolution) {
        throw new Error(
          `Agent failed to resolve exercise: ${exercise.name}. This should not happen.`,
        )
      }

      return {
        session_id: session.id,
        exercise_id: resolution.exerciseId,
        order_index: exercise.order_index,
        notes: exercise.notes ?? null,
      }
    })

    const {
      data: workoutExercises,
      error: workoutExerciseError,
    } = await supabase
      .from('workout_exercises')
      .insert(workoutExercisesToInsert)
      .select()

    if (workoutExerciseError) throw workoutExerciseError

    const allSetsToInsert = workout.exercises.flatMap((exercise, index) => {
      const workoutExercise = workoutExercises[index]

      return exercise.sets.map((set) => ({
        workout_exercise_id: workoutExercise.id,
        set_number: set.set_number,
        reps: set.reps,
        weight: set.weight ?? null,
        duration_seconds: set.duration_seconds ?? null,
        rpe: set.rpe ?? null,
        notes: set.notes ?? null,
        is_warmup: set.is_warmup === true,
      }))
    })

    if (allSetsToInsert.length > 0) {
      const { error: setsError } = await supabase
        .from('sets')
        .insert(allSetsToInsert)
      if (setsError) throw setsError
    }

    const { error: recordCountError } = await supabase.rpc(
      'refresh_workout_record_count',
      { p_session_id: session.id },
    )
    if (recordCountError) throw recordCountError

    await refreshUserStrengthProfileCache(supabase, userId).catch((error) => {
      logWithCorrelation(
        correlationId,
        'Failed to refresh cached strength profile after workout creation',
        {
          userId,
          sessionId: session.id,
          error: error instanceof Error ? error.message : String(error),
        },
      )
    })

    const { data: finalizedSession, error: finalizeSessionError } = await supabase
      .from('workout_sessions')
      .update({ is_processing: false })
      .eq('id', session.id)
      .select()
      .single()

    if (finalizeSessionError) throw finalizeSessionError

    logWithCorrelation(
      correlationId,
      `Completed workout ${session.id}: ${workoutExercises.length} exercises, ${allSetsToInsert.length} sets`,
    )

    const resolutionsArray = Array.from(exerciseResolutions.values())

    const metrics: WorkoutMetrics = {
      totalExercises: workout.exercises.length,
      matchedExercises: resolutionsArray.filter(
        (resolution) => !resolution.wasCreated,
      ).length,
      createdExercises: resolutionsArray.filter(
        (resolution) => resolution.wasCreated,
      ).length,
      totalSets: allSetsToInsert.length,
    }

    return { session: finalizedSession, metrics }
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'Cleaning up partial workout session after persistence failure',
      {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      },
    )

    const { error: cleanupError } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', session.id)

    if (cleanupError) {
      logWithCorrelation(correlationId, 'Failed to clean up partial workout session', {
        sessionId: session.id,
        error: cleanupError.message,
      })
    }

    throw error
  }
}

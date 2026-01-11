import { createServiceClient } from '../_shared/supabase.ts'
import { logWithCorrelation } from './metrics.ts'
import { resolveExercises } from './resolver/agent.ts'
import { NormalizedWorkout, WorkoutMetrics } from './schemas.ts'

export interface CreatedWorkoutResult {
  session: any
  metrics: WorkoutMetrics
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
  correlationId: string,
): Promise<CreatedWorkoutResult> {
  logWithCorrelation(correlationId, 'Creating workout session', {
    userId,
    routineId,
    workoutType: workout.type,
    durationSeconds,
  })

  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId,
      raw_text: rawText,
      notes: description || null, // Use user-provided description, not AI-parsed notes
      type: workout.type ?? null,
      image_url: imageUrl ?? null,
      routine_id: routineId ?? null,
      duration: typeof durationSeconds === 'number' ? durationSeconds : null,
    })
    .select()
    .single()

  if (sessionError) throw sessionError

  if (!Array.isArray(workout.exercises)) {
    throw new Error('Invalid workout data: exercises must be an array')
  }

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

  return { session, metrics }
}

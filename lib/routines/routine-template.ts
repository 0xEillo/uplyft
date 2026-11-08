/**
 * The one writer for routine templates (workout_routines →
 * workout_routine_exercises → workout_routine_sets).
 *
 * Callers map their own source (AI plan, routine editor, past workout,
 * explore routine) into `RoutineTemplateExercise[]` and hand it here. Writes
 * are not transactional (no RPC), so each writer cleans up after itself when a
 * later step fails.
 *
 * Imports only the Supabase client — lib/database.ts depends on this module,
 * so this module must not import lib/database.ts.
 */
import { supabase } from '@/lib/supabase'
import type { WorkoutRoutine } from '@/types/database.types'

export type RoutineTemplateSet = {
  set_number: number
  reps_min?: number | null
  reps_max?: number | null
  /** Omitted from the row when undefined (column default applies). */
  rest_seconds?: number | null
}

export type RoutineTemplateExercise = {
  exercise_id: string
  order_index: number
  notes?: string | null
  sets: RoutineTemplateSet[]
}

/** Columns written on the routine row (besides user_id). Undefined keys are omitted. */
export type RoutineTemplateMeta = {
  name: string
  notes?: string | null
  image_path?: string | null
  tint_color?: string | null
  program_id?: string | null
}

export type InsertedRoutineExercise = {
  id: string
  order_index: number
}

export type RoutineExerciseRow = {
  routine_id: string
  exercise_id: string
  order_index: number
  notes: string | null
}

export type RoutineSetRow = {
  routine_exercise_id: string
  set_number: number
  reps_min: number | null
  reps_max: number | null
  rest_seconds?: number | null
}

// ---------------------------------------------------------------------------
// Pure row builders
// ---------------------------------------------------------------------------

/**
 * Rows for workout_routine_exercises. `orderIndexOffset` shifts every
 * order_index (used to stage new rows clear of the existing ones).
 */
export function buildRoutineExerciseRows(
  routineId: string,
  exercises: RoutineTemplateExercise[],
  orderIndexOffset = 0,
): RoutineExerciseRow[] {
  return exercises.map((exercise) => ({
    routine_id: routineId,
    exercise_id: exercise.exercise_id,
    order_index: exercise.order_index + orderIndexOffset,
    notes: exercise.notes ?? null,
  }))
}

/**
 * Rows for workout_routine_sets, attaching each exercise's sets to the
 * inserted routine-exercise row with the same (offset) order_index. Exercises
 * whose row is missing are skipped and reported.
 */
export function buildRoutineSetRows(
  exercises: RoutineTemplateExercise[],
  insertedExercises: InsertedRoutineExercise[],
  orderIndexOffset = 0,
): { rows: RoutineSetRow[]; missingOrderIndexes: number[] } {
  const insertedIdByOrderIndex = new Map<number, string>()
  insertedExercises.forEach((row) => {
    if (typeof row.order_index === 'number' && !Number.isNaN(row.order_index)) {
      insertedIdByOrderIndex.set(row.order_index, row.id)
    }
  })

  const rows: RoutineSetRow[] = []
  const missingOrderIndexes: number[] = []

  exercises.forEach((exercise) => {
    const routineExerciseId = insertedIdByOrderIndex.get(
      exercise.order_index + orderIndexOffset,
    )
    if (!routineExerciseId) {
      missingOrderIndexes.push(exercise.order_index)
      return
    }

    exercise.sets.forEach((set) => {
      rows.push({
        routine_exercise_id: routineExerciseId,
        set_number: set.set_number,
        reps_min: set.reps_min ?? null,
        reps_max: set.reps_max ?? null,
        ...(set.rest_seconds !== undefined
          ? { rest_seconds: set.rest_seconds }
          : {}),
      })
    })
  })

  return { rows, missingOrderIndexes }
}

/**
 * Both row sets for a template, given the inserted exercise rows. Convenience
 * wrapper over the two builders above for a template written at its own
 * order indexes.
 */
export function buildRoutineTemplateRows(
  routineId: string,
  exercises: RoutineTemplateExercise[],
  insertedExercises: InsertedRoutineExercise[],
): { exerciseRows: RoutineExerciseRow[]; setRows: RoutineSetRow[] } {
  return {
    exerciseRows: buildRoutineExerciseRows(routineId, exercises),
    setRows: buildRoutineSetRows(exercises, insertedExercises).rows,
  }
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

async function bestEffortDelete(
  table: 'workout_routines' | 'workout_routine_exercises',
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  try {
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (error) throw error
  } catch (cleanupError) {
    console.error(`[routine-template] Failed to clean up ${table}:`, cleanupError)
  }
}

/**
 * Insert exercises (at order_index + offset) and their sets. Inserted
 * exercise ids are pushed to `insertedIds` as soon as they exist so the
 * caller can clean them up if a later step throws.
 */
async function insertTemplateRows(
  routineId: string,
  exercises: RoutineTemplateExercise[],
  orderIndexOffset: number,
  insertedIds: string[],
): Promise<InsertedRoutineExercise[]> {
  if (exercises.length === 0) return []

  const { data, error } = await supabase
    .from('workout_routine_exercises')
    .insert(buildRoutineExerciseRows(routineId, exercises, orderIndexOffset))
    .select('id, order_index')

  if (error) throw error
  if (!data) throw new Error('Failed to create routine exercises')

  const inserted = data as InsertedRoutineExercise[]
  inserted.forEach((row) => insertedIds.push(row.id))

  const { rows: setRows, missingOrderIndexes } = buildRoutineSetRows(
    exercises,
    inserted,
    orderIndexOffset,
  )
  if (missingOrderIndexes.length > 0) {
    console.warn(
      '[routine-template] Missing inserted routine exercise for order index',
      { routineId, orderIndexes: missingOrderIndexes },
    )
  }

  if (setRows.length > 0) {
    const { error: setsError } = await supabase
      .from('workout_routine_sets')
      .insert(setRows)
    if (setsError) throw setsError
  }

  return inserted
}

/**
 * Create a routine with its exercises and sets. If any step after the routine
 * insert fails, the routine is deleted (cascading to its children) and the
 * error is rethrown.
 */
export async function createRoutineWithTemplate(
  userId: string,
  meta: RoutineTemplateMeta,
  exercises: RoutineTemplateExercise[],
): Promise<{ routine: WorkoutRoutine; exercises: InsertedRoutineExercise[] }> {
  const { data: routine, error: routineError } = await supabase
    .from('workout_routines')
    .insert({ user_id: userId, ...meta })
    .select()
    .single()

  if (routineError) throw routineError

  const createdRoutine = routine as WorkoutRoutine

  try {
    const inserted = await insertTemplateRows(
      createdRoutine.id,
      exercises,
      0,
      [],
    )
    return { routine: createdRoutine, exercises: inserted }
  } catch (error) {
    await bestEffortDelete('workout_routines', [createdRoutine.id])
    throw error
  }
}

/**
 * Replace a routine's exercises and sets.
 *
 * There is no transaction available, so this stages the new template before
 * removing the old one: new exercise rows are inserted at order indexes
 * shifted clear of both the existing rows and the final positions (the table
 * has a unique (routine_id, order_index) constraint), their sets are
 * inserted, the old exercise rows are deleted (sets cascade), and finally the
 * new rows are renumbered to their real order_index.
 *
 * - Failure before the old rows are deleted removes the staged rows and leaves
 *   the routine as it was.
 * - Failure while renumbering is logged and not thrown: the new template is
 *   saved and its relative order is correct (every reader sorts by
 *   order_index); only the absolute indexes stay shifted.
 */
export async function replaceRoutineTemplate(
  routineId: string,
  exercises: RoutineTemplateExercise[],
): Promise<{ exercises: InsertedRoutineExercise[] }> {
  const { data: existing, error: existingError } = await supabase
    .from('workout_routine_exercises')
    .select('id, order_index')
    .eq('routine_id', routineId)

  if (existingError) throw existingError

  const existingRows = (existing ?? []) as InsertedRoutineExercise[]
  const existingIds = existingRows.map((row) => row.id)
  const maxExistingOrder = existingRows.reduce(
    (max, row) => Math.max(max, row.order_index),
    -1,
  )
  const maxNewOrder = exercises.reduce(
    (max, exercise) => Math.max(max, exercise.order_index),
    -1,
  )
  const offset = Math.max(maxExistingOrder + 1, maxNewOrder + 1)

  const stagedIds: string[] = []
  let staged: InsertedRoutineExercise[]
  try {
    staged = await insertTemplateRows(routineId, exercises, offset, stagedIds)

    if (existingIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('workout_routine_exercises')
        .delete()
        .in('id', existingIds)
      if (deleteError) throw deleteError
    }
  } catch (error) {
    await bestEffortDelete('workout_routine_exercises', stagedIds)
    throw error
  }

  // Renumber in ascending order, one at a time, stopping at the first failure.
  // Renumbered rows land below `offset` and the rest stay above it in their
  // original order, so a partial failure never changes the relative order.
  const rows = [...staged].sort((a, b) => a.order_index - b.order_index)
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const finalOrder = row.order_index - offset
    const { error } = await supabase
      .from('workout_routine_exercises')
      .update({ order_index: finalOrder })
      .eq('id', row.id)
    if (error) {
      console.error(
        '[routine-template] Failed to renumber replaced routine exercises',
        { routineId, renumbered: index, total: rows.length, error },
      )
      break
    }
    rows[index] = { id: row.id, order_index: finalOrder }
  }

  return { exercises: rows }
}

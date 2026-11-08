/**
 * Pure business rules for saving the edit-workout screen.
 *
 * buildWorkoutEditPlan turns the screen's edit state into a description of the
 * writes to perform; applyWorkoutEditPlan (lib/workout-edit-apply.ts) performs
 * them. Keep this module free of runtime imports so it stays unit-testable.
 */

import { parseDurationInput } from '@/lib/exercise-logging-mode'

export interface WorkoutSessionUpdate {
  type?: string | null
  notes?: string | null
  image_url?: string | null
  date?: string
  duration?: number | null
}

export interface WorkoutSetUpdate {
  reps?: number | null
  weight?: number | null
  duration_seconds?: number | null
}

/** Raw text the user typed into a set row. Absent fields were not edited. */
export interface EditedSetValues {
  reps?: string
  weight?: string
  duration_seconds?: string
}

export interface WorkoutEditOriginal {
  id: string
  /** Owner id passed to the ownership-checked session update. */
  userId: string
  image_url?: string | null
  /** Exercises in their current on-screen order (including reorders). */
  workout_exercises?: readonly { id: string }[] | null
}

export interface WorkoutEditState {
  title: string
  notes: string
  imageDeleted: boolean
  editedImageUrl: string | null
  date: Date | null
  durationHours: string
  durationMinutes: string
  durationSeconds: string
  deletedExerciseIds: ReadonlySet<string>
  deletedSetIds: ReadonlySet<string>
  /** workoutExerciseId -> replacement exerciseId */
  editedExercises: Readonly<Record<string, string>>
  /** setId -> raw edited values */
  editedSets: Readonly<Record<string, EditedSetValues>>
}

export interface WorkoutEditPlanOptions {
  /** Convert a weight typed in the user's preferred unit to kg. */
  toKg: (value: number | null | undefined) => number | null
}

export interface WorkoutEditPlan {
  workoutId: string
  userId: string
  sessionUpdate: WorkoutSessionUpdate
  /** Storage URL of the previous image to delete, if it was replaced/removed. */
  deleteImageUrl: string | null
  deleteExerciseIds: string[]
  deleteSetIds: string[]
  exerciseSwaps: { workoutExerciseId: string; exerciseId: string }[]
  order: { workoutExerciseId: string; orderIndex: number }[]
  setUpdates: { setId: string; updates: WorkoutSetUpdate }[]
}

export function computeTotalDurationSeconds(
  hours: string,
  minutes: string,
  seconds: string,
): number | null {
  const total =
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0)
  return total > 0 ? total : null
}

export function buildSessionUpdate(
  original: Pick<WorkoutEditOriginal, 'image_url'>,
  edits: Pick<
    WorkoutEditState,
    | 'title'
    | 'notes'
    | 'imageDeleted'
    | 'editedImageUrl'
    | 'date'
    | 'durationHours'
    | 'durationMinutes'
    | 'durationSeconds'
  >,
): WorkoutSessionUpdate {
  const updates: WorkoutSessionUpdate = {}

  // Always update title and notes (including setting to null if cleared)
  updates.type = edits.title.trim() || null
  updates.notes = edits.notes.trim() || null

  // Image: explicitly null if deleted, otherwise only when a new one was picked
  if (edits.imageDeleted) {
    updates.image_url = null
  } else if (edits.editedImageUrl) {
    updates.image_url = edits.editedImageUrl
  }

  if (edits.date) {
    updates.date = edits.date.toISOString()
  }

  updates.duration = computeTotalDurationSeconds(
    edits.durationHours,
    edits.durationMinutes,
    edits.durationSeconds,
  )

  return updates
}

/**
 * Build the update payload for one edited set.
 *
 * Quirks preserved from the original screen:
 * - Blank reps produce `reps: undefined` (the key is present, so the set still
 *   counts as changed, but the column is never written and reps can't be
 *   cleared).
 * - Weight is not trimmed: '' clears it, anything parseFloat rejects is ignored.
 * - A positive duration nulls reps and weight; a blank/zero duration writes
 *   `duration_seconds: null` without touching reps/weight.
 *
 * Returns null when nothing should be written.
 */
export function buildSetUpdate(
  values: EditedSetValues,
  toKg: WorkoutEditPlanOptions['toKg'],
): WorkoutSetUpdate | null {
  const updates: WorkoutSetUpdate = {}

  if (values.reps !== undefined) {
    const parsed = values.reps.trim()
    if (parsed === '') {
      updates.reps = undefined
    } else {
      const reps = parseFloat(parsed)
      if (!isNaN(reps)) {
        updates.reps = reps
      }
    }
  }

  if (values.weight !== undefined) {
    const weight = values.weight === '' ? null : parseFloat(values.weight)
    if (weight === null || !isNaN(weight)) {
      updates.weight = weight !== null ? toKg(weight) : null
    }
  }

  if (values.duration_seconds !== undefined) {
    const duration = parseDurationInput(values.duration_seconds)
    updates.duration_seconds = duration
    if (duration !== null) {
      updates.reps = null
      updates.weight = null
    }
  }

  return Object.keys(updates).length > 0 ? updates : null
}

export function buildWorkoutEditPlan(
  original: WorkoutEditOriginal,
  edits: WorkoutEditState,
  { toKg }: WorkoutEditPlanOptions,
): WorkoutEditPlan {
  const deleteImageUrl =
    original.image_url &&
    (edits.imageDeleted ||
      (edits.editedImageUrl && edits.editedImageUrl !== original.image_url))
      ? original.image_url
      : null

  const exerciseSwaps = Object.entries(edits.editedExercises)
    .filter(([workoutExerciseId]) => !edits.deletedExerciseIds.has(workoutExerciseId))
    .map(([workoutExerciseId, exerciseId]) => ({ workoutExerciseId, exerciseId }))

  const order = (original.workout_exercises ?? [])
    .filter((we) => !edits.deletedExerciseIds.has(we.id))
    .map((we, orderIndex) => ({ workoutExerciseId: we.id, orderIndex }))

  const setUpdates: WorkoutEditPlan['setUpdates'] = []
  for (const [setId, values] of Object.entries(edits.editedSets)) {
    if (edits.deletedSetIds.has(setId)) continue
    const updates = buildSetUpdate(values, toKg)
    if (updates) setUpdates.push({ setId, updates })
  }

  return {
    workoutId: original.id,
    userId: original.userId,
    sessionUpdate: buildSessionUpdate(original, edits),
    deleteImageUrl,
    deleteExerciseIds: Array.from(edits.deletedExerciseIds),
    deleteSetIds: Array.from(edits.deletedSetIds),
    exerciseSwaps,
    order,
    setUpdates,
  }
}

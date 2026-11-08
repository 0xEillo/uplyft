import { database } from '@/lib/database'
import { deleteWorkoutImage } from '@/lib/utils/image-upload'
import type { WorkoutEditPlan } from '@/lib/workout-edit-plan'

/**
 * Perform the writes described by a WorkoutEditPlan.
 *
 * Phases run sequentially; writes inside a phase run in parallel. The first
 * failure rejects and later phases are skipped. Writes already made are not
 * rolled back (the save is not atomic).
 */
export async function applyWorkoutEditPlan(plan: WorkoutEditPlan): Promise<void> {
  // 1. Session fields (title, notes, image, date, duration)
  await database.workoutSessions.update(
    plan.workoutId,
    plan.userId,
    plan.sessionUpdate,
  )

  // Remove the previous image from storage if it was replaced or deleted
  if (plan.deleteImageUrl) {
    await deleteWorkoutImage(plan.deleteImageUrl)
  }

  // 2. Delete exercises (their sets cascade)
  await Promise.all(
    plan.deleteExerciseIds.map((id) => database.workoutExercises.delete(id)),
  )

  // 3. Delete sets
  await Promise.all(plan.deleteSetIds.map((id) => database.sets.delete(id)))

  // 4. Swap exercises
  await Promise.all(
    plan.exerciseSwaps.map(({ workoutExerciseId, exerciseId }) =>
      database.workoutExercises.update(workoutExerciseId, exerciseId),
    ),
  )

  // 5. Persist exercise order
  await Promise.all(
    plan.order.map(({ workoutExerciseId, orderIndex }) =>
      database.workoutExercises.updateOrder(workoutExerciseId, orderIndex),
    ),
  )

  // 6. Update edited sets
  await Promise.all(
    plan.setUpdates.map(({ setId, updates }) =>
      database.sets.update(setId, updates),
    ),
  )
}

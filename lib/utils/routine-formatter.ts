import { WorkoutRoutineWithDetails } from '@/types/database.types'

/**
 * Formats a workout routine into a text template for the workout notes input.
 * Creates a template where users just need to fill in their actual performance.
 *
 * Format:
 * - Exercise name with optional rep target in brackets
 * - Each set on a new line: "Set N: " with space for user to fill in
 * - Blank line between exercises
 *
 * Example output:
 * ```
 * Bench Press [Target: 8-12 reps]
 * Set 1:
 * Set 2:
 * Set 3:
 *
 * Incline DB Press [Target: 10 reps]
 * Set 1:
 * Set 2:
 * ```
 */
export function formatRoutineAsTemplate(
  routine: WorkoutRoutineWithDetails,
): string {
  const exercises = routine.workout_routine_exercises || []

  const formattedExercises = exercises
    .sort((a, b) => a.order_index - b.order_index)
    .map((exercise) => {
      const exerciseName = exercise.exercise?.name || 'Exercise'
      const sets = (exercise.sets || []).sort((a, b) => a.set_number - b.set_number)

      // Determine the target rep range for the header
      // Use the first set's rep range as the target (most routines have consistent reps per exercise)
      let targetText = ''
      if (sets.length > 0) {
        const firstSet = sets[0]
        if (firstSet.reps_min !== null && firstSet.reps_max !== null) {
          if (firstSet.reps_min === firstSet.reps_max) {
            // Exact reps
            targetText = ` [Target: ${firstSet.reps_min} reps]`
          } else {
            // Rep range
            targetText = ` [Target: ${firstSet.reps_min}-${firstSet.reps_max} reps]`
          }
        }
      }

      const header = `${exerciseName}${targetText}`
      const setLines = sets.map((_, index) => `Set ${index + 1}: `)

      return [header, ...setLines].join('\n')
    })

  return formattedExercises.join('\n\n')
}

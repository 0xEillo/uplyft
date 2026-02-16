
/**
 * Maps trackable exercises to SECONDARY muscle groups for multi-group contribution.
 * For example, squats hit Glutes heavily, so they should contribute to Glutes level.
 */
export const SECONDARY_EXERCISE_MUSCLE_MAPPING: Record<string, string> = {
  'Squat (Barbell)': 'Glutes',
  'Bulgarian Split Squat (Dumbbell)': 'Glutes',
  'Deadlift (Barbell)': 'Hamstrings', // Deadlifts also hit hams
  'Romanian Deadlift (Barbell)': 'Glutes', // RDLs also hit glutes
}

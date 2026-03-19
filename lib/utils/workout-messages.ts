import { getWeeklyCommitmentTarget } from '@/lib/commitment'

/**
 * Generates motivational messages based on weekly workout progress
 */

export interface WorkoutProgress {
  workoutNumber: number // 1st, 2nd, 3rd workout this week
  weeklyTarget: number // Target workouts per week
}

/**
 * Parse commitment value to numeric target
 * Supports both specific-day commitments and flexible weekly frequency.
 */
export function parseCommitment(
  commitment: string[] | null,
  commitmentFrequency?: string | null,
): number {
  return getWeeklyCommitmentTarget({
    commitment,
    commitment_frequency: commitmentFrequency,
  })
}

/**
 * Generate a motivational message based on workout progress
 */
export function generateWorkoutMessage(progress: WorkoutProgress): string {
  const { workoutNumber, weeklyTarget } = progress

  // First workout of the week
  if (workoutNumber === 1) {
    return 'First workout of the week!'
  }

  // Reached weekly target exactly
  if (workoutNumber === weeklyTarget) {
    return 'Weekly target complete!'
  }

  // Exceeded weekly target
  if (workoutNumber > weeklyTarget) {
    return 'Going above and beyond!'
  }

  // Progress toward target
  const percentComplete = (workoutNumber / weeklyTarget) * 100

  if (percentComplete >= 75) {
    return `Almost there!`
  }

  if (percentComplete >= 50) {
    return `Halfway there!`
  }

  // Default for early progress
  return `Keep it up!`
}

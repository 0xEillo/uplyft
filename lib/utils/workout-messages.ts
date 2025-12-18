/**
 * Generates motivational messages based on weekly workout progress
 */

export interface WorkoutProgress {
  workoutNumber: number // 1st, 2nd, 3rd workout this week
  weeklyTarget: number // Target workouts per week
}

/**
 * Parse commitment value to numeric target
 * Commitment is now an array of day strings like ['monday', 'wednesday', 'friday']
 */
export function parseCommitment(commitment: string[] | string | null): number {
  if (!commitment) return 3 // Default to 3x per week

  // Handle new array format (days of the week)
  if (Array.isArray(commitment)) {
    const validDays = commitment.filter(c => c !== 'not_sure')
    return validDays.length > 0 ? validDays.length : 3
  }

  // Handle legacy frequency format for backwards compatibility
  const commitmentMap: Record<string, number> = {
    '2_times': 2,
    '3_times': 3,
    '4_times': 4,
    '5_plus': 5,
  }

  return commitmentMap[commitment] || 3
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

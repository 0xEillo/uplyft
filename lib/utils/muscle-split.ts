import { WorkoutSessionWithDetails } from '@/types/database.types'
import { normalizeVolumeWeight } from './workout-stats'

export interface MuscleSplitData {
  muscleGroup: string
  volume: number
  percentage: number
}

/**
 * Calculate the muscle group distribution for a workout based on volume
 * Returns an array of muscle groups with their volume and percentage
 */
export function calculateMuscleSplit(
  workout: WorkoutSessionWithDetails,
): MuscleSplitData[] {
  if (!workout.workout_exercises || workout.workout_exercises.length === 0) {
    return []
  }

  // Calculate volume per muscle group
  const muscleGroupVolumes = new Map<string, number>()
  let totalVolume = 0

  workout.workout_exercises.forEach((workoutExercise) => {
    const muscleGroup = workoutExercise.exercise?.muscle_group
    if (!muscleGroup || muscleGroup === 'Cardio') return // Skip cardio

    // Calculate volume for this exercise
    const exerciseVolume = workoutExercise.sets.reduce((sum, set) => {
      const reps = set.reps || 0
      if (!reps) return sum

      return sum + normalizeVolumeWeight(set.weight) * reps
    }, 0)

    // Add to muscle group total
    const currentVolume = muscleGroupVolumes.get(muscleGroup) || 0
    muscleGroupVolumes.set(muscleGroup, currentVolume + exerciseVolume)
    totalVolume += exerciseVolume
  })

  // Convert to array and calculate percentages
  const muscleSplitData: MuscleSplitData[] = Array.from(
    muscleGroupVolumes.entries(),
  ).map(([muscleGroup, volume]) => ({
    muscleGroup,
    volume,
    percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
  }))

  // Sort by percentage descending
  return muscleSplitData.sort((a, b) => b.percentage - a.percentage)
}

/**
 * Group similar muscle groups for cleaner display
 * e.g., Biceps + Triceps = Arms, Quads + Hamstrings + Calves = Legs
 */
export function calculateMuscleSplitGrouped(
  workout: WorkoutSessionWithDetails,
): MuscleSplitData[] {
  const detailedSplit = calculateMuscleSplit(workout)

  const groupedVolumes = new Map<string, number>()
  let totalVolume = 0

  detailedSplit.forEach(({ muscleGroup, volume }) => {
    let groupName = muscleGroup

    // Group related muscle groups
    if (muscleGroup === 'Biceps' || muscleGroup === 'Triceps') {
      groupName = 'Arms'
    } else if (
      muscleGroup === 'Quads' ||
      muscleGroup === 'Hamstrings' ||
      muscleGroup === 'Calves'
    ) {
      groupName = 'Legs'
    }

    const currentVolume = groupedVolumes.get(groupName) || 0
    groupedVolumes.set(groupName, currentVolume + volume)
    totalVolume += volume
  })

  // Convert to array and calculate percentages
  const groupedSplitData: MuscleSplitData[] = Array.from(
    groupedVolumes.entries(),
  ).map(([muscleGroup, volume]) => ({
    muscleGroup,
    volume,
    percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
  }))

  // Sort by percentage descending
  return groupedSplitData.sort((a, b) => b.percentage - a.percentage)
}

/**
 * Get a formatted string of the main muscle groups trained (for workout title)
 * e.g., "Shoulders, Arms, Core"
 */
export function getWorkoutMuscleGroups(
  workout: WorkoutSessionWithDetails,
  limit: number = 3,
): string {
  const split = calculateMuscleSplitGrouped(workout)
  const topGroups = split.slice(0, limit).map((s) => s.muscleGroup)

  if (topGroups.length === 0) {
    return 'Workout'
  }

  return topGroups.join(', ')
}

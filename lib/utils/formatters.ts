import { WorkoutSessionWithDetails } from '@/types/database.types'

export interface ExerciseDisplay {
  name: string
  sets: number
  reps: string
  weight: string
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

export function formatWorkoutForDisplay(
  workout: WorkoutSessionWithDetails,
): ExerciseDisplay[] {
  if (!workout.workout_exercises || workout.workout_exercises.length === 0) {
    return []
  }

  return workout.workout_exercises.map((we) => {
    const exercise = we.exercise
    const sets = we.sets || []

    if (sets.length === 0) {
      return {
        name: exercise.name,
        sets: 0,
        reps: '-',
        weight: '-',
      }
    }

    // Format reps
    const allSameReps = sets.every((s) => s.reps === sets[0].reps)
    const repsDisplay = allSameReps
      ? `${sets.length}×${sets[0].reps}` // e.g., "5×5"
      : sets.map((s) => s.reps).join(', ') // e.g., "10, 8, 6"

    // Format weight
    const weights = sets
      .map((s) => s.weight)
      .filter((w): w is number => w !== null)

    let weightDisplay: string
    if (weights.length === 0) {
      weightDisplay = 'BW' // Bodyweight
    } else {
      const allSameWeight = weights.every((w) => w === weights[0])
      if (allSameWeight) {
        weightDisplay = `${weights[0]} lbs`
      } else {
        const minWeight = Math.min(...weights)
        const maxWeight = Math.max(...weights)
        weightDisplay = `${minWeight}-${maxWeight} lbs`
      }
    }

    return {
      name: exercise.name,
      sets: sets.length,
      reps: repsDisplay,
      weight: weightDisplay,
    }
  })
}

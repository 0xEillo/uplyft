import { WeightUnit, kgToPreferred } from '@/contexts/unit-context'
import { WorkoutSessionWithDetails } from '@/types/database.types'

export interface ExerciseDisplay {
  name: string
  sets: number
  reps: string
  weight: string
  hasVariedSets: boolean
  setDetails?: {
    reps: number | null
    weight: number | null
  }[]
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
  unit: WeightUnit,
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
        hasVariedSets: false,
      }
    }

    // Check if sets are varied (different reps or weights)
    const allSameReps = sets.every((s) => s.reps === sets[0].reps)
    const weights = sets
      .map((s) => s.weight)
      .filter((w): w is number => w !== null)
    const allSameWeight =
      weights.length === 0 || weights.every((w) => w === weights[0])
    const hasVariedSets = !allSameReps || !allSameWeight

    // Format reps
    let repsDisplay: string
    if (allSameReps) {
      repsDisplay = sets[0].reps != null ? `${sets[0].reps}` : '--'
    } else {
      repsDisplay = sets.some((s) => s.reps == null) ? '--' : '...'
    }

    // Format weight
    let weightDisplay: string
    if (weights.length === 0) {
      weightDisplay = 'BW' // Bodyweight
    } else if (allSameWeight) {
      const converted = kgToPreferred(weights[0], unit)
      weightDisplay = `${converted.toFixed(unit === 'kg' ? 1 : 0)}`
    } else {
      weightDisplay = '...'
    }

    return {
      name: exercise.name,
      sets: sets.length,
      reps: repsDisplay,
      weight: weightDisplay,
      hasVariedSets,
      setDetails: sets.map((s) => ({
        reps: s.reps,
        weight: s.weight !== null ? kgToPreferred(s.weight, unit) : null,
      })),
    }
  })
}

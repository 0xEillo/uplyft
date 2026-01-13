import { WeightUnit, kgToPreferred } from '@/contexts/unit-context'
import { WorkoutSessionWithDetails } from '@/types/database.types'

export interface ExerciseDisplay {
  id: string // exercise ID for navigation
  name: string
  gifUrl?: string | null
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

/**
 * Normalizes exercise names to title case (each word starts with capital letter)
 * Examples: "leg press" -> "Leg Press", "bench press" -> "Bench Press"
 */
export function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      // Handle hyphenated words (e.g., "push-ups" -> "Push-ups")
      if (word.includes('-')) {
        return word
          .split('-')
          .map(
            (part) =>
              part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
          )
          .join('-')
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

export function formatWorkoutForDisplay(
  workout: WorkoutSessionWithDetails,
  unit: WeightUnit,
): ExerciseDisplay[] {
  if (!workout.workout_exercises || workout.workout_exercises.length === 0) {
    return []
  }

  // Sort by order_index to preserve the original exercise order from the notepad
  const sortedExercises = [...workout.workout_exercises]
    .filter((we) => we.exercise !== null)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))

  return sortedExercises.map((we) => {
      const exercise = we.exercise!
      const sets = we.sets || []

      if (sets.length === 0) {
        return {
          id: exercise.id,
          name: exercise.name,
          gifUrl: exercise.gif_url,
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
        id: exercise.id,
        name: exercise.name,
        gifUrl: exercise.gif_url,
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

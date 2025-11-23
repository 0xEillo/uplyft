import { WorkoutSessionWithDetails } from '@/types/database.types'

const BODYWEIGHT_VOLUME_FALLBACK_KG = 1

export interface WorkoutStats {
  totalVolume: number // in kg
  totalSets: number
  totalReps: number
  durationSeconds: number
  exerciseCount: number
  prCount: number
  topWeight: number
  uniqueMuscleGroups: string[]
}

/**
 * Calculate total volume lifted in a workout (in kg)
 * Note: All weights are stored in kg internally, regardless of user's display preference.
 * The weightUnit parameter is only used for the calculation context and is not applied
 * to the stored weights. Use formatVolume() to convert the result for display.
 */
export function normalizeVolumeWeight(weight?: number | null): number {
  return typeof weight === 'number' && weight > 0
    ? weight
    : BODYWEIGHT_VOLUME_FALLBACK_KG
}

export function calculateTotalVolume(
  workout: WorkoutSessionWithDetails,
  weightUnit: 'kg' | 'lb' = 'kg',
): number {
  if (!workout.workout_exercises) return 0

  let totalVolume = 0

  workout.workout_exercises.forEach((exercise) => {
    exercise.sets?.forEach((set) => {
      const reps = set.reps || 0
      if (!reps) return

      const weight = normalizeVolumeWeight(set.weight)

      // Volume calculation: weight (kg) × reps
      totalVolume += weight * reps
    })
  })

  return Math.round(totalVolume)
}

/**
 * Calculate workout statistics
 */
export function calculateWorkoutStats(
  workout: WorkoutSessionWithDetails,
  weightUnit: 'kg' | 'lb' = 'kg',
): WorkoutStats {
  const exercises = workout.workout_exercises || []

  let totalSets = 0
  let totalReps = 0
  let prCount = 0
  let topWeight = 0
  const muscleGroups = new Set<string>()

  exercises.forEach((exercise) => {
    // Track muscle groups
    if (exercise.exercise?.muscle_group) {
      muscleGroups.add(exercise.exercise.muscle_group)
    }

    // Count sets and reps
    exercise.sets?.forEach((set) => {
      totalSets++
      totalReps += set.reps || 0

      // Track top weight
      const weight = set.weight || 0
      const weightInKg = weightUnit === 'lb' ? weight * 0.453592 : weight
      if (weightInKg > topWeight) {
        topWeight = weightInKg
      }
    })

    // Count PRs (if exercise has PR info)
    if ((exercise.exercise as any)?.pr_info?.is_current_pr) {
      prCount++
    }
  })

  const totalVolume = calculateTotalVolume(workout, weightUnit)

  const trackedDurationSeconds =
    typeof workout.duration === 'number' ? workout.duration : null

  // Estimate duration (if not tracked, estimate 3 mins per set + 2 mins warmup)
  const estimatedDurationSeconds = Math.max(
    0,
    Math.round(totalSets * 3 + 2) * 60,
  )
  const durationSeconds = trackedDurationSeconds ?? estimatedDurationSeconds

  if (trackedDurationSeconds === null) {
    console.log(
      'Workout duration not tracked, using estimation:',
      estimatedDurationSeconds,
      'seconds for',
      totalSets,
      'sets. workout.duration =',
      workout.duration,
    )
  }

  return {
    totalVolume,
    totalSets,
    totalReps,
    durationSeconds,
    exerciseCount: exercises.length,
    prCount,
    topWeight: Math.round(topWeight),
    uniqueMuscleGroups: Array.from(muscleGroups),
  }
}

/**
 * Format volume for display (handles kg/lb conversion)
 */
export function formatVolume(
  volumeKg: number,
  targetUnit: 'kg' | 'lb' = 'kg',
): { value: number; unit: string } {
  if (targetUnit === 'lb') {
    return {
      value: Math.round(volumeKg * 2.20462),
      unit: 'lb',
    }
  }
  return {
    value: Math.round(volumeKg),
    unit: 'kg',
  }
}

/**
 * Format duration (seconds) to readable string
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}m`
  }

  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Calculate workout count for the current week
 */
export function getWorkoutCountThisWeek(
  workouts: WorkoutSessionWithDetails[],
): number {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
  startOfWeek.setHours(0, 0, 0, 0)

  return workouts.filter((workout) => {
    const workoutDate = new Date(workout.date)
    return workoutDate >= startOfWeek
  }).length
}

/**
 * Exercise History Service
 *
 * Provides cached access to a user's last performance data for exercises.
 * Used to populate placeholders when adding exercises to structured workouts.
 *
 * Standard workout tracker approach:
 * - Show last weight/reps for each set number
 * - Cache results to avoid redundant queries during a session
 * - Match by exercise name (case-insensitive) for robustness
 */

import { estimateOneRepMaxKg } from '@/lib/strength-progress'
import { supabase } from '@/lib/supabase'

// =============================================================================
// TYPES
// =============================================================================

export interface SetPerformance {
  setNumber: number
  weight: number | null
  reps: number | null
}

export interface ExerciseLastPerformance {
  exerciseName: string
  date: string
  sets: SetPerformance[]
}

/**
 * All-time historical bests for an exercise, scanned across every logged set
 * (warm-ups excluded). Weights are in kg (raw DB units); conversion to the
 * user's preferred unit happens at the UI layer.
 *
 * Used to power live in-workout PR detection — the three categories mirror
 * `PrService` exactly so the in-workout trophy matches the post-workout PR.
 */
export interface ExerciseHistoricalBests {
  best1RMKg: number
  maxWeightKg: number
  maxSetVolumeKg: number
}

/** Supabase query result shape for workout sets */
interface WorkoutSetRow {
  set_number: number
  weight: number | null
  reps: number | null
}

/** Supabase query result shape for workout exercises */
interface WorkoutExerciseRow {
  exercise: { name: string } | null
  sets: WorkoutSetRow[] | null
}

/** Supabase query result shape for workout sessions */
interface WorkoutSessionRow {
  date: string
  workout_exercises: WorkoutExerciseRow[] | null
}

// =============================================================================
// CACHE
// =============================================================================

/**
 * In-memory cache for exercise history.
 * Key format: `${userId}:${normalizedExerciseName}`
 * 
 * Note: This cache persists for the app session. It's cleared when:
 * - The user posts a new workout (via clearExerciseHistoryCache)
 * - The app is restarted
 */
const performanceCache = new Map<string, ExerciseLastPerformance | null>()

/** In-flight last-performance requests, so concurrent callers share one query. */
const performanceInflight = new Map<
  string,
  Promise<ExerciseLastPerformance | null>
>()

/** Cache for historical-bests lookups. */
const historicalBestsCache = new Map<string, ExerciseHistoricalBests | null>()

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Generate a cache key for an exercise lookup.
 */
function getCacheKey(userId: string, exerciseName: string): string {
  return `${userId}:${exerciseName.toLowerCase().trim()}`
}

/**
 * Transform database rows into our SetPerformance interface.
 */
function transformSetsFromDatabase(sets: WorkoutSetRow[]): SetPerformance[] {
  return sets
    .slice() // Create a copy to avoid mutating the original
    .sort((a, b) => a.set_number - b.set_number)
    .map((set) => ({
      setNumber: set.set_number,
      weight: set.weight,
      reps: set.reps,
    }))
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Fetch the user's last performance for a specific exercise.
 * Returns the most recent workout session's sets for that exercise.
 *
 * Results are cached to avoid redundant database queries.
 *
 * @param userId - The user's ID
 * @param exerciseName - Name of the exercise (case-insensitive)
 * @param skipCache - Force a fresh fetch, bypassing cache
 * @returns The last performance data, or null if no history exists
 *
 * @example
 * const history = await getLastPerformanceForExercise(userId, 'Bench Press')
 * // history.sets[0] = { setNumber: 1, weight: 135, reps: 8 }
 */
export async function getLastPerformanceForExercise(
  userId: string,
  exerciseName: string,
  skipCache = false,
): Promise<ExerciseLastPerformance | null> {
  const cacheKey = getCacheKey(userId, exerciseName)

  // Check cache first
  if (!skipCache && performanceCache.has(cacheKey)) {
    return performanceCache.get(cacheKey) ?? null
  }

  const pending = performanceInflight.get(cacheKey)
  if (!skipCache && pending) {
    return pending
  }

  const request = fetchLastPerformance(userId, exerciseName, cacheKey)
  performanceInflight.set(cacheKey, request)
  try {
    return await request
  } finally {
    if (performanceInflight.get(cacheKey) === request) {
      performanceInflight.delete(cacheKey)
    }
  }
}

/**
 * Synchronously read a cached last performance. Returns `undefined` when the
 * exercise hasn't been fetched yet (vs `null` = fetched, no history).
 */
export function peekLastPerformanceForExercise(
  userId: string,
  exerciseName: string,
): ExerciseLastPerformance | null | undefined {
  const cacheKey = getCacheKey(userId, exerciseName)
  if (!performanceCache.has(cacheKey)) return undefined
  return performanceCache.get(cacheKey) ?? null
}

/**
 * Fire-and-forget warm-up of the last-performance cache (e.g. as soon as an
 * exercise is picked, before it is actually added to the workout).
 */
export function prefetchLastPerformanceForExercise(
  userId: string,
  exerciseName: string,
): void {
  void getLastPerformanceForExercise(userId, exerciseName)
}

async function fetchLastPerformance(
  userId: string,
  exerciseName: string,
  cacheKey: string,
): Promise<ExerciseLastPerformance | null> {
  try {
    // Query the most recent workout session containing this exercise
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `
        date,
        workout_exercises!inner (
          exercise:exercises!inner (name),
          sets (
            set_number,
            weight,
            reps
          )
        )
      `,
      )
      .eq('user_id', userId)
      .ilike('workout_exercises.exercise.name', exerciseName.trim())
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // PGRST116 = No rows returned (not an error for us)
      if (error.code === 'PGRST116') {
        performanceCache.set(cacheKey, null)
        return null
      }
      throw error
    }

    // Supabase returns a complex nested structure - use unknown for safe casting
    const session = data as unknown as WorkoutSessionRow | null

    if (!session?.workout_exercises?.[0]?.sets) {
      performanceCache.set(cacheKey, null)
      return null
    }

    // Extract and transform the sets
    const workoutExercise = session.workout_exercises[0]
    const sets = transformSetsFromDatabase(workoutExercise.sets || [])

    const result: ExerciseLastPerformance = {
      exerciseName: workoutExercise.exercise?.name || exerciseName,
      date: session.date,
      sets,
    }

    // Cache the result
    performanceCache.set(cacheKey, result)

    return result
  } catch (error) {
    console.error(
      '[exerciseHistoryService] Error fetching last performance:',
      error,
    )
    // Don't cache errors - allow retry on next request
    return null
  }
}

/**
 * Get a specific set's performance from an exercise's history.
 * Convenience wrapper around getLastPerformanceForExercise.
 *
 * @param userId - The user's ID
 * @param exerciseName - Name of the exercise
 * @param setNumber - The set number to find (1-indexed)
 * @returns The set performance, or null if not found
 */
export async function getSetPerformance(
  userId: string,
  exerciseName: string,
  setNumber: number,
): Promise<SetPerformance | null> {
  const history = await getLastPerformanceForExercise(userId, exerciseName)

  if (!history) return null

  return history.sets.find((s) => s.setNumber === setNumber) ?? null
}

/**
 * Fetch the user's all-time historical bests for an exercise: best estimated
 * 1RM, heaviest single weight, and best single-set volume. Warm-up sets are
 * excluded (they should never count toward PRs).
 *
 * Mirrors the three PR categories in `PrService` so the in-workout trophy
 * agrees with the post-workout PR badges. Cached in-memory for the session.
 */
export async function getHistoricalBestsForExercise(
  userId: string,
  exerciseName: string,
  skipCache = false,
): Promise<ExerciseHistoricalBests | null> {
  const cacheKey = getCacheKey(userId, exerciseName)

  if (!skipCache && historicalBestsCache.has(cacheKey)) {
    return historicalBestsCache.get(cacheKey) ?? null
  }

  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `
        workout_exercises!inner (
          exercise:exercises!inner (name),
          sets (
            weight,
            reps,
            is_warmup
          )
        )
      `,
      )
      .eq('user_id', userId)
      .ilike('workout_exercises.exercise.name', exerciseName.trim())

    if (error) {
      if (error.code === 'PGRST116') {
        historicalBestsCache.set(cacheKey, null)
        return null
      }
      throw error
    }

    interface BestsRow {
      workout_exercises?: {
        // Supabase can sometimes resolve joined single-rows as arrays; we
        // don't read `exercise` here, but the nested sets are what we need.
        sets?: {
          weight: number | null
          reps: number | null
          is_warmup?: boolean | null
        }[]
      }[]
    }

    let best1RMKg = 0
    let maxWeightKg = 0
    let maxSetVolumeKg = 0

    ;(data as unknown as BestsRow[] | null)?.forEach((session) => {
      session.workout_exercises?.forEach((we) => {
        we.sets?.forEach((s) => {
          if (s.is_warmup === true) return
          if (typeof s.weight !== 'number' || s.weight <= 0) return
          if (typeof s.reps !== 'number' || s.reps <= 0) return

          const oneRm = estimateOneRepMaxKg(s.weight, s.reps)
          if (oneRm > best1RMKg) best1RMKg = oneRm

          if (s.weight > maxWeightKg) maxWeightKg = s.weight

          const volume = s.weight * s.reps
          if (volume > maxSetVolumeKg) maxSetVolumeKg = volume
        })
      })
    })

    if (best1RMKg <= 0 && maxWeightKg <= 0 && maxSetVolumeKg <= 0) {
      historicalBestsCache.set(cacheKey, null)
      return null
    }

    const result: ExerciseHistoricalBests = {
      best1RMKg,
      maxWeightKg,
      maxSetVolumeKg,
    }
    historicalBestsCache.set(cacheKey, result)
    return result
  } catch (err) {
    console.error(
      '[exerciseHistoryService] Error fetching historical bests:',
      err,
    )
    return null
  }
}


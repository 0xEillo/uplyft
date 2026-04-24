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
 * Normalize exercise name for consistent matching.
 */
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim()
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
 * Batch fetch last performance for multiple exercises.
 * More efficient than individual calls when adding multiple exercises.
 *
 * @param userId - The user's ID
 * @param exerciseNames - Array of exercise names
 * @returns Map of exercise name (lowercase) to performance data
 */
export async function getLastPerformanceForExercises(
  userId: string,
  exerciseNames: string[],
): Promise<Map<string, ExerciseLastPerformance | null>> {
  const results = new Map<string, ExerciseLastPerformance | null>()

  // Separate cached from uncached exercises
  const uncachedNames: string[] = []

  for (const name of exerciseNames) {
    const cacheKey = getCacheKey(userId, name)
    if (performanceCache.has(cacheKey)) {
      results.set(
        normalizeExerciseName(name),
        performanceCache.get(cacheKey) ?? null,
      )
    } else {
      uncachedNames.push(name)
    }
  }

  // Fetch uncached exercises in parallel
  if (uncachedNames.length > 0) {
    const fetchPromises = uncachedNames.map(async (name) => {
      const result = await getLastPerformanceForExercise(userId, name)
      return { name: normalizeExerciseName(name), result }
    })

    const fetchResults = await Promise.all(fetchPromises)
    for (const { name, result } of fetchResults) {
      results.set(name, result)
    }
  }

  return results
}

/**
 * Clear the entire exercise history cache.
 * Call this when a user posts a new workout to ensure fresh data.
 */
export function clearExerciseHistoryCache(): void {
  performanceCache.clear()
  historicalBestsCache.clear()
}

/**
 * Clear cache for a specific exercise.
 * Useful for targeted cache invalidation.
 *
 * @param userId - The user's ID
 * @param exerciseName - Name of the exercise to clear
 */
export function clearExerciseCacheEntry(
  userId: string,
  exerciseName: string,
): void {
  const cacheKey = getCacheKey(userId, exerciseName)
  performanceCache.delete(cacheKey)
  historicalBestsCache.delete(cacheKey)
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

/**
 * Preload exercise history for frequently used exercises.
 * Call this on screen mount to improve UX by having data ready.
 *
 * This function fires off requests without awaiting them.
 * Results populate the cache in the background.
 *
 * @param userId - The user's ID
 * @param exerciseNames - Array of exercise names to preload
 */
export function preloadExerciseHistory(
  userId: string,
  exerciseNames: string[],
): void {
  for (const name of exerciseNames) {
    const cacheKey = getCacheKey(userId, name)
    if (!performanceCache.has(cacheKey)) {
      // Fire and forget - errors are logged but don't bubble up
      getLastPerformanceForExercise(userId, name).catch((err) => {
        console.warn('[exerciseHistoryService] Preload failed for', name, err)
      })
    }
  }
}

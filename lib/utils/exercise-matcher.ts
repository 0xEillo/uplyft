/**
 * Exercise Matcher Utilities
 *
 * This module provides exercise matching functionality using the centralized
 * exerciseLookup service. All lookups are from the database (cached).
 *
 * @deprecated Direct usage of findExerciseByName should migrate to using
 * exerciseLookup service. This file is kept for backward compatibility.
 */
import {
    exerciseLookup,
    ExerciseLookupResult,
} from '@/lib/services/exerciseLookup'

/**
 * @deprecated Use ExerciseLookupResult from exerciseLookup service
 */
export type ExerciseMatch = ExerciseLookupResult

/**
 * Find an exercise by name using fuzzy matching.
 * Returns exercise ID, name, and GIF URL if found.
 *
 * NOTE: This requires exerciseLookup to be initialized first.
 * Call exerciseLookup.initialize() early in the app lifecycle.
 *
 * @param name - The exercise name to search for
 * @returns ExerciseMatch or null if not found
 */
export function findExerciseByName(name: string): ExerciseMatch | null {
  return exerciseLookup.findByName(name)
}

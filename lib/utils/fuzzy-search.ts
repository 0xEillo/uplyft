/**
 * Fuzzy search utility for exercises using Fuse.js
 *
 * Features:
 * - Typo tolerance: "Dumbell" → "Dumbbell"
 * - Plural handling: "Bicep" → "Biceps"
 * - Word order independence: "curl bicep" → "Bicep Curl"
 */
import Fuse, { IFuseOptions } from 'fuse.js'

import { Exercise } from '@/types/database.types'

// Fuse.js options tuned for exercise names
const FUSE_OPTIONS: IFuseOptions<Exercise> = {
  keys: [
    { name: 'name', weight: 1.0 },
    { name: 'muscle_group', weight: 0.3 },
    { name: 'equipment', weight: 0.2 },
  ],
  threshold: 0.4, // 0 = exact match, 1 = match anything. 0.4 is a good balance
  distance: 100, // How far to search for fuzzy matches within the string
  ignoreLocation: true, // Don't penalize matches that appear later in the string
  minMatchCharLength: 2, // Minimum characters before fuzzy matching kicks in
  shouldSort: true, // Sort by relevance
  includeScore: true, // Include match score in results
}

// Cache for Fuse instances to avoid recreating on every search
let fuseInstance: Fuse<Exercise> | null = null
let cachedExercises: Exercise[] | null = null

/**
 * Create or get cached Fuse instance
 */
function getFuseInstance(exercises: Exercise[]): Fuse<Exercise> {
  // Recreate if exercises changed
  if (fuseInstance && cachedExercises === exercises) {
    return fuseInstance
  }

  fuseInstance = new Fuse(exercises, FUSE_OPTIONS)
  cachedExercises = exercises
  return fuseInstance
}

/**
 * Filter and sort exercises by fuzzy match relevance
 *
 * @param exercises - Array of exercises to search
 * @param query - Search query (will be trimmed and lowercased)
 * @returns Filtered and sorted exercises by relevance
 */
export function fuzzySearchExercises(
  exercises: Exercise[],
  query: string,
): Exercise[] {
  const trimmedQuery = query.trim()

  // Empty query returns all exercises
  if (!trimmedQuery) {
    return exercises
  }

  // For very short queries (1-2 chars), use simple prefix matching for speed
  if (trimmedQuery.length <= 2) {
    const lowerQuery = trimmedQuery.toLowerCase()
    return exercises.filter((e) =>
      e.name.toLowerCase().startsWith(lowerQuery),
    )
  }

  const fuse = getFuseInstance(exercises)
  const results = fuse.search(trimmedQuery)

  // Extract exercises from Fuse results
  return results.map((result) => result.item)
}

/**
 * Check if a query has any fuzzy matches in the exercise list
 */
export function hasExactOrFuzzyMatch(
  exercises: Exercise[],
  query: string,
): boolean {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) return false

  // Check for exact match first
  const hasExact = exercises.some(
    (e) => e.name.toLowerCase() === trimmedQuery,
  )
  if (hasExact) return true

  // Check for fuzzy match
  const fuse = getFuseInstance(exercises)
  const results = fuse.search(trimmedQuery, { limit: 1 })
  return results.length > 0 && (results[0].score ?? 1) < 0.3
}

/**
 * Clear the Fuse cache (call when exercises list is updated)
 */
export function clearFuseCache(): void {
  fuseInstance = null
  cachedExercises = null
}

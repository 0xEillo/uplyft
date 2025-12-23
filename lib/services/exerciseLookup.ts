/**
 * Centralized Exercise Lookup Service
 *
 * This service provides a standardized way to look up exercises from the database.
 * It maintains an in-memory cache that is populated on first use and can be refreshed.
 *
 * Usage:
 *   - Call `await exerciseLookup.initialize()` early in the app lifecycle
 *   - Use `exerciseLookup.findByName(name)` to get an exercise by name
 *   - Use `exerciseLookup.getAll()` to get all cached exercises
 */
import Fuse, { IFuseOptions } from 'fuse.js'

import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'

// Fuse.js options for fuzzy matching exercise names
const FUSE_OPTIONS: IFuseOptions<Exercise> = {
  keys: [
    { name: 'name', weight: 1.0 },
    { name: 'aliases', weight: 0.8 },
  ],
  threshold: 0.3, // Lower threshold = stricter matching
  distance: 100,
  ignoreLocation: true,
  minMatchCharLength: 2,
  shouldSort: true,
  includeScore: true,
}

// In-memory cache
let cachedExercises: Exercise[] = []
let exerciseNameMap: Map<string, Exercise> = new Map()
let fuseInstance: Fuse<Exercise> | null = null
let isInitialized = false
let initPromise: Promise<void> | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let lastFetchTime = 0

/**
 * Result type for exercise lookups
 */
export interface ExerciseLookupResult {
  id: string
  name: string
  gifUrl: string | null
  muscleGroup: string | null
  equipment: string | null
}

/**
 * Convert database Exercise to lookup result format
 */
function toResult(exercise: Exercise): ExerciseLookupResult {
  return {
    id: exercise.id,
    name: exercise.name,
    gifUrl: exercise.gif_url ?? null,
    muscleGroup: exercise.muscle_group ?? null,
    equipment: exercise.equipment ?? null,
  }
}

/**
 * Build internal caches from exercise list
 */
function buildCaches(exercises: Exercise[]): void {
  cachedExercises = exercises
  exerciseNameMap = new Map()

  for (const exercise of exercises) {
    // Add by normalized name
    exerciseNameMap.set(exercise.name.toLowerCase().trim(), exercise)

    // Also add aliases if they exist
    if (exercise.aliases && Array.isArray(exercise.aliases)) {
      for (const alias of exercise.aliases) {
        if (typeof alias === 'string' && alias.trim()) {
          exerciseNameMap.set(alias.toLowerCase().trim(), exercise)
        }
      }
    }
  }

  // Rebuild Fuse instance
  fuseInstance = new Fuse(exercises, FUSE_OPTIONS)
}

/**
 * Exercise Lookup Service
 */
export const exerciseLookup = {
  /**
   * Initialize the exercise cache by fetching from the database.
   * Safe to call multiple times - will only fetch once unless cache is stale.
   */
  async initialize(force = false): Promise<void> {
    const now = Date.now()

    // Return early if cache is fresh
    if (!force && isInitialized && now - lastFetchTime < CACHE_TTL) {
      return
    }

    // Prevent concurrent initializations
    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      try {
        const exercises = await database.exercises.getAll()
        buildCaches(exercises)
        lastFetchTime = now
        isInitialized = true
      } catch (error) {
        console.error('[exerciseLookup] Failed to initialize:', error)
        throw error
      } finally {
        initPromise = null
      }
    })()

    return initPromise
  },

  /**
   * Check if the cache is initialized
   */
  isInitialized(): boolean {
    return isInitialized
  },

  /**
   * Get all cached exercises
   */
  getAll(): Exercise[] {
    return cachedExercises
  },

  /**
   * Find an exercise by exact name match (case-insensitive)
   */
  findByNameExact(name: string): ExerciseLookupResult | null {
    if (!name) return null

    const normalized = name.toLowerCase().trim()
    const exercise = exerciseNameMap.get(normalized)

    return exercise ? toResult(exercise) : null
  },

  /**
   * Find an exercise by name with fuzzy matching.
   * First tries exact match, then falls back to fuzzy search.
   */
  findByName(name: string): ExerciseLookupResult | null {
    if (!name) return null

    // 1. Try exact match first
    const exact = this.findByNameExact(name)
    if (exact) return exact

    // 2. Try fuzzy match if Fuse is ready
    if (!fuseInstance || cachedExercises.length === 0) {
      return null
    }

    const normalized = name.toLowerCase().trim()

    // Try substring contains match
    for (const exercise of cachedExercises) {
      const exName = exercise.name.toLowerCase()
      if (exName.includes(normalized) || normalized.includes(exName)) {
        return toResult(exercise)
      }
    }

    // Try Fuse fuzzy search
    const results = fuseInstance.search(name, { limit: 1 })
    if (results.length > 0 && (results[0].score ?? 1) < 0.3) {
      return toResult(results[0].item)
    }

    return null
  },

  /**
   * Find multiple exercises by names
   */
  findByNames(names: string[]): Map<string, ExerciseLookupResult | null> {
    const results = new Map<string, ExerciseLookupResult | null>()

    for (const name of names) {
      results.set(name, this.findByName(name))
    }

    return results
  },

  /**
   * Get the raw Exercise object by name (for cases when full DB object is needed)
   */
  getExerciseByName(name: string): Exercise | null {
    if (!name) return null
    return exerciseNameMap.get(name.toLowerCase().trim()) ?? null
  },

  /**
   * Invalidate the cache, forcing a refetch on next access
   */
  invalidate(): void {
    isInitialized = false
    lastFetchTime = 0
    cachedExercises = []
    exerciseNameMap.clear()
    fuseInstance = null
  },

  /**
   * Add an exercise to the cache (for newly created exercises)
   */
  addExercise(exercise: Exercise): void {
    // Avoid duplicates
    if (cachedExercises.some((e) => e.id === exercise.id)) return

    cachedExercises.unshift(exercise)
    exerciseNameMap.set(exercise.name.toLowerCase().trim(), exercise)

    // Rebuild Fuse with new exercise
    fuseInstance = new Fuse(cachedExercises, FUSE_OPTIONS)
  },
}

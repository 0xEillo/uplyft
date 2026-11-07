/**
 * Centralized Exercise Lookup Service
 *
 * Single shared exercise catalog for the app. The exercise picker, the workout
 * logger and name lookups all read from this one cache instead of each
 * downloading the full exercise table.
 *
 * - Warmed at app start (`initialize()` in the root layout).
 * - Persists a snapshot of the global catalog to disk so a cold start can
 *   render instantly (stale-while-revalidate), then refreshes from the network.
 * - Notifies subscribers when the catalog changes (see `subscribe`).
 *
 * Usage:
 *   - Call `await exerciseLookup.initialize()` early in the app lifecycle
 *   - Use `exerciseLookup.findByName(name)` to get an exercise by name
 *   - Use `exerciseLookup.getAll()` to get all cached exercises
 */
import * as FileSystem from 'expo-file-system/legacy'
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

// In-memory cache. `cachedExercises` is replaced (never mutated) on change so
// React consumers can use it as a stable snapshot.
let cachedExercises: Exercise[] = []
let exerciseNameMap: Map<string, Exercise> = new Map()
let exerciseIdMap: Map<string, Exercise> = new Map()
let fuseInstance: Fuse<Exercise> | null = null
let hasNetworkData = false
let lastFetchTime = 0
let refreshPromise: Promise<void> | null = null
let snapshotPromise: Promise<void> | null = null
// Global exercises last read from / written to disk, to skip redundant writes.
let persistedGlobalExercises: Exercise[] | null = null
const listeners = new Set<() => void>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Bump when the persisted shape / selected columns change.
const SNAPSHOT_VERSION = 1
const SNAPSHOT_PATH = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}exercise-catalog-v${SNAPSHOT_VERSION}.json`
  : null

export interface ExerciseLookupResult {
  id: string
  name: string
  gifUrl: string | null
  muscleGroup: string | null
  equipment: string | null
}

function toResult(exercise: Exercise): ExerciseLookupResult {
  return {
    id: exercise.id,
    name: exercise.name,
    gifUrl: exercise.gif_url ?? null,
    muscleGroup: exercise.muscle_group ?? null,
    equipment: exercise.equipment ?? null,
  }
}

function setCatalog(exercises: Exercise[]): void {
  cachedExercises = exercises
  exerciseNameMap = new Map()
  exerciseIdMap = new Map()

  for (const exercise of exercises) {
    exerciseIdMap.set(exercise.id, exercise)

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

  // Fuse indexing is comparatively expensive; build lazily on first fuzzy lookup.
  fuseInstance = null

  listeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.warn('[exerciseLookup] Listener failed:', error)
    }
  })
}

function joinList(value: string[] | null | undefined): string {
  return Array.isArray(value) ? value.join('\u0000') : ''
}

/** Cheap structural equality over the fields the app reads. */
function isSameCatalog(a: Exercise[], b: Exercise[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.gif_url !== y.gif_url ||
      x.muscle_group !== y.muscle_group ||
      x.equipment !== y.equipment ||
      x.created_by !== y.created_by ||
      x.type !== y.type ||
      joinList(x.aliases) !== joinList(y.aliases) ||
      joinList(x.equipments) !== joinList(y.equipments) ||
      joinList(x.target_muscles) !== joinList(y.target_muscles) ||
      joinList(x.secondary_muscles) !== joinList(y.secondary_muscles) ||
      joinList(x.instructions) !== joinList(y.instructions)
    ) {
      return false
    }
  }
  return true
}

function getFuse(): Fuse<Exercise> | null {
  if (cachedExercises.length === 0) return null
  if (!fuseInstance) {
    fuseInstance = new Fuse(cachedExercises, FUSE_OPTIONS)
  }
  return fuseInstance
}

async function readSnapshot(): Promise<Exercise[] | null> {
  if (!SNAPSHOT_PATH) return null
  try {
    const info = await FileSystem.getInfoAsync(SNAPSHOT_PATH)
    if (!info.exists) return null
    const raw = await FileSystem.readAsStringAsync(SNAPSHOT_PATH)
    const parsed = JSON.parse(raw) as { v?: number; exercises?: Exercise[] }
    if (parsed?.v !== SNAPSHOT_VERSION || !Array.isArray(parsed.exercises)) {
      return null
    }
    return parsed.exercises
  } catch (error) {
    console.warn('[exerciseLookup] Failed to read catalog snapshot:', error)
    return null
  }
}

async function writeSnapshot(exercises: Exercise[]): Promise<void> {
  if (!SNAPSHOT_PATH) return
  try {
    // Only persist global exercises. User-created ones arrive with the network
    // refresh, so a different account on this device never sees them.
    const globalExercises = exercises.filter((exercise) => !exercise.created_by)
    if (
      persistedGlobalExercises &&
      isSameCatalog(persistedGlobalExercises, globalExercises)
    ) {
      return
    }
    persistedGlobalExercises = globalExercises
    await FileSystem.writeAsStringAsync(
      SNAPSHOT_PATH,
      JSON.stringify({ v: SNAPSHOT_VERSION, exercises: globalExercises }),
    )
  } catch (error) {
    console.warn('[exerciseLookup] Failed to write catalog snapshot:', error)
  }
}

function hydrateFromSnapshot(): Promise<void> {
  if (!snapshotPromise) {
    snapshotPromise = readSnapshot().then((snapshot) => {
      if (snapshot) persistedGlobalExercises = snapshot
      // Never clobber data that already arrived from the network.
      if (snapshot && snapshot.length > 0 && cachedExercises.length === 0) {
        setCatalog(snapshot)
      }
    })
  }
  return snapshotPromise
}

function refreshFromNetwork(): Promise<void> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const exercises = await database.exercises.getAll()
      const changed = !isSameCatalog(cachedExercises, exercises)
      // Keep the existing array identity when nothing visible changed so
      // subscribers (e.g. the exercise picker) don't re-render for nothing.
      if (changed) {
        setCatalog(exercises)
      }
      lastFetchTime = Date.now()
      hasNetworkData = true
      if (changed) {
        void writeSnapshot(exercises)
      }
    } catch (error) {
      console.error('[exerciseLookup] Failed to initialize:', error)
      throw error
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export const exerciseLookup = {
  /**
   * Ensure the catalog is loaded. Resolves immediately when any cached data
   * (in-memory or on-disk snapshot) is available and revalidates in the
   * background when stale; only waits on the network when there is no data.
   */
  async initialize(force = false): Promise<void> {
    const isFresh =
      hasNetworkData && Date.now() - lastFetchTime < CACHE_TTL
    if (!force && isFresh) {
      return
    }

    if (cachedExercises.length === 0) {
      await hydrateFromSnapshot()
    }

    const refresh = refreshFromNetwork()
    if (!force && cachedExercises.length > 0) {
      refresh.catch(() => {
        // Already logged; keep serving cached data.
      })
      return
    }

    return refresh
  },

  /**
   * Subscribe to catalog changes. Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getById(id: string): Exercise | null {
    return exerciseIdMap.get(id) ?? null
  },

  isInitialized(): boolean {
    return cachedExercises.length > 0
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

    // 2. Try fuzzy match
    const fuse = getFuse()
    if (!fuse) {
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
    const results = fuse.search(name, { limit: 1 })
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
    hasNetworkData = false
    lastFetchTime = 0
    setCatalog([])
  },

  /**
   * Add an exercise to the cache (for newly created exercises)
   */
  addExercise(exercise: Exercise): void {
    // Avoid duplicates
    if (exerciseIdMap.has(exercise.id)) return

    setCatalog([exercise, ...cachedExercises])
  },
}

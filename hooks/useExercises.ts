import { exerciseLookup } from '@/lib/services/exerciseLookup'
import {
  type ExerciseUsage,
  loadExerciseUsage,
  peekExerciseUsage,
} from '@/lib/services/exerciseUsage'
import {
  type ExerciseEquipment,
  getAvailableExerciseEquipment,
  matchesExerciseEquipmentFilter,
} from '@/lib/utils/exercise-equipment'
import { Exercise } from '@/types/database.types'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

interface UseExercisesOptions {
  userId?: string
  initialLoad?: boolean
}

const EMPTY_EXERCISES: Exercise[] = []
const EMPTY_USAGE_COUNTS: Record<string, number> = {}

// Derived filter metadata is computed once per catalog snapshot (the catalog
// array is replaced, never mutated, when it changes).
const derivedMetadataCache = new WeakMap<
  Exercise[],
  { muscleGroups: string[]; equipmentTypes: ExerciseEquipment[] }
>()

function getDerivedMetadata(allExercises: Exercise[]) {
  const cached = derivedMetadataCache.get(allExercises)
  if (cached) return cached

  const muscleSet = new Set<string>()
  allExercises.forEach((e) => {
    if (e.muscle_group && typeof e.muscle_group === 'string') {
      muscleSet.add(e.muscle_group)
    }
  })

  const derived = {
    muscleGroups: Array.from(muscleSet).sort(),
    // Derive equipment types from a normalized canonical set.
    equipmentTypes: getAvailableExerciseEquipment(allExercises),
  }
  derivedMetadataCache.set(allExercises, derived)
  return derived
}

function filterVisibleExercises(allExercises: Exercise[], userId?: string) {
  return allExercises.filter(
    (e) => !e.created_by || (userId && e.created_by === userId),
  )
}

/**
 * Exercise catalog + the user's usage stats, backed by the shared
 * `exerciseLookup` cache (warmed at app start and persisted to disk), so
 * screens render immediately instead of waiting on a network round trip.
 */
export function useExercises(options: UseExercisesOptions = {}) {
  const { userId, initialLoad = true } = options

  const catalog = useSyncExternalStore(
    exerciseLookup.subscribe,
    exerciseLookup.getAll,
  )
  const exercises = useMemo(
    () =>
      catalog.length === 0
        ? EMPTY_EXERCISES
        : filterVisibleExercises(catalog, userId),
    [catalog, userId],
  )
  const { muscleGroups, equipmentTypes } = getDerivedMetadata(catalog)

  const [usage, setUsage] = useState<ExerciseUsage | null>(() =>
    peekExerciseUsage(userId),
  )
  const [isFetching, setIsFetching] = useState(
    () => initialLoad && exerciseLookup.getAll().length === 0,
  )
  const [error, setError] = useState<Error | null>(null)

  const isMounted = useRef(true)

  const loadExercises = useCallback(
    async (force = false) => {
      const hasData = exerciseLookup.getAll().length > 0
      if (!hasData) setIsFetching(true)

      try {
        setError(null)
        await exerciseLookup.initialize(force)
      } catch (err) {
        if (isMounted.current) {
          setError(
            err instanceof Error ? err : new Error('Failed to load exercises'),
          )
        }
      } finally {
        if (isMounted.current && !hasData) {
          setIsFetching(false)
        }
      }

      return filterVisibleExercises(exerciseLookup.getAll(), userId)
    },
    [userId],
  )

  const loadRecentExercises = useCallback(async () => {
    if (!userId) return []

    try {
      const nextUsage = await loadExerciseUsage(userId)
      if (isMounted.current) {
        setUsage(nextUsage)
      }
      return nextUsage.recentIds
        .map((id) => exerciseLookup.getById(id))
        .filter((exercise): exercise is Exercise => exercise !== null)
    } catch (err) {
      console.error('Error loading recent exercises:', err)
      return []
    }
  }, [userId])

  const recentExercises = useMemo(() => {
    if (!usage || usage.recentIds.length === 0 || exercises.length === 0) {
      return EMPTY_EXERCISES
    }

    const visibleById = new Map(exercises.map((e) => [e.id, e]))
    const resolved: Exercise[] = []
    for (const id of usage.recentIds) {
      const exercise = visibleById.get(id)
      if (exercise) resolved.push(exercise)
    }
    return resolved
  }, [usage, exercises])

  const searchExercises = useCallback(
    (
      query: string,
      muscleFilter: string[] = [],
      equipmentFilter: string[] = [],
    ) => {
      const normalizedQuery = query.toLowerCase().trim()

      return exercises.filter((exercise) => {
        // Name filter
        if (
          normalizedQuery &&
          !exercise.name.toLowerCase().includes(normalizedQuery)
        ) {
          return false
        }

        // Muscle group filter
        if (muscleFilter.length > 0) {
          if (
            !exercise.muscle_group ||
            !muscleFilter.includes(exercise.muscle_group)
          ) {
            return false
          }
        }

        // Equipment filter
        if (equipmentFilter.length > 0) {
          const selectedEquipment = new Set(equipmentFilter)
          if (!matchesExerciseEquipmentFilter(exercise, selectedEquipment)) {
            return false
          }
        }

        return true
      })
    },
    [exercises],
  )

  const addExercise = useCallback((exercise: Exercise) => {
    exerciseLookup.addExercise(exercise)
  }, [])

  const invalidateCache = useCallback(() => {
    exerciseLookup.invalidate()
  }, [])

  useEffect(() => {
    isMounted.current = true

    if (initialLoad) {
      void loadExercises()
      if (userId) {
        void loadRecentExercises()
      }
    }

    return () => {
      isMounted.current = false
    }
  }, [initialLoad, loadExercises, loadRecentExercises, userId])

  return {
    exercises,
    recentExercises,
    usageCounts: usage?.usageCounts ?? EMPTY_USAGE_COUNTS,
    muscleGroups,
    equipmentTypes,
    isLoading: isFetching && catalog.length === 0,
    error,
    loadExercises,
    loadRecentExercises,
    searchExercises,
    addExercise,
    invalidateCache,
    isFromCache: catalog.length > 0,
  }
}

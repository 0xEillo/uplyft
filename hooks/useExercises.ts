import { database } from '@/lib/database'
import {
  type ExerciseEquipment,
  getAvailableExerciseEquipment,
  matchesExerciseEquipmentFilter,
} from '@/lib/utils/exercise-equipment'
import { Exercise } from '@/types/database.types'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseExercisesOptions {
  userId?: string
  initialLoad?: boolean
}

interface ExerciseCache {
  exercises: Exercise[]
  muscleGroups: string[]
  equipmentTypes: ExerciseEquipment[]
  lastFetched: number
}

// Global cache - persists across component mounts
let globalCache: ExerciseCache | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function haveSameExerciseIdsAndOrder(a: Exercise[], b: Exercise[]) {
  if (a === b) return true
  if (a.length !== b.length) return false

  return a.every((exercise, index) => exercise.id === b[index]?.id)
}

function haveSameStringValues(a: string[], b: string[]) {
  if (a === b) return true
  if (a.length !== b.length) return false

  return a.every((value, index) => value === b[index])
}

export function useExercises(options: UseExercisesOptions = {}) {
  const { userId, initialLoad = true } = options

  const [exercises, setExercises] = useState<Exercise[]>(
    globalCache?.exercises ?? [],
  )
  const [recentExercises, setRecentExercises] = useState<Exercise[]>([])
  const [muscleGroups, setMuscleGroups] = useState<string[]>(
    globalCache?.muscleGroups ?? [],
  )
  const [equipmentTypes, setEquipmentTypes] = useState<ExerciseEquipment[]>(
    globalCache?.equipmentTypes ?? [],
  )
  const [isLoading, setIsLoading] = useState(!globalCache)
  const [error, setError] = useState<Error | null>(null)

  const isMounted = useRef(true)

  const loadExercises = useCallback(async (force = false) => {
    // Helper to filter exercises based on visibility
    const filterVisibleExercises = (
      allExercises: Exercise[],
      currentUserId?: string,
    ) => {
      return allExercises.filter(
        (e) => !e.created_by || (currentUserId && e.created_by === currentUserId),
      )
    }

    // Check cache validity and keep stable references when the visible data did not change.
    const now = Date.now()
    if (!force && globalCache && now - globalCache.lastFetched < CACHE_TTL) {
      const filtered = filterVisibleExercises(globalCache.exercises, userId)
      setExercises((prev) =>
        haveSameExerciseIdsAndOrder(prev, filtered) ? prev : filtered,
      )
      setMuscleGroups((prev) =>
        haveSameStringValues(prev, globalCache!.muscleGroups)
          ? prev
          : globalCache!.muscleGroups,
      )
      setEquipmentTypes((prev) =>
        haveSameStringValues(prev, globalCache!.equipmentTypes)
          ? prev
          : globalCache!.equipmentTypes,
      )
      setIsLoading(false)
      return filtered
    }

    try {
      setIsLoading(true)
      setError(null)

      const allExercises = await database.exercises.getAll()

      if (!isMounted.current) return []

      // Derive muscle groups
      const muscleSet = new Set<string>()
      allExercises.forEach((e) => {
        if (e.muscle_group && typeof e.muscle_group === 'string') {
          muscleSet.add(e.muscle_group)
        }
      })
      const muscles = Array.from(muscleSet).sort()

      // Derive equipment types from a normalized canonical set.
      const equipment = getAvailableExerciseEquipment(allExercises)

      // Update global cache
      globalCache = {
        exercises: allExercises,
        muscleGroups: muscles,
        equipmentTypes: equipment,
        lastFetched: now,
      }

      const filtered = filterVisibleExercises(allExercises, userId)
      setExercises(filtered)
      setMuscleGroups(muscles)
      setEquipmentTypes(equipment)

      return filtered
    } catch (err) {
      if (!isMounted.current) return []
      setError(
        err instanceof Error ? err : new Error('Failed to load exercises'),
      )
      return []
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [userId])

  const loadRecentExercises = useCallback(async () => {
    if (!userId) return []

    try {
      const recent = await database.exercises.getRecent(userId)
      if (isMounted.current) {
        setRecentExercises(recent)
      }
      return recent
    } catch (err) {
      console.error('Error loading recent exercises:', err)
      return []
    }
  }, [userId])

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
    setExercises((prev) => {
      if (prev.some((e) => e.id === exercise.id)) return prev
      const updated = [exercise, ...prev]
      // Update global cache
      if (globalCache) {
        globalCache.exercises = updated
      }
      return updated
    })
  }, [])

  const invalidateCache = useCallback(() => {
    globalCache = null
  }, [])

  useEffect(() => {
    isMounted.current = true

    if (initialLoad) {
      loadExercises()
      if (userId) {
        loadRecentExercises()
      }
    }

    return () => {
      isMounted.current = false
    }
  }, [initialLoad, loadExercises, loadRecentExercises, userId])

  return {
    exercises,
    recentExercises,
    muscleGroups,
    equipmentTypes,
    isLoading,
    error,
    loadExercises,
    loadRecentExercises,
    searchExercises,
    addExercise,
    invalidateCache,
    isFromCache: !!globalCache && exercises.length > 0,
  }
}

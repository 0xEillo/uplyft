import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseExercisesOptions {
  userId?: string
  initialLoad?: boolean
}

interface ExerciseCache {
  exercises: Exercise[]
  muscleGroups: string[]
  equipmentTypes: string[]
  lastFetched: number
}

// Global cache - persists across component mounts
let globalCache: ExerciseCache | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useExercises(options: UseExercisesOptions = {}) {
  const { userId, initialLoad = true } = options

  const [exercises, setExercises] = useState<Exercise[]>(
    globalCache?.exercises ?? [],
  )
  const [recentExercises, setRecentExercises] = useState<Exercise[]>([])
  const [muscleGroups, setMuscleGroups] = useState<string[]>(
    globalCache?.muscleGroups ?? [],
  )
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>(
    globalCache?.equipmentTypes ?? [],
  )
  const [isLoading, setIsLoading] = useState(!globalCache)
  const [error, setError] = useState<Error | null>(null)

  const isMounted = useRef(true)

  const loadExercises = useCallback(async (force = false) => {
    // Check cache validity
    const now = Date.now()
    if (!force && globalCache && now - globalCache.lastFetched < CACHE_TTL) {
      setExercises(globalCache.exercises)
      setMuscleGroups(globalCache.muscleGroups)
      setEquipmentTypes(globalCache.equipmentTypes)
      setIsLoading(false)
      return globalCache.exercises
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

      // Derive equipment types
      const equipmentSet = new Set<string>()
      allExercises.forEach((e) => {
        if (e.equipment) equipmentSet.add(e.equipment)
        if (e.equipments && Array.isArray(e.equipments)) {
          e.equipments.forEach((eq) => equipmentSet.add(eq))
        }
      })
      const equipment = Array.from(equipmentSet).sort()

      // Update global cache
      globalCache = {
        exercises: allExercises,
        muscleGroups: muscles,
        equipmentTypes: equipment,
        lastFetched: now,
      }

      setExercises(allExercises)
      setMuscleGroups(muscles)
      setEquipmentTypes(equipment)

      return allExercises
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
  }, [])

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
          let matches = false
          if (
            exercise.equipment &&
            equipmentFilter.includes(exercise.equipment)
          ) {
            matches = true
          }
          if (
            !matches &&
            exercise.equipments &&
            Array.isArray(exercise.equipments)
          ) {
            matches = exercise.equipments.some((eq) =>
              equipmentFilter.includes(eq),
            )
          }
          if (!matches) return false
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

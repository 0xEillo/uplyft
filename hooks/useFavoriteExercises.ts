import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getFavoriteExercisesStorageKey,
  parseFavoriteExerciseIds,
  serializeFavoriteExerciseIds,
} from '@/lib/utils/favorite-exercises'

export function useFavoriteExercises(userId?: string | null) {
  const storageKey = useMemo(
    () => getFavoriteExercisesStorageKey(userId),
    [userId],
  )
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<Set<string>>(
    new Set(),
  )
  const [isLoading, setIsLoading] = useState(true)
  const favoriteExerciseIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    favoriteExerciseIdsRef.current = favoriteExerciseIds
  }, [favoriteExerciseIds])

  useEffect(() => {
    let isActive = true

    async function loadFavoriteExerciseIds() {
      setIsLoading(true)

      try {
        const storedValue = await AsyncStorage.getItem(storageKey)
        if (!isActive) {
          return
        }

        const parsedFavoriteIds = parseFavoriteExerciseIds(storedValue)
        favoriteExerciseIdsRef.current = parsedFavoriteIds
        setFavoriteExerciseIds(parsedFavoriteIds)
      } catch (error) {
        console.error('Error loading favorite exercises:', error)
        if (!isActive) {
          return
        }

        const emptyFavorites = new Set<string>()
        favoriteExerciseIdsRef.current = emptyFavorites
        setFavoriteExerciseIds(emptyFavorites)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadFavoriteExerciseIds()

    return () => {
      isActive = false
    }
  }, [storageKey])

  const persistFavoriteExerciseIds = useCallback(
    async (nextFavoriteIds: Set<string>) => {
      try {
        await AsyncStorage.setItem(
          storageKey,
          serializeFavoriteExerciseIds(nextFavoriteIds),
        )
      } catch (error) {
        console.error('Error saving favorite exercises:', error)
      }
    },
    [storageKey],
  )

  const toggleFavoriteExercise = useCallback(
    async (exerciseId: string) => {
      const nextFavoriteIds = new Set(favoriteExerciseIdsRef.current)

      if (nextFavoriteIds.has(exerciseId)) {
        nextFavoriteIds.delete(exerciseId)
      } else {
        nextFavoriteIds.add(exerciseId)
      }

      favoriteExerciseIdsRef.current = nextFavoriteIds
      setFavoriteExerciseIds(nextFavoriteIds)
      await persistFavoriteExerciseIds(nextFavoriteIds)

      return nextFavoriteIds.has(exerciseId)
    },
    [persistFavoriteExerciseIds],
  )

  return {
    favoriteExerciseIds,
    isLoading,
    toggleFavoriteExercise,
  }
}

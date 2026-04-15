import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = '@profile_pic_prompt_v1'
const WORKOUT_INTERVAL = 3
const MAX_DISMISSALS = 3

/**
 * Show the profile pic reminder after 3 workouts, then every 3 workouts
 * after each dismissal. After 3 dismissals the prompt is permanently hidden.
 */
interface ProfilePicPromptState {
  timesShown: number
  nextPromptWorkoutCount?: number
}

interface UseProfilePicPromptArgs {
  userId?: string | null
  workoutCount: number
  hasProfilePic: boolean
  isProfileLoading: boolean
}

interface UseProfilePicPromptResult {
  isVisible: boolean
  dismiss: () => void
}

const clampTimesShown = (value: number) =>
  Math.max(0, Math.min(value, MAX_DISMISSALS))

const normalizeWorkoutCount = (value: number) => Math.max(0, Math.floor(value))

const getNextPromptWorkoutCount = ({
  timesShown,
  storedNextPromptWorkoutCount,
  workoutCount,
}: {
  timesShown: number
  storedNextPromptWorkoutCount?: number
  workoutCount: number
}) => {
  if (
    typeof storedNextPromptWorkoutCount === 'number' &&
    Number.isFinite(storedNextPromptWorkoutCount)
  ) {
    return Math.max(WORKOUT_INTERVAL, Math.floor(storedNextPromptWorkoutCount))
  }

  if (timesShown === 0) {
    return WORKOUT_INTERVAL
  }

  // Migrate older saved state by scheduling the next prompt relative to now.
  return normalizeWorkoutCount(workoutCount) + WORKOUT_INTERVAL
}

const getStorageKey = (userId?: string | null) =>
  userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY

export const shouldShowProfilePicPrompt = ({
  hasProfilePic,
  isProfileLoading,
  isReady,
  nextPromptWorkoutCount,
  timesShown,
  workoutCount,
}: {
  hasProfilePic: boolean
  isProfileLoading: boolean
  isReady: boolean
  nextPromptWorkoutCount: number
  timesShown: number
  workoutCount: number
}) => {
  if (!isReady || isProfileLoading) return false
  if (hasProfilePic) return false
  if (timesShown >= MAX_DISMISSALS) return false
  return workoutCount >= nextPromptWorkoutCount
}

export function useProfilePicPrompt({
  userId,
  workoutCount,
  hasProfilePic,
  isProfileLoading,
}: UseProfilePicPromptArgs): UseProfilePicPromptResult {
  const [timesShown, setTimesShown] = useState(0)
  const [nextPromptWorkoutCount, setNextPromptWorkoutCount] =
    useState(WORKOUT_INTERVAL)
  const [isReady, setIsReady] = useState(false)

  const storageKey = useMemo(() => getStorageKey(userId), [userId])

  const persistPromptState = useCallback(
    async (nextTimesShown: number, nextPromptCount: number) => {
      try {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            timesShown: nextTimesShown,
            nextPromptWorkoutCount: nextPromptCount,
          }),
        )
      } catch (error) {
        console.error('Error saving profile pic prompt state:', error)
      }
    },
    [storageKey],
  )

  useEffect(() => {
    if (!userId) {
      setTimesShown(0)
      setNextPromptWorkoutCount(WORKOUT_INTERVAL)
      setIsReady(false)
      return
    }

    let cancelled = false

    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<ProfilePicPromptState>
          const parsedTimesShown =
            typeof parsed.timesShown === 'number'
              ? clampTimesShown(Math.floor(parsed.timesShown))
              : 0
          const parsedNextPromptWorkoutCount = getNextPromptWorkoutCount({
            timesShown: parsedTimesShown,
            storedNextPromptWorkoutCount: parsed.nextPromptWorkoutCount,
            workoutCount,
          })

          if (!cancelled) {
            setTimesShown(parsedTimesShown)
            setNextPromptWorkoutCount(parsedNextPromptWorkoutCount)
          }

          if (
            typeof parsed.nextPromptWorkoutCount !== 'number' &&
            parsedTimesShown > 0
          ) {
            void persistPromptState(
              parsedTimesShown,
              parsedNextPromptWorkoutCount,
            )
          }
        } else if (!cancelled) {
          setTimesShown(0)
          setNextPromptWorkoutCount(WORKOUT_INTERVAL)
        }
      } catch (error) {
        console.error('Error reading profile pic prompt state:', error)
      } finally {
        if (!cancelled) {
          setIsReady(true)
        }
      }
    }

    loadState()

    return () => {
      cancelled = true
    }
  }, [persistPromptState, storageKey, userId, workoutCount])

  const isVisible = useMemo(() => {
    return shouldShowProfilePicPrompt({
      hasProfilePic,
      isProfileLoading,
      isReady,
      nextPromptWorkoutCount,
      timesShown,
      workoutCount,
    })
  }, [
    hasProfilePic,
    isProfileLoading,
    isReady,
    nextPromptWorkoutCount,
    timesShown,
    workoutCount,
  ])

  const dismiss = useCallback(() => {
    if (!userId) return

    const nextPromptCount = normalizeWorkoutCount(workoutCount) + WORKOUT_INTERVAL
    setNextPromptWorkoutCount(nextPromptCount)

    setTimesShown((current) => {
      const nextTimesShown = clampTimesShown(current + 1)
      void persistPromptState(nextTimesShown, nextPromptCount)
      return nextTimesShown
    })
  }, [persistPromptState, userId, workoutCount])

  return {
    isVisible,
    dismiss,
  }
}

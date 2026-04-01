import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = '@profile_pic_prompt_v1'

/**
 * Show the profile pic reminder after 3 workouts, then again after 8
 * and 15 workouts. After 3 dismissals the prompt is permanently hidden.
 */
const SHOW_THRESHOLDS = [3, 8, 15] as const

interface ProfilePicPromptState {
  timesShown: number
}

interface UseProfilePicPromptArgs {
  userId?: string | null
  workoutCount: number
  hasProfilePic: boolean
}

interface UseProfilePicPromptResult {
  isVisible: boolean
  dismiss: () => void
}

const clampTimesShown = (value: number) =>
  Math.max(0, Math.min(value, SHOW_THRESHOLDS.length))

const getStorageKey = (userId?: string | null) =>
  userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY

export function useProfilePicPrompt({
  userId,
  workoutCount,
  hasProfilePic,
}: UseProfilePicPromptArgs): UseProfilePicPromptResult {
  const [timesShown, setTimesShown] = useState(0)
  const [isReady, setIsReady] = useState(false)

  const storageKey = useMemo(() => getStorageKey(userId), [userId])

  const persistTimesShown = useCallback(
    async (nextTimesShown: number) => {
      try {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({ timesShown: nextTimesShown }),
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
      setIsReady(false)
      return
    }

    let cancelled = false

    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<ProfilePicPromptState>
          if (typeof parsed.timesShown === 'number' && !cancelled) {
            setTimesShown(clampTimesShown(Math.floor(parsed.timesShown)))
          }
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
  }, [storageKey, userId])

  const isVisible = useMemo(() => {
    if (!isReady) return false
    // Don't show if user already has a profile pic
    if (hasProfilePic) return false
    // Don't show if we've exhausted all thresholds
    if (timesShown >= SHOW_THRESHOLDS.length) return false
    // Show only once we hit the threshold
    return workoutCount >= SHOW_THRESHOLDS[timesShown]
  }, [isReady, hasProfilePic, timesShown, workoutCount])

  const dismiss = useCallback(() => {
    if (!userId) return

    setTimesShown((current) => {
      // Skip past any thresholds the user has already passed
      let next = clampTimesShown(current + 1)
      while (
        next < SHOW_THRESHOLDS.length &&
        workoutCount >= SHOW_THRESHOLDS[next]
      ) {
        next += 1
      }
      next = clampTimesShown(next)
      void persistTimesShown(next)
      return next
    })
  }, [persistTimesShown, userId, workoutCount])

  return {
    isVisible,
    dismiss,
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = '@invite_friends_prompt_v3'
const LEGACY_STORAGE_KEY = '@invite_friends_prompt_v2'
const SHOW_THRESHOLDS = [0, 5, 15] as const

interface InviteFriendsPromptState {
  timesShown: number
}

interface UseInviteFriendsPromptArgs {
  userId?: string | null
  workoutCount: number
}

interface UseInviteFriendsPromptResult {
  isReady: boolean
  isVisible: boolean
  advancePrompt: () => void
}

const clampTimesShown = (value: number) =>
  Math.max(0, Math.min(value, SHOW_THRESHOLDS.length))

export const getNextInvitePromptStep = (
  currentTimesShown: number,
  workoutCount: number,
) => {
  let nextTimesShown = clampTimesShown(currentTimesShown + 1)

  while (
    nextTimesShown < SHOW_THRESHOLDS.length &&
    workoutCount >= SHOW_THRESHOLDS[nextTimesShown]
  ) {
    nextTimesShown += 1
  }

  return clampTimesShown(nextTimesShown)
}

const parseTimesShown = (rawValue: string | null): number | null => {
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as Partial<InviteFriendsPromptState>
    if (typeof parsed.timesShown !== 'number') {
      return null
    }
    return clampTimesShown(Math.floor(parsed.timesShown))
  } catch (error) {
    console.error('Error parsing invite prompt state:', error)
    return null
  }
}

const getStorageKey = (userId?: string | null) =>
  userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY

const getLegacyStorageKeys = (userId?: string | null) =>
  userId ? [`${LEGACY_STORAGE_KEY}:${userId}`, LEGACY_STORAGE_KEY] : [LEGACY_STORAGE_KEY]

export function useInviteFriendsPrompt({
  userId,
  workoutCount,
}: UseInviteFriendsPromptArgs): UseInviteFriendsPromptResult {
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
        console.error('Error saving invite prompt state:', error)
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
        const parsed = parseTimesShown(stored)
        if (parsed !== null) {
          if (!cancelled) {
            setTimesShown(parsed)
          }
          return
        }

        const legacyKeys = getLegacyStorageKeys(userId)
        for (const legacyKey of legacyKeys) {
          const legacyStored = await AsyncStorage.getItem(legacyKey)
          const legacyParsed = parseTimesShown(legacyStored)
          if (legacyParsed !== null) {
            if (!cancelled) {
              setTimesShown(legacyParsed)
            }
            void persistTimesShown(legacyParsed)
            return
          }
        }

        if (!cancelled) {
          setTimesShown(0)
        }
      } catch (error) {
        console.error('Error reading invite prompt state:', error)
        if (!cancelled) {
          setTimesShown(0)
        }
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
  }, [persistTimesShown, storageKey, userId])

  const isVisible = useMemo(() => {
    if (!isReady) return false
    if (timesShown >= SHOW_THRESHOLDS.length) return false
    return workoutCount >= SHOW_THRESHOLDS[timesShown]
  }, [isReady, timesShown, workoutCount])

  const advancePrompt = useCallback(() => {
    if (!userId) return

    setTimesShown((current) => {
      const next = getNextInvitePromptStep(current, workoutCount)
      void persistTimesShown(next)
      return next
    })
  }, [persistTimesShown, userId, workoutCount])

  return {
    isReady,
    isVisible,
    advancePrompt,
  }
}

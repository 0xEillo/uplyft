import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { LayoutAnimation } from 'react-native'
import { useEffect, useMemo, useRef, useState } from 'react'

export interface WeeklyProgressStats {
  workouts: { current: number; previous: number; diff: number }
  durationSeconds: { current: number; previous: number; diff: number }
  volumeKg: { current: number; previous: number; diff: number }
  isLoading: boolean
}

/**
 * @param refreshToken Changing it refetches the stats. Pass `null` while the
 * token isn't known yet: the first null -> value transition does not refetch,
 * because the initial fetch already returned current data.
 */
export function useWeeklyProgress(
  refreshToken?: number | null,
): WeeklyProgressStats {
  const { user } = useAuth()
  const userId = user?.id
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<Omit<WeeklyProgressStats, 'isLoading'>>({
    workouts: { current: 0, previous: 0, diff: 0 },
    durationSeconds: { current: 0, previous: 0, diff: 0 },
    volumeKg: { current: 0, previous: 0, diff: 0 },
  })
  const hasLoadedRef = useRef(false)
  const requestIdRef = useRef(0)
  const isMountedRef = useRef(true)
  const lastRequestRef = useRef<{
    userId: string | undefined
    refreshToken: number | null | undefined
  } | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const lastRequest = lastRequestRef.current
    lastRequestRef.current = { userId, refreshToken }
    if (
      lastRequest &&
      lastRequest.userId === userId &&
      lastRequest.refreshToken === null &&
      refreshToken != null
    ) {
      // Token just became known; the in-flight/initial fetch is still current.
      return
    }

    if (!userId) {
      requestIdRef.current += 1 // drop any in-flight result for the old user
      hasLoadedRef.current = false
      setStats({
        workouts: { current: 0, previous: 0, diff: 0 },
        durationSeconds: { current: 0, previous: 0, diff: 0 },
        volumeKg: { current: 0, previous: 0, diff: 0 },
      })
      setIsLoading(false)
      return
    }

    const activeUserId = userId
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const shouldShowLoading = !hasLoadedRef.current

    async function fetchStats() {
      try {
        if (shouldShowLoading) {
          setIsLoading(true)
        }

        // Calculate current week (Monday to Sunday)
        const now = new Date()
        const day = now.getDay()
        const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1)

        const startOfCurrentWeek = new Date(now)
        startOfCurrentWeek.setDate(diffToMonday)
        startOfCurrentWeek.setHours(0, 0, 0, 0)

        // Calculate last week (Monday to Sunday)
        const startOfLastWeek = new Date(startOfCurrentWeek)
        startOfLastWeek.setDate(startOfCurrentWeek.getDate() - 7)

        const weeklyRows = await database.workoutSessions.getWeeklyProgressStats(
          activeUserId,
          startOfLastWeek,
          startOfCurrentWeek,
          now,
        )

        const currentWeekStats = weeklyRows.find(
          (row) => row.period === 'current',
        )
        const previousWeekStats = weeklyRows.find(
          (row) => row.period === 'previous',
        )
        const currentWorkouts = currentWeekStats?.workout_count ?? 0
        const previousWorkouts = previousWeekStats?.workout_count ?? 0
        const currentDuration = currentWeekStats?.duration_seconds ?? 0
        const previousDuration = previousWeekStats?.duration_seconds ?? 0
        const currentVolume = currentWeekStats?.volume_kg ?? 0
        const previousVolume = previousWeekStats?.volume_kg ?? 0

        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return
        }

        if (hasLoadedRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        }

        setStats({
          workouts: {
            current: currentWorkouts,
            previous: previousWorkouts,
            diff: currentWorkouts - previousWorkouts,
          },
          durationSeconds: {
            current: currentDuration,
            previous: previousDuration,
            diff: currentDuration - previousDuration,
          },
          volumeKg: {
            current: currentVolume,
            previous: previousVolume,
            diff: currentVolume - previousVolume,
          },
        })
        hasLoadedRef.current = true
      } catch (error) {
        console.error('Failed to fetch weekly progress:', error)
      } finally {
        if (
          isMountedRef.current &&
          requestId === requestIdRef.current &&
          shouldShowLoading
        ) {
          setIsLoading(false)
        }
      }
    }

    void fetchStats()
  }, [refreshToken, userId])

  // Stable object so memoized consumers (list header) only update on change
  return useMemo(() => ({ ...stats, isLoading }), [stats, isLoading])
}

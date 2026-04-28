import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { LayoutAnimation } from 'react-native'
import { useEffect, useRef, useState } from 'react'

export interface WeeklyProgressStats {
  workouts: { current: number; previous: number; diff: number }
  durationSeconds: { current: number; previous: number; diff: number }
  volumeKg: { current: number; previous: number; diff: number }
  isLoading: boolean
}

export function useWeeklyProgress(refreshToken?: number): WeeklyProgressStats {
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

  useEffect(() => {
    if (!userId) {
      hasLoadedRef.current = false
      setStats({
        workouts: { current: 0, previous: 0, diff: 0 },
        durationSeconds: { current: 0, previous: 0, diff: 0 },
        volumeKg: { current: 0, previous: 0, diff: 0 },
      })
      setIsLoading(false)
      return
    }

    let isActive = true
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

        if (!isActive || requestId !== requestIdRef.current) {
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
          isActive &&
          requestId === requestIdRef.current &&
          shouldShowLoading
        ) {
          setIsLoading(false)
        }
      }
    }

    void fetchStats()

    return () => {
      isActive = false
    }
  }, [refreshToken, userId])

  return { ...stats, isLoading }
}

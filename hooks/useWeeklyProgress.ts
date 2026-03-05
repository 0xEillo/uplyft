import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { calculateWorkoutStats } from '@/lib/utils/workout-stats'
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

        // Fetch all workouts from start of last week to now
        const workouts = await database.workoutSessions.getWorkoutsByDateRange(
          activeUserId,
          startOfLastWeek,
          now,
        )

        // Split workouts into current and previous week
        const currentWeekWorkouts = workouts.filter((w) => {
          const wDate = new Date(w.date)
          return wDate >= startOfCurrentWeek
        })

        const previousWeekWorkouts = workouts.filter((w) => {
          const wDate = new Date(w.date)
          return wDate >= startOfLastWeek && wDate < startOfCurrentWeek
        })

        // Calculate stats for current week
        let currentDuration = 0
        let currentVolume = 0
        currentWeekWorkouts.forEach((w) => {
          const wStats = calculateWorkoutStats(w, 'kg')
          currentDuration += wStats.durationSeconds
          currentVolume += wStats.totalVolume
        })

        // Calculate stats for previous week
        let previousDuration = 0
        let previousVolume = 0
        previousWeekWorkouts.forEach((w) => {
          const wStats = calculateWorkoutStats(w, 'kg')
          previousDuration += wStats.durationSeconds
          previousVolume += wStats.totalVolume
        })

        if (!isActive || requestId !== requestIdRef.current) {
          return
        }

        if (hasLoadedRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        }

        setStats({
          workouts: {
            current: currentWeekWorkouts.length,
            previous: previousWeekWorkouts.length,
            diff: currentWeekWorkouts.length - previousWeekWorkouts.length,
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

import { useEffect, useState } from 'react'
import { database } from '@/lib/database'
import { calculateWorkoutStats } from '@/lib/utils/workout-stats'
import { useAuth } from '@/contexts/auth-context'

export interface WeeklyProgressStats {
  workouts: { current: number; previous: number; diff: number }
  durationSeconds: { current: number; previous: number; diff: number }
  volumeKg: { current: number; previous: number; diff: number }
  isLoading: boolean
}

export function useWeeklyProgress(): WeeklyProgressStats {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<Omit<WeeklyProgressStats, 'isLoading'>>({
    workouts: { current: 0, previous: 0, diff: 0 },
    durationSeconds: { current: 0, previous: 0, diff: 0 },
    volumeKg: { current: 0, previous: 0, diff: 0 },
  })

  useEffect(() => {
    async function fetchStats() {
      if (!user) return

      try {
        setIsLoading(true)

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

        const endOfLastWeek = new Date(startOfCurrentWeek)
        endOfLastWeek.setMilliseconds(-1)

        // Fetch all workouts from start of last week to now
        const workouts = await database.workoutSessions.getWorkoutsByDateRange(
          user.id,
          startOfLastWeek,
          now
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
      } catch (error) {
        console.error('Failed to fetch weekly progress:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [user])

  return { ...stats, isLoading }
}

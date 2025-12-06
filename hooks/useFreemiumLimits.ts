import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useRef, useState } from 'react'

const FREE_TIER_WEEKLY_LIMIT = 2

export function useFreemiumLimits() {
  const { user } = useAuth()
  const { isProMember } = useSubscription()
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const fetchIdRef = useRef(0)
  const isMountedRef = useRef(true)

  const getWeekBounds = useCallback(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysUntilMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const start = new Date(now)
    start.setDate(now.getDate() + daysUntilMonday)
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    end.setHours(0, 0, 0, 0)

    return { start, end }
  }, [])

  const fetchWorkoutCount = useCallback(async () => {
    if (!user || isProMember) {
      return
    }

    const requestId = ++fetchIdRef.current
    if (isMountedRef.current) {
      setIsLoading(true)
    }

    const { start, end } = getWeekBounds()

    try {
      const { count, error } = await supabase
        .from('workout_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())

      if (!isMountedRef.current || requestId !== fetchIdRef.current) {
        return
      }

      if (error) {
        console.error(
          '[useFreemiumLimits] Error fetching workout count:',
          error,
        )
        setWorkoutsThisWeek(0)
      } else {
        setWorkoutsThisWeek(count ?? 0)
      }
    } catch (error) {
      if (!isMountedRef.current || requestId !== fetchIdRef.current) {
        return
      }
      console.error(
        '[useFreemiumLimits] Exception fetching workout count:',
        error,
      )
      setWorkoutsThisWeek(0)
    } finally {
      if (isMountedRef.current && requestId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [user, isProMember, getWeekBounds])

  const isTimestampInCurrentWeek = useCallback(
    (timestamp?: string | null) => {
      if (!timestamp) {
        return false
      }
      const { start, end } = getWeekBounds()
      const createdAt = new Date(timestamp)
      return createdAt >= start && createdAt < end
    },
    [getWeekBounds],
  )

  const refresh = useCallback(() => {
    fetchWorkoutCount()
  }, [fetchWorkoutCount])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      fetchIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (!user) {
      fetchIdRef.current += 1
      setWorkoutsThisWeek(0)
      setIsLoading(false)
      return
    }

    if (isProMember) {
      fetchIdRef.current += 1
      setWorkoutsThisWeek(0)
      setIsLoading(false)
      return
    }

    fetchWorkoutCount()
  }, [user, isProMember, fetchWorkoutCount])

  useEffect(() => {
    if (!user || isProMember) {
      return
    }

    const channel = supabase
      .channel(`freemium_limits_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const nextCreatedAt =
            payload.eventType === 'DELETE'
              ? payload.old?.created_at
              : payload.new?.created_at

          if (isTimestampInCurrentWeek(nextCreatedAt)) {
            fetchWorkoutCount()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, isProMember, fetchWorkoutCount, isTimestampInCurrentWeek])

  // Pro members have unlimited access
  if (isProMember) {
    return {
      canPostWorkout: true,
      workoutsThisWeek: 0,
      weeklyLimit: Infinity,
      remainingWorkouts: Infinity,
      isLoading: false,
      refresh,
    }
  }

  // Free tier users have weekly limit
  // IMPORTANT: Allow posting while loading to prevent false negatives
  const canPostWorkout = isLoading
    ? true
    : workoutsThisWeek < FREE_TIER_WEEKLY_LIMIT
  const remainingWorkouts = Math.max(
    0,
    FREE_TIER_WEEKLY_LIMIT - workoutsThisWeek,
  )

  return {
    canPostWorkout,
    workoutsThisWeek,
    weeklyLimit: FREE_TIER_WEEKLY_LIMIT,
    remainingWorkouts,
    isLoading,
    refresh,
  }
}

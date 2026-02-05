import { startActivity, stopActivity, updateActivity } from 'expo-live-activity'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react'
import { Platform } from 'react-native'

interface LiveActivityContextType {
  startWorkoutActivity: () => void
  updateWorkoutActivity: (
    elapsedSeconds: number,
    options?: UpdateWorkoutActivityOptions,
  ) => void
  stopWorkoutActivity: () => void
  isActivitySupported: boolean
}

type TimerMode = 'workout' | 'rest'

interface UpdateWorkoutActivityOptions {
  mode?: TimerMode
  displaySeconds?: number
}

const LiveActivityContext = createContext<LiveActivityContextType | undefined>(
  undefined,
)

export function LiveActivityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const activityIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastUpdateAtRef = useRef<number>(0)
  const updateCountRef = useRef<number>(0)

  // Live Activities only work on iOS 16.2+
  const isActivitySupported = Platform.OS === 'ios'

  const formatElapsed = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds))
    const hours = Math.floor(safeSeconds / 3600)
    const minutes = Math.floor((safeSeconds % 3600) / 60)
    const seconds = safeSeconds % 60
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(
        seconds,
      ).padStart(2, '0')}`
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const buildSubtitle = (time: string, mode: TimerMode) => {
    const label = mode === 'rest' ? 'Rest timer' : 'Workout timer'
    return `${time} • ${label}`
  }

  const logState = (label: string, state: any, config?: any) => {
    console.log(`[LiveActivity] ${label}`)
    console.log(`[LiveActivity]   State:`, JSON.stringify(state, null, 2))
    if (config) {
      console.log(`[LiveActivity]   Config:`, JSON.stringify(config, null, 2))
    }
  }

  const startWorkoutActivity = useCallback(() => {
    console.log('[LiveActivity] ===== START startWorkoutActivity =====')
    console.log('[LiveActivity] isActivitySupported:', isActivitySupported)
    console.log('[LiveActivity] Platform.OS:', Platform.OS)
    console.log('[LiveActivity] Current activityId:', activityIdRef.current)

    if (!isActivitySupported) {
      console.log('[LiveActivity] ❌ Not supported on this platform')
      return
    }

    // Stop any existing activity first
    if (activityIdRef.current) {
      console.log(
        '[LiveActivity] Stopping existing activity:',
        activityIdRef.current,
      )
      try {
        const stopState = {
          title: 'Workout Ended',
          subtitle: '0:00',
        }
        logState('stopActivity (existing)', stopState)
        stopActivity(activityIdRef.current, stopState)
        console.log('[LiveActivity] ✅ Stopped existing activity')
      } catch (error) {
        console.log(
          '[LiveActivity] ❌ Error stopping existing activity:',
          error,
        )
      }
      activityIdRef.current = null
    }

    try {
      const workoutStartTime = Date.now()
      startTimeRef.current = workoutStartTime
      lastUpdateAtRef.current = 0
      updateCountRef.current = 0

      console.log('[LiveActivity] Workout start time:', workoutStartTime)
      console.log(
        '[LiveActivity] Workout start ISO:',
        new Date(workoutStartTime).toISOString(),
      )

      // subtitle format: "0:00 • Workout timer" - Swift extracts timer before " • "
      const state = {
        title: 'Rep AI',
        subtitle: buildSubtitle('0:00', 'workout'),
        dynamicIslandImageName: 'bicep',
      }

      const config = {
        backgroundColor: '#000000',
        titleColor: '#FFFFFF',
        subtitleColor: '#4CAF50',
        progressViewTint: '#4CAF50',
        deepLinkUrl: 'repai://create-post',
        timerType: 'digital' as const,
      }

      logState('startActivity', state, config)

      const activityId = startActivity(state, config)

      if (activityId) {
        activityIdRef.current = activityId
        console.log('[LiveActivity] ✅ Started activity with ID:', activityId)
        console.log('[LiveActivity] Activity ID type:', typeof activityId)
        console.log('[LiveActivity] Activity ID length:', activityId.length)
      } else {
        console.log('[LiveActivity] ❌ startActivity returned null/undefined')
      }
    } catch (error) {
      console.log('[LiveActivity] ❌ Error starting activity:', error)
      if (error instanceof Error) {
        console.log('[LiveActivity] Error name:', error.name)
        console.log('[LiveActivity] Error message:', error.message)
        console.log('[LiveActivity] Error stack:', error.stack)
      }
    }
    console.log('[LiveActivity] ===== END startWorkoutActivity =====')
  }, [isActivitySupported])

  const updateWorkoutActivity = useCallback(
    (elapsedSeconds: number, options?: UpdateWorkoutActivityOptions) => {
      if (!isActivitySupported) {
        console.log('[LiveActivity] ❌ updateWorkoutActivity: not supported')
        return
      }

      if (!activityIdRef.current) {
        console.log('[LiveActivity] ❌ updateWorkoutActivity: no activityId')
        return
      }

      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateAtRef.current

      // Throttle to once per second
      if (timeSinceLastUpdate < 1000) {
        if (elapsedSeconds % 5 === 0) {
          console.log(
            `[LiveActivity] ⏭️  Skipping update (throttled): elapsed=${elapsedSeconds}s, timeSinceLastUpdate=${timeSinceLastUpdate}ms`,
          )
        }
        return
      }

      lastUpdateAtRef.current = now

      if (!startTimeRef.current) {
        const calculatedStartTime = now - elapsedSeconds * 1000
        startTimeRef.current = calculatedStartTime
        console.log(
          `[LiveActivity] Calculated startTime: ${calculatedStartTime} (elapsed=${elapsedSeconds}s)`,
        )
      }

      try {
        updateCountRef.current += 1
        const timerMode = options?.mode ?? 'workout'
        const rawDisplaySeconds =
          typeof options?.displaySeconds === 'number'
            ? options.displaySeconds
            : elapsedSeconds
        const displaySeconds = Math.max(0, Math.floor(rawDisplaySeconds))
        const formattedTime = formatElapsed(displaySeconds)
        const subtitle = buildSubtitle(formattedTime, timerMode)

        const updateState = {
          title: 'Rep AI',
          subtitle,
          dynamicIslandImageName: 'bicep',
        }

        // Log every update, but more detail every 5 seconds
        if (elapsedSeconds % 5 === 0) {
          console.log('[LiveActivity] ===== UPDATE =====')
          console.log('[LiveActivity] elapsedSeconds:', elapsedSeconds)
          console.log('[LiveActivity] displaySeconds:', displaySeconds)
          console.log('[LiveActivity] timerMode:', timerMode)
          console.log('[LiveActivity] formattedTime:', formattedTime)
          console.log('[LiveActivity] subtitle:', subtitle)
          console.log('[LiveActivity] activityId:', activityIdRef.current)
          console.log('[LiveActivity] startTime:', startTimeRef.current)
          console.log('[LiveActivity] now:', now)
          console.log('[LiveActivity] updateCount:', updateCountRef.current)
          logState('updateActivity', updateState)
        } else {
          // Light logging for other updates
          console.log(
            `[LiveActivity] Update ${updateCountRef.current}: ${formattedTime} (elapsed=${elapsedSeconds}s)`,
          )
        }

        updateActivity(activityIdRef.current, updateState)
        console.log(
          `[LiveActivity] ✅ updateActivity called (count=${updateCountRef.current})`,
        )
      } catch (error) {
        console.log('[LiveActivity] ❌ Error updating activity:', error)
        if (error instanceof Error) {
          console.log('[LiveActivity] Error name:', error.name)
          console.log('[LiveActivity] Error message:', error.message)
          console.log('[LiveActivity] Error stack:', error.stack)
        }
      }
    },
    [isActivitySupported],
  )

  const stopWorkoutActivity = useCallback(() => {
    console.log('[LiveActivity] ===== START stopWorkoutActivity =====')
    console.log('[LiveActivity] isActivitySupported:', isActivitySupported)
    console.log('[LiveActivity] activityId:', activityIdRef.current)

    if (!isActivitySupported) {
      console.log('[LiveActivity] ❌ Not supported')
      return
    }

    if (!activityIdRef.current) {
      console.log('[LiveActivity] ❌ No activityId to stop')
      return
    }

    try {
      const stopState = {
        title: 'Rep AI',
        subtitle: 'Complete! 💪',
      }
      logState('stopActivity', stopState)
      stopActivity(activityIdRef.current, stopState)
      console.log('[LiveActivity] ✅ Stopped successfully')
      activityIdRef.current = null
      startTimeRef.current = 0
      lastUpdateAtRef.current = 0
      updateCountRef.current = 0
    } catch (error) {
      console.log('[LiveActivity] ❌ Error stopping activity:', error)
      if (error instanceof Error) {
        console.log('[LiveActivity] Error name:', error.name)
        console.log('[LiveActivity] Error message:', error.message)
        console.log('[LiveActivity] Error stack:', error.stack)
      }
    }
    console.log('[LiveActivity] ===== END stopWorkoutActivity =====')
  }, [isActivitySupported])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityIdRef.current) {
        console.log(
          '[LiveActivity] Cleanup on unmount, activityId:',
          activityIdRef.current,
        )
        try {
          stopActivity(activityIdRef.current, {
            title: 'Rep AI',
            subtitle: 'Session Ended',
          })
          console.log('[LiveActivity] ✅ Cleanup stopActivity called')
        } catch (error) {
          console.log('[LiveActivity] ❌ Cleanup error:', error)
        }
      }
    }
  }, [])

  return (
    <LiveActivityContext.Provider
      value={{
        startWorkoutActivity,
        updateWorkoutActivity,
        stopWorkoutActivity,
        isActivitySupported,
      }}
    >
      {children}
    </LiveActivityContext.Provider>
  )
}

export function useLiveActivity() {
  const context = useContext(LiveActivityContext)
  if (context === undefined) {
    throw new Error(
      'useLiveActivity must be used within a LiveActivityProvider',
    )
  }
  return context
}

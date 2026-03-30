import {
  addActivityUpdatesListener,
  startActivity,
  stopActivity,
  updateActivity,
} from 'expo-live-activity'
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
  updateWorkoutActivity: (elapsedSeconds: number) => void
  stopWorkoutActivity: () => void
  isActivitySupported: boolean
}

const LiveActivityContext = createContext<LiveActivityContextType | undefined>(
  undefined,
)
const DEBUG_LOGS = false

export function LiveActivityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const activityIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastUpdateAtRef = useRef<number>(0)
  const updateCountRef = useRef<number>(0)

  const iosVersion =
    Platform.OS === 'ios'
      ? Number.parseFloat(String(Platform.Version))
      : Number.NaN
  // ActivityKit support in this library starts at iOS 16.2+.
  const isActivitySupported =
    Platform.OS === 'ios' && !Number.isNaN(iosVersion) && iosVersion >= 16.2

  const formatElapsed = useCallback((totalSeconds: number) => {
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
  }, [])

  const logState = useCallback((label: string, state: any, config?: any) => {
    if (!DEBUG_LOGS) return
    console.log(`[LiveActivity] ${label}`)
    console.log(`[LiveActivity]   State:`, JSON.stringify(state, null, 2))
    if (config) {
      console.log(`[LiveActivity]   Config:`, JSON.stringify(config, null, 2))
    }
  }, [])

  const startWorkoutActivity = useCallback(() => {
    if (DEBUG_LOGS) {
      console.log('[LiveActivity] ===== START startWorkoutActivity =====')
      console.log('[LiveActivity] isActivitySupported:', isActivitySupported)
      console.log('[LiveActivity] Platform.OS:', Platform.OS)
      console.log('[LiveActivity] Current activityId:', activityIdRef.current)
    }

    if (!isActivitySupported) {
      if (DEBUG_LOGS) console.log('[LiveActivity] ❌ Not supported on this platform')
      return
    }

    // Stop any existing activity first
    if (activityIdRef.current) {
      if (DEBUG_LOGS) {
        console.log(
          '[LiveActivity] Stopping existing activity:',
          activityIdRef.current,
        )
      }
      try {
        const stopState = {
          title: 'Workout Ended',
          subtitle: '0:00',
        }
        logState('stopActivity (existing)', stopState)
        stopActivity(activityIdRef.current, stopState)
        if (DEBUG_LOGS) console.log('[LiveActivity] ✅ Stopped existing activity')
      } catch (e) {
        if (DEBUG_LOGS) {
          console.log(
            '[LiveActivity] ❌ Error stopping existing activity:',
            e,
          )
        }
      }
      activityIdRef.current = null
    }

    try {
      const workoutStartTime = Date.now()
      startTimeRef.current = workoutStartTime
      lastUpdateAtRef.current = 0
      updateCountRef.current = 0

      if (DEBUG_LOGS) {
        console.log('[LiveActivity] Workout start time:', workoutStartTime)
        console.log(
          '[LiveActivity] Workout start ISO:',
          new Date(workoutStartTime).toISOString(),
        )
      }

      // subtitle format: "0:00 • Rep AI" - Swift extracts timer before " • "
      const state = {
        title: 'Rep AI',
        subtitle: '0:00',
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
        if (DEBUG_LOGS) {
          console.log('[LiveActivity] ✅ Started activity with ID:', activityId)
          console.log('[LiveActivity] Activity ID type:', typeof activityId)
          console.log('[LiveActivity] Activity ID length:', activityId.length)
        }
      } else {
        if (DEBUG_LOGS) console.log('[LiveActivity] ❌ startActivity returned null/undefined')
      }
    } catch (e) {
      if (DEBUG_LOGS) {
        console.log('[LiveActivity] ❌ Error starting activity:', e)
        if (e instanceof Error) {
          console.log('[LiveActivity] Error name:', e.name)
          console.log('[LiveActivity] Error message:', e.message)
          console.log('[LiveActivity] Error stack:', e.stack)
        }
      }
    }
    if (DEBUG_LOGS) console.log('[LiveActivity] ===== END startWorkoutActivity =====')
  }, [isActivitySupported, logState])

  useEffect(() => {
    if (!isActivitySupported) {
      return
    }

    const subscription = addActivityUpdatesListener?.((event) => {
      if (!event) {
        return
      }

      if (DEBUG_LOGS) {
        console.log('[LiveActivity] Native state change:', event)
      }

      if (
        activityIdRef.current &&
        event.activityID === activityIdRef.current &&
        (event.activityState === 'ended' || event.activityState === 'dismissed')
      ) {
        activityIdRef.current = null
        startTimeRef.current = 0
        lastUpdateAtRef.current = 0
        updateCountRef.current = 0
      }
    })

    return () => {
      subscription?.remove?.()
    }
  }, [isActivitySupported])

  const updateWorkoutActivity = useCallback(
    (elapsedSeconds: number) => {
      if (!isActivitySupported) {
        if (DEBUG_LOGS) console.log('[LiveActivity] ❌ updateWorkoutActivity: not supported')
        return
      }

      if (!activityIdRef.current) {
        // Silently return if no activity is active. This can happen during hydration
        // or immediately after a workout is cleared while state is settling.
        return
      }

      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateAtRef.current

      // Throttle to once per second
      if (timeSinceLastUpdate < 1000) {
        if (DEBUG_LOGS && elapsedSeconds % 5 === 0) {
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
        if (DEBUG_LOGS) {
          console.log(
            `[LiveActivity] Calculated startTime: ${calculatedStartTime} (elapsed=${elapsedSeconds}s)`,
          )
        }
      }

      try {
        updateCountRef.current += 1
        const formattedTime = formatElapsed(elapsedSeconds)
        const subtitle = formattedTime

        const updateState = {
          title: 'Rep AI',
          subtitle,
          dynamicIslandImageName: 'bicep',
        }

        // Log every update, but more detail every 5 seconds
        if (DEBUG_LOGS) {
          if (elapsedSeconds % 5 === 0) {
            console.log('[LiveActivity] ===== UPDATE =====')
            console.log('[LiveActivity] elapsedSeconds:', elapsedSeconds)
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
        }

        updateActivity(activityIdRef.current, updateState)
        if (DEBUG_LOGS) {
          console.log(
            `[LiveActivity] ✅ updateActivity called (count=${updateCountRef.current})`,
          )
        }
      } catch (e) {
        if (DEBUG_LOGS) {
          console.log('[LiveActivity] ❌ Error updating activity:', e)
          if (e instanceof Error) {
            console.log('[LiveActivity] Error name:', e.name)
            console.log('[LiveActivity] Error message:', e.message)
            console.log('[LiveActivity] Error stack:', e.stack)
          }
        }
      }
    },
    [formatElapsed, isActivitySupported, logState],
  )

  const stopWorkoutActivity = useCallback(() => {
    if (DEBUG_LOGS) {
      console.log('[LiveActivity] ===== START stopWorkoutActivity =====')
      console.log('[LiveActivity] isActivitySupported:', isActivitySupported)
      console.log('[LiveActivity] activityId:', activityIdRef.current)
    }

    if (!isActivitySupported) {
      if (DEBUG_LOGS) console.log('[LiveActivity] ❌ Not supported')
      return
    }

    if (!activityIdRef.current) {
      // Silently return if no activity is active to stop.
      return
    }

    try {
      const stopState = {
        title: 'Rep AI',
        subtitle: 'Complete! 💪',
      }
      logState('stopActivity', stopState)
      stopActivity(activityIdRef.current, stopState)
      if (DEBUG_LOGS) console.log('[LiveActivity] ✅ Stopped successfully')
      activityIdRef.current = null
      startTimeRef.current = 0
      lastUpdateAtRef.current = 0
      updateCountRef.current = 0
    } catch (e) {
      if (DEBUG_LOGS) {
        console.log('[LiveActivity] ❌ Error stopping activity:', e)
        if (e instanceof Error) {
          console.log('[LiveActivity] Error name:', e.name)
          console.log('[LiveActivity] Error message:', e.message)
          console.log('[LiveActivity] Error stack:', e.stack)
        }
      }
    }
    if (DEBUG_LOGS) console.log('[LiveActivity] ===== END stopWorkoutActivity =====')
  }, [isActivitySupported, logState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityIdRef.current) {
        if (DEBUG_LOGS) {
          console.log(
            '[LiveActivity] Cleanup on unmount, activityId:',
            activityIdRef.current,
          )
        }
        try {
          stopActivity(activityIdRef.current, {
            title: 'Rep AI',
            subtitle: 'Session Ended',
          })
          if (DEBUG_LOGS) console.log('[LiveActivity] ✅ Cleanup stopActivity called')
        } catch (e) {
          if (DEBUG_LOGS) console.log('[LiveActivity] ❌ Cleanup error:', e)
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

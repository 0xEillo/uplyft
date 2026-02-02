import {
    startActivity,
    stopActivity
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

export function LiveActivityProvider({ children }: { children: React.ReactNode }) {
  const activityIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(0)

  // Live Activities only work on iOS 16.2+
  const isActivitySupported = Platform.OS === 'ios'

  const startWorkoutActivity = useCallback(() => {
    if (!isActivitySupported) {
      console.log('[LiveActivity] Not supported on this platform')
      return
    }

    // Stop any existing activity first
    if (activityIdRef.current) {
      console.log('[LiveActivity] Stopping existing activity:', activityIdRef.current)
      try {
        stopActivity(activityIdRef.current, {
          title: 'Workout Ended',
          subtitle: '',
        })
      } catch (error) {
        console.log('[LiveActivity] Error stopping previous activity:', error)
      }
      activityIdRef.current = null
    }

    try {
      // Store workout start time - this will be used by native SwiftUI timer
      const workoutStartTime = Date.now()
      startTimeRef.current = workoutStartTime
      
      console.log('[LiveActivity] ===== STARTING ACTIVITY =====')
      console.log('[LiveActivity] Workout start time:', workoutStartTime)
      console.log('[LiveActivity] As ISO date:', new Date(workoutStartTime).toISOString())
      
      // Pass start time via progressBar.date - the native module maps this to timerEndDateInMilliseconds
      // Only pass dynamicIslandImageName (not imageName) to hide the image on lock screen
      const state: any = {
        title: 'Rep AI',
        subtitle: 'Workout Active',
        progressBar: {
          date: workoutStartTime,
        },
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
      
      console.log('[LiveActivity] State:', JSON.stringify(state, null, 2))
      
      const activityId = startActivity(state, config)

      if (activityId) {
        activityIdRef.current = activityId
        console.log('[LiveActivity] Started activity with ID:', activityId)
      } else {
        console.log('[LiveActivity] startActivity returned undefined/null')
      }
    } catch (error) {
      console.log('[LiveActivity] Error starting activity:', error)
    }
  }, [isActivitySupported])

  const updateWorkoutActivity = useCallback((_elapsedSeconds: number) => {
    // No need to update frequently - native SwiftUI timer handles the counting
    // Only keep this for potential future use (e.g., updating subtitle on pause)
  }, [])

  const stopWorkoutActivity = useCallback(() => {
    if (!isActivitySupported || !activityIdRef.current) return

    console.log('[LiveActivity] Stopping activity:', activityIdRef.current)

    try {
      stopActivity(activityIdRef.current, {
        title: 'Rep AI',
        subtitle: 'Complete! 💪',
        progress: 1,
      } as any)
      console.log('[LiveActivity] Stopped successfully')
      activityIdRef.current = null
      startTimeRef.current = 0
    } catch (error) {
      console.log('[LiveActivity] Error stopping activity:', error)
    }
  }, [isActivitySupported])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityIdRef.current) {
        console.log('[LiveActivity] Cleanup on unmount')
        try {
          stopActivity(activityIdRef.current, {
            title: 'Rep AI',
            subtitle: 'Session Ended',
          })
        } catch {
          // Silently fail on cleanup
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

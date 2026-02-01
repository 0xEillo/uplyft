import { useAudioPlayer } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react'
import { AppState } from 'react-native'

const timerSound = require('@/assets/sounds/stopwatch.mp3')

interface RestTimerContextType {
  remainingSeconds: number
  isActive: boolean
  initialDuration: number
  start: (duration: number) => void
  stop: () => void
  addTime: (seconds: number) => void
}

const RestTimerContext = createContext<RestTimerContextType | undefined>(
  undefined,
)

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [initialDuration, setInitialDuration] = useState(0)

  // Use refs for interval and background handling
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimeRef = useRef<number | null>(null)
  const appStateRef = useRef(AppState.currentState)
  const notificationIdRef = useRef<string | null>(null)

  const player = useAudioPlayer(timerSound)

  const playSound = () => {
    try {
      player.seekTo(0)
      player.play()
    } catch (error) {
      console.log('Error playing sound:', error)
    }
  }

  // Cancel any scheduled rest timer notification
  const cancelNotification = useCallback(async () => {
    if (notificationIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          notificationIdRef.current,
        )
      } catch (error) {
        console.log('Error cancelling notification:', error)
      }
      notificationIdRef.current = null
    }
  }, [])

  // Schedule a notification for when the rest timer completes
  const scheduleNotification = useCallback(async (seconds: number) => {
    try {
      // Cancel any existing notification first
      await cancelNotification()

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest Complete ⏱️',
          body: 'Time to start your next set!',
          sound: true,
          data: { type: 'rest_timer' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: seconds,
        },
      })

      notificationIdRef.current = notificationId
    } catch (error) {
      console.log('Error scheduling notification:', error)
    }
  }, [cancelNotification])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsActive(false)
    setRemainingSeconds(0)
    endTimeRef.current = null
    // Cancel the background notification when timer is stopped
    cancelNotification()
  }, [cancelNotification])

  const start = useCallback(
    (duration: number) => {
      stop() // Clear any existing timer
      setInitialDuration(duration)
      setRemainingSeconds(duration)
      setIsActive(true)

      endTimeRef.current = Date.now() + duration * 1000

      // Schedule background notification
      scheduleNotification(duration)

      intervalRef.current = setInterval(() => {
        if (!endTimeRef.current) return

        const now = Date.now()
        const diff = Math.ceil((endTimeRef.current - now) / 1000)

        if (diff <= 0) {
          // Timer finished in foreground
          setRemainingSeconds(0)
          stop() // This also cancels the notification

          // Trigger feedback (in-app vibration and sound)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          playSound()
        } else {
          setRemainingSeconds(diff)
        }
      }, 1000)
    },
    [stop, scheduleNotification],
  )

  const addTime = useCallback(
    (seconds: number) => {
      if (!isActive || !endTimeRef.current) return

      endTimeRef.current += seconds * 1000
      setRemainingSeconds((prev) => {
        const newRemaining = prev + seconds
        // Reschedule notification with updated time
        scheduleNotification(newRemaining)
        return newRemaining
      })
    },
    [isActive, scheduleNotification],
  )

  // Handle background/foreground transitions to keep timer accurate
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Coming back to foreground - update timer immediately
        if (isActive && endTimeRef.current) {
          const now = Date.now()
          const diff = Math.ceil((endTimeRef.current - now) / 1000)

          if (diff <= 0) {
            setRemainingSeconds(0)
            stop()
          } else {
            setRemainingSeconds(diff)
          }
        }
      }

      appStateRef.current = nextAppState
    })

    return () => {
      subscription.remove()
    }
  }, [isActive, stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      // Cancel any pending notification
      if (notificationIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(
          notificationIdRef.current,
        ).catch(() => {})
      }
    }
  }, [])

  return (
    <RestTimerContext.Provider
      value={{
        remainingSeconds,
        isActive,
        initialDuration,
        start,
        stop,
        addTime,
      }}
    >
      {children}
    </RestTimerContext.Provider>
  )
}

export function useRestTimerContext() {
  const context = useContext(RestTimerContext)
  if (context === undefined) {
    throw new Error(
      'useRestTimerContext must be used within a RestTimerProvider',
    )
  }
  return context
}


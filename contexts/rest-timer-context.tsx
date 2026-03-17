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
import { AppState, Platform } from 'react-native'

const timerSound = require('../assets/sounds/stopwatch.mp3')
const REST_TIMER_CHANNEL_ID = 'rest_timer_alarm'
const REST_TIMER_SOUND_FILE = 'stopwatch.mp3'
const REST_TIMER_VIBRATION_PATTERN = [0, 600, 250, 600]

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

  const playSound = useCallback(() => {
    try {
      player.seekTo(0)
      player.play()
    } catch (error) {
      console.log('Error playing sound:', error)
    }
  }, [player])

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

  const ensureNotificationPermission = useCallback(async () => {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync()

      if (existingStatus === 'granted') {
        return true
      }

      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      })

      return status === 'granted'
    } catch (error) {
      console.log('Error requesting notification permission:', error)
      return false
    }
  }, [])

  const ensureRestTimerChannel = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return
    }

    try {
      await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
        name: 'Rest Timer',
        description: 'Alerts when your workout rest timer finishes.',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: REST_TIMER_VIBRATION_PATTERN,
        enableVibrate: true,
        enableLights: true,
        showBadge: false,
        lightColor: '#FF6B35',
        sound: REST_TIMER_SOUND_FILE,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      })
    } catch (error) {
      console.log('Error configuring rest timer notification channel:', error)
    }
  }, [])

  const createRestTimerNotificationContent = useCallback(
    (useCustomSound: boolean): Notifications.NotificationContentInput => ({
      title: 'Rest Complete ⏱️',
      body: 'Time to start your next set!',
      sound:
        Platform.OS === 'ios'
          ? useCustomSound
            ? REST_TIMER_SOUND_FILE
            : 'default'
          : true,
      interruptionLevel: Platform.OS === 'ios' ? 'timeSensitive' : undefined,
      priority:
        Platform.OS === 'android'
          ? Notifications.AndroidNotificationPriority.MAX
          : undefined,
      vibrate:
        Platform.OS === 'android' ? REST_TIMER_VIBRATION_PATTERN : undefined,
      data: { type: 'rest_timer' },
    }),
    [],
  )

  // Schedule a notification for when the rest timer completes
  const scheduleNotification = useCallback(async (seconds: number) => {
    try {
      // Cancel any existing notification first
      await cancelNotification()

      const hasPermission = await ensureNotificationPermission()
      if (!hasPermission) {
        return
      }

      await ensureRestTimerChannel()

      const trigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: Platform.OS === 'android' ? REST_TIMER_CHANNEL_ID : undefined,
      } satisfies Notifications.TimeIntervalTriggerInput

      let notificationId: string

      try {
        notificationId = await Notifications.scheduleNotificationAsync({
          content: createRestTimerNotificationContent(true),
          trigger,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        if (
          Platform.OS === 'ios' &&
          errorMessage.includes(
            `Custom sound '${REST_TIMER_SOUND_FILE}' not found in native app`,
          )
        ) {
          console.warn(
            `Custom notification sound ${REST_TIMER_SOUND_FILE} is unavailable in this iOS build. Falling back to the default sound.`,
          )
          notificationId = await Notifications.scheduleNotificationAsync({
            content: createRestTimerNotificationContent(false),
            trigger,
          })
        } else {
          throw error
        }
      }

      notificationIdRef.current = notificationId
    } catch (error) {
      console.log('Error scheduling notification:', error)
    }
  }, [
    cancelNotification,
    createRestTimerNotificationContent,
    ensureNotificationPermission,
    ensureRestTimerChannel,
  ])

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
    [playSound, scheduleNotification, stop],
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

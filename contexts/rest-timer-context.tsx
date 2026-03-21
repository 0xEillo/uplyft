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
import { MMKV } from 'react-native-mmkv'

const timerSound = require('../assets/sounds/stopwatch.mp3')
const REST_TIMER_CHANNEL_ID = 'rest_timer_alarm'
const REST_TIMER_SOUND_FILE = 'stopwatch.mp3'
const REST_TIMER_VIBRATION_PATTERN = [0, 600, 250, 600]
const REST_TIMER_STORAGE_KEY = '@rest_timer_state'
const restTimerStorage = new MMKV({ id: 'rest-timer' })

type PersistedRestTimerState = {
  durationSeconds: number
  endTimeMs: number
  notificationId: string | null
  updatedAtMs: number
}

function readPersistedRestTimerState(): PersistedRestTimerState | null {
  const raw = restTimerStorage.getString(REST_TIMER_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedRestTimerState>
    if (
      typeof parsed.durationSeconds !== 'number' ||
      typeof parsed.endTimeMs !== 'number' ||
      typeof parsed.updatedAtMs !== 'number'
    ) {
      return null
    }

    return {
      durationSeconds: parsed.durationSeconds,
      endTimeMs: parsed.endTimeMs,
      notificationId:
        typeof parsed.notificationId === 'string' ? parsed.notificationId : null,
      updatedAtMs: parsed.updatedAtMs,
    }
  } catch {
    return null
  }
}

function writePersistedRestTimerState(
  state: PersistedRestTimerState | null,
): void {
  if (!state) {
    restTimerStorage.delete(REST_TIMER_STORAGE_KEY)
    return
  }

  restTimerStorage.set(REST_TIMER_STORAGE_KEY, JSON.stringify(state))
}

function getRemainingSeconds(endTimeMs: number): number {
  return Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000))
}

function getScheduledNotificationType(notification: unknown): unknown {
  const candidate = notification as {
    content?: { data?: { type?: unknown } }
    request?: { content?: { data?: { type?: unknown } } }
  }

  return (
    candidate.content?.data?.type ??
    candidate.request?.content?.data?.type ??
    null
  )
}

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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimeRef = useRef<number | null>(null)
  const appStateRef = useRef(AppState.currentState)
  const notificationIdRef = useRef<string | null>(null)
  const initialDurationRef = useRef(0)
  const timerVersionRef = useRef(0)

  const player = useAudioPlayer(timerSound)

  const playSound = useCallback(() => {
    try {
      player.seekTo(0)
      player.play()
    } catch (error) {
      console.log('Error playing sound:', error)
    }
  }, [player])

  const setInitialDurationValue = useCallback((duration: number) => {
    initialDurationRef.current = duration
    setInitialDuration(duration)
  }, [])

  const persistTimerState = useCallback(
    (state: Omit<PersistedRestTimerState, 'updatedAtMs'> | null) => {
      if (!state) {
        writePersistedRestTimerState(null)
        return
      }

      writePersistedRestTimerState({
        ...state,
        updatedAtMs: Date.now(),
      })
    },
    [],
  )

  const clearTicker = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const clearTimerState = useCallback(() => {
    clearTicker()
    endTimeRef.current = null
    notificationIdRef.current = null
    setIsActive(false)
    setRemainingSeconds(0)
    setInitialDurationValue(0)
    persistTimerState(null)
  }, [clearTicker, persistTimerState, setInitialDurationValue])

  const cancelRestTimerNotifications = useCallback(
    async (expectedTimerVersion = timerVersionRef.current) => {
      const notificationIds = new Set<string>()

      if (notificationIdRef.current) {
        notificationIds.add(notificationIdRef.current)
      }

    const persistedState = readPersistedRestTimerState()
    if (persistedState?.notificationId) {
      notificationIds.add(persistedState.notificationId)
    }

    try {
      const scheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync()

      scheduledNotifications.forEach((notification) => {
        if (getScheduledNotificationType(notification) === 'rest_timer') {
          notificationIds.add(notification.identifier)
        }
      })
    } catch (error) {
      console.log('Error loading scheduled rest timer notifications:', error)
    }

    if (expectedTimerVersion !== timerVersionRef.current) {
      return
    }

    await Promise.allSettled(
      Array.from(notificationIds).map((notificationId) =>
        Notifications.cancelScheduledNotificationAsync(notificationId),
      ),
    )
    },
    [],
  )

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

  const syncScheduledNotification = useCallback(
    async (endTimeMs: number, durationSeconds: number, timerVersion: number) => {
      try {
        await cancelRestTimerNotifications(timerVersion)

        if (
          timerVersion !== timerVersionRef.current ||
          endTimeRef.current !== endTimeMs
        ) {
          return
        }

        const remainingSeconds = getRemainingSeconds(endTimeMs)
        if (remainingSeconds <= 0) {
          return
        }

        const hasPermission = await ensureNotificationPermission()
        if (!hasPermission) {
          persistTimerState({
            durationSeconds,
            endTimeMs,
            notificationId: null,
          })
          return
        }

        await ensureRestTimerChannel()

        const trigger = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: remainingSeconds,
          channelId:
            Platform.OS === 'android' ? REST_TIMER_CHANNEL_ID : undefined,
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

        if (
          timerVersion !== timerVersionRef.current ||
          endTimeRef.current !== endTimeMs
        ) {
          await Notifications.cancelScheduledNotificationAsync(notificationId).catch(
            () => {},
          )
          return
        }

        notificationIdRef.current = notificationId
        persistTimerState({
          durationSeconds,
          endTimeMs,
          notificationId,
        })
      } catch (error) {
        console.log('Error scheduling notification:', error)
      }
    },
    [
      cancelRestTimerNotifications,
      createRestTimerNotificationContent,
      ensureNotificationPermission,
      ensureRestTimerChannel,
      persistTimerState,
    ],
  )

  const completeTimer = useCallback(
    async (playFeedback: boolean) => {
      timerVersionRef.current += 1
      clearTimerState()
      await cancelRestTimerNotifications(timerVersionRef.current)

      if (playFeedback) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        playSound()
      }
    },
    [cancelRestTimerNotifications, clearTimerState, playSound],
  )

  const activateTimer = useCallback(
    (endTimeMs: number, durationSeconds: number) => {
      const sanitizedDuration = Math.max(1, Math.round(durationSeconds))
      const remaining = getRemainingSeconds(endTimeMs)

      timerVersionRef.current += 1
      const timerVersion = timerVersionRef.current

      clearTicker()

      if (remaining <= 0) {
        void completeTimer(false)
        return
      }

      endTimeRef.current = endTimeMs
      notificationIdRef.current = null
      setInitialDurationValue(sanitizedDuration)
      setRemainingSeconds(remaining)
      setIsActive(true)
      persistTimerState({
        durationSeconds: sanitizedDuration,
        endTimeMs,
        notificationId: null,
      })

      intervalRef.current = setInterval(() => {
        const currentEndTimeMs = endTimeRef.current
        if (!currentEndTimeMs) return

        const nextRemaining = getRemainingSeconds(currentEndTimeMs)
        if (nextRemaining <= 0) {
          void completeTimer(true)
          return
        }

        setRemainingSeconds(nextRemaining)
      }, 1000)

      void syncScheduledNotification(endTimeMs, sanitizedDuration, timerVersion)
    },
    [
      clearTicker,
      completeTimer,
      persistTimerState,
      setInitialDurationValue,
      syncScheduledNotification,
    ],
  )

  const stop = useCallback(() => {
    timerVersionRef.current += 1
    const nextTimerVersion = timerVersionRef.current
    clearTimerState()
    void cancelRestTimerNotifications(nextTimerVersion)
  }, [cancelRestTimerNotifications, clearTimerState])

  const start = useCallback(
    (duration: number) => {
      const sanitizedDuration = Math.max(1, Math.round(duration))
      activateTimer(Date.now() + sanitizedDuration * 1000, sanitizedDuration)
    },
    [activateTimer],
  )

  const addTime = useCallback(
    (seconds: number) => {
      if (!isActive || !endTimeRef.current) return

      const sanitizedSeconds = Math.max(1, Math.round(seconds))
      const nextEndTimeMs = endTimeRef.current + sanitizedSeconds * 1000
      const nextDurationSeconds = initialDurationRef.current + sanitizedSeconds

      activateTimer(nextEndTimeMs, nextDurationSeconds)
    },
    [activateTimer, isActive],
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (isActive && endTimeRef.current) {
          const diff = getRemainingSeconds(endTimeRef.current)

          if (diff <= 0) {
            void completeTimer(false)
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
  }, [completeTimer, isActive])

  useEffect(() => {
    const persistedState = readPersistedRestTimerState()
    if (!persistedState) {
      return
    }

    if (getRemainingSeconds(persistedState.endTimeMs) <= 0) {
      timerVersionRef.current += 1
      const nextTimerVersion = timerVersionRef.current
      clearTimerState()
      void cancelRestTimerNotifications(nextTimerVersion)
      return
    }

    activateTimer(persistedState.endTimeMs, persistedState.durationSeconds)
  }, [activateTimer, cancelRestTimerNotifications, clearTimerState])

  useEffect(() => {
    return () => {
      timerVersionRef.current += 1
      const nextTimerVersion = timerVersionRef.current
      clearTicker()
      void cancelRestTimerNotifications(nextTimerVersion)
    }
  }, [cancelRestTimerNotifications, clearTicker])

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

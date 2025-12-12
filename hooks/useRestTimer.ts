import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

export function useRestTimer() {
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [initialDuration, setInitialDuration] = useState(0)
  
  // Use refs for interval and background handling
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimeRef = useRef<number | null>(null)
  const appStateRef = useRef(AppState.currentState)

  const playSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/stopwatch.mp3')
      )
      await sound.playAsync()
      // Unload sound after playing to free resources
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          await sound.unloadAsync()
        }
      })
    } catch (error) {
      console.log('Error playing sound:', error)
    }
  }

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsActive(false)
    setRemainingSeconds(0)
    endTimeRef.current = null
  }, [])

  const start = useCallback((duration: number) => {
    stop() // Clear any existing timer
    setInitialDuration(duration)
    setRemainingSeconds(duration)
    setIsActive(true)
    
    endTimeRef.current = Date.now() + duration * 1000
    
    intervalRef.current = setInterval(() => {
      if (!endTimeRef.current) return

      const now = Date.now()
      const diff = Math.ceil((endTimeRef.current - now) / 1000)

      if (diff <= 0) {
        // Timer finished
        setRemainingSeconds(0)
        stop()
        
        // Trigger feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        playSound()
      } else {
        setRemainingSeconds(diff)
      }
    }, 1000)
  }, [stop])

  const addTime = useCallback((seconds: number) => {
    if (!isActive || !endTimeRef.current) return

    endTimeRef.current += seconds * 1000
    setRemainingSeconds((prev) => prev + seconds)
  }, [isActive])

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
    }
  }, [])

  return {
    remainingSeconds,
    isActive,
    initialDuration,
    start,
    stop,
    addTime,
  }
}

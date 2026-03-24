import { Exercise } from '@/types/database.types'
import { useCallback, useRef } from 'react'

// Global callback ref to persist across navigation
let globalSelectionCallback: ((exercise: Exercise | Exercise[]) => void) | null = null

export function useExerciseSelection() {
  const callbackRef = useRef<((exercise: Exercise | Exercise[]) => void) | null>(null)

  const registerCallback = useCallback((callback: (exercise: Exercise | Exercise[]) => void) => {
    callbackRef.current = callback
    globalSelectionCallback = callback
  }, [])

  const clearCallback = useCallback(() => {
    callbackRef.current = null
    globalSelectionCallback = null
  }, [])

  const callCallback = useCallback((exercise: Exercise | Exercise[]) => {
    const callback = globalSelectionCallback
    if (!callback) return

    // Clear first so the callback can only be consumed once, even if the
    // caller double-taps or the callback triggers more navigation.
    clearCallback()
    callback(exercise)
  }, [clearCallback])

  return {
    registerCallback,
    clearCallback,
    callCallback,
  }
}

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
    if (globalSelectionCallback) {
      globalSelectionCallback(exercise)
      clearCallback()
    }
  }, [clearCallback])

  return {
    registerCallback,
    clearCallback,
    callCallback,
  }
}

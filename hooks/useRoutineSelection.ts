import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { useCallback, useRef } from 'react'

// Global callback ref to persist across navigation
let globalSelectionCallback: ((routine: WorkoutRoutineWithDetails) => void) | null = null

export function useRoutineSelection() {
  const callbackRef = useRef<((routine: WorkoutRoutineWithDetails) => void) | null>(null)

  const registerCallback = useCallback((callback: (routine: WorkoutRoutineWithDetails) => void) => {
    callbackRef.current = callback
    globalSelectionCallback = callback
  }, [])

  const clearCallback = useCallback(() => {
    callbackRef.current = null
    globalSelectionCallback = null
  }, [])

  const callCallback = useCallback((routine: WorkoutRoutineWithDetails) => {
    if (globalSelectionCallback) {
      globalSelectionCallback(routine)
      clearCallback()
    }
  }, [clearCallback])

  return {
    registerCallback,
    clearCallback,
    callCallback,
  }
}

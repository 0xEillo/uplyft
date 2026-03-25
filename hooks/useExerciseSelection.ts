import { Exercise } from '@/types/database.types'
import { useCallback } from 'react'

type ExerciseSelectionCallback = (exercise: Exercise | Exercise[]) => void

// Shared one-shot callback store to persist across navigation.
const selectionCallbackStore: {
  current: ExerciseSelectionCallback | null
} = {
  current: null,
}

export function useExerciseSelection() {
  const registerCallback = useCallback((callback: ExerciseSelectionCallback) => {
    selectionCallbackStore.current = callback
  }, [])

  const clearCallback = useCallback(() => {
    selectionCallbackStore.current = null
  }, [])

  const callCallback = useCallback((exercise: Exercise | Exercise[]) => {
    const callback = selectionCallbackStore.current

    if (typeof callback !== 'function') {
      selectionCallbackStore.current = null
      return
    }

    // Clear before invoke so repeated taps cannot deliver the selection twice.
    selectionCallbackStore.current = null
    callback(exercise)
  }, [])

  return {
    registerCallback,
    clearCallback,
    callCallback,
  }
}

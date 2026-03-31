import type { WorkoutComposerSession } from '@/lib/utils/workout-composer-session'

type WorkoutComposerSessionListener = (session: WorkoutComposerSession) => void

const listeners = new Set<WorkoutComposerSessionListener>()

export function subscribeToWorkoutComposerSessionRestored(
  listener: WorkoutComposerSessionListener,
): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function emitWorkoutComposerSessionRestored(
  session: WorkoutComposerSession,
): void {
  listeners.forEach((listener) => {
    listener(session)
  })
}

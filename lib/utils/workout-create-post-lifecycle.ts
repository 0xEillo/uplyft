export interface WorkoutTimerAutoStartInput {
  hasWorkoutDraftContent: boolean
  isWorkoutTimerRunning: boolean
  isHydrating: boolean
  isScreenFocused: boolean
  isFinalizingWorkout: boolean
}

export function shouldAutoStartWorkoutTimer({
  hasWorkoutDraftContent,
  isWorkoutTimerRunning,
  isHydrating,
  isScreenFocused,
  isFinalizingWorkout,
}: WorkoutTimerAutoStartInput): boolean {
  return (
    hasWorkoutDraftContent &&
    !isWorkoutTimerRunning &&
    !isHydrating &&
    isScreenFocused &&
    !isFinalizingWorkout
  )
}

export type LiveActivitySyncAction = 'none' | 'start' | 'update' | 'stop'

export interface LiveActivitySyncInput {
  hasStartedActivity: boolean
  isWorkoutTimerRunning: boolean
  workoutElapsedSeconds: number
  isFinalizingWorkout: boolean
}

export function getLiveActivitySyncAction({
  hasStartedActivity,
  isWorkoutTimerRunning,
  workoutElapsedSeconds,
  isFinalizingWorkout,
}: LiveActivitySyncInput): LiveActivitySyncAction {
  if (isFinalizingWorkout) {
    return hasStartedActivity ? 'stop' : 'none'
  }

  if (isWorkoutTimerRunning && workoutElapsedSeconds > 0) {
    return hasStartedActivity ? 'update' : 'start'
  }

  return hasStartedActivity ? 'stop' : 'none'
}

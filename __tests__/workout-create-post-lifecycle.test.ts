import {
  getLiveActivitySyncAction,
  shouldAutoStartWorkoutTimer,
} from '../lib/utils/workout-create-post-lifecycle'

describe('workout create-post lifecycle', () => {
  describe('shouldAutoStartWorkoutTimer', () => {
    test('starts the timer when a focused draft gains content', () => {
      expect(
        shouldAutoStartWorkoutTimer({
          hasWorkoutDraftContent: true,
          isWorkoutTimerRunning: false,
          isHydrating: false,
          isScreenFocused: true,
          isFinalizingWorkout: false,
        }),
      ).toBe(true)
    })

    test('does not restart the timer while finalizing a workout submission', () => {
      expect(
        shouldAutoStartWorkoutTimer({
          hasWorkoutDraftContent: true,
          isWorkoutTimerRunning: false,
          isHydrating: false,
          isScreenFocused: true,
          isFinalizingWorkout: true,
        }),
      ).toBe(false)
    })

    test('does not auto-start when screen is hydrating, unfocused, or already running', () => {
      expect(
        shouldAutoStartWorkoutTimer({
          hasWorkoutDraftContent: true,
          isWorkoutTimerRunning: false,
          isHydrating: true,
          isScreenFocused: true,
          isFinalizingWorkout: false,
        }),
      ).toBe(false)

      expect(
        shouldAutoStartWorkoutTimer({
          hasWorkoutDraftContent: true,
          isWorkoutTimerRunning: false,
          isHydrating: false,
          isScreenFocused: false,
          isFinalizingWorkout: false,
        }),
      ).toBe(false)

      expect(
        shouldAutoStartWorkoutTimer({
          hasWorkoutDraftContent: true,
          isWorkoutTimerRunning: true,
          isHydrating: false,
          isScreenFocused: true,
          isFinalizingWorkout: false,
        }),
      ).toBe(false)
    })
  })

  describe('getLiveActivitySyncAction', () => {
    test('starts a live activity when the workout timer begins running', () => {
      expect(
        getLiveActivitySyncAction({
          hasStartedActivity: false,
          isWorkoutTimerRunning: true,
          workoutElapsedSeconds: 12,
          isFinalizingWorkout: false,
        }),
      ).toBe('start')
    })

    test('updates the live activity while the workout remains active', () => {
      expect(
        getLiveActivitySyncAction({
          hasStartedActivity: true,
          isWorkoutTimerRunning: true,
          workoutElapsedSeconds: 120,
          isFinalizingWorkout: false,
        }),
      ).toBe('update')
    })

    test('stops the live activity when the timer stops', () => {
      expect(
        getLiveActivitySyncAction({
          hasStartedActivity: true,
          isWorkoutTimerRunning: false,
          workoutElapsedSeconds: 120,
          isFinalizingWorkout: false,
        }),
      ).toBe('stop')
    })

    test('forces the live activity to stop while finalizing even if timer state lags behind', () => {
      expect(
        getLiveActivitySyncAction({
          hasStartedActivity: true,
          isWorkoutTimerRunning: true,
          workoutElapsedSeconds: 120,
          isFinalizingWorkout: true,
        }),
      ).toBe('stop')
    })

    test('does nothing while finalizing when no activity is running', () => {
      expect(
        getLiveActivitySyncAction({
          hasStartedActivity: false,
          isWorkoutTimerRunning: true,
          workoutElapsedSeconds: 120,
          isFinalizingWorkout: true,
        }),
      ).toBe('none')
    })
  })
})

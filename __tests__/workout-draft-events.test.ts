import {
  emitWorkoutDraftSubmitted,
  subscribeToWorkoutDraftSubmitted,
} from '../lib/utils/workout-draft-events'

describe('workout draft events', () => {
  test('notifies all active listeners when a workout draft is submitted', () => {
    const firstListener = jest.fn()
    const secondListener = jest.fn()

    const unsubscribeFirst = subscribeToWorkoutDraftSubmitted(firstListener)
    const unsubscribeSecond = subscribeToWorkoutDraftSubmitted(secondListener)

    emitWorkoutDraftSubmitted()

    expect(firstListener).toHaveBeenCalledTimes(1)
    expect(secondListener).toHaveBeenCalledTimes(1)

    unsubscribeFirst()
    unsubscribeSecond()
  })

  test('stops notifying a listener after it unsubscribes', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToWorkoutDraftSubmitted(listener)

    unsubscribe()
    emitWorkoutDraftSubmitted()

    expect(listener).not.toHaveBeenCalled()
  })
})

import {
  prependProcessedWorkoutToFeed,
  replaceWorkoutInFeedById,
  shouldHydratePostedWorkout,
} from '../lib/utils/posted-workout-optimizations'

describe('posted workout optimization helpers', () => {
  test('prepends processed workout and removes pending placeholders', () => {
    const prev = [
      { id: 'pending-1', isPending: true, workout_exercises: [] },
      { id: 'old-1', workout_exercises: [] },
      { id: 'old-2', workout_exercises: [] },
    ]
    const workout = { id: 'new-1', workout_exercises: [] }

    const next = prependProcessedWorkoutToFeed(prev, workout)

    expect(next.map((w) => w.id)).toEqual(['new-1', 'old-1', 'old-2'])
    expect(next.some((w) => w.isPending)).toBe(false)
  })

  test('dedupes when processed workout already exists and still removes pending placeholders', () => {
    const prev = [
      { id: 'pending-1', isPending: true, workout_exercises: [] },
      { id: 'new-1', workout_exercises: [] },
      { id: 'old-1', workout_exercises: [] },
    ]
    const workout = { id: 'new-1', workout_exercises: [{ id: 'we-1' }] }

    const next = prependProcessedWorkoutToFeed(prev, workout)

    expect(next.map((w) => w.id)).toEqual(['new-1', 'old-1'])
  })

  test('replaces workout in feed by id without changing order', () => {
    const prev = [
      { id: 'a', version: 1 },
      { id: 'b', version: 1 },
      { id: 'c', version: 1 },
    ]

    const next = replaceWorkoutInFeedById(prev, { id: 'b', version: 2 })

    expect(next).toEqual([
      { id: 'a', version: 1 },
      { id: 'b', version: 2 },
      { id: 'c', version: 1 },
    ])
  })

  test('detects when posted workout hydration is needed', () => {
    expect(shouldHydratePostedWorkout({})).toBe(true)
    expect(shouldHydratePostedWorkout({ workout_exercises: null })).toBe(true)
    expect(shouldHydratePostedWorkout({ workout_exercises: [] })).toBe(true)
    expect(
      shouldHydratePostedWorkout({ workout_exercises: [{ id: 'we-1' }] }),
    ).toBe(false)
  })
})

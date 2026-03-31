import {
  getPendingPlaceholderUiStatus,
  prependProcessedWorkoutToFeed,
  resolvePostedWorkoutForFeed,
  replaceWorkoutInFeedById,
  shouldHydratePostedWorkout,
  shouldInsertPostedWorkoutImmediately,
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
    expect(next.some((w) => 'isPending' in w && Boolean(w.isPending))).toBe(
      false,
    )
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

  test('only inserts posted workouts immediately when they already include exercises', () => {
    expect(shouldInsertPostedWorkoutImmediately({})).toBe(false)
    expect(
      shouldInsertPostedWorkoutImmediately({ workout_exercises: [{ id: 'we-1' }] }),
    ).toBe(true)
  })

  test('resolves the best feed workout payload from hydrated data and fallback profile', () => {
    const workout: {
      id: string
      profile: { display_name: string } | null
      workout_exercises: { id: string }[]
    } = {
      id: 'new-1',
      profile: null,
      workout_exercises: [],
    }
    const hydratedWorkout: typeof workout = {
      id: 'new-1',
      profile: null,
      workout_exercises: [{ id: 'we-1' }],
    }
    const fallbackProfile = { display_name: 'Oliver' }

    expect(
      resolvePostedWorkoutForFeed(workout, hydratedWorkout, fallbackProfile),
    ).toEqual({
      id: 'new-1',
      profile: fallbackProfile,
      workout_exercises: [{ id: 'we-1' }],
    })

    expect(
      resolvePostedWorkoutForFeed(workout, null, fallbackProfile),
    ).toEqual({
      id: 'new-1',
      profile: fallbackProfile,
      workout_exercises: [],
    })
  })

  test('keeps a pending placeholder in processing state once latched until removed', () => {
    expect(
      getPendingPlaceholderUiStatus({
        hasPendingPlaceholder: true,
        isProcessingPending: true,
        isProcessingLatched: false,
      }),
    ).toBe('processing')

    expect(
      getPendingPlaceholderUiStatus({
        hasPendingPlaceholder: true,
        isProcessingPending: false,
        isProcessingLatched: true,
      }),
    ).toBe('processing')

    expect(
      getPendingPlaceholderUiStatus({
        hasPendingPlaceholder: true,
        isProcessingPending: false,
        isProcessingLatched: false,
      }),
    ).toBe('queued')

    expect(
      getPendingPlaceholderUiStatus({
        hasPendingPlaceholder: false,
        isProcessingPending: false,
        isProcessingLatched: true,
      }),
    ).toBe('hidden')
  })
})

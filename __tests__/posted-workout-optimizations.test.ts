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
      {
        id: 'pending-1',
        isPending: true,
        created_at: '2026-04-07T12:01:00.000Z',
        workout_exercises: [],
      },
      {
        id: 'old-1',
        created_at: '2026-04-07T11:00:00.000Z',
        workout_exercises: [],
      },
      {
        id: 'old-2',
        created_at: '2026-04-07T10:00:00.000Z',
        workout_exercises: [],
      },
    ]
    const workout = {
      id: 'new-1',
      created_at: '2026-04-07T12:30:00.000Z',
      workout_exercises: [],
    }

    const next = prependProcessedWorkoutToFeed(prev, workout)

    expect(next.map((w) => w.id)).toEqual(['new-1', 'old-1', 'old-2'])
    expect(next.some((w) => 'isPending' in w && Boolean(w.isPending))).toBe(
      false,
    )
  })

  test('dedupes when processed workout already exists and still removes pending placeholders', () => {
    const prev = [
      {
        id: 'pending-1',
        isPending: true,
        created_at: '2026-04-07T12:01:00.000Z',
        workout_exercises: [],
      },
      {
        id: 'new-1',
        created_at: '2026-04-07T11:30:00.000Z',
        workout_exercises: [],
      },
      {
        id: 'old-1',
        created_at: '2026-04-07T11:00:00.000Z',
        workout_exercises: [],
      },
    ]
    const workout = {
      id: 'new-1',
      created_at: '2026-04-07T12:30:00.000Z',
      workout_exercises: [{ id: 'we-1' }],
    }

    const next = prependProcessedWorkoutToFeed(prev, workout)

    expect(next.map((w) => w.id)).toEqual(['new-1', 'old-1'])
    expect(next[0]?.workout_exercises).toEqual([{ id: 'we-1' }])
  })

  test('keeps a newer friend workout above an older processed workout', () => {
    const prev = [
      {
        id: 'friend-newer',
        created_at: '2026-04-07T12:58:00.000Z',
        workout_exercises: [{ id: 'we-friend' }],
      },
      {
        id: 'older',
        created_at: '2026-04-07T12:40:00.000Z',
        workout_exercises: [{ id: 'we-older' }],
      },
    ]
    const workout = {
      id: 'mine-older',
      created_at: '2026-04-07T12:49:00.000Z',
      workout_exercises: [{ id: 'we-mine' }],
    }

    const next = prependProcessedWorkoutToFeed(prev, workout)

    expect(next.map((w) => w.id)).toEqual([
      'friend-newer',
      'mine-older',
      'older',
    ])
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

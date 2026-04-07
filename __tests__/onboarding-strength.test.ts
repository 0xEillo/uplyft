jest.mock('../lib/database', () => ({
  database: {
    exercises: {
      getOrCreate: jest.fn(),
    },
  },
}))

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

import { database } from '../lib/database'
import {
  getOnboardingStrengthSnapshot,
  mergeOnboardingStrengthSnapshotIntoExerciseData,
  persistOnboardingStrengthSnapshot,
} from '../lib/onboarding-strength'
import { supabase } from '../lib/supabase'

const mockGetOrCreate = jest.mocked(database.exercises.getOrCreate)
const mockFrom = jest.mocked(supabase.from)

function createUpsertClient(result: { error: unknown | null }) {
  return {
    upsert: jest.fn().mockResolvedValue(result),
  }
}

function createSelectClient(result: {
  data: any
  error: unknown | null
}) {
  const maybeSingle = jest.fn().mockResolvedValue(result)
  const eq = jest.fn().mockReturnValue({ maybeSingle })
  const select = jest.fn().mockReturnValue({ eq })

  return {
    select,
    eq,
    maybeSingle,
  }
}

describe('persistOnboardingStrengthSnapshot', () => {
  const validInput = {
    exerciseName: 'Bench Press (Barbell)',
    workingWeightKg: 80.126,
    reps: 5,
    estimated1RMKg: 93.333,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('saves a normalized onboarding strength snapshot', async () => {
    mockGetOrCreate.mockResolvedValue({
      id: 'exercise-1',
    } as any)
    const client = createUpsertClient({ error: null })
    mockFrom.mockReturnValue(client as any)

    await persistOnboardingStrengthSnapshot('user-1', validInput)

    expect(mockGetOrCreate).toHaveBeenCalledWith(
      'Bench Press (Barbell)',
      'user-1',
    )
    expect(mockFrom).toHaveBeenCalledWith('onboarding_strength_snapshots')
    expect(client.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        exercise_id: 'exercise-1',
        working_weight_kg: 80.13,
        reps: 5,
        estimated_1rm_kg: 93.33,
      },
      { onConflict: 'user_id' },
    )
  })

  it('ignores missing user ids', async () => {
    await persistOnboardingStrengthSnapshot('', validInput)

    expect(mockGetOrCreate).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('ignores invalid onboarding inputs', async () => {
    await persistOnboardingStrengthSnapshot('user-1', null)
    await persistOnboardingStrengthSnapshot('user-1', {
      ...validInput,
      exerciseName: '   ',
    })
    await persistOnboardingStrengthSnapshot('user-1', {
      ...validInput,
      workingWeightKg: 0,
    })
    await persistOnboardingStrengthSnapshot('user-1', {
      ...validInput,
      reps: 0,
    })
    await persistOnboardingStrengthSnapshot('user-1', {
      ...validInput,
      estimated1RMKg: Number.NaN,
    })

    expect(mockGetOrCreate).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('swallows exercise lookup failures', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockGetOrCreate.mockRejectedValue(new Error('lookup failed'))

    await expect(
      persistOnboardingStrengthSnapshot('user-1', validInput),
    ).resolves.toBeUndefined()

    expect(mockFrom).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('swallows supabase upsert failures', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockGetOrCreate.mockResolvedValue({
      id: 'exercise-1',
    } as any)
    const client = createUpsertClient({ error: new Error('upsert failed') })
    mockFrom.mockReturnValue(client as any)

    await expect(
      persistOnboardingStrengthSnapshot('user-1', validInput),
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('getOnboardingStrengthSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null for missing users', async () => {
    await expect(getOnboardingStrengthSnapshot('')).resolves.toBeNull()

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns null when no onboarding snapshot exists', async () => {
    const client = createSelectClient({ data: null, error: null })
    mockFrom.mockReturnValue(client as any)

    await expect(getOnboardingStrengthSnapshot('user-1')).resolves.toBeNull()

    expect(mockFrom).toHaveBeenCalledWith('onboarding_strength_snapshots')
    expect(client.select).toHaveBeenCalled()
    expect(client.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(client.maybeSingle).toHaveBeenCalled()
  })

  it('maps a stored snapshot with an object exercise relation', async () => {
    const client = createSelectClient({
      data: {
        exercise_id: 'exercise-1',
        working_weight_kg: 80,
        reps: 5,
        estimated_1rm_kg: 93.33,
        created_at: '2026-04-07T09:00:00.000Z',
        updated_at: '2026-04-07T10:00:00.000Z',
        exercise: {
          id: 'exercise-1',
          name: 'Bench Press (Barbell)',
          muscle_group: 'Chest',
          gif_url: 'https://example.com/bench.gif',
        },
      },
      error: null,
    })
    mockFrom.mockReturnValue(client as any)

    await expect(getOnboardingStrengthSnapshot('user-1')).resolves.toEqual({
      exerciseId: 'exercise-1',
      exerciseName: 'Bench Press (Barbell)',
      muscleGroup: 'Chest',
      gifUrl: 'https://example.com/bench.gif',
      workingWeightKg: 80,
      reps: 5,
      estimated1RMKg: 93.33,
      recordedAt: '2026-04-07T10:00:00.000Z',
    })
  })

  it('maps a stored snapshot with an array exercise relation', async () => {
    const client = createSelectClient({
      data: {
        exercise_id: 'exercise-2',
        working_weight_kg: 100,
        reps: 3,
        estimated_1rm_kg: 110,
        created_at: '2026-04-07T09:00:00.000Z',
        updated_at: null,
        exercise: [
          {
            id: 'exercise-2',
            name: 'Squat (Barbell)',
            muscle_group: 'Quads',
            gif_url: null,
          },
        ],
      },
      error: null,
    })
    mockFrom.mockReturnValue(client as any)

    await expect(getOnboardingStrengthSnapshot('user-1')).resolves.toEqual({
      exerciseId: 'exercise-2',
      exerciseName: 'Squat (Barbell)',
      muscleGroup: 'Quads',
      gifUrl: null,
      workingWeightKg: 100,
      reps: 3,
      estimated1RMKg: 110,
      recordedAt: '2026-04-07T09:00:00.000Z',
    })
  })

  it('returns null when the exercise relation is missing', async () => {
    const client = createSelectClient({
      data: {
        exercise_id: 'exercise-1',
        working_weight_kg: 80,
        reps: 5,
        estimated_1rm_kg: 93.33,
        created_at: '2026-04-07T09:00:00.000Z',
        updated_at: '2026-04-07T10:00:00.000Z',
        exercise: [],
      },
      error: null,
    })
    mockFrom.mockReturnValue(client as any)

    await expect(getOnboardingStrengthSnapshot('user-1')).resolves.toBeNull()
  })

  it('returns null and warns when the query fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const client = createSelectClient({
      data: null,
      error: new Error('select failed'),
    })
    mockFrom.mockReturnValue(client as any)

    await expect(getOnboardingStrengthSnapshot('user-1')).resolves.toBeNull()

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('mergeOnboardingStrengthSnapshotIntoExerciseData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the original structures when there is no onboarding snapshot', () => {
    const exercises = [
      {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        max1RM: 90,
        lastTrainedAt: '2026-04-01T10:00:00.000Z',
        gifUrl: null,
        records: [],
      },
    ]
    const snapshots = {
      'exercise-1': {
        currentBest1RM: 90,
        previousBest1RM: 84,
        lastIncreaseAt: '2026-04-01T10:00:00.000Z',
        lastIncreaseSessionId: 'session-1',
      },
    }

    const result = mergeOnboardingStrengthSnapshotIntoExerciseData({
      exercises,
      best1RMSnapshotByExerciseId: snapshots,
      snapshot: null,
    })

    expect(result.exercises).toBe(exercises)
    expect(result.best1RMSnapshotByExerciseId).toBe(snapshots)
  })

  it('adds the onboarding lift when the user has no logged strength data yet', () => {
    const result = mergeOnboardingStrengthSnapshotIntoExerciseData({
      exercises: [],
      best1RMSnapshotByExerciseId: {},
      snapshot: {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        gifUrl: 'https://example.com/bench.gif',
        workingWeightKg: 80,
        reps: 5,
        estimated1RMKg: 93.33,
        recordedAt: '2026-04-07T10:00:00.000Z',
      },
    })

    expect(result.exercises).toEqual([
      {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        max1RM: 93,
        lastTrainedAt: '2026-04-07T10:00:00.000Z',
        gifUrl: 'https://example.com/bench.gif',
        records: [
          {
            weight: 80,
            maxReps: 5,
            date: '2026-04-07T10:00:00.000Z',
            estimated1RM: 93,
          },
        ],
      },
    ])

    expect(result.best1RMSnapshotByExerciseId).toEqual({
      'exercise-1': {
        currentBest1RM: 93,
        previousBest1RM: 0,
        lastIncreaseAt: '2026-04-07T10:00:00.000Z',
        lastIncreaseSessionId: null,
      },
    })
  })

  it('merges the onboarding lift into an existing exercise without duplicating it', () => {
    const result = mergeOnboardingStrengthSnapshotIntoExerciseData({
      exercises: [
        {
          exerciseId: 'exercise-1',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 90,
          lastTrainedAt: '2026-04-01T10:00:00.000Z',
          gifUrl: null,
          records: [
            {
              weight: 75,
              maxReps: 5,
              date: '2026-04-01T10:00:00.000Z',
              estimated1RM: 88,
            },
          ],
        },
      ],
      best1RMSnapshotByExerciseId: {
        'exercise-1': {
          currentBest1RM: 90,
          previousBest1RM: 84,
          lastIncreaseAt: '2026-04-01T10:00:00.000Z',
          lastIncreaseSessionId: 'session-1',
        },
      },
      snapshot: {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        gifUrl: 'https://example.com/bench.gif',
        workingWeightKg: 80,
        reps: 5,
        estimated1RMKg: 93.33,
        recordedAt: '2026-04-07T10:00:00.000Z',
      },
    })

    expect(result.exercises).toHaveLength(1)
    expect(result.exercises[0]).toMatchObject({
      exerciseId: 'exercise-1',
      max1RM: 93,
      lastTrainedAt: '2026-04-07T10:00:00.000Z',
      gifUrl: 'https://example.com/bench.gif',
    })
    expect(result.exercises[0].records).toEqual([
      {
        weight: 80,
        maxReps: 5,
        date: '2026-04-07T10:00:00.000Z',
        estimated1RM: 93,
      },
      {
        weight: 75,
        maxReps: 5,
        date: '2026-04-01T10:00:00.000Z',
        estimated1RM: 88,
      },
    ])
    expect(result.best1RMSnapshotByExerciseId['exercise-1']).toEqual({
      currentBest1RM: 93,
      previousBest1RM: 90,
      lastIncreaseAt: '2026-04-07T10:00:00.000Z',
      lastIncreaseSessionId: null,
    })
  })

  it('does not downgrade real workout bests when the onboarding estimate is lower', () => {
    const result = mergeOnboardingStrengthSnapshotIntoExerciseData({
      exercises: [
        {
          exerciseId: 'exercise-1',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 100,
          lastTrainedAt: '2026-04-01T10:00:00.000Z',
          gifUrl: 'https://example.com/existing.gif',
          records: [
            {
              weight: 85,
              maxReps: 3,
              date: '2026-04-01T10:00:00.000Z',
              estimated1RM: 100,
            },
          ],
        },
      ],
      best1RMSnapshotByExerciseId: {
        'exercise-1': {
          currentBest1RM: 100,
          previousBest1RM: 95,
          lastIncreaseAt: '2026-04-01T10:00:00.000Z',
          lastIncreaseSessionId: 'session-1',
        },
      },
      snapshot: {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        gifUrl: 'https://example.com/onboarding.gif',
        workingWeightKg: 80,
        reps: 5,
        estimated1RMKg: 93.33,
        recordedAt: '2026-04-07T10:00:00.000Z',
      },
    })

    expect(result.exercises[0]).toMatchObject({
      max1RM: 100,
      lastTrainedAt: '2026-04-07T10:00:00.000Z',
      gifUrl: 'https://example.com/existing.gif',
    })
    expect(result.best1RMSnapshotByExerciseId['exercise-1']).toEqual({
      currentBest1RM: 100,
      previousBest1RM: 95,
      lastIncreaseAt: '2026-04-01T10:00:00.000Z',
      lastIncreaseSessionId: 'session-1',
    })
  })

  it('merges matching records instead of duplicating identical date and weight entries', () => {
    const result = mergeOnboardingStrengthSnapshotIntoExerciseData({
      exercises: [
        {
          exerciseId: 'exercise-1',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 90,
          lastTrainedAt: '2026-04-07T10:00:00.000Z',
          gifUrl: null,
          records: [
            {
              weight: 80,
              maxReps: 4,
              date: '2026-04-07T10:00:00.000Z',
              estimated1RM: 89,
            },
          ],
        },
      ],
      best1RMSnapshotByExerciseId: {},
      snapshot: {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        gifUrl: null,
        workingWeightKg: 80,
        reps: 5,
        estimated1RMKg: 93.33,
        recordedAt: '2026-04-07T10:00:00.000Z',
      },
    })

    expect(result.exercises[0].records).toEqual([
      {
        weight: 80,
        maxReps: 5,
        date: '2026-04-07T10:00:00.000Z',
        estimated1RM: 93,
      },
    ])
  })

  it('uses the stronger exercise max when the best snapshot map is missing', () => {
    const result = mergeOnboardingStrengthSnapshotIntoExerciseData({
      exercises: [
        {
          exerciseId: 'exercise-1',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 105,
          lastTrainedAt: '2026-04-01T10:00:00.000Z',
          gifUrl: null,
          records: [],
        },
      ],
      best1RMSnapshotByExerciseId: {},
      snapshot: {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        gifUrl: null,
        workingWeightKg: 80,
        reps: 5,
        estimated1RMKg: 93.33,
        recordedAt: '2026-04-07T10:00:00.000Z',
      },
    })

    expect(result.best1RMSnapshotByExerciseId['exercise-1']).toEqual({
      currentBest1RM: 105,
      previousBest1RM: 0,
      lastIncreaseAt: '2026-04-07T10:00:00.000Z',
      lastIncreaseSessionId: null,
    })
  })
})

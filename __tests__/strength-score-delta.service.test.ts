const mockLoadStrengthInputs = jest.fn()

jest.mock('@/lib/strength-inputs', () => ({
  loadStrengthInputs: (...args: unknown[]) => mockLoadStrengthInputs(...args),
}))

import {
  calculateStrengthScoreDelta,
  loadAndCalculateStrengthScoreDelta,
  loadStrengthScoreDeltaContext,
  STRENGTH_SCORE_DELTA_SEMANTICS,
} from '@/lib/strength-score-delta'

describe('strength score delta service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('posted workout and latest increase semantics match for the same latest session', () => {
    const context = {
      profile: { gender: 'male', weight_kg: 90 } as any,
      strengthGender: 'male' as const,
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 130,
          lastTrainedAt: '2026-03-05T10:00:00.000Z',
        },
        {
          exerciseId: 'squat',
          exerciseName: 'Squat (Barbell)',
          muscleGroup: 'Quads',
          max1RM: 170,
          lastTrainedAt: '2026-03-05T10:00:00.000Z',
        },
      ],
      best1RMSnapshotByExerciseId: {
        bench: {
          currentBest1RM: 130,
          previousBest1RM: 120,
          lastIncreaseAt: '2026-03-05T10:00:00.000Z',
          lastIncreaseSessionId: 'workout-123',
        },
        squat: {
          currentBest1RM: 170,
          previousBest1RM: 165,
          lastIncreaseAt: '2026-03-01T10:00:00.000Z',
          lastIncreaseSessionId: 'workout-older',
        },
      },
    }

    const overlayDelta = calculateStrengthScoreDelta({
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.postedWorkoutSession,
      postedWorkoutSessionId: 'workout-123',
      context,
    })
    const cardDelta = calculateStrengthScoreDelta({
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.latestIncreaseSession,
      context,
    })

    expect(overlayDelta).not.toBeNull()
    expect(cardDelta).not.toBeNull()
    expect(overlayDelta?.baselineSessionId).toBe('workout-123')
    expect(cardDelta?.baselineSessionId).toBe('workout-123')
    expect(overlayDelta?.pointsGained).toBeGreaterThan(0)
    expect(overlayDelta?.pointsGained).toBe(cardDelta?.pointsGained)
    expect(overlayDelta?.baselineResult.score).toBe(cardDelta?.baselineResult.score)
    expect(overlayDelta?.currentResult.score).toBe(cardDelta?.currentResult.score)
  })

  test('explicit semantics can intentionally produce different deltas', () => {
    const context = {
      profile: { gender: 'male', weight_kg: 90 } as any,
      strengthGender: 'male' as const,
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 130,
          lastTrainedAt: '2026-03-05T10:00:00.000Z',
        },
        {
          exerciseId: 'squat',
          exerciseName: 'Squat (Barbell)',
          muscleGroup: 'Quads',
          max1RM: 185,
          lastTrainedAt: '2026-03-05T10:00:00.000Z',
        },
      ],
      best1RMSnapshotByExerciseId: {
        bench: {
          currentBest1RM: 130,
          previousBest1RM: 110,
          lastIncreaseAt: '2026-03-01T10:00:00.000Z',
          lastIncreaseSessionId: 'workout-old',
        },
        squat: {
          currentBest1RM: 185,
          previousBest1RM: 180,
          lastIncreaseAt: '2026-03-05T10:00:00.000Z',
          lastIncreaseSessionId: 'workout-new',
        },
      },
    }

    const postedDelta = calculateStrengthScoreDelta({
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.postedWorkoutSession,
      postedWorkoutSessionId: 'workout-old',
      context,
    })
    const latestDelta = calculateStrengthScoreDelta({
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.latestIncreaseSession,
      context,
    })

    expect(postedDelta).not.toBeNull()
    expect(latestDelta).not.toBeNull()
    expect(postedDelta?.baselineSessionId).toBe('workout-old')
    expect(latestDelta?.baselineSessionId).toBe('workout-new')
    expect(postedDelta?.pointsGained).not.toBe(latestDelta?.pointsGained)
  })

  test('calculates ranks when profile weight is returned as a numeric string', () => {
    const context = {
      profile: { gender: 'male', weight_kg: '90' } as any,
      strengthGender: 'male' as const,
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 130,
          lastTrainedAt: '2026-03-05T10:00:00.000Z',
        },
      ],
      best1RMSnapshotByExerciseId: {
        bench: {
          currentBest1RM: 130,
          previousBest1RM: 120,
          lastIncreaseAt: '2026-03-05T10:00:00.000Z',
          lastIncreaseSessionId: 'workout-123',
        },
      },
    }

    const delta = calculateStrengthScoreDelta({
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.latestIncreaseSession,
      context,
    })

    expect(delta).not.toBeNull()
    expect(delta?.currentResult.liftsTracked).toBe(1)
  })

  test('loadStrengthScoreDeltaContext loads through the shared strength inputs loader', async () => {
    const overrideProfile = { id: 'override', gender: 'male', weight_kg: 90 } as any
    const exercises = [
      {
        exerciseId: 'bench',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        max1RM: 120,
        records: [],
        gifUrl: null,
        lastTrainedAt: '2026-03-05T10:00:00.000Z',
      },
    ]
    const snapshots = {
      bench: {
        currentBest1RM: 120,
        previousBest1RM: 110,
        lastIncreaseAt: '2026-03-05T10:00:00.000Z',
        lastIncreaseSessionId: 'workout-1',
      },
    }
    mockLoadStrengthInputs.mockResolvedValue({
      profile: overrideProfile,
      strengthGender: 'male',
      bodyweightKg: 90,
      exercises,
      sessions: [],
      best1RMSnapshotByExerciseId: snapshots,
    })

    const context = await loadStrengthScoreDeltaContext('user-1', {
      profileOverride: overrideProfile,
    })

    expect(mockLoadStrengthInputs).toHaveBeenCalledWith('user-1', {
      profileOverride: overrideProfile,
    })
    expect(context).toEqual({
      profile: overrideProfile,
      strengthGender: 'male',
      exercises,
      best1RMSnapshotByExerciseId: snapshots,
      sessions: [],
    })

    await loadStrengthScoreDeltaContext('user-2')
    expect(mockLoadStrengthInputs).toHaveBeenLastCalledWith('user-2', undefined)
  })

  test('loadAndCalculateStrengthScoreDelta keeps posted and latest flows aligned', async () => {
    mockLoadStrengthInputs.mockResolvedValue({
      profile: { id: 'user-1', gender: 'male', weight_kg: 90 },
      strengthGender: 'male',
      bodyweightKg: 90,
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 130,
          sessionCount: 2,
          records: [],
          gifUrl: null,
          lastTrainedAt: '2026-03-05T10:00:00.000Z',
        },
        {
          exerciseId: 'squat',
          exerciseName: 'Squat (Barbell)',
          muscleGroup: 'Quads',
          max1RM: 170,
          sessionCount: 3,
          records: [],
          gifUrl: null,
          lastTrainedAt: '2026-03-05T10:00:00.000Z',
        },
      ],
      sessions: [
        { sessionId: 'workout-first', exerciseBests: { bench: 120, squat: 165 } },
        { sessionId: 'workout-older', exerciseBests: { squat: 170 } },
        { sessionId: 'workout-123', exerciseBests: { bench: 130, squat: 160 } },
      ],
      best1RMSnapshotByExerciseId: {
        bench: {
          currentBest1RM: 130,
          previousBest1RM: 120,
          lastIncreaseAt: '2026-03-05T10:00:00.000Z',
          lastIncreaseSessionId: 'workout-123',
        },
        squat: {
          currentBest1RM: 170,
          previousBest1RM: 165,
          lastIncreaseAt: '2026-03-01T10:00:00.000Z',
          lastIncreaseSessionId: 'workout-older',
        },
      },
    })

    const overlayDelta = await loadAndCalculateStrengthScoreDelta({
      userId: 'user-1',
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.postedWorkoutSession,
      postedWorkoutSessionId: 'workout-123',
    })
    const cardDelta = await loadAndCalculateStrengthScoreDelta({
      userId: 'user-1',
      semantics: STRENGTH_SCORE_DELTA_SEMANTICS.latestIncreaseSession,
    })

    expect(overlayDelta).not.toBeNull()
    expect(cardDelta).not.toBeNull()
    expect(overlayDelta?.pointsGained).toBe(cardDelta?.pointsGained)
    expect(overlayDelta?.pointsGained).toBeGreaterThan(0)
    expect(overlayDelta?.currentResult.level).toBe(cardDelta?.currentResult.level)
    expect(overlayDelta?.baselineSessionId).toBe(cardDelta?.baselineSessionId)
    expect(overlayDelta!.baselineResult.score + overlayDelta!.pointsGained).toBe(
      overlayDelta!.currentResult.score,
    )
  })
})

import {
    OVERALL_STRENGTH_SCORE_CAP,
    calculateOverallStrengthScoreDeltaForSession,
    calculateExerciseStrengthPoints,
    calculateOverallStrengthScore,
    getOverallStrengthGroupLevelProgress,
    getLatestStrengthIncreaseSession,
    scoreToOverallLevelProgress,
} from '../lib/overall-strength-score'

describe('overall strength score', () => {
  test('interpolates below beginner threshold', () => {
    const points = calculateExerciseStrengthPoints({
      exerciseName: 'Bench Press (Barbell)',
      gender: 'male',
      bodyweightKg: 100,
      estimated1RMKg: 25, // ratio 0.25, beginner is 0.5
    })

    expect(points).not.toBeNull()
    expect(points).toBeCloseTo(50, 5)
  })

  test('caps at 1000 when world class threshold is exceeded', () => {
    const points = calculateExerciseStrengthPoints({
      exerciseName: 'Bench Press (Barbell)',
      gender: 'male',
      bodyweightKg: 100,
      estimated1RMKg: 300,
    })

    expect(points).toBe(OVERALL_STRENGTH_SCORE_CAP)
  })

  test('maps score to correct level and progress', () => {
    const mapped = scoreToOverallLevelProgress(700)

    expect(mapped.level).toBe('Advanced')
    expect(mapped.nextLevel).toBe('Elite')
    expect(mapped.progress).toBeCloseTo(44.44, 2)
  })

  test('maps group rank from effective group score instead of top exercise score', () => {
    const mapped = getOverallStrengthGroupLevelProgress({
      effectiveScore: 395,
    })

    expect(mapped.level).toBe('Novice')
    expect(mapped.nextLevel).toBe('Intermediate')
    expect(mapped.progress).toBeCloseTo(97.5, 2)
  })

  test('uses highest exercise score per muscle group and weighted aggregation', () => {
    const now = new Date('2026-02-15T00:00:00.000Z')
    const exercises = [
      {
        exerciseId: 'chest-1',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        max1RM: 125,
        lastTrainedAt: now.toISOString(),
      },
      {
        exerciseId: 'chest-2',
        exerciseName: 'Incline Bench Press (Barbell)',
        muscleGroup: 'Chest',
        max1RM: 90,
        lastTrainedAt: now.toISOString(),
      },
      {
        exerciseId: 'back-1',
        exerciseName: 'Bent Over Row (Barbell)',
        muscleGroup: 'Back',
        max1RM: 120,
        lastTrainedAt: now.toISOString(),
      },
      {
        exerciseId: 'legs-1',
        exerciseName: 'Squat (Barbell)',
        muscleGroup: 'Quads',
        max1RM: 150,
        lastTrainedAt: now.toISOString(),
      },
      {
        exerciseId: 'shoulders-1',
        exerciseName: 'Shoulder Press (Barbell)',
        muscleGroup: 'Shoulders',
        max1RM: 85,
        lastTrainedAt: now.toISOString(),
      },
      {
        exerciseId: 'arms-1',
        exerciseName: 'Bicep Curl (Dumbbell)',
        muscleGroup: 'Biceps',
        max1RM: 40,
        lastTrainedAt: now.toISOString(),
      },
    ]

    const chestBest = Math.max(
      calculateExerciseStrengthPoints({
        exerciseName: 'Bench Press (Barbell)',
        gender: 'male',
        bodyweightKg: 100,
        estimated1RMKg: 125,
      }) ?? 0,
      calculateExerciseStrengthPoints({
        exerciseName: 'Incline Bench Press (Barbell)',
        gender: 'male',
        bodyweightKg: 100,
        estimated1RMKg: 90,
      }) ?? 0,
    )

    const overall = calculateOverallStrengthScore({
      gender: 'male',
      bodyweightKg: 100,
      exercises,
      now,
    })

    expect(overall.liftsTracked).toBe(6)
    expect(overall.score).toBe(418) // weighted aggregation across Legs, Back, Chest, Shoulders, Arms (Core empty)
    expect(overall.groupBreakdown.Chest.topExerciseScore).toBeCloseTo(chestBest, 5)
  })

  test('applies decay after 14-day grace period', () => {
    const now = new Date('2026-02-15T00:00:00.000Z')
    const lastTrainedAt = new Date('2026-01-25T00:00:00.000Z') // 21 days ago

    const chestPoints =
      calculateExerciseStrengthPoints({
        exerciseName: 'Bench Press (Barbell)',
        gender: 'male',
        bodyweightKg: 100,
        estimated1RMKg: 100,
      }) ?? 0

    const overall = calculateOverallStrengthScore({
      gender: 'male',
      bodyweightKg: 100,
      exercises: [
        {
          exerciseId: 'chest-1',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: 100,
          lastTrainedAt: lastTrainedAt.toISOString(),
        },
      ],
      now,
    })

    const expected = Math.round(chestPoints * 0.95 * 0.19)

    expect(overall.groupBreakdown.Chest.decayFactor).toBeCloseTo(0.95, 5)
    expect(overall.score).toBe(expected)
  })

  test('returns zero score when no supported exercises are present', () => {
    const result = calculateOverallStrengthScore({
      gender: 'male',
      bodyweightKg: 100,
      exercises: [
        {
          exerciseId: 'custom-1',
          exerciseName: 'Custom Exercise',
          muscleGroup: 'Chest',
          max1RM: 100,
          lastTrainedAt: '2026-02-15T00:00:00.000Z',
        },
      ],
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(result.liftsTracked).toBe(0)
    expect(result.score).toBe(0)
    expect(result.level).toBe('Untrained')
  })

  test('picks the latest strength increase session from snapshots', () => {
    const exercises = [
      {
        exerciseId: 'bench',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        max1RM: 130,
      },
      {
        exerciseId: 'squat',
        exerciseName: 'Squat (Barbell)',
        muscleGroup: 'Quads',
        max1RM: 180,
      },
    ]

    const latest = getLatestStrengthIncreaseSession({
      exercises,
      best1RMSnapshotByExerciseId: {
        bench: {
          currentBest1RM: 130,
          previousBest1RM: 120,
          lastIncreaseAt: '2026-02-10T12:00:00.000Z',
          lastIncreaseSessionId: 'session-old',
        },
        squat: {
          currentBest1RM: 180,
          previousBest1RM: 170,
          lastIncreaseAt: '2026-02-14T08:30:00.000Z',
          lastIncreaseSessionId: 'session-new',
        },
      },
    })

    expect(latest).toEqual({
      sessionId: 'session-new',
      lastIncreaseAt: '2026-02-14T08:30:00.000Z',
    })
  })

  test('calculates session delta using only exercises improved in that session', () => {
    const exercises = [
      {
        exerciseId: 'bench',
        exerciseName: 'Bench Press (Barbell)',
        muscleGroup: 'Chest',
        max1RM: 130,
      },
      {
        exerciseId: 'squat',
        exerciseName: 'Squat (Barbell)',
        muscleGroup: 'Quads',
        max1RM: 180,
      },
    ]

    const snapshots = {
      bench: {
        currentBest1RM: 130,
        previousBest1RM: 120,
        lastIncreaseAt: '2026-02-10T12:00:00.000Z',
        lastIncreaseSessionId: 'session-old',
      },
      squat: {
        currentBest1RM: 180,
        previousBest1RM: 170,
        lastIncreaseAt: '2026-02-14T08:30:00.000Z',
        lastIncreaseSessionId: 'session-new',
      },
    }

    const delta = calculateOverallStrengthScoreDeltaForSession({
      gender: 'male',
      bodyweightKg: 100,
      exercises,
      best1RMSnapshotByExerciseId: snapshots,
      baselineSessionId: 'session-new',
    })

    const expectedBaseline = calculateOverallStrengthScore({
      gender: 'male',
      bodyweightKg: 100,
      exercises: [
        exercises[0],
        {
          ...exercises[1],
          max1RM: 170,
        },
      ],
    })

    expect(delta.currentResult.score).toBeGreaterThan(delta.baselineResult.score)
    expect(delta.baselineResult.score).toBe(expectedBaseline.score)
    expect(delta.pointsGained).toBe(delta.currentResult.score - delta.baselineResult.score)
  })
})

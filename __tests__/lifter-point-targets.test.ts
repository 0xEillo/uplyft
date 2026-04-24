// eslint-disable-next-line @typescript-eslint/no-require-imports
const { calculateLifterPointTargets } = require('../supabase/functions/_shared/strength')

type ExerciseRankFixture = {
  exerciseId: string
  exerciseName: string
  canonicalExerciseName: string
  muscleGroup: string | null
  lastTrainedAt: string | null
  isRepBased: boolean
  tier: 1 | 2 | 3
  level: string
  nextLevel: string | null
  progress: number
  scorePoints: number
  pointsToNextLevel: number | null
  currentValue: number
  currentMetric: 'estimated_1rm_kg' | 'reps'
  estimated1RMKg: number | null
  bestSetWeightKg: number | null
  bestSetReps: number | null
  targetValue: number | null
  targetMetric: 'estimated_1rm_kg' | 'reps'
  gapToNextLevel: number | null
  ratioToBodyweight: number | null
}

type PracticalRepTargetFixture = {
  weightKg: number
  reps: number
  estimated1RMKg: number
}

function makeProfile(
  exerciseRanks: ExerciseRankFixture[],
) {
  return {
    profile: {
      gender: 'male',
      bodyweightKg: 100,
    },
    overallLevel: null,
    exerciseRanks,
    missingRequirements: [],
  }
}

describe('lifter point targets', () => {
  test('finds a tracked lift target that reaches the requested point gain', () => {
    const result = calculateLifterPointTargets({
      profile: makeProfile([
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press (Barbell)',
          canonicalExerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          lastTrainedAt: '2026-02-15T00:00:00.000Z',
          isRepBased: false,
          tier: 1,
          level: 'Beginner',
          nextLevel: 'Novice',
          progress: 50,
          scorePoints: 150,
          pointsToNextLevel: 50,
          currentValue: 62.5,
          currentMetric: 'estimated_1rm_kg',
          estimated1RMKg: 62.5,
          bestSetWeightKg: 55,
          bestSetReps: 4,
          targetValue: 75,
          targetMetric: 'estimated_1rm_kg',
          gapToNextLevel: 13,
          ratioToBodyweight: 0.625,
        },
      ]),
      requestedPoints: 10,
      exerciseName: 'Bench Press (Barbell)',
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(result.available).toBe(true)
    expect(result.bestTarget?.source).toBe('tracked')
    expect(result.bestTarget?.canonicalExerciseName).toBe('Bench Press (Barbell)')
    expect(result.bestTarget?.pointsGained).toBeGreaterThanOrEqual(10)
    expect(result.bestTarget?.targetValue).toBeGreaterThan(62.5)
  })

  test('includes unlogged standards-backed lifts when relevant', () => {
    const result = calculateLifterPointTargets({
      profile: makeProfile([]),
      requestedPoints: 10,
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(result.available).toBe(true)
    expect(result.bestTarget?.source).toBe('unlogged')
    expect(result.bestTarget?.pointsGained).toBeGreaterThanOrEqual(10)
    expect(result.bestTarget?.targetValue).toBeGreaterThan(0)
  })

  test('returns practical Epley weight-rep options for weight-based targets', () => {
    const result = calculateLifterPointTargets({
      profile: makeProfile([]),
      requestedPoints: 10,
      exerciseName: 'Bench Press (Barbell)',
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(result.bestTarget?.isRepBased).toBe(false)
    expect(
      result.bestTarget?.practicalTargets.map(
        (target: PracticalRepTargetFixture) => target.reps,
      ),
    ).toEqual([5, 6, 8])
    result.bestTarget?.practicalTargets.forEach((target: PracticalRepTargetFixture) => {
      expect(target.weightKg).toBeGreaterThan(0)
      expect(target.estimated1RMKg).toBeGreaterThanOrEqual(
        result.bestTarget?.targetEstimated1RMKg ?? 0,
      )
    })
  })

  test('reports missing profile requirements without producing targets', () => {
    const result = calculateLifterPointTargets({
      profile: {
        profile: {
          gender: null,
          bodyweightKg: null,
        },
        overallLevel: null,
        exerciseRanks: [],
        missingRequirements: ['profile gender', 'profile bodyweight'],
      },
      requestedPoints: 10,
    })

    expect(result.available).toBe(false)
    expect(result.missingRequirements).toEqual([
      'profile gender',
      'profile bodyweight',
    ])
    expect(result.bestTarget).toBeNull()
  })
})

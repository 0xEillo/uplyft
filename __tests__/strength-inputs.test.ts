const mockTables: { current: Record<string, unknown> } = { current: {} }

function fakeSupabase() {
  return {
    from(table: string) {
      const result = mockTables.current[table] ?? { data: null, error: null }
      const builder: any = {}
      ;['select', 'eq', 'not', 'gt', 'order', 'limit', 'in'].forEach((method) => {
        builder[method] = () => builder
      })
      builder.single = () => Promise.resolve(result)
      builder.maybeSingle = () => Promise.resolve(result)
      builder.then = (resolve: (value: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject)
      return builder
    },
  }
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => fakeSupabase().from(table) },
}))

import { calculateExerciseStrengthPoints } from '../lib/overall-strength-score'
import { loadStrengthInputs } from '../lib/strength-inputs'
import {
  buildStrengthInputsFromRows,
  resolveStrengthBodyweightKg,
  type StrengthSessionRow,
} from '../supabase/functions/_shared/strength-inputs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serverStrength = require('../supabase/functions/_shared/strength')

function lift(
  id: string,
  name: string,
  sets: { weight: number | null; reps: number | null }[],
  muscleGroup: string | null = null,
) {
  return {
    exercise_id: id,
    exercise: { id, name, muscle_group: muscleGroup, gif_url: null },
    sets,
  }
}

const ROWS: StrengthSessionRow[] = [
  {
    // Saved last, but performed first (backdated).
    id: 'w-backdated',
    date: '2026-01-01',
    created_at: '2026-01-20T10:00:00.000Z',
    workout_exercises: [
      lift('bench', 'Bench Press (Barbell)', [{ weight: 80, reps: 5 }], 'Chest'),
    ],
  },
  {
    id: 'w1',
    date: '2026-01-05',
    created_at: '2026-01-05T10:00:00.000Z',
    workout_exercises: [
      // 100 x 5 = 116.67 -> 117
      lift('squat', 'squat (barbell) ', [{ weight: 100, reps: 5 }, { weight: 90, reps: 8 }], 'Quads'),
      lift('bench', 'Bench Press (Barbell)', [{ weight: 82.5, reps: 5 }], 'Chest'),
      lift('zottman', 'Zottman Curl', [{ weight: 14, reps: 10 }], 'Biceps'),
      lift('hlr', 'Hanging Leg Raise', [{ weight: null, reps: 12 }], 'Abs'),
      // No valid sets: weighted lift logged without weight.
      lift('row', 'Bent Over Row (Barbell)', [{ weight: null, reps: 10 }], 'Back'),
    ],
  },
  {
    id: 'w2',
    date: '2026-01-08',
    created_at: '2026-01-08T10:00:00.000Z',
    workout_exercises: [
      // 110 x 3 = 121: a new best.
      lift('squat', 'squat (barbell) ', [{ weight: 110, reps: 3 }], 'Quads'),
      lift('zottman', 'Zottman Curl', [{ weight: 16, reps: 10 }], 'Biceps'),
    ],
  },
]

const ONBOARDING_ROW = {
  exercise_id: 'dl',
  working_weight_kg: 150,
  reps: 5,
  estimated_1rm_kg: '174.6',
  created_at: '2025-12-20T10:00:00.000Z',
  updated_at: null,
  exercise: [{ id: 'dl', name: 'Deadlift (Barbell)', muscle_group: 'Back', gif_url: null }],
}

describe('buildStrengthInputsFromRows', () => {
  const inputs = buildStrengthInputsFromRows({
    sessionRows: ROWS,
    onboarding: {
      exerciseId: 'dl',
      exerciseName: 'Deadlift (Barbell)',
      muscleGroup: 'Back',
      gifUrl: null,
      workingWeightKg: 150,
      reps: 5,
      estimated1RMKg: 174.6,
      recordedAt: '2025-12-20T10:00:00.000Z',
    },
  })

  test('shapes standards lifts with rounded bests, matching names case-insensitively', () => {
    expect(inputs.exercises.map((exercise) => [
      exercise.exerciseId,
      exercise.exerciseName,
      exercise.max1RM,
      exercise.sessionCount,
      exercise.lastTrainedAt,
    ])).toEqual([
      ['squat', 'squat (barbell) ', 121, 2, '2026-01-08T10:00:00.000Z'],
      ['bench', 'Bench Press (Barbell)', 96, 2, '2026-01-20T10:00:00.000Z'],
      ['hlr', 'Hanging Leg Raise', 12, 1, '2026-01-05T10:00:00.000Z'],
      // Onboarding-only lift: no session count, so it counts as established.
      ['dl', 'Deadlift (Barbell)', 175, undefined, '2025-12-20T10:00:00.000Z'],
    ])
    expect(inputs.exercises[0].records).toEqual([
      { weight: 110, maxReps: 3, date: '2026-01-08', estimated1RM: 121 },
      { weight: 100, maxReps: 5, date: '2026-01-05', estimated1RM: 117 },
      { weight: 90, maxReps: 8, date: '2026-01-05', estimated1RM: 114 },
    ])
  })

  test('orders the history by workout date, scored lifts only', () => {
    expect(inputs.sessions).toEqual([
      { sessionId: 'w-backdated', exerciseBests: { bench: 93 } },
      { sessionId: 'w1', exerciseBests: { squat: 117, bench: 96, hlr: 12 } },
      { sessionId: 'w2', exerciseBests: { squat: 121 } },
    ])
  })

  test('tracks rounded before/after bests for every logged exercise', () => {
    expect(inputs.best1RMSnapshotByExerciseId).toEqual({
      bench: {
        currentBest1RM: 96,
        previousBest1RM: 93,
        lastIncreaseAt: '2026-01-05T10:00:00.000Z',
        lastIncreaseSessionId: 'w1',
      },
      squat: {
        currentBest1RM: 121,
        previousBest1RM: 117,
        lastIncreaseAt: '2026-01-08T10:00:00.000Z',
        lastIncreaseSessionId: 'w2',
      },
      hlr: {
        currentBest1RM: 12,
        previousBest1RM: 0,
        lastIncreaseAt: '2026-01-05T10:00:00.000Z',
        lastIncreaseSessionId: 'w1',
      },
      zottman: {
        currentBest1RM: 21,
        previousBest1RM: 19,
        lastIncreaseAt: '2026-01-08T10:00:00.000Z',
        lastIncreaseSessionId: 'w2',
      },
      dl: {
        currentBest1RM: 175,
        previousBest1RM: 0,
        lastIncreaseAt: '2025-12-20T10:00:00.000Z',
        lastIncreaseSessionId: null,
      },
    })
  })
})

test('the scorer matches exercise names case- and whitespace-insensitively', () => {
  const points = (exerciseName: string) =>
    calculateExerciseStrengthPoints({
      exerciseName,
      gender: 'male',
      bodyweightKg: 80,
      estimated1RMKg: 100,
    })
  expect(points(' bench press (barbell)')).toBe(points('Bench Press (Barbell)'))
  expect(points('Bench Press (Barbell)')).not.toBeNull()
})

test('bodyweight is the latest daily-log weight, else the profile weight', () => {
  expect(resolveStrengthBodyweightKg({ latestDailyWeightKg: 82, profileWeightKg: 90 })).toBe(82)
  expect(resolveStrengthBodyweightKg({ latestDailyWeightKg: null, profileWeightKg: '90' })).toBe(90)
  expect(resolveStrengthBodyweightKg({ latestDailyWeightKg: 0, profileWeightKg: null })).toBeNull()
})

describe('app and server loaders produce identical inputs from the same rows', () => {
  const cases: [string, unknown][] = [
    ['with a daily-log weight', { data: { weight_kg: 81.5 }, error: null }],
    ['without a daily-log weight', { data: null, error: null }],
  ]

  test.each(cases)('%s', async (_name, dailyLog) => {
    mockTables.current = {
      profiles: { data: { id: 'user-1', gender: 'male', weight_kg: 88 }, error: null },
      workout_sessions: { data: ROWS, error: null },
      daily_log_entries: dailyLog,
      onboarding_strength_snapshots: { data: ONBOARDING_ROW, error: null },
    }

    const app = await loadStrengthInputs('user-1')
    const server = await serverStrength.loadUserStrengthInputs(fakeSupabase(), 'user-1')

    const pick = (value: any) => ({
      bodyweightKg: value.bodyweightKg,
      exercises: value.exercises,
      sessions: value.sessions,
      best1RMSnapshotByExerciseId: value.best1RMSnapshotByExerciseId,
    })
    expect(pick(app)).toEqual(pick(server))
    expect(app.strengthGender).toBe(server.gender)
    expect(app.profile?.weight_kg).toBe(app.bodyweightKg)
    expect(app.exercises.some((exercise) => exercise.exerciseId === 'dl')).toBe(true)

    // Both sides then score the same inputs to the same number.
    const serverProfile = await serverStrength.buildUserStrengthProfile(fakeSupabase(), 'user-1')
    expect(serverProfile.profile.bodyweightKg).toBe(app.bodyweightKg)
  })

  test('the app loader applies the bodyweight rule to a profile override', async () => {
    mockTables.current = {
      workout_sessions: { data: ROWS, error: null },
      daily_log_entries: { data: { weight_kg: 95 }, error: null },
      onboarding_strength_snapshots: { data: null, error: null },
    }
    const override = { id: 'user-1', gender: 'male', weight_kg: 90 } as any

    const withDailyLog = await loadStrengthInputs('user-1', { profileOverride: override })
    expect(withDailyLog.profile?.weight_kg).toBe(95)

    mockTables.current.daily_log_entries = { data: null, error: null }
    const withoutDailyLog = await loadStrengthInputs('user-1', { profileOverride: override })
    expect(withoutDailyLog.profile).toBe(override)
    expect(withoutDailyLog.bodyweightKg).toBe(90)
  })
})

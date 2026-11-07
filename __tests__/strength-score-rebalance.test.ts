import {
  STRENGTH_SCORE_MAX_AHEAD,
  applyStrengthScoreRounding,
  calculateOverallStrengthScore,
  calculateStrengthScoreHistory,
  getStrengthLevelTargetPerformance,
  type OverallStrengthExerciseInput,
  type StrengthHistorySession,
} from '../lib/overall-strength-score'
import { estimateOneRepMaxKg } from '../lib/strength-progress'
import type { StrengthLevel } from '../lib/strength-standards'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildUserStrengthProfile } = require('../supabase/functions/_shared/strength')

const BODYWEIGHT_KG = 80

function atLevel(exerciseName: string, level: StrengthLevel): number {
  const target = getStrengthLevelTargetPerformance({
    exerciseName,
    gender: 'male',
    bodyweightKg: BODYWEIGHT_KG,
    targetLevel: level,
  })
  if (target === null) throw new Error(`No standard for ${exerciseName}`)
  return target
}

function lift(
  exerciseId: string,
  exerciseName: string,
  max1RM: number,
  extra: Partial<OverallStrengthExerciseInput> = {},
): OverallStrengthExerciseInput {
  return { exerciseId, exerciseName, max1RM, ...extra }
}

function score(exercises: OverallStrengthExerciseInput[]) {
  return calculateOverallStrengthScore({
    gender: 'male',
    bodyweightKg: BODYWEIGHT_KG,
    exercises,
  })
}

function preciseScore(exercises: OverallStrengthExerciseInput[]): number {
  return Object.values(score(exercises).groupBreakdown).reduce(
    (sum, group) => sum + group.weightedContribution,
    0,
  )
}

describe('strength score rebalance', () => {
  test('accessory lifts count at their real level instead of being cut', () => {
    const squat = lift('squat', 'Squat (Barbell)', atLevel('Squat (Barbell)', 'Intermediate'))
    const legExtension = lift(
      'leg-extension',
      'Leg Extension (Machine)',
      atLevel('Leg Extension (Machine)', 'Intermediate'),
    )

    const legs = score([squat, legExtension]).groupBreakdown.Legs

    // Both lifts are Intermediate (400), so the group must stay at least Intermediate.
    expect(legs.effectiveScore).toBeGreaterThanOrEqual(400)
  })

  test('a machine-only lifter at Intermediate on every lift scores Intermediate', () => {
    const machines = [
      'Chest Press (Machine)',
      'Seated Fly (Machine)',
      'Leg Press (Machine)',
      'Leg Extension (Machine)',
      'Lying Leg Curl (Machine)',
      'Lat Pulldown (Cable)',
      'Shoulder Press (Machine)',
      'Pushdown (Cable)',
      'Cable Crunch (Cable)',
    ].map((name) => lift(name, name, atLevel(name, 'Intermediate')))

    const result = score(machines)

    expect(result.level).toBe('Intermediate')
    expect(result.score).toBeGreaterThanOrEqual(4000)
    expect(result.score).toBeLessThanOrEqual(4100)
  })

  test('compound machines count more than isolation lifts', () => {
    const strongLegPress = score([
      lift('lp', 'Leg Press (Machine)', atLevel('Leg Press (Machine)', 'Advanced')),
      lift('le', 'Leg Extension (Machine)', atLevel('Leg Extension (Machine)', 'Novice')),
    ]).groupBreakdown.Legs.effectiveScore
    const strongLegExtension = score([
      lift('lp', 'Leg Press (Machine)', atLevel('Leg Press (Machine)', 'Novice')),
      lift('le', 'Leg Extension (Machine)', atLevel('Leg Extension (Machine)', 'Advanced')),
    ]).groupBreakdown.Legs.effectiveScore

    expect(strongLegPress).toBeGreaterThan(strongLegExtension)
  })

  test('a lift logged once counts less than one trained regularly', () => {
    const squat = lift('squat', 'Squat (Barbell)', atLevel('Squat (Barbell)', 'Advanced'), {
      sessionCount: 20,
    })
    const weakLift = (sessionCount: number) =>
      lift('le', 'Leg Extension (Machine)', atLevel('Leg Extension (Machine)', 'Novice'), {
        sessionCount,
      })

    const triedOnce = score([squat, weakLift(1)]).groupBreakdown.Legs.effectiveScore
    const trainedOften = score([squat, weakLift(12)]).groupBreakdown.Legs.effectiveScore

    expect(triedOnce).toBeGreaterThan(trainedOften)
  })
})

describe('applyStrengthScoreRounding', () => {
  test('a record earns +1 even when the precise gain is tiny', () => {
    expect(
      applyStrengthScoreRounding({ previousDisplayedScore: 400, preciseScore: 400.05, hadRecord: true }),
    ).toBe(401)
  })

  test('never runs more than the limit ahead of the precise score', () => {
    expect(
      applyStrengthScoreRounding({
        previousDisplayedScore: 400 + STRENGTH_SCORE_MAX_AHEAD,
        preciseScore: 400.2,
        hadRecord: true,
      }),
    ).toBe(400 + STRENGTH_SCORE_MAX_AHEAD)
  })

  test('never shows less than the rounded precise score', () => {
    expect(
      applyStrengthScoreRounding({ previousDisplayedScore: 402, preciseScore: 409.6, hadRecord: true }),
    ).toBe(410)
  })

  test('workouts without a record keep the score unchanged while within limits', () => {
    expect(
      applyStrengthScoreRounding({ previousDisplayedScore: 402, preciseScore: 400.4, hadRecord: false }),
    ).toBe(402)
  })
})

describe('calculateStrengthScoreHistory', () => {
  function buildHistory(
    legExtensionBests: number[],
    extraSessions: StrengthHistorySession[] = [],
    baseWorkouts = 5,
  ) {
    const base: StrengthHistorySession[] = Array.from({ length: baseWorkouts }, (_, index) => ({
      sessionId: `base-${index}`,
      exerciseBests: { squat: 140, bench: 100, row: 90, ohp: 60, le: 80 },
    }))
    const sessions: StrengthHistorySession[] = [
      ...base,
      ...legExtensionBests.map((best, index) => ({
        sessionId: `le-${index}`,
        exerciseBests: { le: best },
      })),
      ...extraSessions,
    ]
    const finalBest = (id: string, fallback: number) =>
      Math.max(
        fallback,
        ...sessions.map((session) => session.exerciseBests[id] ?? 0),
      )
    const countSessions = (id: string) =>
      sessions.filter((session) => session.exerciseBests[id] !== undefined).length
    const exercises = [
      lift('squat', 'Squat (Barbell)', finalBest('squat', 0), { sessionCount: countSessions('squat') }),
      lift('bench', 'Bench Press (Barbell)', finalBest('bench', 0), { sessionCount: countSessions('bench') }),
      lift('row', 'Bent Over Row (Barbell)', finalBest('row', 0), { sessionCount: countSessions('row') }),
      lift('ohp', 'Shoulder Press (Barbell)', finalBest('ohp', 0), { sessionCount: countSessions('ohp') }),
      lift('le', 'Leg Extension (Machine)', finalBest('le', 0), { sessionCount: countSessions('le') }),
    ]
    return { exercises, sessions }
  }

  test('small accessory records earn a point each until the score is the limit ahead', () => {
    const { exercises, sessions } = buildHistory([81, 82, 83, 84, 85, 86, 87, 88])

    const history = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises,
      sessions,
    })
    const recordSteps = history.steps.slice(5)
    const precise = preciseScore(exercises)

    expect(recordSteps.every((step) => step.hadRecord)).toBe(true)
    expect(recordSteps[0].scoreAfter - recordSteps[0].scoreBefore).toBe(1)
    expect(recordSteps.filter((step) => step.scoreAfter > step.scoreBefore).length).toBeGreaterThanOrEqual(
      STRENGTH_SCORE_MAX_AHEAD,
    )
    expect(history.result.score).toBeLessThanOrEqual(precise + STRENGTH_SCORE_MAX_AHEAD)
    expect(history.result.score).toBeGreaterThanOrEqual(Math.round(precise))
  })

  test('the final score matches the precise score within the limit, and is unaffected by input order', () => {
    const { exercises, sessions } = buildHistory([81, 82, 83], [
      { sessionId: 'squat-pr', exerciseBests: { squat: 160 } },
    ])

    const forward = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises,
      sessions,
    })
    const reversedExercises = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises: [...exercises].reverse(),
      sessions,
    })
    const precise = preciseScore(exercises)

    expect(forward.result.score - precise).toBeLessThanOrEqual(STRENGTH_SCORE_MAX_AHEAD)
    expect(forward.result.score - precise).toBeGreaterThanOrEqual(-0.5)
    expect(reversedExercises.result.score).toBe(forward.result.score)
  })

  test('a workout with a record never lowers the displayed score', () => {
    // Only one base workout, so leg extension gains weight in its group as it
    // is trained, which lowers the precise score despite the records.
    const { exercises, sessions } = buildHistory([81, 82, 83, 84, 85, 86], [], 1)

    const history = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises,
      sessions,
    })
    const recordSteps = history.steps.filter((step) => step.hadRecord)

    expect(history.steps.at(-1)!.preciseScoreAfter).toBeLessThan(history.steps[0].preciseScoreAfter)
    expect(recordSteps.every((step) => step.scoreAfter >= step.scoreBefore)).toBe(true)
  })

  test('logging a new, weaker lift does not lower the displayed score', () => {
    const { exercises, sessions } = buildHistory([])
    const withNewLift = [
      ...exercises,
      lift('curl', 'Bicep Curl (Dumbbell)', 8, { sessionCount: 1 }),
    ]
    const before = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises,
      sessions,
    })
    const after = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises: withNewLift,
      sessions: [...sessions, { sessionId: 'new-lift', exerciseBests: { curl: 8 } }],
    })

    expect(after.result.score).toBeGreaterThanOrEqual(before.result.score)
  })

  test('best values that never appear in a workout (onboarding) count from the start', () => {
    const history = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises: [lift('bench', 'Bench Press (Barbell)', 100)],
      sessions: [],
    })

    expect(history.result.score).toBe(score([lift('bench', 'Bench Press (Barbell)', 100)]).score)
  })
})

describe('server and app agree on the displayed score', () => {
  type SetRow = { reps: number; weight: number }
  const workouts: { id: string; date: string; lifts: [string, string, SetRow[]][] }[] = [
    {
      id: 'w1',
      date: '2026-03-01T10:00:00.000Z',
      lifts: [
        ['squat', 'Squat (Barbell)', [{ weight: 120, reps: 5 }]],
        ['bench', 'Bench Press (Barbell)', [{ weight: 80, reps: 6 }]],
        ['le', 'Leg Extension (Machine)', [{ weight: 60, reps: 10 }]],
        ['lp', 'Leg Press (Machine)', [{ weight: 180, reps: 10 }]],
      ],
    },
    {
      id: 'w2',
      date: '2026-03-03T10:00:00.000Z',
      lifts: [
        ['le', 'Leg Extension (Machine)', [{ weight: 62.5, reps: 10 }]],
        ['curl', 'Bicep Curl (Dumbbell)', [{ weight: 14, reps: 10 }]],
      ],
    },
    {
      id: 'w3',
      date: '2026-03-05T10:00:00.000Z',
      lifts: [
        ['le', 'Leg Extension (Machine)', [{ weight: 65, reps: 10 }]],
        ['lp', 'Leg Press (Machine)', [{ weight: 190, reps: 10 }]],
      ],
    },
    {
      id: 'w4',
      date: '2026-03-08T10:00:00.000Z',
      lifts: [
        ['squat', 'Squat (Barbell)', [{ weight: 125, reps: 5 }]],
        ['bench', 'Bench Press (Barbell)', [{ weight: 82.5, reps: 6 }]],
      ],
    },
  ]

  function fakeSupabase(onboarding: unknown = null) {
    const rows = workouts.map((workout) => ({
      id: workout.id,
      date: workout.date,
      created_at: workout.date,
      workout_exercises: workout.lifts.map(([id, name, sets]) => ({
        exercise_id: id,
        exercise: { id, name, muscle_group: null },
        sets,
      })),
    }))
    const results: Record<string, unknown> = {
      profiles: { data: { gender: 'male' }, error: null },
      workout_sessions: { data: rows, error: null },
      daily_log_entries: { data: { weight_kg: BODYWEIGHT_KG }, error: null },
      onboarding_strength_snapshots: { data: onboarding, error: null },
    }
    return {
      from(table: string) {
        const builder: any = {}
        ;['select', 'eq', 'not', 'gt', 'order', 'limit'].forEach((method) => {
          builder[method] = () => builder
        })
        builder.single = () => Promise.resolve(results[table])
        builder.maybeSingle = () => Promise.resolve(results[table])
        builder.then = (resolve: (value: unknown) => unknown) => resolve(results[table])
        return builder
      },
    }
  }

  test('replaying the same workouts gives the same score', async () => {
    const sessions: StrengthHistorySession[] = workouts.map((workout) => ({
      sessionId: workout.id,
      exerciseBests: Object.fromEntries(
        workout.lifts.map(([id, , sets]) => [
          id,
          Math.max(...sets.map((set) => Math.round(estimateOneRepMaxKg(set.weight, set.reps)))),
        ]),
      ),
    }))
    const exercises = Array.from(
      new Map(workouts.flatMap((workout) => workout.lifts.map(([id, name]) => [id, name]))).entries(),
    ).map(([id, name]) =>
      lift(id, name, Math.max(...sessions.map((session) => session.exerciseBests[id] ?? 0)), {
        sessionCount: sessions.filter((session) => session.exerciseBests[id] !== undefined).length,
      }),
    )

    const app = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises,
      sessions,
    })
    const server = await buildUserStrengthProfile(fakeSupabase(), 'user-1')

    expect(server.overallLevel.points).toBe(app.result.score)
    expect(server.overallLevel.level).toBe(app.result.level)
  })
  test('both count the onboarding lift', async () => {
    const sessions: StrengthHistorySession[] = workouts.map((workout) => ({
      sessionId: workout.id,
      exerciseBests: Object.fromEntries(
        workout.lifts.map(([id, , sets]) => [
          id,
          Math.max(...sets.map((set) => Math.round(estimateOneRepMaxKg(set.weight, set.reps)))),
        ]),
      ),
    }))
    const logged = Array.from(
      new Map(workouts.flatMap((workout) => workout.lifts.map(([id, name]) => [id, name]))).entries(),
    ).map(([id, name]) =>
      lift(id, name, Math.max(...sessions.map((session) => session.exerciseBests[id] ?? 0)), {
        sessionCount: sessions.filter((session) => session.exerciseBests[id] !== undefined).length,
      }),
    )
    // Onboarding deadlift was never logged; the app adds it with no session count.
    const app = calculateStrengthScoreHistory({
      gender: 'male',
      bodyweightKg: BODYWEIGHT_KG,
      exercises: [...logged, lift('dl', 'Deadlift (Barbell)', 160)],
      sessions,
    })
    const server = await buildUserStrengthProfile(
      fakeSupabase({
        exercise_id: 'dl',
        working_weight_kg: 140,
        reps: 5,
        estimated_1rm_kg: 160,
        created_at: '2026-02-20T10:00:00.000Z',
        updated_at: null,
        exercise: { name: 'Deadlift (Barbell)', muscle_group: 'Back' },
      }),
      'user-1',
    )

    expect(server.overallLevel.points).toBe(app.result.score)
    expect(server.overallLevel.level).toBe(app.result.level)
  })
})

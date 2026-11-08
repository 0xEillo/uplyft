/**
 * Golden numbers for the strength score. Fixed fixtures run through both the
 * app scorer (lib/overall-strength-score.ts, lib/strength-standards.ts) and the
 * server scorer (supabase/functions/_shared/strength.ts), and both must produce
 * these exact values. A failure here means scores changed for real users.
 */
import {
  calculateExerciseStrengthPoints,
  calculateOverallStrengthScore,
  calculateStrengthScoreHistory,
  calculateStrengthScoreProjectionForExerciseLevel,
  type OverallStrengthExerciseInput,
  type OverallStrengthGroup,
  type OverallStrengthScoreResult,
  type StrengthHistorySession,
} from '../lib/overall-strength-score'
import { estimateOneRepMaxKg, type StrengthGender } from '../lib/strength-progress'
import { getStrengthStandard } from '../lib/strength-standards'
import { getExerciseNameMap } from '../lib/exercise-standards-config'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serverStrength = require('../supabase/functions/_shared/strength')

type SetFixture = { weight: number | null; reps: number }
type LiftFixture = [id: string, name: string, muscleGroup: string | null, sets: SetFixture[]]
type WorkoutFixture = { id: string; date: string; lifts: LiftFixture[] }
type OnboardingFixture = {
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  workingWeightKg: number
  reps: number
  estimated1RMKg: number
  recordedAt: string
}

interface Fixture {
  name: string
  gender: StrengthGender
  bodyweightKg: number
  workouts: WorkoutFixture[]
  onboarding?: OnboardingFixture
}

const GROUPS: OverallStrengthGroup[] = ['Legs', 'Back', 'Chest', 'Shoulders', 'Arms', 'Core']

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const FIXTURES: Fixture[] = [
  {
    name: 'male mixed full body, records and non-records',
    gender: 'male',
    bodyweightKg: 82.5,
    workouts: [
      {
        id: 'm1',
        date: '2026-01-05T09:00:00.000Z',
        lifts: [
          ['squat', 'Squat (Barbell)', 'Quads', [{ weight: 100, reps: 5 }, { weight: 110, reps: 3 }]],
          ['bench', 'Bench Press (Barbell)', 'Chest', [{ weight: 80, reps: 5 }]],
          ['row', 'Bent Over Row (Barbell)', 'Back', [{ weight: 70, reps: 8 }]],
          ['zottman', 'Zottman Curl', 'Biceps', [{ weight: 14, reps: 10 }]],
        ],
      },
      {
        id: 'm2',
        date: '2026-01-08T09:00:00.000Z',
        lifts: [
          ['dl', 'Deadlift (Barbell)', 'Back', [{ weight: 140, reps: 5 }]],
          ['ohp', 'Shoulder Press (Barbell)', 'Shoulders', [{ weight: 50, reps: 6 }]],
          ['curl', 'Bicep Curl (Dumbbell)', 'Biceps', [{ weight: 16, reps: 10 }]],
          ['hlr', 'Hanging Leg Raise', 'Abs', [{ weight: null, reps: 12 }]],
        ],
      },
      {
        id: 'm3',
        date: '2026-01-12T09:00:00.000Z',
        lifts: [
          // No records: lighter than week 1.
          ['squat', 'Squat (Barbell)', 'Quads', [{ weight: 100, reps: 4 }]],
          ['bench', 'Bench Press (Barbell)', 'Chest', [{ weight: 75, reps: 5 }]],
        ],
      },
      {
        id: 'm4',
        date: '2026-01-15T09:00:00.000Z',
        lifts: [
          // Tiny record (+1 kg e1RM) and an alias name.
          ['bench', 'Bench Press (Barbell)', 'Chest', [{ weight: 82.5, reps: 5 }]],
          ['smith', 'Smith Squat', 'Quads', [{ weight: 90, reps: 8 }]],
          ['pushdown', 'Pushdown (Cable)', 'Triceps', [{ weight: 35, reps: 12 }]],
          ['le', 'Leg Extension (Machine)', 'Quads', [{ weight: 60, reps: 12 }]],
        ],
      },
      {
        id: 'm5',
        date: '2026-01-19T09:00:00.000Z',
        lifts: [
          ['squat', 'Squat (Barbell)', 'Quads', [{ weight: 120, reps: 5 }]],
          ['dl', 'Deadlift (Barbell)', 'Back', [{ weight: 160, reps: 3 }]],
          ['hlr', 'Hanging Leg Raise', 'Abs', [{ weight: null, reps: 15 }]],
          ['lat', 'Lat Pulldown (Cable)', 'Lats', [{ weight: 65, reps: 10 }]],
        ],
      },
    ],
  },
  {
    name: 'female light, only two groups trained',
    gender: 'female',
    bodyweightKg: 58,
    workouts: [
      {
        id: 'f1',
        date: '2026-02-01T18:00:00.000Z',
        lifts: [
          ['hip', 'Hip Thrust (Barbell)', 'Glutes', [{ weight: 60, reps: 10 }]],
          ['lp', 'Leg Press (Machine)', 'Quads', [{ weight: 100, reps: 12 }]],
          ['lr', 'Lateral Raise (Dumbbell)', 'Shoulders', [{ weight: 5, reps: 15 }]],
        ],
      },
      {
        id: 'f2',
        date: '2026-02-04T18:00:00.000Z',
        lifts: [
          ['hip', 'Hip Thrust (Barbell)', 'Glutes', [{ weight: 70, reps: 8 }]],
          ['lr', 'Lateral Raise (Dumbbell)', 'Shoulders', [{ weight: 6, reps: 12 }]],
        ],
      },
    ],
  },
  {
    name: 'male clamped: tier-1 lift past world class',
    gender: 'male',
    bodyweightKg: 70,
    workouts: [
      {
        id: 'c1',
        date: '2026-03-01T07:00:00.000Z',
        lifts: [
          ['bench', 'Bench Press (Barbell)', 'Chest', [{ weight: 220, reps: 3 }]],
          ['fly', 'Fly (Dumbbell)', 'Chest', [{ weight: 50, reps: 10 }]],
          ['squat', 'Squat (Barbell)', 'Quads', [{ weight: 260, reps: 2 }]],
        ],
      },
      {
        id: 'c2',
        date: '2026-03-03T07:00:00.000Z',
        lifts: [
          ['bench', 'Bench Press (Barbell)', 'Chest', [{ weight: 225, reps: 3 }]],
          ['shrug', 'Shrug (Barbell)', 'Traps', [{ weight: 180, reps: 10 }]],
        ],
      },
    ],
  },
  {
    name: 'male with an onboarding lift never logged',
    gender: 'male',
    bodyweightKg: 95,
    workouts: [
      {
        id: 'o1',
        date: '2026-04-10T12:00:00.000Z',
        lifts: [
          ['bench', 'Bench Press (Barbell)', 'Chest', [{ weight: 100, reps: 5 }]],
          ['curl', 'Bicep Curl (Barbell)', 'Biceps', [{ weight: 40, reps: 8 }]],
        ],
      },
      {
        id: 'o2',
        date: '2026-04-14T12:00:00.000Z',
        lifts: [
          ['bench', 'Bench Press (Barbell)', 'Chest', [{ weight: 102.5, reps: 5 }]],
          ['cc', 'Cable Crunch (Cable)', 'Abs', [{ weight: 50, reps: 15 }]],
        ],
      },
    ],
    onboarding: {
      exerciseId: 'dl',
      exerciseName: 'Deadlift (Barbell)',
      muscleGroup: 'Back',
      workingWeightKg: 150,
      reps: 5,
      estimated1RMKg: 175,
      recordedAt: '2026-04-01T08:00:00.000Z',
    },
  },
]

function performance(name: string, set: SetFixture): number {
  return name === 'Hanging Leg Raise'
    ? set.reps
    : estimateOneRepMaxKg(set.weight as number, set.reps)
}

/** Shapes fixture rows the way the app loader does (rounded e1RM per set). */
function buildAppInputs(fixture: Fixture): {
  exercises: OverallStrengthExerciseInput[]
  sessions: StrengthHistorySession[]
} {
  const exercises = new Map<string, OverallStrengthExerciseInput>()
  const sessions: StrengthHistorySession[] = []
  fixture.workouts.forEach((workout) => {
    const bests: Record<string, number> = {}
    workout.lifts.forEach(([id, name, muscleGroup, sets]) => {
      if (name === 'Zottman Curl') return // no standards: the app loader skips it
      const existing = exercises.get(id) ?? {
        exerciseId: id,
        exerciseName: name,
        muscleGroup,
        max1RM: 0,
        lastTrainedAt: workout.date,
        sessionCount: 0,
      }
      sets.forEach((set) => {
        const value = Math.round(performance(name, set))
        existing.max1RM = Math.max(existing.max1RM, value)
        bests[id] = Math.max(bests[id] ?? 0, value)
      })
      existing.lastTrainedAt = workout.date
      existing.sessionCount = (existing.sessionCount ?? 0) + 1
      exercises.set(id, existing)
    })
    sessions.push({ sessionId: workout.id, exerciseBests: bests })
  })
  const list = Array.from(exercises.values())
  const onboarding = fixture.onboarding
  if (onboarding) {
    const max1RM = Math.round(onboarding.estimated1RMKg)
    const existing = list.find((exercise) => exercise.exerciseId === onboarding.exerciseId)
    if (existing) existing.max1RM = Math.max(existing.max1RM, max1RM)
    else
      list.push({
        exerciseId: onboarding.exerciseId,
        exerciseName: onboarding.exerciseName,
        muscleGroup: onboarding.muscleGroup,
        max1RM,
        lastTrainedAt: onboarding.recordedAt,
      })
  }
  return { exercises: list, sessions }
}

function fakeSupabase(fixture: Fixture) {
  const rows = fixture.workouts.map((workout) => ({
    id: workout.id,
    date: workout.date,
    created_at: workout.date,
    workout_exercises: workout.lifts.map(([id, name, muscleGroup, sets]) => ({
      exercise_id: id,
      exercise: { id, name, muscle_group: muscleGroup, gif_url: null },
      sets,
    })),
  }))
  const onboarding = fixture.onboarding
    ? {
        exercise_id: fixture.onboarding.exerciseId,
        working_weight_kg: fixture.onboarding.workingWeightKg,
        reps: fixture.onboarding.reps,
        estimated_1rm_kg: fixture.onboarding.estimated1RMKg,
        created_at: fixture.onboarding.recordedAt,
        updated_at: null,
        exercise: {
          id: fixture.onboarding.exerciseId,
          name: fixture.onboarding.exerciseName,
          muscle_group: fixture.onboarding.muscleGroup,
          gif_url: null,
        },
      }
    : null
  const results: Record<string, unknown> = {
    profiles: { data: { gender: fixture.gender, weight_kg: fixture.bodyweightKg }, error: null },
    workout_sessions: { data: rows, error: null },
    daily_log_entries: { data: { weight_kg: fixture.bodyweightKg }, error: null },
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

function summariseResult(result: Pick<
  OverallStrengthScoreResult,
  'level' | 'nextLevel' | 'progress' | 'liftsTracked' | 'weakestGroup' | 'groupBreakdown'
> & { score: number }) {
  return {
    score: result.score,
    level: result.level,
    nextLevel: result.nextLevel,
    progress: round(result.progress, 2),
    liftsTracked: result.liftsTracked,
    weakestGroup: result.weakestGroup,
    groups: Object.fromEntries(
      GROUPS.map((group) => [group, round(result.groupBreakdown[group].effectiveScore)]),
    ),
  }
}

const EXPECTED: Record<string, any> = {
  'male mixed full body, records and non-records': {
    history: {
      score: 4491,
      level: 'Intermediate',
      nextLevel: 'Advanced',
      progress: 24.55,
      liftsTracked: 11,
      weakestGroup: 'Arms',
      groups: {
        Legs: 4781.073,
        Back: 5484.494,
        Chest: 4020,
        Shoulders: 4200,
        Arms: 3210.39,
        Core: 3538.462,
      },
      steps: [
        [0, 2893, 2893.4],
        [2893, 4242, 4241.995],
        [4242, 4242, 4241.995],
        [4242, 4242, 4195.929],
        [4242, 4491, 4491.394],
      ],
    },
    ranks: [
      ['dl', 'Intermediate', 76.67, 5533, 176],
      ['squat', 'Intermediate', 39.39, 4788, 140],
      ['row', 'Intermediate', 15.76, 4315, 89],
      ['lat', 'Intermediate', 10.91, 4218, 87],
      ['ohp', 'Novice', 90.91, 3818, 60],
      ['bench', 'Novice', 82.73, 3655, 96],
      ['hlr', 'Novice', 76.92, 3538, 15],
      ['smith', 'Novice', 76.36, 3527, 114],
      ['curl', 'Novice', 69.7, 3394, 21],
      ['le', 'Novice', 53.64, 3073, 84],
      ['pushdown', 'Novice', 37.58, 2752, 49],
    ],
    direct: {
      current: {
        score: 4491,
        level: 'Intermediate',
        nextLevel: 'Advanced',
        progress: 24.57,
        liftsTracked: 11,
        weakestGroup: 'Arms',
        groups: {
          Legs: 4781.073,
          Back: 5484.494,
          Chest: 4020,
          Shoulders: 4200,
          Arms: 3210.39,
          Core: 3538.462,
        },
      },
      points: [
        ['squat', 4787.879, 'Intermediate'],
        ['bench', 3654.545, 'Novice'],
        ['row', 4315.152, 'Intermediate'],
        ['dl', 5533.333, 'Intermediate'],
        ['ohp', 3818.182, 'Novice'],
        ['curl', 3393.939, 'Novice'],
        ['hlr', 3538.462, 'Novice'],
        ['smith', 3527.273, 'Novice'],
        ['pushdown', 2751.515, 'Novice'],
        ['le', 3072.727, 'Novice'],
        ['lat', 4218.182, 'Intermediate'],
      ],
      projection: [4491.394, 4728.265, 237, 165],
    },
    serverTargets: {
      currentPoints: 4491,
      best: [142.6, 25, 4516],
    },
  },
  'female light, only two groups trained': {
    history: {
      score: 1763,
      level: 'Beginner',
      nextLevel: 'Novice',
      progress: 76.3,
      liftsTracked: 3,
      weakestGroup: 'Shoulders',
      groups: {
        Legs: 4561.537,
        Back: 0,
        Chest: 0,
        Shoulders: 3517.241,
        Arms: 0,
        Core: 0,
      },
      steps: [
        [0, 1687, 1687.468],
        [1687, 1763, 1763.045],
      ],
    },
    ranks: [
      ['lp', 'Intermediate', 33.1, 4662, 140],
      ['hip', 'Intermediate', 4.6, 4092, 89],
      ['lr', 'Novice', 75.86, 3517, 8],
    ],
    direct: {
      current: {
        score: 1763,
        level: 'Beginner',
        nextLevel: 'Novice',
        progress: 76.3,
        liftsTracked: 3,
        weakestGroup: 'Shoulders',
        groups: {
          Legs: 4561.537,
          Back: 0,
          Chest: 0,
          Shoulders: 3517.241,
          Arms: 0,
          Core: 0,
        },
      },
      points: [
        ['hip', 4091.954, 'Intermediate'],
        ['lp', 4662.069, 'Intermediate'],
        ['lr', 3517.241, 'Novice'],
      ],
      projection: [1763.045, 2073.158, 310, 87],
    },
    serverTargets: {
      currentPoints: 1763,
      best: [62.3, 25, 1788],
    },
  },
  'male clamped: tier-1 lift past world class': {
    history: {
      score: 6588,
      level: 'Advanced',
      nextLevel: 'Elite',
      progress: 26.13,
      liftsTracked: 4,
      weakestGroup: 'Back',
      groups: {
        Legs: 10000,
        Back: 9533.333,
        Chest: 10000,
        Shoulders: 0,
        Arms: 0,
        Core: 0,
      },
      steps: [
        [0, 4300, 4300],
        [4300, 6588, 6588],
      ],
    },
    ranks: [
      ['bench', 'World Class', 100, 10000, 248],
      ['fly', 'World Class', 100, 10000, 67],
      ['squat', 'World Class', 100, 10000, 277],
      ['shrug', 'Elite', 23.81, 8667, 240],
    ],
    direct: {
      current: {
        score: 6588,
        level: 'Advanced',
        nextLevel: 'Elite',
        progress: 26.13,
        liftsTracked: 4,
        weakestGroup: 'Back',
        groups: {
          Legs: 10000,
          Back: 9533.333,
          Chest: 10000,
          Shoulders: 0,
          Arms: 0,
          Core: 0,
        },
      },
      points: [
        ['bench', 10000, 'World Class'],
        ['fly', 10000, 'World Class'],
        ['squat', 10000, 'World Class'],
        ['shrug', 8666.667, 'Elite'],
      ],
      projection: [6588, 6588, 0, 277],
    },
    serverTargets: {
      currentPoints: 6588,
      best: null,
    },
  },
  'male with an onboarding lift never logged': {
    history: {
      score: 2492,
      level: 'Novice',
      nextLevel: 'Intermediate',
      progress: 24.6,
      liftsTracked: 4,
      weakestGroup: 'Core',
      groups: {
        Legs: 0,
        Back: 4805.263,
        Chest: 4457.895,
        Shoulders: 0,
        Arms: 3705.263,
        Core: 3157.895,
      },
      steps: [
        [1153, 2307, 2307.337],
        [2307, 2492, 2491.632],
      ],
    },
    ranks: [
      ['dl', 'Intermediate', 18.42, 4368, 175],
      ['bench', 'Intermediate', 2.63, 4053, 120],
      ['curl', 'Novice', 68.42, 3368, 51],
      ['cc', 'Novice', 57.89, 3158, 75],
    ],
    direct: {
      current: {
        score: 2492,
        level: 'Novice',
        nextLevel: 'Intermediate',
        progress: 24.58,
        liftsTracked: 4,
        weakestGroup: 'Core',
        groups: {
          Legs: 0,
          Back: 4805.263,
          Chest: 4457.895,
          Shoulders: 0,
          Arms: 3705.263,
          Core: 3157.895,
        },
      },
      points: [
        ['bench', 4052.632, 'Intermediate'],
        ['curl', 3368.421, 'Novice'],
        ['cc', 3157.895, 'Novice'],
        ['dl', 4368.421, 'Intermediate'],
      ],
      projection: [2491.632, 4075.632, 1584, 190],
    },
    serverTargets: {
      currentPoints: 2492,
      best: [6.8, 25, 2517],
    },
  },
}

describe('strength score golden numbers', () => {
  describe.each(FIXTURES)('$name', (fixture) => {
    const { exercises, sessions } = buildAppInputs(fixture)
    const expected = EXPECTED[fixture.name]

    test('app and server history replay give the golden score', async () => {
      const app = calculateStrengthScoreHistory({
        gender: fixture.gender,
        bodyweightKg: fixture.bodyweightKg,
        exercises,
        sessions,
      })
      const server = await serverStrength.buildUserStrengthProfile(
        fakeSupabase(fixture),
        'user-1',
      )
      const appSummary = {
        ...summariseResult(app.result),
        steps: app.steps.map((step) => [step.scoreBefore, step.scoreAfter, round(step.preciseScoreAfter)]),
      }
      const serverSummary = summariseResult({
        ...server.overallLevel,
        score: server.overallLevel.points,
      })
      const serverRanks = server.exerciseRanks.map((rank: any) => [
        rank.exerciseId,
        rank.level,
        round(rank.progress, 2),
        rank.scorePoints,
        rank.currentValue,
      ])

      expect(appSummary).toEqual(expected.history)
      const { steps: _steps, ...appWithoutSteps } = appSummary
      expect(serverSummary).toEqual(appWithoutSteps)
      expect(serverRanks).toEqual(expected.ranks)
    })

    test('app and server non-replay score and per-lift levels agree', () => {
      const app = calculateOverallStrengthScore({
        gender: fixture.gender,
        bodyweightKg: fixture.bodyweightKg,
        exercises,
      })
      const appPoints = exercises.map((exercise) => [
        exercise.exerciseId,
        calculateExerciseStrengthPoints({
          exerciseName: exercise.exerciseName,
          gender: fixture.gender,
          bodyweightKg: fixture.bodyweightKg,
          estimated1RMKg: exercise.max1RM,
        }) === null
          ? null
          : round(
              calculateExerciseStrengthPoints({
                exerciseName: exercise.exerciseName,
                gender: fixture.gender,
                bodyweightKg: fixture.bodyweightKg,
                estimated1RMKg: exercise.max1RM,
              }) as number,
            ),
        getStrengthStandard(
          exercise.exerciseName,
          fixture.gender,
          fixture.bodyweightKg,
          exercise.max1RM,
        )?.level ?? null,
      ])
      const projection = calculateStrengthScoreProjectionForExerciseLevel({
        gender: fixture.gender,
        bodyweightKg: fixture.bodyweightKg,
        exercises,
        exercise: {
          exerciseId: 'squat',
          exerciseName: 'Squat (Barbell)',
          muscleGroup: 'Quads',
          lastTrainedAt: null,
        },
        targetLevel: 'Advanced',
        now: new Date('2026-06-01T00:00:00.000Z'),
      })
      // The server's chat tool scores the same lifts without replaying history.
      const serverTargets = serverStrength.calculateLifterPointTargets({
        profile: {
          profile: { gender: fixture.gender, bodyweightKg: fixture.bodyweightKg },
          overallLevel: null,
          missingRequirements: [],
          exerciseRanks: exercises
            .filter((exercise) => exercise.exerciseName !== 'Zottman Curl')
            .map((exercise) => ({
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              canonicalExerciseName:
                getExerciseNameMap().get(exercise.exerciseName)?.name ?? exercise.exerciseName,
              muscleGroup: exercise.muscleGroup ?? null,
              lastTrainedAt: exercise.lastTrainedAt ?? null,
              isRepBased: exercise.exerciseName === 'Hanging Leg Raise',
              tier: getExerciseNameMap().get(exercise.exerciseName)?.tier ?? 3,
              sessionCount: exercise.sessionCount ?? null,
              currentValue: exercise.max1RM,
              bestSetWeightKg: null,
              bestSetReps: null,
            })),
        },
        requestedPoints: 25,
        exerciseName: 'Squat (Barbell)',
        now: new Date('2026-06-01T00:00:00.000Z'),
      })

      const summary = {
        current: summariseResult(app),
        points: appPoints,
        projection: projection
          ? [round(projection.currentScore), round(projection.projectedScore), projection.pointsGained, projection.targetPerformance]
          : null,
      }
      const serverSummary = {
        currentPoints: serverTargets.currentPoints,
        best: serverTargets.bestTarget
          ? [serverTargets.bestTarget.targetValue, serverTargets.bestTarget.pointsGained, serverTargets.bestTarget.projectedPoints]
          : null,
      }

      expect(summary).toEqual(expected.direct)
      expect(serverSummary).toEqual(expected.serverTargets)
      expect(serverTargets.currentPoints).toBe(app.score)
    })
  })
})

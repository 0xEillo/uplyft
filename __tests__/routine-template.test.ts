import type { RoutineTemplateExercise } from '@/lib/routines/routine-template'

type QueryResult = {
  data?: unknown
  error?: { code?: string; message?: string } | null
}

type QueryCall = {
  method: string
  args: unknown[]
}

type MockQueryBuilder = {
  __calls: QueryCall[]
  __table?: string
  [key: string]: unknown
}

const mockSupabase = {
  from: jest.fn(),
}

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

// lib/database.ts pulls in modules that don't load under node; stub them the
// same way __tests__/workout-ownership.test.ts does.
jest.mock('@/lib/exercise-metadata', () => ({
  generateExerciseMetadata: jest.fn(),
}))

jest.mock('@/lib/exercise-standards-config', () => ({
  getExerciseNameMap: jest.fn(() => ({})),
  getLeaderboardExercises: jest.fn(() => []),
  isRepBasedExercise: jest.fn(() => false),
}))

jest.mock('@/lib/strength-progress', () => ({
  estimateOneRepMaxKg: jest.fn(() => 0),
}))

jest.mock('@/lib/utils/formatters', () => ({
  normalizeExerciseName: jest.fn((name: string) => name.trim()),
}))

const createQueryBuilder = (result: QueryResult): MockQueryBuilder => {
  const calls: QueryCall[] = []
  const builder: MockQueryBuilder = {
    __calls: calls,
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  }

  ;['select', 'eq', 'in', 'insert', 'update', 'delete'].forEach((method) => {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  })

  builder.single = (...args: unknown[]) => {
    calls.push({ method: 'single', args })
    return Promise.resolve(result)
  }

  return builder
}

const queueFromBuilders = (...builders: MockQueryBuilder[]) => {
  const queue = [...builders]
  mockSupabase.from.mockImplementation((table: string) => {
    const builder = queue.shift()
    if (!builder) {
      throw new Error(`Unexpected supabase.from("${table}") call`)
    }
    builder.__table = table
    return builder
  })
  return { remaining: () => queue.length }
}

const callArgs = (builder: MockQueryBuilder, method: string) =>
  builder.__calls.find((call) => call.method === method)?.args

const loadModule = () => import('@/lib/routines/routine-template')

const TEMPLATE: RoutineTemplateExercise[] = [
  {
    exercise_id: 'ex-bench',
    order_index: 0,
    notes: 'pause reps',
    sets: [
      { set_number: 1, reps_min: 6, reps_max: 8, rest_seconds: 120 },
      { set_number: 2, reps_min: 6, reps_max: 8, rest_seconds: 120 },
    ],
  },
  {
    exercise_id: 'ex-fly',
    order_index: 1,
    sets: [{ set_number: 1, reps_min: 10, reps_max: 12 }],
  },
]

describe('routine template row builders', () => {
  test('buildRoutineTemplateRows maps exercises and sets by order_index', async () => {
    const { buildRoutineTemplateRows } = await loadModule()

    expect(
      buildRoutineTemplateRows('routine-1', TEMPLATE, [
        // returned out of order on purpose
        { id: 're-fly', order_index: 1 },
        { id: 're-bench', order_index: 0 },
      ]),
    ).toEqual({
      exerciseRows: [
        {
          routine_id: 'routine-1',
          exercise_id: 'ex-bench',
          order_index: 0,
          notes: 'pause reps',
        },
        {
          routine_id: 'routine-1',
          exercise_id: 'ex-fly',
          order_index: 1,
          notes: null,
        },
      ],
      setRows: [
        {
          routine_exercise_id: 're-bench',
          set_number: 1,
          reps_min: 6,
          reps_max: 8,
          rest_seconds: 120,
        },
        {
          routine_exercise_id: 're-bench',
          set_number: 2,
          reps_min: 6,
          reps_max: 8,
          rest_seconds: 120,
        },
        // rest_seconds omitted when the caller didn't provide it
        {
          routine_exercise_id: 're-fly',
          set_number: 1,
          reps_min: 10,
          reps_max: 12,
        },
      ],
    })
  })

  test('set numbering is whatever the caller supplies', async () => {
    const { buildRoutineSetRows } = await loadModule()
    const { rows } = buildRoutineSetRows(
      [
        {
          exercise_id: 'ex',
          order_index: 3,
          sets: [
            { set_number: 4, rest_seconds: null },
            { set_number: 7, rest_seconds: null },
          ],
        },
      ],
      [{ id: 're', order_index: 3 }],
    )
    expect(rows.map((row) => row.set_number)).toEqual([4, 7])
    expect(rows[0]).toEqual({
      routine_exercise_id: 're',
      set_number: 4,
      reps_min: null,
      reps_max: null,
      rest_seconds: null,
    })
  })

  test('applies the order index offset and reports missing rows', async () => {
    const { buildRoutineExerciseRows, buildRoutineSetRows } =
      await loadModule()

    expect(
      buildRoutineExerciseRows('routine-1', TEMPLATE, 10).map(
        (row) => row.order_index,
      ),
    ).toEqual([10, 11])

    const { rows, missingOrderIndexes } = buildRoutineSetRows(
      TEMPLATE,
      [{ id: 're-bench', order_index: 10 }],
      10,
    )
    expect(rows).toHaveLength(2)
    expect(missingOrderIndexes).toEqual([1])
  })
})

describe('createRoutineWithTemplate', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('inserts routine, exercises, then sets', async () => {
    const routineInsert = createQueryBuilder({
      data: { id: 'routine-1', name: 'Push' },
      error: null,
    })
    const exerciseInsert = createQueryBuilder({
      data: [
        { id: 're-bench', order_index: 0 },
        { id: 're-fly', order_index: 1 },
      ],
      error: null,
    })
    const setInsert = createQueryBuilder({ data: null, error: null })
    const queue = queueFromBuilders(routineInsert, exerciseInsert, setInsert)

    const { createRoutineWithTemplate } = await loadModule()
    const result = await createRoutineWithTemplate(
      'user-1',
      { name: 'Push', notes: null, program_id: 'program-1' },
      TEMPLATE,
    )

    expect(result.routine).toEqual({ id: 'routine-1', name: 'Push' })
    expect(result.exercises).toHaveLength(2)

    expect(routineInsert.__table).toBe('workout_routines')
    expect(callArgs(routineInsert, 'insert')).toEqual([
      { user_id: 'user-1', name: 'Push', notes: null, program_id: 'program-1' },
    ])

    expect(exerciseInsert.__table).toBe('workout_routine_exercises')
    expect(callArgs(exerciseInsert, 'insert')?.[0]).toHaveLength(2)

    expect(setInsert.__table).toBe('workout_routine_sets')
    expect(callArgs(setInsert, 'insert')?.[0]).toHaveLength(3)
    expect(queue.remaining()).toBe(0)
  })

  test('skips child inserts for an empty template', async () => {
    const queue = queueFromBuilders(
      createQueryBuilder({ data: { id: 'routine-1' }, error: null }),
    )
    const { createRoutineWithTemplate } = await loadModule()
    await createRoutineWithTemplate('user-1', { name: 'Empty' }, [])
    expect(queue.remaining()).toBe(0)
  })

  test('throws without cleanup when the routine insert fails', async () => {
    const queue = queueFromBuilders(
      createQueryBuilder({ data: null, error: { message: 'rls' } }),
    )
    const { createRoutineWithTemplate } = await loadModule()
    await expect(
      createRoutineWithTemplate('user-1', { name: 'Push' }, TEMPLATE),
    ).rejects.toEqual({ message: 'rls' })
    expect(queue.remaining()).toBe(0)
  })

  test.each([
    ['exercise insert', 1],
    ['set insert', 2],
  ])('deletes the routine when the %s fails', async (_label, failingStep) => {
    const steps = [
      createQueryBuilder({ data: { id: 'routine-1' }, error: null }),
      createQueryBuilder({
        data: [
          { id: 're-bench', order_index: 0 },
          { id: 're-fly', order_index: 1 },
        ],
        error: null,
      }),
      createQueryBuilder({ data: null, error: null }),
    ].slice(0, failingStep)
    const failing = createQueryBuilder({
      data: null,
      error: { message: 'boom' },
    })
    const cleanup = createQueryBuilder({ data: null, error: null })
    const queue = queueFromBuilders(...steps, failing, cleanup)

    const { createRoutineWithTemplate } = await loadModule()
    await expect(
      createRoutineWithTemplate('user-1', { name: 'Push' }, TEMPLATE),
    ).rejects.toEqual({ message: 'boom' })

    expect(cleanup.__table).toBe('workout_routines')
    expect(cleanup.__calls).toEqual([
      { method: 'delete', args: [] },
      { method: 'in', args: ['id', ['routine-1']] },
    ])
    expect(queue.remaining()).toBe(0)
  })

  test('still rethrows the original error if cleanup fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    queueFromBuilders(
      createQueryBuilder({ data: { id: 'routine-1' }, error: null }),
      createQueryBuilder({ data: null, error: { message: 'boom' } }),
      createQueryBuilder({ data: null, error: { message: 'offline' } }),
    )
    const { createRoutineWithTemplate } = await loadModule()
    await expect(
      createRoutineWithTemplate('user-1', { name: 'Push' }, TEMPLATE),
    ).rejects.toEqual({ message: 'boom' })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('replaceRoutineTemplate', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  // Existing rows at order 0..2 → offset = max(2 + 1, 1 + 1) = 3
  const existing = createQueryBuilder.bind(null, {
    data: [
      { id: 'old-0', order_index: 0 },
      { id: 'old-1', order_index: 1 },
      { id: 'old-2', order_index: 2 },
    ],
    error: null,
  })
  const stagedInsert = createQueryBuilder.bind(null, {
    data: [
      { id: 'new-0', order_index: 3 },
      { id: 'new-1', order_index: 4 },
    ],
    error: null,
  })
  const ok = createQueryBuilder.bind(null, { data: null, error: null })
  const fail = createQueryBuilder.bind(null, {
    data: null,
    error: { message: 'boom' },
  })

  test('stages new rows clear of old ones, deletes old, then renumbers', async () => {
    const existingSelect = existing()
    const exerciseInsert = stagedInsert()
    const setInsert = ok()
    const oldDelete = ok()
    const renumber0 = ok()
    const renumber1 = ok()
    const queue = queueFromBuilders(
      existingSelect,
      exerciseInsert,
      setInsert,
      oldDelete,
      renumber0,
      renumber1,
    )

    const { replaceRoutineTemplate } = await loadModule()
    const result = await replaceRoutineTemplate('routine-1', TEMPLATE)

    expect(callArgs(existingSelect, 'eq')).toEqual(['routine_id', 'routine-1'])

    const insertedRows = callArgs(exerciseInsert, 'insert')?.[0] as {
      order_index: number
    }[]
    expect(insertedRows.map((row) => row.order_index)).toEqual([3, 4])

    const setRows = callArgs(setInsert, 'insert')?.[0] as {
      routine_exercise_id: string
    }[]
    expect(setRows.map((row) => row.routine_exercise_id)).toEqual([
      'new-0',
      'new-0',
      'new-1',
    ])

    expect(oldDelete.__table).toBe('workout_routine_exercises')
    expect(callArgs(oldDelete, 'in')).toEqual([
      'id',
      ['old-0', 'old-1', 'old-2'],
    ])

    expect(callArgs(renumber0, 'update')).toEqual([{ order_index: 0 }])
    expect(callArgs(renumber0, 'eq')).toEqual(['id', 'new-0'])
    expect(callArgs(renumber1, 'update')).toEqual([{ order_index: 1 }])
    expect(callArgs(renumber1, 'eq')).toEqual(['id', 'new-1'])

    expect(result.exercises).toEqual([
      { id: 'new-0', order_index: 0 },
      { id: 'new-1', order_index: 1 },
    ])
    expect(queue.remaining()).toBe(0)
  })

  test('offset also clears the final positions when the new template is longer', async () => {
    const exerciseInsert = createQueryBuilder({
      data: [
        { id: 'new-0', order_index: 2 },
        { id: 'new-1', order_index: 3 },
      ],
      error: null,
    })
    queueFromBuilders(
      createQueryBuilder({
        data: [{ id: 'old-0', order_index: 0 }],
        error: null,
      }),
      exerciseInsert,
      ok(),
      ok(),
      ok(),
      ok(),
    )
    const { replaceRoutineTemplate } = await loadModule()
    await replaceRoutineTemplate('routine-1', TEMPLATE)

    // offset = max(0 + 1, 1 + 1) = 2, so staged [2, 3] never overlaps final [0, 1]
    const insertedRows = callArgs(exerciseInsert, 'insert')?.[0] as {
      order_index: number
    }[]
    expect(insertedRows.map((row) => row.order_index)).toEqual([2, 3])
  })

  test('leaves the old template alone when the existing-row read fails', async () => {
    const queue = queueFromBuilders(fail())
    const { replaceRoutineTemplate } = await loadModule()
    await expect(
      replaceRoutineTemplate('routine-1', TEMPLATE),
    ).rejects.toEqual({ message: 'boom' })
    expect(queue.remaining()).toBe(0)
  })

  test('leaves the old template alone when staging the exercises fails', async () => {
    const queue = queueFromBuilders(existing(), fail())
    const { replaceRoutineTemplate } = await loadModule()
    await expect(
      replaceRoutineTemplate('routine-1', TEMPLATE),
    ).rejects.toEqual({ message: 'boom' })
    expect(queue.remaining()).toBe(0)
  })

  test.each([
    ['set insert', [] as 'ok'[]],
    ['old-row delete', ['ok'] as 'ok'[]],
  ])(
    'removes the staged rows and keeps the old ones when the %s fails',
    async (_label, okStepsBeforeFailure) => {
      const cleanup = ok()
      const queue = queueFromBuilders(
        existing(),
        stagedInsert(),
        ...okStepsBeforeFailure.map(() => ok()),
        fail(),
        cleanup,
      )
      const { replaceRoutineTemplate } = await loadModule()
      await expect(
        replaceRoutineTemplate('routine-1', TEMPLATE),
      ).rejects.toEqual({ message: 'boom' })

      expect(cleanup.__table).toBe('workout_routine_exercises')
      expect(cleanup.__calls).toEqual([
        { method: 'delete', args: [] },
        { method: 'in', args: ['id', ['new-0', 'new-1']] },
      ])
      expect(queue.remaining()).toBe(0)
    },
  )

  test('a failed renumber is logged, not thrown, and stops before later rows', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const renumberAfterFailure = ok()
    const queue = queueFromBuilders(
      existing(),
      stagedInsert(),
      ok(),
      ok(),
      fail(),
      renumberAfterFailure,
    )
    const { replaceRoutineTemplate } = await loadModule()
    await expect(replaceRoutineTemplate('routine-1', TEMPLATE)).resolves.toEqual({
      exercises: [
        { id: 'new-0', order_index: 3 },
        { id: 'new-1', order_index: 4 },
      ],
    })
    expect(queue.remaining()).toBe(1)
    expect(consoleError).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  test('a renumber failure part-way keeps the relative order', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    queueFromBuilders(existing(), stagedInsert(), ok(), ok(), ok(), fail())
    const { replaceRoutineTemplate } = await loadModule()
    const result = await replaceRoutineTemplate('routine-1', TEMPLATE)
    // new-0 moved to its final slot; new-1 stayed at its staged slot above it
    expect(result.exercises).toEqual([
      { id: 'new-0', order_index: 0 },
      { id: 'new-1', order_index: 4 },
    ])
    consoleError.mockRestore()
  })

  test('replacing with an empty template just deletes the old rows', async () => {
    const oldDelete = ok()
    const queue = queueFromBuilders(existing(), oldDelete)
    const { replaceRoutineTemplate } = await loadModule()
    await expect(replaceRoutineTemplate('routine-1', [])).resolves.toEqual({
      exercises: [],
    })
    expect(callArgs(oldDelete, 'in')).toEqual([
      'id',
      ['old-0', 'old-1', 'old-2'],
    ])
    expect(queue.remaining()).toBe(0)
  })
})

describe('database callers', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('createFromWorkout keeps the workout set numbers and order indexes', async () => {
    const { database } = await import('@/lib/database')
    jest.spyOn(database.workoutSessions, 'getById').mockResolvedValue({
      id: 'workout-1',
      notes: 'Leg day',
      type: null,
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-squat',
          order_index: 5,
          notes: 'deep',
          sets: [{ set_number: 2 }, { set_number: 3 }],
        },
      ],
    } as never)

    const routineInsert = createQueryBuilder({
      data: { id: 'routine-1', name: 'Leg day' },
      error: null,
    })
    const exerciseInsert = createQueryBuilder({
      data: [{ id: 're-squat', order_index: 5 }],
      error: null,
    })
    const setInsert = createQueryBuilder({ data: null, error: null })
    queueFromBuilders(routineInsert, exerciseInsert, setInsert)

    await expect(
      database.workoutRoutines.createFromWorkout('workout-1', 'user-1'),
    ).resolves.toEqual({ id: 'routine-1', name: 'Leg day' })

    expect(callArgs(routineInsert, 'insert')).toEqual([
      { user_id: 'user-1', name: 'Leg day', notes: 'Leg day' },
    ])
    expect(callArgs(exerciseInsert, 'insert')).toEqual([
      [
        {
          routine_id: 'routine-1',
          exercise_id: 'ex-squat',
          order_index: 5,
          notes: 'deep',
        },
      ],
    ])
    expect(callArgs(setInsert, 'insert')).toEqual([
      [
        {
          routine_exercise_id: 're-squat',
          set_number: 2,
          reps_min: null,
          reps_max: null,
          rest_seconds: null,
        },
        {
          routine_exercise_id: 're-squat',
          set_number: 3,
          reps_min: null,
          reps_max: null,
          rest_seconds: null,
        },
      ],
    ])
  })

  test('saveRoutineToUser numbers sets 1..n and omits rest_seconds', async () => {
    const { database } = await import('@/lib/database')
    jest.spyOn(database.explore, 'getRoutineById').mockResolvedValue({
      id: 'explore-1',
      name: 'Pull',
      description: 'Back focus',
      image_url: null,
      exercises: [
        {
          exercise_id: 'ex-row',
          order_index: 0,
          notes: null,
          sets: 2,
          reps_min: 8,
          reps_max: 10,
        },
      ],
    } as never)

    const routineInsert = createQueryBuilder({
      data: { id: 'routine-1', name: 'Pull' },
      error: null,
    })
    const exerciseInsert = createQueryBuilder({
      data: [{ id: 're-row', order_index: 0 }],
      error: null,
    })
    const setInsert = createQueryBuilder({ data: null, error: null })
    queueFromBuilders(routineInsert, exerciseInsert, setInsert)

    await database.explore.saveRoutineToUser('explore-1', 'user-1', 'prog-1')

    expect(callArgs(routineInsert, 'insert')).toEqual([
      {
        user_id: 'user-1',
        name: 'Pull',
        notes: 'Back focus',
        image_path: null,
        program_id: 'prog-1',
      },
    ])
    expect(callArgs(setInsert, 'insert')).toEqual([
      [
        {
          routine_exercise_id: 're-row',
          set_number: 1,
          reps_min: 8,
          reps_max: 10,
        },
        {
          routine_exercise_id: 're-row',
          set_number: 2,
          reps_min: 8,
          reps_max: 10,
        },
      ],
    ])
  })
})

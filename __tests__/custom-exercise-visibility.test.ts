type QueryResult = {
  data?: unknown
  error?: { code?: string; message?: string } | null
  count?: number | null
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
  rpc: jest.fn(),
  auth: {
    getSession: jest.fn(),
  },
}

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

jest.mock('@/lib/exercise-metadata', () => ({
  generateExerciseMetadata: jest.fn(async () => ({
    muscle_group: 'Full Body',
    type: 'compound',
    equipment: 'other',
  })),
}))

jest.mock('@/lib/exercise-standards-config', () => ({
  getExerciseNameMap: jest.fn(() => new Map()),
  getLeaderboardExercises: jest.fn(() => []),
  isRepBasedExercise: jest.fn(() => false),
}))

jest.mock('@/lib/strength-progress', () => ({
  estimateOneRepMaxKg: jest.fn((weight: number, reps: number) =>
    Math.round(weight * (1 + reps / 30)),
  ),
}))

jest.mock('@/lib/utils/formatters', () => ({
  normalizeExerciseName: jest.fn((name: string) => name.trim()),
}))

jest.mock('@/lib/supabase-functions-client', () => ({
  callSupabaseFunction: jest.fn(),
}))

const createQueryBuilder = (result: QueryResult): MockQueryBuilder => {
  const calls: QueryCall[] = []
  const builder: MockQueryBuilder = {
    __calls: calls,
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }

  const chainMethods = [
    'select',
    'eq',
    'in',
    'order',
    'range',
    'limit',
    'gte',
    'gt',
    'lt',
    'not',
    'ilike',
    'contains',
    'is',
    'insert',
    'update',
    'delete',
  ]

  chainMethods.forEach((method) => {
    ;(builder as Record<string, unknown>)[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  })

  ;(builder as Record<string, unknown>).single = (...args: unknown[]) => {
    calls.push({ method: 'single', args })
    return Promise.resolve(result)
  }

  ;(builder as Record<string, unknown>).maybeSingle = (...args: unknown[]) => {
    calls.push({ method: 'maybeSingle', args })
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
  return queue
}

const loadDatabaseModule = async () => {
  const mod = await import('@/lib/database')
  return mod
}

describe('custom exercise visibility architecture', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    mockSupabase.rpc.mockReset()
  })

  describe('exercise detail view fallback', () => {
    test('database.exercises.getById returns direct row when visible', async () => {
      const directExercise = { id: 'ex-1', name: 'Bench Press', created_by: null }
      queueFromBuilders(
        createQueryBuilder({ data: directExercise, error: null }),
      )

      const { database } = await loadDatabaseModule()
      const result = await database.exercises.getById('ex-1')

      expect(result).toEqual(directExercise)
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    test('database.exercises.getById falls back to view-only RPC on privacy error', async () => {
      const privacyError = { code: '42501', message: 'permission denied by rls' }
      const fallbackExercise = {
        id: 'ex-friend',
        name: 'Friend Custom Curl',
        created_by: 'friend-user',
      }
      queueFromBuilders(
        createQueryBuilder({ data: null, error: privacyError }),
      )
      mockSupabase.rpc.mockResolvedValue({
        data: [fallbackExercise],
        error: null,
      })

      const { database } = await loadDatabaseModule()
      const result = await database.exercises.getById('ex-friend')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_viewable_exercise_by_id', {
        p_exercise_id: 'ex-friend',
      })
      expect(result).toEqual(fallbackExercise)
    })

    test('database.exercises.getById rethrows non-privacy errors without fallback', async () => {
      const dbError = { code: '23505', message: 'duplicate key' }
      queueFromBuilders(createQueryBuilder({ data: null, error: dbError }))

      const { database } = await loadDatabaseModule()

      await expect(database.exercises.getById('ex-1')).rejects.toEqual(dbError)
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    test('database.exercises.getById rethrows original not-found when fallback returns empty', async () => {
      const notFound = { code: 'PGRST116', message: 'The result contains 0 rows' }
      queueFromBuilders(createQueryBuilder({ data: null, error: notFound }))
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      const { database } = await loadDatabaseModule()

      await expect(database.exercises.getById('missing')).rejects.toEqual(notFound)
    })
  })

  describe('workout social/detail hydration', () => {
    test('workoutSessions.getById hydrates missing custom exercise relation via scoped RPC', async () => {
      const existingExercise = {
        id: 'ex-visible',
        name: 'Squat',
        created_by: null,
        gif_url: null,
      }
      const workout = {
        id: 'workout-1',
        user_id: 'friend-1',
        workout_exercises: [
          {
            id: 'we-hidden',
            exercise_id: 'ex-hidden',
            order_index: 0,
            exercise: null,
            sets: [],
          },
          {
            id: 'we-visible',
            exercise_id: 'ex-visible',
            order_index: 1,
            exercise: existingExercise,
            sets: [],
          },
        ],
      }

      queueFromBuilders(createQueryBuilder({ data: workout, error: null }))
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            workout_exercise_id: 'we-hidden',
            id: 'ex-hidden',
            name: 'Friend Custom Fly',
            muscle_group: 'Chest',
            type: 'isolation',
            equipment: 'dumbbell',
            created_by: 'friend-1',
            created_at: '2026-02-01T00:00:00.000Z',
            aliases: null,
            exercise_id: null,
            gif_url: null,
            target_muscles: null,
            body_parts: null,
            equipments: null,
            secondary_muscles: null,
            instructions: null,
          },
        ],
        error: null,
      })

      const { database } = await loadDatabaseModule()
      const result = await database.workoutSessions.getById('workout-1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_visible_workout_exercise_exercise_details',
        { p_workout_exercise_ids: ['we-hidden'] },
      )
      expect(result.workout_exercises[0].exercise).toMatchObject({
        id: 'ex-hidden',
        name: 'Friend Custom Fly',
        created_by: 'friend-1',
      })
      expect(result.workout_exercises[1].exercise).toBe(existingExercise)
    })

    test('workoutSessions.getSocialFeed hydrates missing relations and attaches profiles', async () => {
      const followsBuilder = createQueryBuilder({
        data: [{ followee_id: 'friend-1' }],
        error: null,
      })
      const workoutsBuilder = createQueryBuilder({
        data: [
          {
            id: 'w-1',
            user_id: 'friend-1',
            workout_exercises: [
              { id: 'we-1', exercise_id: 'ex-1', exercise: null, sets: [] },
            ],
          },
        ],
        error: null,
      })
      const profilesBuilder = createQueryBuilder({
        data: [
          {
            id: 'friend-1',
            display_name: 'Friend',
            user_tag: 'friend',
            avatar_url: null,
          },
        ],
        error: null,
      })
      queueFromBuilders(followsBuilder, workoutsBuilder, profilesBuilder)
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            workout_exercise_id: 'we-1',
            id: 'ex-1',
            name: 'Friend Custom Lift',
            muscle_group: 'Back',
            type: 'compound',
            equipment: 'barbell',
            created_by: 'friend-1',
            created_at: '2026-02-01T00:00:00.000Z',
            aliases: null,
            exercise_id: null,
            gif_url: null,
            target_muscles: null,
            body_parts: null,
            equipments: null,
            secondary_muscles: null,
            instructions: null,
          },
        ],
        error: null,
      })

      const { database } = await loadDatabaseModule()
      const result = await database.workoutSessions.getSocialFeed('me', 10, 0)

      expect(result).toHaveLength(1)
      expect(result[0].profile).toMatchObject({ id: 'friend-1', display_name: 'Friend' })
      expect(result[0].workout_exercises[0].exercise).toMatchObject({
        id: 'ex-1',
        name: 'Friend Custom Lift',
      })
      expect((followsBuilder.__calls.find((c) => c.method === 'eq')?.args) || []).toEqual([
        'follower_id',
        'me',
      ])
    })

    test('workout hydration gracefully degrades when scoped RPC fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      queueFromBuilders(
        createQueryBuilder({
          data: {
            id: 'workout-1',
            user_id: 'friend-1',
            workout_exercises: [
              { id: 'we-hidden', exercise_id: 'ex-hidden', exercise: null, sets: [] },
            ],
          },
          error: null,
        }),
      )
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'rpc denied' },
      })

      const { database } = await loadDatabaseModule()
      const result = await database.workoutSessions.getById('workout-1')

      expect(result.workout_exercises[0].exercise).toBeNull()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('routine hydration for follower-visible routines', () => {
    test('workoutRoutines.getById hydrates missing exercise relations via routine-scoped RPC', async () => {
      queueFromBuilders(
        createQueryBuilder({
          data: {
            id: 'routine-1',
            user_id: 'friend-1',
            workout_routine_exercises: [
              {
                id: 'wre-1',
                exercise_id: 'ex-hidden',
                order_index: 0,
                exercise: null,
                sets: [],
              },
            ],
          },
          error: null,
        }),
      )
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            workout_routine_exercise_id: 'wre-1',
            id: 'ex-hidden',
            name: 'Friend Custom Step-up',
            muscle_group: 'Quads',
            type: 'compound',
            equipment: 'dumbbell',
            created_by: 'friend-1',
            created_at: '2026-02-01T00:00:00.000Z',
            aliases: null,
            exercise_id: null,
            gif_url: null,
            target_muscles: null,
            body_parts: null,
            equipments: null,
            secondary_muscles: null,
            instructions: null,
          },
        ],
        error: null,
      })

      const { database } = await loadDatabaseModule()
      const result = await database.workoutRoutines.getById('routine-1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_visible_workout_routine_exercise_exercise_details',
        { p_workout_routine_exercise_ids: ['wre-1'] },
      )
      expect(result.workout_routine_exercises[0].exercise).toMatchObject({
        id: 'ex-hidden',
        name: 'Friend Custom Step-up',
      })
    })

    test('workoutRoutines.getAll hydrates every routine item with missing relation', async () => {
      queueFromBuilders(
        createQueryBuilder({
          data: [
            {
              id: 'routine-a',
              user_id: 'me',
              workout_routine_exercises: [
                { id: 'wre-a1', exercise_id: 'ex-a', exercise: null, sets: [] },
              ],
            },
            {
              id: 'routine-b',
              user_id: 'me',
              workout_routine_exercises: [
                { id: 'wre-b1', exercise_id: 'ex-b', exercise: null, sets: [] },
              ],
            },
          ],
          error: null,
        }),
      )
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            workout_routine_exercise_id: 'wre-a1',
            id: 'ex-a',
            name: 'Mine A',
            muscle_group: 'Back',
            type: 'compound',
            equipment: 'barbell',
            created_by: 'me',
            created_at: '2026-02-01T00:00:00.000Z',
            aliases: null,
            exercise_id: null,
            gif_url: null,
            target_muscles: null,
            body_parts: null,
            equipments: null,
            secondary_muscles: null,
            instructions: null,
          },
          {
            workout_routine_exercise_id: 'wre-b1',
            id: 'ex-b',
            name: 'Mine B',
            muscle_group: 'Chest',
            type: 'isolation',
            equipment: 'cable',
            created_by: 'me',
            created_at: '2026-02-01T00:00:00.000Z',
            aliases: null,
            exercise_id: null,
            gif_url: null,
            target_muscles: null,
            body_parts: null,
            equipments: null,
            secondary_muscles: null,
            instructions: null,
          },
        ],
        error: null,
      })

      const { database } = await loadDatabaseModule()
      const result = await database.workoutRoutines.getAll('me')

      expect(result[0].workout_routine_exercises[0].exercise?.name).toBe('Mine A')
      expect(result[1].workout_routine_exercises[0].exercise?.name).toBe('Mine B')
    })
  })

  describe('exercise history query path for exercise detail page', () => {
    test('stats.getExerciseHistoryById filters by exercise id (not exercise name)', async () => {
      const builder = createQueryBuilder({ data: [], error: null })
      queueFromBuilders(builder)

      const { database } = await loadDatabaseModule()
      await database.stats.getExerciseHistoryById('friend-1', 'ex-friend')

      const eqCalls = builder.__calls
        .filter((c) => c.method === 'eq')
        .map((c) => c.args)

      expect(eqCalls).toContainEqual(['user_id', 'friend-1'])
      expect(eqCalls).toContainEqual(['workout_exercises.exercise_id', 'ex-friend'])
      expect(eqCalls).not.toContainEqual([
        'workout_exercises.exercise.name',
        expect.anything(),
      ])
    })
  })
})

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
  getExerciseNameMap: jest.fn(() => ({})),
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
  return builders
}

const loadDatabaseModule = async () => {
  const mod = await import('@/lib/database')
  return mod
}

describe('workout ownership guards', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    mockSupabase.rpc.mockReset()
  })

  test('getOwnedById returns the workout when the current user owns it', async () => {
    queueFromBuilders(
      createQueryBuilder({
        data: { id: 'workout-1', user_id: 'user-1' },
        error: null,
      }),
      createQueryBuilder({
        data: { id: 'workout-1', user_id: 'user-1', workout_exercises: [] },
        error: null,
      }),
    )

    const { database } = await loadDatabaseModule()
    const result = await database.workoutSessions.getOwnedById(
      'workout-1',
      'user-1',
    )

    expect(result).toMatchObject({
      id: 'workout-1',
      user_id: 'user-1',
    })
  })

  test('getOwnedById rejects when another user owns the workout', async () => {
    queueFromBuilders(
      createQueryBuilder({
        data: { id: 'workout-1', user_id: 'friend-1' },
        error: null,
      }),
    )

    const { database, OwnershipError } = await loadDatabaseModule()

    await expect(
      database.workoutSessions.getOwnedById('workout-1', 'user-1'),
    ).rejects.toBeInstanceOf(OwnershipError)
  })

  test('update scopes the mutation to the authenticated owner', async () => {
    const ownershipBuilder = createQueryBuilder({
      data: { id: 'workout-1', user_id: 'user-1' },
      error: null,
    })
    const updateBuilder = createQueryBuilder({
      data: { id: 'workout-1', user_id: 'user-1', type: 'Leg Day' },
      error: null,
    })
    queueFromBuilders(ownershipBuilder, updateBuilder)

    const { database } = await loadDatabaseModule()
    await database.workoutSessions.update('workout-1', 'user-1', {
      type: 'Leg Day',
    })

    expect(updateBuilder.__table).toBe('workout_sessions')
    expect(updateBuilder.__calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'workout-1'] },
        { method: 'eq', args: ['user_id', 'user-1'] },
      ]),
    )
  })

  test('delete scopes the mutation to the authenticated owner', async () => {
    const ownershipBuilder = createQueryBuilder({
      data: { id: 'workout-1', user_id: 'user-1' },
      error: null,
    })
    const deleteBuilder = createQueryBuilder({
      data: null,
      error: null,
    })
    queueFromBuilders(ownershipBuilder, deleteBuilder)

    const { database } = await loadDatabaseModule()
    await database.workoutSessions.delete('workout-1', 'user-1')

    expect(deleteBuilder.__table).toBe('workout_sessions')
    expect(deleteBuilder.__calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'workout-1'] },
        { method: 'eq', args: ['user_id', 'user-1'] },
      ]),
    )
  })
})

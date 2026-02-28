const queuedQueryResults: Array<{ data: unknown; error: unknown }> = []
const selectClauses: string[] = []

interface MockQueryBuilder {
  select: (clause: string) => MockQueryBuilder
  eq: (...args: unknown[]) => MockQueryBuilder
  or: () => Promise<{ data: unknown; error: unknown }>
}

const fromMock = jest.fn(() => {
  let builder: MockQueryBuilder
  builder = {
    select: (clause: string) => {
      selectClauses.push(clause)
      return builder
    },
    eq: (..._args: unknown[]) => builder,
    or: () => {
      const next = queuedQueryResults.shift()
      if (!next) {
        throw new Error('No queued Supabase response for PR test')
      }
      return Promise.resolve(next)
    },
  }

  return builder
})

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

import { PrContextSet, PrService } from '@/lib/pr'

function queueSupabaseData(...data: unknown[]) {
  data.forEach((entry) => {
    queuedQueryResults.push({ data: entry, error: null })
  })
}

function makeSessionRows(
  exerciseId: string,
  sets: Array<{ reps: number; weight: number; is_warmup?: boolean }>,
) {
  return [
    {
      workout_exercises: [
        {
          exercise_id: exerciseId,
          sets,
        },
      ],
    },
  ]
}

describe('PrService', () => {
  beforeEach(() => {
    queuedQueryResults.length = 0
    selectClauses.length = 0
    fromMock.mockClear()
  })

  test('ignores warmup current sets and preserves original set indices for badges', async () => {
    queueSupabaseData([], [])

    const currentSets: PrContextSet[] = [
      { reps: 1, weight: 200, isWarmup: true, originalIndex: 0 },
      { reps: 1, weight: 100, isWarmup: false, originalIndex: 1 },
    ]

    const result = await PrService.computePrsForExercise(
      'user-1',
      'ex-1',
      'Bench Press',
      '2026-02-01T12:00:00.000Z',
      '2026-02-01',
      currentSets,
    )

    expect(result.prs).toHaveLength(3)
    expect(result.prs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'heaviest-weight',
          label: 'Heaviest Weight',
          weight: 100,
          setIndices: [1],
        }),
        expect.objectContaining({
          kind: 'best-1rm',
          label: 'Best 1RM',
          weight: 100,
          setIndices: [1],
        }),
        expect.objectContaining({
          kind: 'best-set-volume',
          label: 'Best Set Volume',
          weight: 100,
          setIndices: [1],
        }),
      ]),
    )
  })

  test('treats equal future performance as still current', async () => {
    queueSupabaseData(
      [],
      makeSessionRows('ex-1', [
        { reps: 1, weight: 120, is_warmup: false },
        { reps: 8, weight: 80, is_warmup: false },
      ]),
    )

    const currentSets: PrContextSet[] = [
      { reps: 1, weight: 120, isWarmup: false, originalIndex: 0 },
      { reps: 8, weight: 80, isWarmup: false, originalIndex: 1 },
    ]

    const result = await PrService.computePrsForExercise(
      'user-1',
      'ex-1',
      'Bench Press',
      '2026-02-01T12:00:00.000Z',
      '2026-02-01',
      currentSets,
    )

    expect(result.prs).toHaveLength(3)
    expect(result.prs.every((pr) => pr.isCurrent)).toBe(true)
  })

  test('ignores warmup history for PR comparisons and baseline 1RM', async () => {
    queueSupabaseData(
      makeSessionRows('ex-1', [
        { reps: 12, weight: 60, is_warmup: true },
        { reps: 8, weight: 50, is_warmup: false },
      ]),
      [],
    )

    const currentSets: PrContextSet[] = [
      { reps: 10, weight: 60, isWarmup: false, originalIndex: 0 },
    ]

    const result = await PrService.computePrsForExercise(
      'user-1',
      'ex-1',
      'Bench Press',
      '2026-02-01T12:00:00.000Z',
      '2026-02-01',
      currentSets,
    )

    expect(result.prs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'heaviest-weight', weight: 60 }),
        expect.objectContaining({ kind: 'best-1rm', weight: 60 }),
        expect.objectContaining({ kind: 'best-set-volume', weight: 60 }),
      ]),
    )
    expect(result.baseline1RM).toBeCloseTo(63.3333, 3) // 50kg x 8 reps
    expect(selectClauses.every((clause) => clause.includes('is_warmup'))).toBe(
      true,
    )
  })
})

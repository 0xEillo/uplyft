import {
  buildBatchResolverCandidateMap,
  rankCandidatesForResolver,
  type BatchSearchRpcRow,
} from '../supabase/functions/parse-workout/resolver/search-utils'

describe('resolver search utils', () => {
  test('prioritizes exact name matches over higher similarity fuzzy matches', () => {
    const candidates = rankCandidatesForResolver('bench press', [
      {
        id: 'fuzzy',
        name: 'Bench Press (Smith Machine)',
        best_similarity: 0.92,
      },
      {
        id: 'exact',
        name: 'Bench Press',
        best_similarity: 0.81,
      },
    ])

    expect(candidates.map((c) => c.id)).toEqual(['exact', 'fuzzy'])
  })

  test('prioritizes exact alias matches over non-exact name matches', () => {
    const candidates = rankCandidatesForResolver('bench', [
      {
        id: 'name-match',
        name: 'Bench Dips',
        aliases: [],
        best_similarity: 0.9,
      },
      {
        id: 'alias-match',
        name: 'Bench Press (Barbell)',
        aliases: ['Bench Press', 'Bench'],
        best_similarity: 0.6,
      },
    ])

    expect(candidates[0]?.id).toBe('alias-match')
  })

  test('uses similarity then shorter-name tie-breaker when no exact matches', () => {
    const candidates = rankCandidatesForResolver('presso', [
      { id: 'long', name: 'Standing Overhead Press', best_similarity: 0.7 },
      { id: 'short', name: 'Press', best_similarity: 0.7 },
      { id: 'higher', name: 'Military Press', best_similarity: 0.75 },
    ])

    expect(candidates.map((c) => c.id)).toEqual(['higher', 'short', 'long'])
  })

  test('enforces result limit', () => {
    const rows: BatchSearchRpcRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: `id-${i}`,
      name: `Exercise ${i}`,
      best_similarity: 1 - i * 0.1,
    }))

    const candidates = rankCandidatesForResolver('exercise', rows, 3)
    expect(candidates).toHaveLength(3)
  })

  test('builds grouped candidate map by search query and preserves query order mapping', () => {
    const rows: BatchSearchRpcRow[] = [
      {
        search_query: 'bench',
        id: 'bench-1',
        name: 'Bench Press',
        aliases: ['Bench'],
        best_similarity: 0.9,
      },
      {
        search_query: 'squat',
        id: 'squat-1',
        name: 'Back Squat',
        aliases: ['Squat'],
        best_similarity: 0.91,
      },
      {
        search_query: 'bench',
        id: 'bench-2',
        name: 'Bench Dips',
        aliases: [],
        best_similarity: 0.88,
      },
      {
        search_query: null,
        id: 'ignored',
        name: 'Ignored',
        best_similarity: 1,
      },
    ]

    const map = buildBatchResolverCandidateMap(['bench', 'squat', 'ohp'], rows, 10)

    expect(map.get('bench')?.map((c) => c.id)).toEqual(['bench-1', 'bench-2'])
    expect(map.get('squat')?.map((c) => c.id)).toEqual(['squat-1'])
    expect(map.get('ohp')).toEqual([])
  })
})

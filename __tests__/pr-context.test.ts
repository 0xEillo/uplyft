import { mapSetsToPrContext, resolvePrContextUserId } from '@/lib/utils/pr-context'

describe('pr-context utils', () => {
  test('resolvePrContextUserId prefers workout owner id', () => {
    expect(resolvePrContextUserId('owner-1', 'viewer-1')).toBe('owner-1')
  })

  test('resolvePrContextUserId falls back to viewer id', () => {
    expect(resolvePrContextUserId(null, 'viewer-1')).toBe('viewer-1')
    expect(resolvePrContextUserId(undefined, 'viewer-2')).toBe('viewer-2')
  })

  test('mapSetsToPrContext preserves original indices and warmup flags', () => {
    const mapped = mapSetsToPrContext([
      { reps: 12, weight: 20, is_warmup: true },
      { reps: 8, weight: 50, is_warmup: false },
      { reps: 5, weight: 70 },
    ])

    expect(mapped).toEqual([
      { reps: 12, weight: 20, isWarmup: true, originalIndex: 0 },
      { reps: 8, weight: 50, isWarmup: false, originalIndex: 1 },
      { reps: 5, weight: 70, isWarmup: false, originalIndex: 2 },
    ])
  })
})

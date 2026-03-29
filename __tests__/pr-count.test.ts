import { countWorkoutRecords } from '@/lib/utils/pr-count'

describe('countWorkoutRecords', () => {
  test('counts individual PR details instead of unique PR set indices', () => {
    const prInfo = [
      {
        prSetIndices: new Set([1]),
        prDetails: [
          { kind: 'heaviest-weight' },
          { kind: 'best-1rm' },
          { kind: 'best-set-volume' },
        ],
      },
      {
        prSetIndices: new Set([0]),
        prDetails: [{ kind: 'best-1rm' }],
      },
    ]

    expect(countWorkoutRecords(prInfo)).toBe(4)
  })

  test('returns zero when there are no PR details', () => {
    expect(
      countWorkoutRecords([
        { prSetIndices: new Set([0]), prDetails: [] },
        { prSetIndices: new Set([1]) },
      ]),
    ).toBe(0)
  })
})

jest.mock('@/contexts/unit-context', () => ({
  kgToPreferred: jest.fn((value: number) => value),
}))

import { formatWorkoutForDisplay } from '@/lib/utils/formatters'

describe('formatWorkoutForDisplay custom exercise visibility fallback', () => {
  test('keeps workout exercises with missing exercise relation and uses fallback name', () => {
    const workout = {
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-hidden',
          order_index: 1,
          exercise: null,
          exercise_name: 'Friend Custom Pushdown',
          sets: [{ id: 's1', reps: 12, weight: 20 }],
        },
        {
          id: 'we-2',
          exercise_id: 'ex-visible',
          order_index: 0,
          exercise: {
            id: 'ex-visible',
            name: 'Bench Press',
            created_by: null,
            gif_url: 'https://example.com/bench.gif',
          },
          sets: [{ id: 's2', reps: 8, weight: 60 }],
        },
      ],
    } as unknown as Parameters<typeof formatWorkoutForDisplay>[0]

    const result = formatWorkoutForDisplay(workout, 'kg')

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: 'ex-visible',
      name: 'Bench Press',
      isCustom: false,
    })
    expect(result[1]).toMatchObject({
      id: 'ex-hidden',
      name: 'Friend Custom Pushdown',
      isCustom: true,
    })
  })

  test('uses generic placeholder when relation and fallback name are both missing', () => {
    const workout = {
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-hidden',
          order_index: 0,
          exercise: null,
          sets: [],
        },
      ],
    } as unknown as Parameters<typeof formatWorkoutForDisplay>[0]

    const result = formatWorkoutForDisplay(workout, 'kg')

    expect(result).toEqual([
      expect.objectContaining({
        id: 'ex-hidden',
        name: 'Custom Exercise',
        isCustom: true,
      }),
    ])
  })
})

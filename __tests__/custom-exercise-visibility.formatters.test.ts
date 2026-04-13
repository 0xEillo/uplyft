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

  test('supports feed preview options by limiting rows and omitting set details', () => {
    const workout = {
      workout_exercises: [
        {
          id: 'we-1',
          exercise_id: 'ex-1',
          order_index: 2,
          exercise: {
            id: 'ex-1',
            name: 'Romanian Deadlift',
            created_by: null,
            gif_url: 'https://example.com/rdl.gif',
          },
          sets: [{ id: 's1', reps: 8, weight: 100 }],
        },
        {
          id: 'we-2',
          exercise_id: 'ex-2',
          order_index: 0,
          exercise: {
            id: 'ex-2',
            name: 'Bench Press',
            created_by: null,
            gif_url: 'https://example.com/bench.gif',
          },
          sets: [{ id: 's2', reps: 8, weight: 60 }],
        },
        {
          id: 'we-3',
          exercise_id: 'ex-3',
          order_index: 1,
          exercise: {
            id: 'ex-3',
            name: 'Row',
            created_by: null,
            gif_url: 'https://example.com/row.gif',
          },
          sets: [{ id: 's3', reps: 10, weight: 50 }],
        },
      ],
    } as unknown as Parameters<typeof formatWorkoutForDisplay>[0]

    const result = formatWorkoutForDisplay(workout, 'kg', {
      limit: 2,
      includeSetDetails: false,
    })

    expect(result).toHaveLength(2)
    expect(result.map((exercise) => exercise.name)).toEqual([
      'Bench Press',
      'Row',
    ])
    expect(result.every((exercise) => exercise.setDetails === undefined)).toBe(
      true,
    )
  })
})

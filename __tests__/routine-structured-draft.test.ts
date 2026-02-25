import { buildStructuredDraftFromRoutineTemplate } from '../lib/utils/routine-structured-draft'

describe('buildStructuredDraftFromRoutineTemplate', () => {
  test('sorts exercises and sets while preserving target metadata', () => {
    const result = buildStructuredDraftFromRoutineTemplate([
      {
        id: 'ex-2',
        name: 'Incline Press',
        orderIndex: 2,
        sets: [
          {
            setNumber: 2,
            repsMin: 8,
            repsMax: 10,
            restSeconds: 90,
          },
          {
            setNumber: 1,
            repsMin: 10,
            repsMax: 12,
            restSeconds: 60,
          },
        ],
      },
      {
        id: 'ex-1',
        name: 'Bench Press',
        orderIndex: 1,
        sets: [
          {
            setNumber: 1,
            repsMin: 5,
            repsMax: 5,
            restSeconds: 180,
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        id: 'ex-1',
        name: 'Bench Press',
        sets: [
          {
            weight: '',
            reps: '',
            targetRepsMin: 5,
            targetRepsMax: 5,
            targetRestSeconds: 180,
          },
        ],
      },
      {
        id: 'ex-2',
        name: 'Incline Press',
        sets: [
          {
            weight: '',
            reps: '',
            targetRepsMin: 10,
            targetRepsMax: 12,
            targetRestSeconds: 60,
          },
          {
            weight: '',
            reps: '',
            targetRepsMin: 8,
            targetRepsMax: 10,
            targetRestSeconds: 90,
          },
        ],
      },
    ])
  })

  test('handles empty names and missing targets safely', () => {
    const result = buildStructuredDraftFromRoutineTemplate([
      {
        id: 'ex-1',
        name: '',
        orderIndex: 0,
        sets: [
          {
            setNumber: 1,
            repsMin: null,
            repsMax: null,
            restSeconds: null,
          },
        ],
      },
    ])

    expect(result[0]).toEqual({
      id: 'ex-1',
      name: 'Exercise',
      sets: [
        {
          weight: '',
          reps: '',
          targetRepsMin: null,
          targetRepsMax: null,
          targetRestSeconds: null,
        },
      ],
    })
  })
})

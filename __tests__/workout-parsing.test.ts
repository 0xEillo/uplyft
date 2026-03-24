jest.mock('../lib/services/exerciseLookup', () => ({
  exerciseLookup: {
    findByName: jest.fn(() => null),
  },
}))

import { parseProgramForDisplay } from '../lib/ai/workoutParsing'

const workingSet = (reps: string) => ({
  type: 'working' as const,
  weight: '',
  reps,
  rest: 60,
})

describe('parseProgramForDisplay', () => {
  test('parses a full generated program object', () => {
    const result = parseProgramForDisplay(`{
      "title": "4 Day Upper/Lower",
      "description": "A balanced hypertrophy split.",
      "goal": "Hypertrophy",
      "frequency": "4 days/week",
      "routines": [
        {
          "name": "Upper 1",
          "duration": "60 min",
          "exerciseCount": 5,
          "exercises": [
            { "name": "Barbell Bench Press", "sets": 3, "reps": "6-8" },
            { "name": "Chest Supported Row", "sets": 2, "reps": "8-10" }
          ]
        }
      ]
    }`)

    expect(result).toEqual({
      title: '4 Day Upper/Lower',
      description: 'A balanced hypertrophy split.',
      goal: 'Hypertrophy',
      frequency: '4 days/week',
      routines: [
        {
          title: 'Upper 1',
          description: '',
          duration: '60 min',
          exercises: [
            {
              name: 'Barbell Bench Press',
              gifUrl: null,
              sets: [
                workingSet('6-8'),
                workingSet('6-8'),
                workingSet('6-8'),
              ],
            },
            {
              name: 'Chest Supported Row',
              gifUrl: null,
              sets: [workingSet('8-10'), workingSet('8-10')],
            },
          ],
        },
      ],
    })
  })

  test('normalizes fallback values and alternate routine keys', () => {
    const result = parseProgramForDisplay(`{
      "title": "3 Day Split",
      "workouts": [
        {
          "title": "Push",
          "durationMinutes": 55,
          "exercises": [
            { "name": "Incline Dumbbell Press", "sets": "3", "reps": "8-10" }
          ]
        }
      ]
    }`)

    expect(result).toEqual({
      title: '3 Day Split',
      description: '',
      goal: undefined,
      frequency: undefined,
      routines: [
        {
          title: 'Push',
          description: '',
          duration: '55 min',
          exercises: [
            {
              name: 'Incline Dumbbell Press',
              gifUrl: null,
              sets: [
                workingSet('8-10'),
                workingSet('8-10'),
                workingSet('8-10'),
              ],
            },
          ],
        },
      ],
    })
  })
})

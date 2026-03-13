import {
  buildDisplayStrengthGroupData,
  buildSpecificMuscleGroupData,
  resolveDatabaseMuscleToDisplayGroup,
} from '../lib/strength-display-groups'

describe('strength display groups', () => {
  test('maps specific muscles into shared display groups', () => {
    expect(resolveDatabaseMuscleToDisplayGroup('Biceps')).toBe('Arms')
    expect(resolveDatabaseMuscleToDisplayGroup('Triceps')).toBe('Arms')
    expect(resolveDatabaseMuscleToDisplayGroup('Glutes')).toBe('Legs')
    expect(resolveDatabaseMuscleToDisplayGroup('Lower Back')).toBe('Back')
  })

  test('builds display groups from aggregate breakdown instead of per-exercise rank', () => {
    const groups = buildDisplayStrengthGroupData({
      exercises: [
        {
          exerciseId: 'shoulder-1',
          exerciseName: 'Shoulder Press (Machine)',
          muscleGroup: 'Shoulders',
        },
        {
          exerciseId: 'shoulder-2',
          exerciseName: 'Lateral Raise (Dumbbell)',
          muscleGroup: 'Shoulders',
        },
        {
          exerciseId: 'arms-1',
          exerciseName: 'Bicep Curl (Dumbbell)',
          muscleGroup: 'Biceps',
        },
      ],
      groupBreakdown: {
        Chest: { effectiveScore: 0 },
        Back: { effectiveScore: 0 },
        Shoulders: { effectiveScore: 830 },
        Arms: { effectiveScore: 610 },
        Legs: { effectiveScore: 0 },
        Core: { effectiveScore: 0 },
      },
    })

    const shoulders = groups.find((group) => group.name === 'Shoulders')
    const arms = groups.find((group) => group.name === 'Arms')

    expect(shoulders).toMatchObject({
      level: 'Elite',
      exercises: expect.arrayContaining([
        expect.objectContaining({ exerciseName: 'Shoulder Press (Machine)' }),
        expect.objectContaining({ exerciseName: 'Lateral Raise (Dumbbell)' }),
      ]),
    })
    expect(arms).toMatchObject({
      level: 'Advanced',
      exercises: [
        expect.objectContaining({ exerciseName: 'Bicep Curl (Dumbbell)' }),
      ],
    })
  })

  test('builds specific muscle groups for tappable body regions', () => {
    const groups = buildSpecificMuscleGroupData({
      gender: 'male',
      bodyweightKg: 100,
      exercises: [
        {
          exerciseId: 'squat-1',
          exerciseName: 'Squat (Barbell)',
          muscleGroup: 'Quads',
          max1RM: 180,
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          exerciseId: 'press-1',
          exerciseName: 'Shoulder Press (Machine)',
          muscleGroup: 'Shoulders',
          max1RM: 130,
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      now: new Date('2026-03-02T00:00:00.000Z'),
    })

    expect(groups.find((group) => group.name === 'Quads')).toBeTruthy()
    expect(groups.find((group) => group.name === 'Glutes')).toBeTruthy()
    expect(groups.find((group) => group.name === 'Shoulders')).toBeTruthy()
    expect(groups.find((group) => group.name === 'Legs')).toBeFalsy()
  })
})

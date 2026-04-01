import {
  exerciseMatchesBodyPart,
  getTrackableExercisesForBodyPart,
} from '@/lib/body-part-strength'

describe('body part strength helpers', () => {
  test('upper-back trackable list excludes lower back and traps exercises', () => {
    const exerciseNames = getTrackableExercisesForBodyPart('upper-back').map(
      (exercise) => exercise.name,
    )

    expect(exerciseNames).toContain('Bent Over Row (Barbell)')
    expect(exerciseNames).toContain('Lat Pulldown (Cable)')
    expect(exerciseNames).toContain('Weighted Pull-Up')
    expect(exerciseNames).not.toContain('Deadlift (Barbell)')
    expect(exerciseNames).not.toContain('Back Extension (Machine)')
    expect(exerciseNames).not.toContain('Hyperextension')
    expect(exerciseNames).not.toContain('Romanian Deadlift (Barbell)')
    expect(exerciseNames).not.toContain('Shrug (Dumbbell)')
    expect(exerciseNames).not.toContain('Rack Pull (Barbell)')
  })

  test('upper-back matching does not accept lower back exercises', () => {
    expect(
      exerciseMatchesBodyPart(
        { exerciseName: 'Lat Pulldown (Cable)', muscleGroup: 'Back' },
        'upper-back',
      ),
    ).toBe(true)

    expect(
      exerciseMatchesBodyPart(
        { exerciseName: 'Deadlift (Barbell)', muscleGroup: 'Lower Back' },
        'upper-back',
      ),
    ).toBe(false)

    expect(
      exerciseMatchesBodyPart(
        { exerciseName: 'Rack Pull (Barbell)', muscleGroup: 'Traps' },
        'upper-back',
      ),
    ).toBe(false)
  })

  test('romanian deadlift only appears for hamstrings trackables', () => {
    const hamstringExercises = getTrackableExercisesForBodyPart('hamstring').map(
      (exercise) => exercise.name,
    )
    const gluteExercises = getTrackableExercisesForBodyPart('gluteal').map(
      (exercise) => exercise.name,
    )

    expect(hamstringExercises).toContain('Romanian Deadlift (Barbell)')
    expect(gluteExercises).not.toContain('Romanian Deadlift (Barbell)')
  })
})

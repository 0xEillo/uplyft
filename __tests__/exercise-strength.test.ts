import { getExerciseStrengthMetric } from '@/lib/exercise-strength'
import { isRepBasedExercise } from '@/lib/exercise-standards-config'
import { getStandardsLadder, getStrengthStandard } from '@/lib/strength-standards'

describe('exercise strength helpers', () => {
  test('weighted decline sit up is treated as weight-based', () => {
    expect(isRepBasedExercise('Weighted Decline Sit Up')).toBe(false)

    const metric = getExerciseStrengthMetric('Weighted Decline Sit Up', {
      weight: 32,
      reps: 7,
    })

    expect(metric).toBeCloseTo(39.47, 1)

    const strengthInfo = getStrengthStandard(
      'Weighted Decline Sit Up',
      'male',
      80,
      metric ?? 0,
    )

    expect(strengthInfo?.level).toBe('Intermediate')
    expect(strengthInfo?.nextLevel?.level).toBe('Advanced')
  })

  test('bodyweight-only exercises can still be rep-based', () => {
    expect(isRepBasedExercise('Hanging Leg Raise')).toBe(true)

    const metric = getExerciseStrengthMetric('Hanging Leg Raise', {
      weight: null,
      reps: 7,
    })

    expect(metric).toBe(7)
  })

  test('weight-based exercises still use estimated 1RM math', () => {
    const metric = getExerciseStrengthMetric('Bench Press (Barbell)', {
      weight: 100,
      reps: 5,
    })

    expect(metric).toBeCloseTo(116.67, 1)
  })

  test('close grip bench press stays slightly easier than standard bench', () => {
    const benchMale = getStandardsLadder('Bench Press (Barbell)', 'male')
    const closeGripMale = getStandardsLadder(
      'Close Grip Bench Press (Barbell)',
      'male',
    )
    const benchFemale = getStandardsLadder('Bench Press (Barbell)', 'female')
    const closeGripFemale = getStandardsLadder(
      'Close Grip Bench Press (Barbell)',
      'female',
    )

    expect(closeGripMale).not.toBeNull()
    expect(closeGripFemale).not.toBeNull()
    expect(benchMale).not.toBeNull()
    expect(benchFemale).not.toBeNull()

    closeGripMale!.forEach((standard, index) => {
      expect(standard.multiplier).toBeLessThan(benchMale![index].multiplier)
    })

    closeGripFemale!.forEach((standard, index) => {
      expect(standard.multiplier).toBeLessThan(benchFemale![index].multiplier)
    })
  })

  test('smith machine press standards are tracked and ordered', () => {
    const exercises = [
      'Bench Press (Smith Machine)',
      'Incline Bench Press (Smith Machine)',
      'Shoulder Press (Smith Machine)',
    ]

    exercises.forEach((exerciseName) => {
      const male = getStandardsLadder(exerciseName, 'male')
      const female = getStandardsLadder(exerciseName, 'female')

      expect(male).not.toBeNull()
      expect(female).not.toBeNull()

      ;[male!, female!].forEach((standards) => {
        standards.slice(1).forEach((standard, index) => {
          expect(standard.multiplier).toBeGreaterThan(
            standards[index].multiplier,
          )
        })
      })
    })
  })
})

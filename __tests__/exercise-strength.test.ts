import { getExerciseStrengthMetric } from '@/lib/exercise-strength'
import { isRepBasedExercise } from '@/lib/exercise-standards-config'
import { getStrengthStandard } from '@/lib/strength-standards'

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
})

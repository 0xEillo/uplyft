import {
  EXERCISE_MUSCLE_FILTER_GROUPS,
  EXERCISE_MUSCLE_GROUPS,
  getMuscleFilterTargets,
  isMuscleFilterAvailable,
  matchesMuscleGroupFilter,
  normalizeMuscleFilterGroup,
} from '@/lib/utils/muscle-filters'

describe('muscle filters', () => {
  test('uses canonical user-facing filter groups', () => {
    expect(EXERCISE_MUSCLE_FILTER_GROUPS).not.toContain('Lats')
    expect(EXERCISE_MUSCLE_FILTER_GROUPS).not.toContain('Abs')
    expect(EXERCISE_MUSCLE_FILTER_GROUPS).toContain('Back')
    expect(EXERCISE_MUSCLE_FILTER_GROUPS).toContain('Core')
    expect(EXERCISE_MUSCLE_GROUPS).toContain('Cardio')
    expect(EXERCISE_MUSCLE_GROUPS).toContain('Full Body')
  })

  test('normalizes alias muscle groups to canonical filter groups', () => {
    expect(normalizeMuscleFilterGroup('Lats')).toBe('Back')
    expect(normalizeMuscleFilterGroup('Abs')).toBe('Core')
  })

  test('maps lats to back catalog entries', () => {
    expect(getMuscleFilterTargets('Lats')).toEqual(['Back', 'Lats'])
    expect(matchesMuscleGroupFilter('Back', ['Lats'])).toBe(true)
  })

  test('maps abs to core catalog entries', () => {
    expect(getMuscleFilterTargets('Abs')).toEqual(['Core', 'Abs'])
    expect(matchesMuscleGroupFilter('Core', ['Abs'])).toBe(true)
  })

  test('checks filter availability through aliases', () => {
    const availableMuscleGroups = new Set(['Back', 'Core', 'Chest'])

    expect(isMuscleFilterAvailable('Lats', availableMuscleGroups)).toBe(true)
    expect(isMuscleFilterAvailable('Abs', availableMuscleGroups)).toBe(true)
    expect(isMuscleFilterAvailable('Traps', availableMuscleGroups)).toBe(false)
  })
})

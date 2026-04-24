import {
  buildDisplayStrengthGroupData,
  buildSpecificMuscleGroupData,
  resolveDatabaseMuscleToDisplayGroup,
} from '../lib/strength-display-groups'
import { getStandardsLadder } from '../lib/strength-standards'

const TEST_BODYWEIGHT_KG = 100

function getMax1RMForLevel(
  exerciseName: string,
  level: 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced',
): number {
  const ladder = getStandardsLadder(exerciseName, 'male')
  const standard = ladder?.find((entry) => entry.level === level)
  if (!standard) {
    throw new Error(`Missing ${level} standard for ${exerciseName}`)
  }

  return Math.round(standard.multiplier * TEST_BODYWEIGHT_KG)
}

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

  test('builds specific muscle groups from each exercise primary muscle only', () => {
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
    expect(groups.find((group) => group.name === 'Glutes')).toBeFalsy()
    expect(groups.find((group) => group.name === 'Shoulders')).toBeTruthy()
    expect(groups.find((group) => group.name === 'Legs')).toBeFalsy()
  })

  test('romanian deadlift contributes to hamstrings but not glutes', () => {
    const groups = buildSpecificMuscleGroupData({
      gender: 'male',
      bodyweightKg: TEST_BODYWEIGHT_KG,
      exercises: [
        {
          exerciseId: 'rdl-1',
          exerciseName: 'Romanian Deadlift (Barbell)',
          muscleGroup: 'Hamstrings',
          max1RM: 180,
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      now: new Date('2026-03-02T00:00:00.000Z'),
    })

    expect(groups.find((group) => group.name === 'Hamstrings')).toBeTruthy()
    expect(groups.find((group) => group.name === 'Glutes')).toBeFalsy()
  })

  test('keeps a muscle at the tier-1 anchor level when lower-tier work is weaker', () => {
    const groups = buildSpecificMuscleGroupData({
      gender: 'male',
      bodyweightKg: TEST_BODYWEIGHT_KG,
      exercises: [
        {
          exerciseId: 'bench-1',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: getMax1RMForLevel(
            'Bench Press (Barbell)',
            'Intermediate',
          ),
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          exerciseId: 'incline-1',
          exerciseName: 'Incline Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: getMax1RMForLevel(
            'Incline Bench Press (Barbell)',
            'Intermediate',
          ),
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          exerciseId: 'fly-1',
          exerciseName: 'Fly (Dumbbell)',
          muscleGroup: 'Chest',
          max1RM: getMax1RMForLevel('Fly (Dumbbell)', 'Novice'),
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      now: new Date('2026-03-02T00:00:00.000Z'),
    })

    expect(groups.find((group) => group.name === 'Chest')).toMatchObject({
      level: 'Intermediate',
    })
  })

  test('lets strong lower-tier support lifts raise a weak tier-1 anchor by about one level', () => {
    const groups = buildSpecificMuscleGroupData({
      gender: 'male',
      bodyweightKg: TEST_BODYWEIGHT_KG,
      exercises: [
        {
          exerciseId: 'bench-1',
          exerciseName: 'Bench Press (Barbell)',
          muscleGroup: 'Chest',
          max1RM: getMax1RMForLevel('Bench Press (Barbell)', 'Novice'),
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          exerciseId: 'fly-1',
          exerciseName: 'Fly (Dumbbell)',
          muscleGroup: 'Chest',
          max1RM: getMax1RMForLevel('Fly (Dumbbell)', 'Advanced'),
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          exerciseId: 'machine-1',
          exerciseName: 'Chest Press (Machine)',
          muscleGroup: 'Chest',
          max1RM: getMax1RMForLevel('Chest Press (Machine)', 'Advanced'),
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          exerciseId: 'machine-2',
          exerciseName: 'Seated Fly (Machine)',
          muscleGroup: 'Chest',
          max1RM: getMax1RMForLevel('Seated Fly (Machine)', 'Advanced'),
          lastTrainedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      now: new Date('2026-03-02T00:00:00.000Z'),
    })

    expect(groups.find((group) => group.name === 'Chest')).toMatchObject({
      level: 'Intermediate',
    })
  })
})

import {
  EXERCISES_WITH_STANDARDS,
  EXERCISE_TIER_WEIGHTS,
} from '../lib/exercise-standards-config'
import {
  GENERATED_EXERCISES_WITH_STANDARDS,
  GENERATED_EXERCISE_TIER_WEIGHTS,
} from '../supabase/functions/_shared/generated-strength-standards'

function normalizeExerciseStandards(
  exercises: readonly {
    id: string
    name: string
    aliases?: readonly string[]
    gifUrl?: string | null
    male: readonly unknown[]
    female: readonly unknown[]
    tier?: 1 | 2 | 3
    isRepBased?: boolean
  }[],
) {
  return exercises
    .map((exercise) => ({
      ...exercise,
      aliases: [...(exercise.aliases ?? [])].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

describe('generated strength standards sync', () => {
  test('matches frontend exercise standards config', () => {
    expect(GENERATED_EXERCISE_TIER_WEIGHTS).toEqual(EXERCISE_TIER_WEIGHTS)
    expect(
      normalizeExerciseStandards(GENERATED_EXERCISES_WITH_STANDARDS),
    ).toEqual(normalizeExerciseStandards(EXERCISES_WITH_STANDARDS))
  })
})

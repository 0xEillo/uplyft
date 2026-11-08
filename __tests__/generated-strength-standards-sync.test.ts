import { spawnSync } from 'child_process'
import { resolve } from 'path'
import {
  EXERCISES_WITH_STANDARDS,
  EXERCISE_MUSCLE_MAPPING,
  EXERCISE_TIER_WEIGHTS,
} from '../lib/exercise-standards-config'
import {
  GENERATED_EXERCISES_WITH_STANDARDS,
  GENERATED_EXERCISE_MUSCLE_MAPPING,
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

  test('matches frontend exercise muscle mapping', () => {
    expect(GENERATED_EXERCISE_MUSCLE_MAPPING).toEqual(EXERCISE_MUSCLE_MAPPING)
  })

  test('every standards exercise has a muscle mapping', () => {
    const unmapped = EXERCISES_WITH_STANDARDS.filter(
      (exercise) => !EXERCISE_MUSCLE_MAPPING[exercise.name],
    ).map((exercise) => exercise.name)
    expect(unmapped).toEqual([])
  })

  // The generator imports the .ts config directly, which needs Node's
  // built-in type stripping (Node 22.18+ / 23.6+).
  const [major, minor] = process.versions.node.split('.').map(Number)
  const canRunGenerator = major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18)
  ;(canRunGenerator ? test : test.skip)(
    'generated file is byte-identical to the generator output',
    () => {
      const result = spawnSync(
        process.execPath,
        ['--no-warnings', resolve(__dirname, '../scripts/generate-strength-standards.mjs'), '--check'],
        { encoding: 'utf8' },
      )
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
    },
  )
})

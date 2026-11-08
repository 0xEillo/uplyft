import { getExerciseSuggestion } from '@/hooks/useExerciseAutocomplete'
import {
  matchesAllQueryTokens,
  rankExercisesByUsage,
} from '@/lib/utils/exercise-usage-ranking'
import { Exercise } from '@/types/database.types'

const ex = (id: string, name: string) => ({ id, name } as Exercise)

const barbell = ex('bb', 'Bench Press (Barbell)')
const dumbbell = ex('db', 'Bench Press (Dumbbell)')
const incline = ex('inc', 'Incline Bench Press (Dumbbell)')
const dip = ex('dip', 'Bench Dip')

describe('matchesAllQueryTokens', () => {
  it('matches word prefixes in any order', () => {
    expect(matchesAllQueryTokens('Bench Press (Dumbbell)', 'ben')).toBe(true)
    expect(matchesAllQueryTokens('Bench Press (Dumbbell)', 'dumb bench')).toBe(true)
    expect(matchesAllQueryTokens('Bench Press (Dumbbell)', 'squat')).toBe(false)
  })
})

describe('rankExercisesByUsage', () => {
  it('puts most-used exercises first among strong matches', () => {
    const ranked = rankExercisesByUsage([barbell, dumbbell, dip], 'ben', {
      db: 12,
      bb: 1,
    })
    expect(ranked.map((e) => e.id)).toEqual(['db', 'bb', 'dip'])
  })

  it('does not let a used weak match jump above strong matches', () => {
    const fuzzyOnly = ex('fly', 'Chest Fly (Dumbbell)')
    const ranked = rankExercisesByUsage([barbell, fuzzyOnly], 'bench', {
      fly: 50,
    })
    expect(ranked.map((e) => e.id)).toEqual(['bb', 'fly'])
  })

  it('keeps original order without usage data', () => {
    expect(rankExercisesByUsage([barbell, dumbbell], 'ben', {})).toEqual([
      barbell,
      dumbbell,
    ])
  })
})

describe('autocomplete with usage counts', () => {
  const exercises = [barbell, dumbbell, incline, dip]

  it('defaults to barbell with no history', () => {
    expect(getExerciseSuggestion('ben', 3, exercises)?.name).toBe(
      'Bench Press (Barbell)',
    )
  })

  it('suggests the user\'s most-used variation first', () => {
    expect(
      getExerciseSuggestion('ben', 3, exercises, { db: 8, bb: 2 })?.name,
    ).toBe('Bench Press (Dumbbell)')
  })

  it('still offers a prefix completion when a non-prefix match is most used', () => {
    expect(
      getExerciseSuggestion('ben', 3, exercises, { inc: 20, db: 3 })?.name,
    ).toBe('Bench Press (Dumbbell)')
  })
})

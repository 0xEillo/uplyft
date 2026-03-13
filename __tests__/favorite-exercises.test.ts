import {
  getFavoriteExercisesStorageKey,
  parseFavoriteExerciseIds,
  serializeFavoriteExerciseIds,
} from '@/lib/utils/favorite-exercises'

describe('favorite exercise storage helpers', () => {
  it('builds a user-specific storage key', () => {
    expect(getFavoriteExercisesStorageKey('user-123')).toBe(
      '@favorite_exercises:user-123',
    )
  })

  it('falls back to the guest storage key when no user id exists', () => {
    expect(getFavoriteExercisesStorageKey()).toBe('@favorite_exercises:guest')
  })

  it('parses valid stored favorite ids into a deduplicated set', () => {
    expect(
      Array.from(
        parseFavoriteExerciseIds(
          JSON.stringify(['bench', 'squat', 'bench', '', 42]),
        ),
      ),
    ).toEqual(['bench', 'squat'])
  })

  it('returns an empty set for invalid stored data', () => {
    expect(Array.from(parseFavoriteExerciseIds('{bad-json'))).toEqual([])
    expect(Array.from(parseFavoriteExerciseIds(JSON.stringify({})))).toEqual([])
  })

  it('serializes favorite ids in a stable order', () => {
    expect(
      serializeFavoriteExerciseIds(['squat', 'bench', 'bench', '', 'deadlift']),
    ).toBe(JSON.stringify(['bench', 'deadlift', 'squat']))
  })
})

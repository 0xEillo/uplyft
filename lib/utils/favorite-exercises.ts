const FAVORITE_EXERCISES_STORAGE_PREFIX = '@favorite_exercises'
const GUEST_FAVORITES_KEY = 'guest'

export function getFavoriteExercisesStorageKey(userId?: string | null): string {
  return `${FAVORITE_EXERCISES_STORAGE_PREFIX}:${userId ?? GUEST_FAVORITES_KEY}`
}

export function parseFavoriteExerciseIds(rawValue: string | null): Set<string> {
  if (!rawValue) {
    return new Set()
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      return new Set()
    }

    return new Set(
      parsed.filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      ),
    )
  } catch {
    return new Set()
  }
}

export function serializeFavoriteExerciseIds(
  favoriteExerciseIds: Iterable<string>,
): string {
  const normalizedIds = Array.from(
    new Set(
      Array.from(favoriteExerciseIds).filter(
        (value) => typeof value === 'string' && value.trim().length > 0,
      ),
    ),
  ).sort()

  return JSON.stringify(normalizedIds)
}

import { Exercise } from '@/types/database.types'

export type ExerciseUsageCounts = Record<string, number>

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[()\-/,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * True when every word the user typed is the start of some word in the
 * exercise name (e.g. "ben" → "Bench Press (Dumbbell)", "db bench" fails,
 * "bench dumb" → "Bench Press (Dumbbell)").
 */
export function matchesAllQueryTokens(name: string, query: string): boolean {
  const queryTokens = tokenize(query)
  if (!queryTokens.length) return false
  const nameTokens = tokenize(name)
  return queryTokens.every((q) => nameTokens.some((t) => t.startsWith(q)))
}

/**
 * Re-orders search results so exercises the user performs most often come
 * first, without letting a loosely-related fuzzy match jump above a strong
 * one: results are split into "strong" matches (every typed word prefixes a
 * word in the name) and the rest, and usage only reorders within each tier.
 * Ties keep the incoming order (search relevance / recency).
 */
export function rankExercisesByUsage(
  matches: Exercise[],
  query: string,
  usageCounts: ExerciseUsageCounts | undefined,
): Exercise[] {
  if (!usageCounts || matches.length <= 1 || !query.trim()) return matches

  return matches
    .map((exercise, index) => ({
      exercise,
      index,
      strong: matchesAllQueryTokens(exercise.name, query),
      usage: usageCounts[exercise.id] ?? 0,
    }))
    .sort((a, b) => {
      if (a.strong !== b.strong) return a.strong ? -1 : 1
      if (a.usage !== b.usage) return b.usage - a.usage
      return a.index - b.index
    })
    .map((item) => item.exercise)
}

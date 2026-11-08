/**
 * Per-user exercise usage cache (which exercises the user has performed, most
 * recent first, and how many workouts each appeared in).
 *
 * Shared by the exercise picker and the workout logger so re-opening either
 * screen renders "Recently Performed" / usage ranking instantly from memory
 * while a background refresh keeps it current.
 */
import { database } from '@/lib/database'

export interface ExerciseUsage {
  recentIds: string[]
  usageCounts: Record<string, number>
}

const usageCache = new Map<string, ExerciseUsage>()
const inflight = new Map<string, Promise<ExerciseUsage>>()

export function peekExerciseUsage(userId: string | undefined | null) {
  if (!userId) return null
  return usageCache.get(userId) ?? null
}

/**
 * Fetch fresh usage for a user. Concurrent calls share one request.
 */
export function loadExerciseUsage(userId: string): Promise<ExerciseUsage> {
  const pending = inflight.get(userId)
  if (pending) return pending

  const request = database.exercises
    .getExerciseUsage(userId)
    .then((usage) => {
      usageCache.set(userId, usage)
      return usage
    })
    .finally(() => {
      inflight.delete(userId)
    })

  inflight.set(userId, request)
  return request
}

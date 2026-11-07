import type { WorkoutCommentPreviewRow } from '@/lib/database'

/**
 * Batches and caches the "first two comments" preview shown under feed cards.
 *
 * Every card used to fetch its own preview (comments, then commenter
 * profiles, then like counts and liked ids: up to 4 requests per card).
 * Cards now ask this loader instead: all requests made in the same tick
 * become one query, and results are cached briefly so FlashList recycling
 * and tab switches don't refetch them.
 */

export const COMMENT_PREVIEW_LIMIT = 2
const CACHE_TTL_MS = 60_000

type FetchPreviews = (
  workoutIds: string[],
  viewerId: string | null,
  perWorkout: number,
) => Promise<Record<string, WorkoutCommentPreviewRow[]>>

type CacheEntry = {
  comments: WorkoutCommentPreviewRow[]
  commentCount: number | null
  fetchedAt: number
}

type Waiter = {
  resolve: (comments: WorkoutCommentPreviewRow[]) => void
  reject: (error: unknown) => void
}

export function createCommentPreviewLoader(
  fetchPreviews: FetchPreviews,
  now: () => number = Date.now,
) {
  const cache = new Map<string, CacheEntry>()
  const pending = new Map<
    string,
    { waiters: Waiter[]; commentCount: number | null }
  >()
  let queuedViewerId: string | null = null
  let flushScheduled = false

  const cacheKey = (workoutId: string, viewerId: string | null) =>
    `${viewerId ?? ''}:${workoutId}`

  const flush = async () => {
    flushScheduled = false
    const batch = new Map(pending)
    pending.clear()
    const viewerId = queuedViewerId
    const workoutIds = [...batch.keys()].map((key) => key.split(':')[1])

    try {
      const previews = await fetchPreviews(
        workoutIds,
        viewerId,
        COMMENT_PREVIEW_LIMIT,
      )
      const fetchedAt = now()
      batch.forEach(({ waiters, commentCount }, key) => {
        const comments = previews[key.split(':')[1]] || []
        cache.set(key, { comments, commentCount, fetchedAt })
        waiters.forEach((waiter) => waiter.resolve(comments))
      })
    } catch (error) {
      batch.forEach(({ waiters }) =>
        waiters.forEach((waiter) => waiter.reject(error)),
      )
    }
  }

  /**
   * Cached preview for a workout, or undefined when it must be (re)fetched.
   * `commentCount` (when known) invalidates the entry once it changes.
   */
  const peek = (
    workoutId: string,
    viewerId: string | null,
    commentCount: number | null = null,
  ): WorkoutCommentPreviewRow[] | undefined => {
    const entry = cache.get(cacheKey(workoutId, viewerId))
    if (!entry) return undefined
    if (now() - entry.fetchedAt > CACHE_TTL_MS) return undefined
    if (commentCount !== null && entry.commentCount !== commentCount) {
      return undefined
    }
    return entry.comments
  }

  const load = (
    workoutId: string,
    viewerId: string | null,
    commentCount: number | null = null,
  ): Promise<WorkoutCommentPreviewRow[]> => {
    const cached = peek(workoutId, viewerId, commentCount)
    if (cached) return Promise.resolve(cached)

    // A batch serves a single viewer; flush early if the viewer changed.
    if (pending.size > 0 && queuedViewerId !== viewerId) {
      void flush()
    }
    queuedViewerId = viewerId

    return new Promise((resolve, reject) => {
      const key = cacheKey(workoutId, viewerId)
      const entry = pending.get(key) || { waiters: [], commentCount }
      entry.waiters.push({ resolve, reject })
      entry.commentCount = commentCount
      pending.set(key, entry)
      if (!flushScheduled) {
        flushScheduled = true
        // Cards mounted in the same commit run their effects back to back,
        // so a macrotask boundary collects the whole visible page.
        setTimeout(() => void flush(), 0)
      }
    })
  }

  const clear = () => cache.clear()

  return { load, peek, clear }
}

let defaultLoader: ReturnType<typeof createCommentPreviewLoader> | null = null

const getDefaultLoader = () => {
  if (!defaultLoader) {
    defaultLoader = createCommentPreviewLoader((ids, viewerId, perWorkout) =>
      // Lazy require keeps this module free of the database import for tests.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/lib/database').database.workoutComments.getPreviewsForWorkouts(
        ids,
        viewerId,
        perWorkout,
      ),
    )
  }
  return defaultLoader
}

export const loadFeedCommentPreviews: ReturnType<
  typeof createCommentPreviewLoader
>['load'] = (...args) => getDefaultLoader().load(...args)

export const peekFeedCommentPreviews: ReturnType<
  typeof createCommentPreviewLoader
>['peek'] = (...args) => getDefaultLoader().peek(...args)

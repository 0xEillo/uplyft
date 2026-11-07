import { useEffect, useState } from 'react'

import { database } from '@/lib/database'
import { PrService, type PrDetail } from '@/lib/pr'
import { mapSetsToPrContext } from '@/lib/utils/pr-context'
import type { WorkoutSessionWithDetails } from '@/types/database.types'

/**
 * How a record reads to a person:
 * - `weight`: heaviest they've ever lifted on this exercise (delta in kg)
 * - `reps`: most reps they've done at this weight or heavier (delta in reps)
 * - `first`: first time logging the exercise, so nothing to compare against
 * - `estimate`: fallback for an est. 1RM gain we can't express as reps (kg)
 */
export type RecordHighlightType = 'weight' | 'reps' | 'first' | 'estimate'

/**
 * One row in the feed card "Records" page: the exercise, the set that earned
 * the record, and how much it beat the previous best by.
 */
export interface WorkoutRecordHighlight {
  exerciseId: string
  exerciseName: string
  gifUrl: string | null
  isCustom: boolean
  /** Weight (kg) and reps of the set that earned the record. */
  weightKg: number
  reps: number
  type: RecordHighlightType
  /** Improvement over the previous best: kg for weight/estimate, reps for reps. */
  delta: number | null
}

export type WorkoutRecordHighlightsState =
  | { status: 'idle' | 'loading' | 'error'; highlights: null }
  | { status: 'ready'; highlights: WorkoutRecordHighlight[] }

// Module-level cache so recycled feed cards don't recompute PRs.
const highlightCache = new Map<string, Promise<WorkoutRecordHighlight[]>>()

function cacheKey(workout: WorkoutSessionWithDetails): string {
  return `${workout.id}:${workout.record_count ?? 0}`
}

function toHighlight(prs: PrDetail[]): Pick<
  WorkoutRecordHighlight,
  'weightKg' | 'reps' | 'type' | 'delta'
> {
  const heaviest = prs.find((pr) => pr.kind === 'heaviest-weight')
  if (heaviest) {
    const previous = heaviest.previousValue ?? 0
    return {
      weightKg: heaviest.weight,
      reps: heaviest.currentReps,
      type: previous > 0 ? 'weight' : 'first',
      delta: previous > 0 ? heaviest.value - previous : null,
    }
  }

  // Not heavier than ever, so a 1RM / volume record means more reps than
  // ever at this weight (or heavier).
  const repRecord =
    prs.find((pr) => pr.kind === 'best-1rm') ??
    prs.find((pr) => pr.kind === 'best-set-volume') ??
    prs[0]
  const previousReps = repRecord.previousBestRepsAtWeight
  if (typeof previousReps === 'number' && repRecord.currentReps > previousReps) {
    return {
      weightKg: repRecord.weight,
      reps: repRecord.currentReps,
      type: 'reps',
      delta: repRecord.currentReps - previousReps,
    }
  }

  const previous = repRecord.previousValue ?? 0
  return {
    weightKg: repRecord.weight,
    reps: repRecord.currentReps,
    type: previous > 0 ? 'estimate' : 'first',
    delta: previous > 0 ? repRecord.value - previous : null,
  }
}

async function loadHighlights(
  feedWorkout: WorkoutSessionWithDetails,
): Promise<WorkoutRecordHighlight[]> {
  // The feed payload only includes the first few exercises; fetch the full
  // session when some were left out so no record is missed.
  const previewCount = feedWorkout.workout_exercises?.length ?? 0
  const totalCount =
    feedWorkout.feed_preview?.totalExerciseCount ?? previewCount
  const workout =
    totalCount > previewCount
      ? await database.workoutSessions.getById(feedWorkout.id)
      : feedWorkout

  if (!workout.user_id || !workout.created_at || !workout.date) return []

  const exercises = workout.workout_exercises || []
  const result = await PrService.computePrsForSession({
    sessionId: workout.id,
    userId: workout.user_id,
    createdAt: workout.created_at,
    date: workout.date,
    exercises: exercises.map((we) => ({
      exerciseId: we.exercise_id,
      exerciseName: we.exercise?.name || 'Exercise',
      sets: mapSetsToPrContext(we.sets),
    })),
  })

  return result.perExercise
    .filter((entry) => entry.prs.length > 0)
    .map((entry) => {
      const exercise = exercises.find(
        (we) => we.exercise_id === entry.exerciseId,
      )?.exercise
      return {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        gifUrl: exercise?.gif_url ?? null,
        isCustom: exercise ? !!exercise.created_by : true,
        ...toHighlight(entry.prs),
      }
    })
}

/**
 * Lazily computes per-exercise record highlights for a feed workout.
 * Nothing is fetched until `enabled` flips to true (e.g. the user starts
 * swiping the card), keeping feed scrolling free of PR queries.
 */
export function useWorkoutRecordHighlights(
  workout: WorkoutSessionWithDetails,
  enabled: boolean,
): WorkoutRecordHighlightsState {
  const [state, setState] = useState<WorkoutRecordHighlightsState>({
    status: 'idle',
    highlights: null,
  })

  const key = cacheKey(workout)

  useEffect(() => {
    setState({ status: 'idle', highlights: null })
  }, [key])

  useEffect(() => {
    if (!enabled || workout.isPending || !(workout.record_count > 0)) return

    let isMounted = true
    let promise = highlightCache.get(key)
    if (!promise) {
      promise = loadHighlights(workout)
      highlightCache.set(key, promise)
      // Allow a retry on the next request if this attempt fails.
      promise.catch(() => highlightCache.delete(key))
    }

    setState((current) =>
      current.status === 'ready' ? current : { status: 'loading', highlights: null },
    )

    promise
      .then((highlights) => {
        if (isMounted) setState({ status: 'ready', highlights })
      })
      .catch((error) => {
        console.error('Error loading workout record highlights:', error)
        if (isMounted) setState({ status: 'error', highlights: null })
      })

    return () => {
      isMounted = false
    }
    // `workout` is intentionally keyed by `key` to avoid refetching on
    // unrelated object identity changes (likes, comments, etc.).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, workout.isPending])

  return state
}

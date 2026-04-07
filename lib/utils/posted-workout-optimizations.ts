type HasId = { id: string }
type MaybePending = { isPending?: boolean }
type HasWorkoutExercises = { workout_exercises?: unknown[] | null }
type HasProfile = { profile?: unknown | null }
type HasFeedRecency = { created_at?: string | null; date?: string | null }

export type PendingPlaceholderUiStatus = 'hidden' | 'queued' | 'processing'

function getFeedRecencyTimestamp(workout: HasFeedRecency): number {
  const iso = workout.created_at ?? workout.date ?? null
  if (!iso) {
    return 0
  }

  const timestamp = new Date(iso).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function prependProcessedWorkoutToFeed<
  T extends HasId & MaybePending & HasFeedRecency,
>(
  previous: T[],
  workout: T,
): T[] {
  const filtered = previous.filter(
    (item) => !item.isPending && item.id !== workout.id,
  )

  return [workout, ...filtered].sort((left, right) => {
    const recencyDifference =
      getFeedRecencyTimestamp(right) - getFeedRecencyTimestamp(left)

    if (recencyDifference !== 0) {
      return recencyDifference
    }

    return right.id.localeCompare(left.id)
  })
}

export function replaceWorkoutInFeedById<T extends HasId>(
  previous: T[],
  workout: T,
): T[] {
  return previous.map((item) => (item.id === workout.id ? workout : item))
}

export function shouldHydratePostedWorkout(
  workout: HasWorkoutExercises,
): boolean {
  return (
    !Array.isArray(workout.workout_exercises) ||
    workout.workout_exercises.length === 0
  )
}

export function shouldInsertPostedWorkoutImmediately(
  workout: HasWorkoutExercises,
): boolean {
  return !shouldHydratePostedWorkout(workout)
}

export function resolvePostedWorkoutForFeed<
  T extends HasId & HasWorkoutExercises & HasProfile,
>(
  workout: T,
  hydratedWorkout: T | null,
  fallbackProfile: T['profile'] | null | undefined,
): T {
  if (hydratedWorkout) {
    return {
      ...hydratedWorkout,
      profile: hydratedWorkout.profile ?? fallbackProfile ?? undefined,
    }
  }

  if (fallbackProfile && !workout.profile) {
    return {
      ...workout,
      profile: fallbackProfile,
    }
  }

  return workout
}

export function getPendingPlaceholderUiStatus({
  hasPendingPlaceholder,
  isProcessingPending,
  isProcessingLatched,
}: {
  hasPendingPlaceholder: boolean
  isProcessingPending: boolean
  isProcessingLatched: boolean
}): PendingPlaceholderUiStatus {
  if (!hasPendingPlaceholder) {
    return 'hidden'
  }

  if (isProcessingPending || isProcessingLatched) {
    return 'processing'
  }

  return 'queued'
}

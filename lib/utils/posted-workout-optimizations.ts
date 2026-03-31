type HasId = { id: string }
type MaybePending = { isPending?: boolean }
type HasWorkoutExercises = { workout_exercises?: unknown[] | null }
type HasProfile = { profile?: unknown | null }

export type PendingPlaceholderUiStatus = 'hidden' | 'queued' | 'processing'

export function prependProcessedWorkoutToFeed<T extends HasId & MaybePending>(
  previous: T[],
  workout: T,
): T[] {
  const filtered = previous.filter((item) => !item.isPending)
  if (filtered.some((item) => item.id === workout.id)) {
    return filtered
  }
  return [workout, ...filtered]
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

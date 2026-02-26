type HasId = { id: string }
type MaybePending = { isPending?: boolean }
type HasWorkoutExercises = { workout_exercises?: unknown[] | null }

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

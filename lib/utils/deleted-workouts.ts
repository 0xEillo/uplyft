// Simple in-memory tracker for workouts deleted from detail pages
// Used to sync feed state when navigating back

const deletedWorkoutIds = new Set<string>()

export function markWorkoutAsDeleted(workoutId: string): void {
  deletedWorkoutIds.add(workoutId)
}

export function getAndClearDeletedWorkoutIds(): string[] {
  const ids = Array.from(deletedWorkoutIds)
  deletedWorkoutIds.clear()
  return ids
}

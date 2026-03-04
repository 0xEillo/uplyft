import type { Profile } from '@/types/database.types'

export interface WorkoutSocialUpdate {
  workoutId: string
  likeCountDelta?: number
  commentCountDelta?: number
  isLiked?: boolean
  likerToAdd?: Partial<Profile>
  likerIdToRemove?: string
}

export interface PendingWorkoutSocialUpdate {
  likeCountDelta: number
  commentCountDelta: number
  isLiked?: boolean
  likerToAdd?: Partial<Profile>
  likerIdToRemove?: string
}

type WorkoutSocialUpdateListener = (update: WorkoutSocialUpdate) => void

const listeners = new Set<WorkoutSocialUpdateListener>()
const pendingUpdatesByWorkoutId = new Map<string, PendingWorkoutSocialUpdate>()

function mergeUpdates(
  current: PendingWorkoutSocialUpdate | undefined,
  incoming: WorkoutSocialUpdate,
): PendingWorkoutSocialUpdate {
  return {
    likeCountDelta:
      (current?.likeCountDelta ?? 0) + (incoming.likeCountDelta ?? 0),
    commentCountDelta:
      (current?.commentCountDelta ?? 0) + (incoming.commentCountDelta ?? 0),
    isLiked:
      typeof incoming.isLiked === 'boolean'
        ? incoming.isLiked
        : current?.isLiked,
    likerToAdd: incoming.likerToAdd ?? current?.likerToAdd,
    likerIdToRemove: incoming.likerIdToRemove ?? current?.likerIdToRemove,
  }
}

export function publishWorkoutSocialUpdate(update: WorkoutSocialUpdate): void {
  if (!update.workoutId) return

  const merged = mergeUpdates(
    pendingUpdatesByWorkoutId.get(update.workoutId),
    update,
  )
  pendingUpdatesByWorkoutId.set(update.workoutId, merged)

  listeners.forEach((listener) => {
    listener(update)
  })
}

export function consumeWorkoutSocialUpdate(
  workoutId: string,
): PendingWorkoutSocialUpdate | null {
  const pendingUpdate = pendingUpdatesByWorkoutId.get(workoutId)
  if (!pendingUpdate) return null

  pendingUpdatesByWorkoutId.delete(workoutId)
  return pendingUpdate
}

export function subscribeWorkoutSocialUpdates(
  listener: WorkoutSocialUpdateListener,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

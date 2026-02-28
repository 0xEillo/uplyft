import type { PrContextSet } from '@/lib/pr'

interface WorkoutSetLike {
  reps?: number | null
  weight?: number | null
  is_warmup?: boolean | null
}

export function resolvePrContextUserId(
  workoutUserId: string | null | undefined,
  viewerUserId: string | null | undefined,
): string | null {
  if (typeof workoutUserId === 'string' && workoutUserId.length > 0) {
    return workoutUserId
  }

  if (typeof viewerUserId === 'string' && viewerUserId.length > 0) {
    return viewerUserId
  }

  return null
}

export function mapSetsToPrContext(
  sets: WorkoutSetLike[] | null | undefined,
): PrContextSet[] {
  return (sets || []).map((set, originalIndex) => ({
    reps: set.reps ?? null,
    weight: set.weight ?? null,
    isWarmup: set.is_warmup === true,
    originalIndex,
  }))
}

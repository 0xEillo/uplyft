export const WORKOUT_SESSION_IDEMPOTENCY_INDEX =
  'idx_workout_sessions_user_idempotency_key_unique'

type PostgresErrorLike = {
  code?: unknown
  message?: unknown
  details?: unknown
}

export function normalizeIdempotencyKey(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function isWorkoutSessionIdempotencyConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as PostgresErrorLike
  if (candidate.code !== '23505') {
    return false
  }

  const haystacks = [candidate.message, candidate.details]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase())

  return haystacks.some((value) =>
    value.includes(WORKOUT_SESSION_IDEMPOTENCY_INDEX.toLowerCase()),
  )
}

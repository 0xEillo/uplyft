import { createServiceClient } from './supabase.ts'

export type RateLimitResult =
  | {
      allowed: true
      minuteCount: number
      hourCount: number
      dayCount: number
    }
  | {
      allowed: false
      reason: 'minute' | 'hour' | 'day' | 'unknown'
      retryAfterSeconds: number
      minuteCount: number
      hourCount: number
      dayCount: number
    }

export interface CheckChatRateLimitOptions {
  userId: string
  weight?: number
  minuteLimit?: number
  hourLimit?: number
  dayLimit?: number
}

/**
 * Atomically check + record an AI chat request against per-user limits.
 *
 * Implementation note: failing open (allowed=true) on infra errors is
 * intentional — a transient DB blip should not block paying users. Budget
 * spikes from such blips are bounded because the next successful call will
 * see the historical rows and start enforcing again.
 */
export async function checkChatRateLimit(
  options: CheckChatRateLimitOptions,
): Promise<RateLimitResult> {
  const {
    userId,
    weight = 1,
    minuteLimit = 8,
    hourLimit = 60,
    dayLimit = 200,
  } = options

  try {
    const service = createServiceClient()
    const { data, error } = await service.rpc('check_ai_chat_rate_limit', {
      p_user_id: userId,
      p_weight: weight,
      p_minute_limit: minuteLimit,
      p_hour_limit: hourLimit,
      p_day_limit: dayLimit,
    })

    if (error) {
      console.error('[rate-limit] RPC error, failing open:', error)
      return {
        allowed: true,
        minuteCount: 0,
        hourCount: 0,
        dayCount: 0,
      }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      console.error('[rate-limit] RPC returned no row, failing open')
      return {
        allowed: true,
        minuteCount: 0,
        hourCount: 0,
        dayCount: 0,
      }
    }

    if (row.allowed) {
      return {
        allowed: true,
        minuteCount: row.minute_count ?? 0,
        hourCount: row.hour_count ?? 0,
        dayCount: row.day_count ?? 0,
      }
    }

    const knownReasons = ['minute', 'hour', 'day'] as const
    type KnownReason = (typeof knownReasons)[number]
    const rawReason = row.reason ?? 'unknown'
    const reason: KnownReason | 'unknown' = (
      knownReasons as readonly string[]
    ).includes(rawReason)
      ? (rawReason as KnownReason)
      : 'unknown'

    return {
      allowed: false,
      reason,
      retryAfterSeconds: row.retry_after_seconds ?? 60,
      minuteCount: row.minute_count ?? 0,
      hourCount: row.hour_count ?? 0,
      dayCount: row.day_count ?? 0,
    }
  } catch (err) {
    console.error('[rate-limit] Unexpected error, failing open:', err)
    return {
      allowed: true,
      minuteCount: 0,
      hourCount: 0,
      dayCount: 0,
    }
  }
}

export function rateLimitMessage(
  reason: 'minute' | 'hour' | 'day' | 'unknown',
): string {
  switch (reason) {
    case 'minute':
      return 'You\u2019re sending messages a bit too fast. Take a breath and try again in a minute.'
    case 'hour':
      return 'You\u2019ve hit the hourly chat limit. Try again in an hour.'
    case 'day':
      return 'You\u2019ve reached today\u2019s AI chat limit. It resets in 24h.'
    default:
      return 'Chat rate limit reached. Please try again later.'
  }
}

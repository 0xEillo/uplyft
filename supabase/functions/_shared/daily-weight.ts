import type { SupabaseClient } from './supabase.ts'

export function normalizeLogDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid log date')
  }

  const year = parsed.getFullYear()
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function getLatestDailyWeightKg(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('daily_log_entries')
    .select('weight_kg')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return typeof data?.weight_kg === 'number' ? data.weight_kg : null
}

export async function getDailyWeightsByLogDate(
  supabase: SupabaseClient,
  userId: string,
  rawDates: string[],
): Promise<Map<string, number | null>> {
  const logDates = Array.from(
    new Set(
      rawDates
        .map((value) => {
          try {
            return normalizeLogDate(value)
          } catch {
            return null
          }
        })
        .filter((value): value is string => Boolean(value)),
    ),
  )

  if (logDates.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('daily_log_entries')
    .select('log_date, weight_kg')
    .eq('user_id', userId)
    .in('log_date', logDates)

  if (error) throw error

  return new Map(
    ((data as { log_date: string; weight_kg: number | null }[] | null) ?? []).map(
      (entry) => [entry.log_date, entry.weight_kg],
    ),
  )
}

export async function getDailyWeightForTimestamp(
  supabase: SupabaseClient,
  userId: string,
  timestamp: string,
): Promise<number | null> {
  const logDate = normalizeLogDate(timestamp)
  const weightByDate = await getDailyWeightsByLogDate(supabase, userId, [logDate])
  return weightByDate.get(logDate) ?? null
}

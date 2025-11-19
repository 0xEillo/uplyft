import type { BodyLogEntry } from '@/lib/body-log/metadata'

export interface BodyLogContextSummary {
  latest?: {
    capturedAt: string
    weightKg: number | null
    bodyFatPercentage: number | null
    bmi: number | null
  }
  trend?: {
    spanDays: number
    weightDeltaKg: number | null
    bodyFatDelta: number | null
  }
}

function normalizeRecords(records: BodyLogEntry[]): BodyLogEntry[] {
  return [...records].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime()
    const bTime = new Date(b.created_at).getTime()
    return Number.isNaN(bTime) || Number.isNaN(aTime) ? 0 : bTime - aTime
  })
}

function diff(a: number | null, b: number | null): number | null {
  if (typeof a !== 'number' || Number.isNaN(a)) return null
  if (typeof b !== 'number' || Number.isNaN(b)) return null
  return Number((a - b).toFixed(2))
}

export function summarizeBodyLogContext(
  records: BodyLogEntry[] | null | undefined,
  options: { trendWindow?: number } = {},
): BodyLogContextSummary | null {
  if (!records || records.length === 0) {
    return null
  }

  const sorted = normalizeRecords(records)
  const latest = sorted[0]

  const summary: BodyLogContextSummary = {
    latest: {
      capturedAt: latest.created_at,
      weightKg: latest.weight_kg,
      bodyFatPercentage: latest.body_fat_percentage,
      bmi: latest.bmi,
    },
  }

  const windowDays = options.trendWindow ?? 90
  const windowStart = new Date(latest.created_at)
  if (!Number.isNaN(windowStart.getTime())) {
    windowStart.setDate(windowStart.getDate() - windowDays)
    const windowRecords = sorted.filter((record) => {
      const recordDate = new Date(record.created_at)
      if (Number.isNaN(recordDate.getTime())) return false
      return recordDate >= windowStart
    })

    const oldest = windowRecords[windowRecords.length - 1]

    if (oldest && oldest.id !== latest.id) {
      const spanMs =
        new Date(latest.created_at).getTime() -
        new Date(oldest.created_at).getTime()
      const spanDays = Math.max(Math.round(spanMs / (1000 * 60 * 60 * 24)), 1)

      summary.trend = {
        spanDays,
        weightDeltaKg: diff(latest.weight_kg, oldest.weight_kg),
        bodyFatDelta: diff(
          latest.body_fat_percentage,
          oldest.body_fat_percentage,
        ),
      }
    }
  }

  return summary
}

// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod@3.25.76'
import { tool } from 'npm:ai@7.0.162'

import { summarizeBodyLogContext } from '../../_shared/body-log-context.ts'
import { daysAgo, round, toDay, type ToolContext } from './shared.ts'

const SCAN_SELECT = `
  id, created_at, weight_kg, body_fat_percentage, bmi, muscle_mass_kg, lean_mass_kg, fat_mass_kg,
  score_v_taper, score_chest, score_shoulders, score_abs, score_arms, score_back, score_legs,
  analysis_summary
`

export function bodyTools({ supabase, userId, summary }: ToolContext) {
  return {
    getBodyMetrics: tool({
      description:
        "The user's body data over a period: daily bodyweight weigh-ins with trend (change, weekly rate, min/max), and body scans (weight, body fat %, lean/fat/muscle mass, BMI, physique scores per area out of 100, and the AI physique analysis) with the change between scans. Use for weight, cut/bulk progress, body composition and physique questions.",
      inputSchema: z.object({
        days: z.number().int().min(7).max(730).optional().describe('Look-back window in days (default 90).'),
      }),
      execute: async ({ days = 90 }) => {
        const from = daysAgo(days)
        const [weighIns, scansInWindow] = await Promise.all([
          (supabase as any)
            .from('daily_log_entries')
            .select('log_date, weight_kg')
            .eq('user_id', userId)
            .not('weight_kg', 'is', null)
            .gte('log_date', from)
            .order('log_date', { ascending: true })
            .limit(800),
          (supabase as any)
            .from('body_log_entries')
            .select(SCAN_SELECT)
            .eq('user_id', userId)
            .gte('created_at', `${from}T00:00:00Z`)
            .order('created_at', { ascending: false })
            .limit(20),
        ])
        if (weighIns.error) throw weighIns.error
        if (scansInWindow.error) throw scansInWindow.error

        // No scans in the window: still show the latest ones for context.
        let scans = (scansInWindow.data ?? []) as any[]
        if (scans.length === 0) {
          const { data, error } = await (supabase as any)
            .from('body_log_entries')
            .select(SCAN_SELECT)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3)
          if (error) throw error
          scans = data ?? []
        }

        const points = ((weighIns.data ?? []) as { log_date: string; weight_kg: number }[]).map(
          (row) => ({ date: row.log_date, kg: Number(row.weight_kg) }),
        )
        const scanTrend = summarizeBodyLogContext(scans)?.trend ?? null

        return {
          window: { days, from },
          heightCm: summary.profile.heightCm ?? null,
          bodyweight: points.length ? summarizeWeighIns(points) : { weighIns: 0, profileWeightKg: summary.profile.weightKg ?? null },
          scans: scans.map((scan) => ({
            date: toDay(scan.created_at),
            ...(scan.weight_kg != null ? { weightKg: round(scan.weight_kg) } : {}),
            ...(scan.body_fat_percentage != null ? { bodyFatPct: round(scan.body_fat_percentage) } : {}),
            ...(scan.lean_mass_kg != null ? { leanMassKg: round(scan.lean_mass_kg) } : {}),
            ...(scan.fat_mass_kg != null ? { fatMassKg: round(scan.fat_mass_kg) } : {}),
            ...(scan.muscle_mass_kg != null ? { muscleMassKg: round(scan.muscle_mass_kg) } : {}),
            ...(scan.bmi != null ? { bmi: round(scan.bmi) } : {}),
            physique: compact({
              vTaper: scan.score_v_taper,
              chest: scan.score_chest,
              shoulders: scan.score_shoulders,
              abs: scan.score_abs,
              arms: scan.score_arms,
              back: scan.score_back,
              legs: scan.score_legs,
            }),
            ...(scan.analysis_summary?.trim() ? { analysis: scan.analysis_summary.trim() } : {}),
          })),
          ...(scanTrend ? { scanChange: compact(scanTrend) } : {}),
        }
      },
    }),
  }
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry != null)
      .map(([key, entry]) => [key, typeof entry === 'number' ? round(entry) : entry]),
  )
}

/** Trend stats plus the series (weekly averages when it's long). */
function summarizeWeighIns(points: { date: string; kg: number }[]) {
  const first = points[0]
  const latest = points.at(-1)!
  const weights = points.map((point) => point.kg)

  // Least-squares slope in kg/day → kg/week.
  const t0 = new Date(first.date).getTime()
  const xs = points.map((point) => (new Date(point.date).getTime() - t0) / 86_400_000)
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length
  const meanY = weights.reduce((sum, y) => sum + y, 0) / weights.length
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
  const slope = denominator > 0
    ? xs.reduce((sum, x, index) => sum + (x - meanX) * (weights[index] - meanY), 0) / denominator
    : 0

  let series: string[]
  if (points.length <= 45) {
    series = points.map((point) => `${point.date}: ${round(point.kg)}`)
  } else {
    const weeks = new Map<string, number[]>()
    for (const point of points) {
      const date = new Date(point.date)
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
      const key = date.toISOString().slice(0, 10)
      weeks.set(key, [...(weeks.get(key) ?? []), point.kg])
    }
    series = [...weeks.entries()].map(
      ([week, values]) => `week of ${week}: avg ${round(values.reduce((s, v) => s + v, 0) / values.length)}`,
    )
  }

  return {
    weighIns: points.length,
    latest: { date: latest.date, kg: round(latest.kg) },
    first: { date: first.date, kg: round(first.kg) },
    changeKg: round(latest.kg - first.kg),
    trendKgPerWeek: round(slope * 7, 2),
    minKg: round(Math.min(...weights)),
    maxKg: round(Math.max(...weights)),
    series,
  }
}

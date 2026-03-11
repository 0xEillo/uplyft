export interface BodyLogRecord {
  id: string
  user_id: string
  file_path: string | null
  created_at: string
  weight_kg: number | null
  body_fat_percentage: number | null
  bmi: number | null
  muscle_mass_kg?: number | null
  lean_mass_kg?: number | null
  fat_mass_kg?: number | null
  score_v_taper?: number | null
  score_chest?: number | null
  score_shoulders?: number | null
  score_abs?: number | null
  score_arms?: number | null
  score_back?: number | null
  score_legs?: number | null
  analysis_summary?: string | null
}

export interface BodyLogContextSummary {
  latest?: {
    capturedAt: string
    weightKg: number | null
    bodyFatPercentage: number | null
    bmi: number | null
    muscleMassKg: number | null
    leanMassKg: number | null
    fatMassKg: number | null
    physiqueScores: {
      vTaper: number | null
      chest: number | null
      shoulders: number | null
      abs: number | null
      arms: number | null
      back: number | null
      legs: number | null
      average: number | null
    }
    analysisSummary: string | null
  }
  trend?: {
    spanDays: number
    weightDeltaKg: number | null
    bodyFatDelta: number | null
    muscleMassDeltaKg: number | null
    leanMassDeltaKg: number | null
    fatMassDeltaKg: number | null
    physiqueAverageDelta: number | null
  }
}

function normalizeRecords(records: BodyLogRecord[]): BodyLogRecord[] {
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

function average(values: Array<number | null | undefined>): number | null {
  const present = values.filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value),
  )

  if (present.length === 0) return null
  return Number(
    (present.reduce((sum, value) => sum + value, 0) / present.length).toFixed(2),
  )
}

export function summarizeBodyLogContext(
  records: BodyLogRecord[] | null | undefined,
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
      muscleMassKg: latest.muscle_mass_kg ?? null,
      leanMassKg: latest.lean_mass_kg ?? null,
      fatMassKg: latest.fat_mass_kg ?? null,
      physiqueScores: {
        vTaper: latest.score_v_taper ?? null,
        chest: latest.score_chest ?? null,
        shoulders: latest.score_shoulders ?? null,
        abs: latest.score_abs ?? null,
        arms: latest.score_arms ?? null,
        back: latest.score_back ?? null,
        legs: latest.score_legs ?? null,
        average: average([
          latest.score_v_taper,
          latest.score_chest,
          latest.score_shoulders,
          latest.score_abs,
          latest.score_arms,
          latest.score_back,
          latest.score_legs,
        ]),
      },
      analysisSummary: latest.analysis_summary ?? null,
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
        muscleMassDeltaKg: diff(
          latest.muscle_mass_kg ?? null,
          oldest.muscle_mass_kg ?? null,
        ),
        leanMassDeltaKg: diff(
          latest.lean_mass_kg ?? null,
          oldest.lean_mass_kg ?? null,
        ),
        fatMassDeltaKg: diff(
          latest.fat_mass_kg ?? null,
          oldest.fat_mass_kg ?? null,
        ),
        physiqueAverageDelta: diff(
          average([
            latest.score_v_taper,
            latest.score_chest,
            latest.score_shoulders,
            latest.score_abs,
            latest.score_arms,
            latest.score_back,
            latest.score_legs,
          ]),
          average([
            oldest.score_v_taper,
            oldest.score_chest,
            oldest.score_shoulders,
            oldest.score_abs,
            oldest.score_arms,
            oldest.score_back,
            oldest.score_legs,
          ]),
        ),
      }
    }
  }

  return summary
}

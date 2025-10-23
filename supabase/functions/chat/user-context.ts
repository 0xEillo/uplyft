import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { summarizeBodyLogContext } from '../_shared/body-log-context.ts'

export type SupabaseClient = ReturnType<typeof createClient<'public'>>

export interface UserContextSummary {
  profile: {
    userTag: string
    displayName: string
    gender?: string | null
    heightCm?: number | null
    weightKg?: number | null
    goals?: string[] | null
    trainingYears?: string | null
  }
  totals: {
    totalVolumeAllTime: number
    sessionsCount: number
    firstSessionDate?: string
    lastSessionDate?: string
  }
  highlights: {
    topExercisesByMax?: {
      name: string
      estMax?: number
      bestSingle?: number
    }[]
    latestBodyLog?: {
      capturedAt: string
      weightKg: number | null
      bodyFatPercentage: number | null
      bmi: number | null
    }
    bodyLogTrend?: {
      spanDays: number
      weightDeltaKg: number | null
      bodyFatDelta: number | null
    }
  }
}

export async function buildUserContextSummary(
  userId: string,
  supabase: SupabaseClient,
): Promise<UserContextSummary> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    throw profileError || new Error('Profile not found')
  }

  const { data: sessionsData, error: sessionsError } = await supabase
    .from('workout_sessions')
    .select(
      `
      *,
      workout_exercises (
        *,
        exercise:exercises (*),
        sets (*)
      )
    `,
    )
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(50)

  if (sessionsError) throw sessionsError
  const sessions = sessionsData || []

  const sessionsCount = sessions.length
  const firstSessionDate =
    sessions.length > 0 ? sessions[sessions.length - 1].date : undefined
  const lastSessionDate = sessions.length > 0 ? sessions[0].date : undefined

  const { data: totalVolumeData, error: totalVolumeError } = await supabase
    .from('workout_sessions')
    .select(
      `
      workout_exercises (
        sets (reps, weight)
      )
    `,
    )
    .eq('user_id', userId)

  if (totalVolumeError) throw totalVolumeError

  let totalVolumeAllTime = 0
  ;(totalVolumeData as any[])?.forEach((session) => {
    session.workout_exercises?.forEach((we: any) => {
      we.sets?.forEach((s: any) => {
        if (s.reps && s.weight) totalVolumeAllTime += s.reps * s.weight
      })
    })
  })

  const exerciseToBest: Record<string, number> = {}
  sessions.forEach((session: any) => {
    session.workout_exercises?.forEach((we: any) => {
      const name = we.exercise?.name
      if (!name) return
      we.sets?.forEach((set: any) => {
        if (typeof set.weight === 'number') {
          if (!exerciseToBest[name] || set.weight > exerciseToBest[name]) {
            exerciseToBest[name] = set.weight
          }
        }
      })
    })
  })

  const topExercisesByMax = Object.entries(exerciseToBest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, bestSingle]) => ({ name, bestSingle }))

  const { data: bodyLogData, error: bodyLogError } = await supabase
    .from('body_log_images')
    .select(
      `
      id,
      created_at,
      weight_kg,
      body_fat_percentage,
      bmi
    `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (bodyLogError) throw bodyLogError

  const bodyLogSummary = summarizeBodyLogContext(bodyLogData || [])

  return {
    profile: {
      userTag: profile.user_tag,
      displayName: profile.display_name,
      gender: profile.gender,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      goals: profile.goals,
      trainingYears: profile.training_years,
    },
    totals: {
      totalVolumeAllTime: Math.round(totalVolumeAllTime || 0),
      sessionsCount,
      firstSessionDate,
      lastSessionDate,
    },
    highlights: {
      topExercisesByMax,
      latestBodyLog: bodyLogSummary?.latest,
      bodyLogTrend: bodyLogSummary?.trend,
    },
  }
}

export function userContextToPrompt(ctx: UserContextSummary): string {
  const lines: string[] = []
  lines.push(`User: ${ctx.profile.displayName} (@${ctx.profile.userTag})`)

  const personalInfo: string[] = []
  if (ctx.profile.gender) personalInfo.push(`gender=${ctx.profile.gender}`)
  if (ctx.profile.heightCm) personalInfo.push(`height=${ctx.profile.heightCm}cm`)
  if (ctx.profile.weightKg) personalInfo.push(`weight=${ctx.profile.weightKg}kg`)
  if (ctx.profile.goals?.length)
    personalInfo.push(
      `goals=${ctx.profile.goals.map((g) => g.replace('_', ' ')).join(', ')}`,
    )
  if (ctx.profile.trainingYears)
    personalInfo.push(
      `training_years=${ctx.profile.trainingYears.replace('_', ' ')}`,
    )
  if (personalInfo.length > 0) {
    lines.push(`Personal info: ${personalInfo.join(', ')}`)
  }

  lines.push(
    `Training summary: sessions=${ctx.totals.sessionsCount}, total_volume=${ctx.totals.totalVolumeAllTime} kg·reps`,
  )
  if (ctx.totals.firstSessionDate || ctx.totals.lastSessionDate) {
    lines.push(
      `Active from ${ctx.totals.firstSessionDate || 'N/A'} to ${
        ctx.totals.lastSessionDate || 'N/A'
      }`,
    )
  }

  if (ctx.highlights.topExercisesByMax?.length) {
    lines.push(
      'Top exercises (best single weight): ' +
        ctx.highlights.topExercisesByMax
          .map((e) => `${e.name}: ${e.bestSingle ?? 'N/A'} kg`)
          .join('; '),
    )
  }

  if (ctx.highlights.latestBodyLog) {
    const latest = ctx.highlights.latestBodyLog
    const metrics: string[] = []
    if (typeof latest.weightKg === 'number') {
      metrics.push(`weight=${latest.weightKg.toFixed(1)}kg`)
    }
    if (typeof latest.bodyFatPercentage === 'number') {
      metrics.push(`body_fat=${latest.bodyFatPercentage.toFixed(1)}%`)
    }
    if (typeof latest.bmi === 'number') {
      metrics.push(`bmi=${latest.bmi.toFixed(1)}`)
    }
    lines.push(
      `Latest body scan (${new Date(latest.capturedAt).toISOString()}): ${
        metrics.length > 0 ? metrics.join(', ') : 'metrics unavailable'
      }`,
    )
  }

  if (ctx.highlights.bodyLogTrend) {
    const trend = ctx.highlights.bodyLogTrend
    const parts: string[] = []
    if (typeof trend.weightDeltaKg === 'number') {
      parts.push(`weight_delta=${trend.weightDeltaKg.toFixed(1)}kg`)
    }
    if (typeof trend.bodyFatDelta === 'number') {
      parts.push(`bodyfat_delta=${trend.bodyFatDelta.toFixed(1)}%`)
    }

    if (parts.length > 0) {
      lines.push(`Body scan trend (last ${trend.spanDays}d): ${parts.join(', ')}`)
    }
  }

  return lines.join('\n')
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { summarizeBodyLogContext } from '../_shared/body-log-context.ts'
import type {
  ExercisePercentileResult,
  MuscleGroupDistribution,
  StrengthScorePoint,
  StrengthSeries,
} from '../_shared/stats.ts'
import {
  getExercisePercentile,
  getMuscleGroupDistribution,
  getStrengthScoreProgress,
  getTopExercisesByEstimated1RM,
} from '../_shared/stats.ts'

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
    bio?: string | null
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
  strength?: {
    topByEst1RM?: StrengthSeries[]
    strengthScore?: StrengthScorePoint[]
  }
  balance?: MuscleGroupDistribution | null
  leaderboard?: {
    best?: {
      exerciseName: string
      percentile: number | null
      userMax1RM: number | null
      genderPercentile?: number | null
      genderWeightPercentile?: number | null
    }
    weakest?: {
      exerciseName: string
      percentile: number | null
      userMax1RM: number | null
      genderPercentile?: number | null
      genderWeightPercentile?: number | null
    }
  }
  routines?: {
    id: string
    name: string
    notes?: string | null
    exerciseCount: number
    lastUsedAt?: string
    lastSessionId?: string
  }[]
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

  const routineUsage = new Map<
    string,
    {
      lastUsedAt?: string
      lastSessionId?: string
    }
  >()

  const normalizeDate = (value: string | null | undefined) => {
    if (!value) return undefined
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }

  sessions.forEach((session: any) => {
    const routineId = session.routine_id
    if (!routineId) return

    const sessionDate = normalizeDate(session.date ?? session.created_at)
    const existing = routineUsage.get(routineId)

    if (!existing) {
      routineUsage.set(routineId, {
        lastUsedAt: sessionDate,
        lastSessionId: session.id,
      })
      return
    }

    if (sessionDate && (!existing.lastUsedAt || sessionDate > existing.lastUsedAt)) {
      routineUsage.set(routineId, {
        lastUsedAt: sessionDate,
        lastSessionId: session.id,
      })
    }
  })

  const { data: routinesData, error: routinesError } = await supabase
    .from('workout_routines')
    .select(
      `
      id,
      name,
      notes,
      updated_at,
      workout_routine_exercises (id)
    `,
    )
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (routinesError) throw routinesError

  const routinesSummary = (routinesData || []).map((routine: any) => {
    const usage = routineUsage.get(routine.id)
    return {
      id: routine.id,
      name: routine.name,
      notes: routine.notes,
      exerciseCount: routine.workout_routine_exercises?.length ?? 0,
      lastUsedAt: usage?.lastUsedAt,
      lastSessionId: usage?.lastSessionId,
    }
  })

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
    .from('body_log_entries')
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

  const [topEst1RMSeries, strengthScoreSeries, balanceDistribution] = await Promise.all([
    getTopExercisesByEstimated1RM(supabase, userId, { limit: 3, daysBack: 120 }),
    getStrengthScoreProgress(supabase, userId, { daysBack: 120 }),
    getMuscleGroupDistribution(supabase, userId, { daysBack: 60 }),
  ])

  const percentileCandidates = topEst1RMSeries.slice(0, 3)
  const percentileResults: ExercisePercentileResult[] = []
  for (const series of percentileCandidates) {
    const result = await getExercisePercentile(supabase, userId, series.exerciseName)
    if (result && typeof result.percentile === 'number' && result.totalUsers >= 3) {
      percentileResults.push(result)
    }
  }

  const sortedPercentiles = percentileResults
    .slice()
    .sort((a, b) => (b.percentile ?? -1) - (a.percentile ?? -1))

  const bestPercentile = sortedPercentiles[0]
  const weakestPercentile = sortedPercentiles
    .slice()
    .sort((a, b) => (a.percentile ?? 101) - (b.percentile ?? 101))[0]

  return {
    profile: {
      userTag: profile.user_tag,
      displayName: profile.display_name,
      gender: profile.gender,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      goals: profile.goals,
      trainingYears: profile.training_years,
      bio: profile.bio,
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
    strength: {
      topByEst1RM: topEst1RMSeries,
      strengthScore: strengthScoreSeries,
    },
    balance: balanceDistribution,
    routines: routinesSummary.length ? routinesSummary : undefined,
    leaderboard:
      bestPercentile || weakestPercentile
        ? {
            best: bestPercentile
              ? {
                  exerciseName: bestPercentile.exerciseName,
                  percentile: bestPercentile.percentile,
                  userMax1RM: bestPercentile.userMax1RM,
                  genderPercentile: bestPercentile.genderPercentile ?? null,
                  genderWeightPercentile:
                    bestPercentile.genderWeightPercentile ?? null,
                }
              : undefined,
            weakest: weakestPercentile
              ? {
                  exerciseName: weakestPercentile.exerciseName,
                  percentile: weakestPercentile.percentile,
                  userMax1RM: weakestPercentile.userMax1RM,
                  genderPercentile: weakestPercentile.genderPercentile ?? null,
                  genderWeightPercentile:
                    weakestPercentile.genderWeightPercentile ?? null,
                }
              : undefined,
          }
        : undefined,
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

  if (ctx.profile.bio?.trim()) {
    lines.push(`AI Context: ${ctx.profile.bio.trim()}`)
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

  if (ctx.strength?.topByEst1RM?.length) {
    const topLiftSummaries = ctx.strength.topByEst1RM.map((lift) => {
      const lastPoint = lift.series[lift.series.length - 1]
      if (!lastPoint) return `${lift.exerciseName}: no data`
      return `${lift.exerciseName}: est1RM=${lastPoint.est1RM.toFixed(1)}kg`
    })
    lines.push('Strength (estimated 1RM): ' + topLiftSummaries.join('; '))
  }

  if (ctx.strength?.strengthScore?.length) {
    const latestScore = ctx.strength.strengthScore[ctx.strength.strengthScore.length - 1]
    if (latestScore) {
      lines.push(`Strength score: ${latestScore.strengthScore} (running sum of best est 1RMs)`)
    }
  }

  if (ctx.balance?.distribution?.length) {
    const topGroups = ctx.balance.distribution.slice(0, 3)
    const summary = topGroups
      .map((item) => `${item.muscleGroup}: ${item.percentage}%`)
      .join('; ')
    lines.push(`Muscle balance (last 60d): ${summary}`)

    const undertrained = ctx.balance.distribution
      .filter((item) => item.percentage < 10)
      .map((item) => item.muscleGroup)
    if (undertrained.length) {
      lines.push(`Undertrained groups (<10% volume): ${undertrained.join(', ')}`)
    }
  }

  if (ctx.routines?.length) {
    const routineSummaries = ctx.routines.slice(0, 5).map((routine) => {
      const parts = [`${routine.name} (${routine.exerciseCount} exercises)`]
      if (routine.lastUsedAt) {
        parts.push(`last used ${new Date(routine.lastUsedAt).toISOString()}`)
      }
      return parts.join('; ')
    })

    lines.push(`Routines: ${routineSummaries.join(' | ')}`)
  }

  if (ctx.leaderboard?.best) {
    const best = ctx.leaderboard.best
    const weakest = ctx.leaderboard.weakest
    const parts: string[] = []
    if (best && typeof best.percentile === 'number') {
      parts.push(
        `${best.exerciseName}: ${best.percentile.toFixed(1)}th pct (${best.userMax1RM ?? 'N/A'} est 1RM)`,
      )
    }
    if (
      weakest &&
      weakest !== best &&
      typeof weakest.percentile === 'number' &&
      weakest.percentile < (best?.percentile ?? 101)
    ) {
      parts.push(
        `${weakest.exerciseName}: ${weakest.percentile.toFixed(1)}th pct (${weakest.userMax1RM ?? 'N/A'} est 1RM)`,
      )
    }
    if (parts.length) {
      lines.push(`Leaderboards: ${parts.join(' | ')}`)
    }
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

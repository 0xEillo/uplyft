import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { summarizeBodyLogContext } from '../_shared/body-log-context.ts'
import type {
  AdherenceSummary,
  RecoverySummary,
} from '../_shared/readiness.ts'
import {
  buildAdherenceSummary,
  buildRecoverySummary,
} from '../_shared/readiness.ts'
import type {
  MuscleGroupDistribution,
  StrengthSeries,
} from '../_shared/stats.ts'
import {
  getMuscleGroupDistribution,
  getTopExercisesByEstimated1RM,
} from '../_shared/stats.ts'
import { buildUserStrengthProfile } from '../_shared/strength.ts'

export type SupabaseClient = ReturnType<typeof createClient<'public'>>

export interface TrainingPatternsSummary {
  sessionsAnalyzed: number
  averageExercisesPerSession: number
  averageWorkingSetsPerSession: number
  averageWorkingSetsPerExercise: number
  averageRepsPerSet: number | null
  repRangeShare: {
    reps_1_5: number
    reps_6_8: number
    reps_9_12: number
    reps_13_20: number
    reps_21_plus: number
  }
  muscleGroups: {
    muscleGroup: string
    averageExercisesPerSession: number
    averageWorkingSetsPerSession: number
    averageRepsPerSet: number | null
  }[]
}

export interface UserContextSummary {
  profile: {
    userTag: string
    displayName: string
    gender?: string | null
    heightCm?: number | null
    weightKg?: number | null
    age?: number | null
    goals?: string[] | null
    commitment?: string[] | null
    trainingYears?: string | null
    bio?: string | null
  }
  totals: {
    totalVolumeAllTime: number
    sessionsCount: number
    firstSessionDate?: string
    lastSessionDate?: string
  }
  trainingPatterns?: TrainingPatternsSummary | null
  recentWorkouts?: {
    id: string
    performedAt: string | null
    type: string | null
    routineName?: string | null
    exercises: {
      name: string
      sets: {
        setNumber?: number | null
        reps?: number | null
        weightKg?: number | null
        rpe?: number | null
      }[]
      omittedSetCount?: number
    }[]
    omittedExerciseCount?: number
  }[]
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
    bodyLogTrend?: {
      spanDays: number
      weightDeltaKg: number | null
      bodyFatDelta: number | null
      muscleMassDeltaKg: number | null
      leanMassDeltaKg: number | null
      fatMassDeltaKg: number | null
      physiqueAverageDelta: number | null
    }
  }
  strength?: {
    topByEst1RM?: StrengthSeries[]
  }
  standards?: {
    overallLevel?: {
      level: string
      nextLevel: string | null
      progress: number
      points: number
      maxPoints: number
      trackedExercises: number
      weakestGroup: string | null
    }
    closestUpgrades?: {
      exerciseName: string
      level: string
      nextLevel: string | null
      progress: number
      gapToNextLevel: number | null
      targetValue: number | null
      targetMetric: 'estimated_1rm_kg' | 'reps'
    }[]
  }
  balance?: MuscleGroupDistribution | null
  recovery?: RecoverySummary | null
  adherence?: AdherenceSummary | null
  routines?: {
    id: string
    name: string
    notes?: string | null
    exerciseCount: number
    lastUsedAt?: string
    lastSessionId?: string
  }[]
}

function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function summarizeTrainingPatterns(
  sessions: any[] | null | undefined,
  options: { maxSessions?: number } = {},
): TrainingPatternsSummary | null {
  const maxSessions = Math.min(Math.max(options.maxSessions ?? 8, 1), 20)
  const analyzedSessions = (sessions || []).slice(0, maxSessions)

  if (analyzedSessions.length === 0) {
    return null
  }

  let totalExercises = 0
  let totalWorkingSets = 0
  let totalReps = 0
  let countedRepSets = 0

  const repBuckets = {
    reps_1_5: 0,
    reps_6_8: 0,
    reps_9_12: 0,
    reps_13_20: 0,
    reps_21_plus: 0,
  }

  const muscleGroupMap = new Map<
    string,
    {
      exerciseCount: number
      workingSets: number
      totalReps: number
      countedRepSets: number
    }
  >()

  analyzedSessions.forEach((session) => {
    ;(session.workout_exercises || []).forEach((exercise: any) => {
      const workingSets = (exercise.sets || []).filter((set: any) => {
        if (set.is_warmup === true) return false
        return typeof set.reps === 'number' && set.reps > 0
      })

      if (workingSets.length === 0) return

      totalExercises += 1
      totalWorkingSets += workingSets.length

      const muscleGroup = exercise.exercise?.muscle_group
      if (typeof muscleGroup === 'string' && muscleGroup.trim()) {
        const existing = muscleGroupMap.get(muscleGroup) ?? {
          exerciseCount: 0,
          workingSets: 0,
          totalReps: 0,
          countedRepSets: 0,
        }

        existing.exerciseCount += 1
        existing.workingSets += workingSets.length

        workingSets.forEach((set: any) => {
          const reps = set.reps as number
          existing.totalReps += reps
          existing.countedRepSets += 1
        })

        muscleGroupMap.set(muscleGroup, existing)
      }

      workingSets.forEach((set: any) => {
        const reps = set.reps as number
        totalReps += reps
        countedRepSets += 1

        if (reps <= 5) {
          repBuckets.reps_1_5 += 1
        } else if (reps <= 8) {
          repBuckets.reps_6_8 += 1
        } else if (reps <= 12) {
          repBuckets.reps_9_12 += 1
        } else if (reps <= 20) {
          repBuckets.reps_13_20 += 1
        } else {
          repBuckets.reps_21_plus += 1
        }
      })
    })
  })

  const sessionCount = analyzedSessions.length
  const muscleGroups = Array.from(muscleGroupMap.entries())
    .map(([muscleGroup, stats]) => ({
      muscleGroup,
      averageExercisesPerSession: roundTo(stats.exerciseCount / sessionCount),
      averageWorkingSetsPerSession: roundTo(stats.workingSets / sessionCount),
      averageRepsPerSet:
        stats.countedRepSets > 0
          ? roundTo(stats.totalReps / stats.countedRepSets)
          : null,
    }))
    .sort((left, right) => {
      if (
        right.averageWorkingSetsPerSession !== left.averageWorkingSetsPerSession
      ) {
        return (
          right.averageWorkingSetsPerSession -
          left.averageWorkingSetsPerSession
        )
      }

      return right.averageExercisesPerSession - left.averageExercisesPerSession
    })

  const repSetTotal = Object.values(repBuckets).reduce((sum, value) => sum + value, 0)
  const repRangeShare =
    repSetTotal > 0
      ? {
          reps_1_5: roundTo((repBuckets.reps_1_5 / repSetTotal) * 100),
          reps_6_8: roundTo((repBuckets.reps_6_8 / repSetTotal) * 100),
          reps_9_12: roundTo((repBuckets.reps_9_12 / repSetTotal) * 100),
          reps_13_20: roundTo((repBuckets.reps_13_20 / repSetTotal) * 100),
          reps_21_plus: roundTo((repBuckets.reps_21_plus / repSetTotal) * 100),
        }
      : repBuckets

  return {
    sessionsAnalyzed: sessionCount,
    averageExercisesPerSession:
      sessionCount > 0 ? roundTo(totalExercises / sessionCount) : 0,
    averageWorkingSetsPerSession:
      sessionCount > 0 ? roundTo(totalWorkingSets / sessionCount) : 0,
    averageWorkingSetsPerExercise:
      totalExercises > 0 ? roundTo(totalWorkingSets / totalExercises) : 0,
    averageRepsPerSet:
      countedRepSets > 0 ? roundTo(totalReps / countedRepSets) : null,
    repRangeShare,
    muscleGroups,
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

  const routineNameById = new Map<string, string>()
  routinesSummary.forEach((routine) => {
    routineNameById.set(routine.id, routine.name)
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
        const reps = s.reps || 0
        if (!reps) return

        const weight =
          typeof s.weight === 'number' && s.weight > 0 ? s.weight : 1

        totalVolumeAllTime += reps * weight
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
      bmi,
      muscle_mass_kg,
      lean_mass_kg,
      fat_mass_kg,
      score_v_taper,
      score_chest,
      score_shoulders,
      score_abs,
      score_arms,
      score_back,
      score_legs,
      analysis_summary
    `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (bodyLogError) throw bodyLogError

  const bodyLogSummary = summarizeBodyLogContext(bodyLogData || [])

  const [
    topEst1RMSeries,
    strengthProfile,
    balanceDistribution,
    recoverySummary,
    adherenceSummary,
  ] = await Promise.all([
    getTopExercisesByEstimated1RM(supabase, userId, { limit: 3, daysBack: 120 }),
    buildUserStrengthProfile(supabase, userId),
    getMuscleGroupDistribution(supabase, userId, { daysBack: 60 }),
    buildRecoverySummary(supabase, userId),
    buildAdherenceSummary(supabase, userId, profile.commitment),
  ])
  const closestUpgrades = strengthProfile.exerciseRanks
    .filter(
      (exercise) =>
        exercise.nextLevel !== null &&
        exercise.gapToNextLevel !== null &&
        exercise.targetValue !== null,
    )
    .slice()
    .sort((left, right) => {
      const leftGap = left.gapToNextLevel ?? Number.POSITIVE_INFINITY
      const rightGap = right.gapToNextLevel ?? Number.POSITIVE_INFINITY

      if (leftGap !== rightGap) return leftGap - rightGap
      if (right.progress !== left.progress) return right.progress - left.progress
      return right.scorePoints - left.scorePoints
    })
    .slice(0, 3)
  const trainingPatterns = summarizeTrainingPatterns(sessions, {
    maxSessions: 8,
  })

  const recentWorkouts = sessions.slice(0, 3).map((session: any) => {
    const exercises = (session.workout_exercises || [])
      .slice()
      .sort((left: any, right: any) => {
        const leftOrder = left.order_index ?? Number.MAX_SAFE_INTEGER
        const rightOrder = right.order_index ?? Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder
      })
      .slice(0, 6)
      .map((exercise: any) => {
        const orderedSets = (exercise.sets || [])
          .filter(
            (set: any) =>
              typeof set.reps === 'number' || typeof set.weight === 'number',
          )
          .slice()
          .sort((left: any, right: any) => {
            const leftOrder = left.set_number ?? Number.MAX_SAFE_INTEGER
            const rightOrder = right.set_number ?? Number.MAX_SAFE_INTEGER
            return leftOrder - rightOrder
          })

        const visibleSets = orderedSets.slice(0, 5).map((set: any) => ({
          setNumber: set.set_number ?? null,
          reps: set.reps ?? null,
          weightKg: set.weight ?? null,
          rpe: set.rpe ?? null,
        }))

        return {
          name: exercise.exercise?.name || 'Unknown Exercise',
          sets: visibleSets,
          omittedSetCount: Math.max(0, orderedSets.length - visibleSets.length) || undefined,
        }
      })

    return {
      id: session.id,
      performedAt: normalizeDate(session.date ?? session.created_at) ?? null,
      type: session.type ?? null,
      routineName: session.routine_id ? routineNameById.get(session.routine_id) : undefined,
      exercises,
      omittedExerciseCount:
        Math.max(0, (session.workout_exercises?.length ?? 0) - exercises.length) ||
        undefined,
    }
  })

  return {
    profile: {
      userTag: profile.user_tag,
      displayName: profile.display_name,
      gender: profile.gender,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      age: profile.age,
      goals: profile.goals,
      commitment: profile.commitment,
      trainingYears: profile.training_years,
      bio: profile.bio,
    },
    totals: {
      totalVolumeAllTime: Math.round(totalVolumeAllTime || 0),
      sessionsCount,
      firstSessionDate,
      lastSessionDate,
    },
    trainingPatterns,
    recentWorkouts,
    highlights: {
      topExercisesByMax,
      latestBodyLog: bodyLogSummary?.latest,
      bodyLogTrend: bodyLogSummary?.trend,
    },
    strength: {
      topByEst1RM: topEst1RMSeries,
    },
    standards:
      strengthProfile.overallLevel || closestUpgrades.length > 0
        ? {
            overallLevel: strengthProfile.overallLevel
              ? {
                  level: strengthProfile.overallLevel.level,
                  nextLevel: strengthProfile.overallLevel.nextLevel,
                  progress: strengthProfile.overallLevel.progress,
                  points: strengthProfile.overallLevel.points,
                  maxPoints: strengthProfile.overallLevel.maxPoints,
                  trackedExercises: strengthProfile.exerciseRanks.length,
                  weakestGroup: strengthProfile.overallLevel.weakestGroup,
                }
              : undefined,
            closestUpgrades: closestUpgrades.map((exercise) => ({
              exerciseName: exercise.exerciseName,
              level: exercise.level,
              nextLevel: exercise.nextLevel,
              progress: exercise.progress,
              gapToNextLevel: exercise.gapToNextLevel,
              targetValue: exercise.targetValue,
              targetMetric: exercise.targetMetric,
            })),
          }
        : undefined,
    balance: balanceDistribution,
    recovery: recoverySummary,
    adherence: adherenceSummary,
    routines: routinesSummary.length ? routinesSummary : undefined,
  }
}

export function userContextToPrompt(ctx: UserContextSummary): string {
  const lines: string[] = []
  lines.push(`User: ${ctx.profile.displayName} (@${ctx.profile.userTag})`)

  const personalInfo: string[] = []
  if (ctx.profile.gender) personalInfo.push(`gender=${ctx.profile.gender}`)
  if (ctx.profile.heightCm) personalInfo.push(`height=${ctx.profile.heightCm}cm`)
  if (ctx.profile.weightKg) personalInfo.push(`weight=${ctx.profile.weightKg}kg`)
  if (ctx.profile.age) personalInfo.push(`age=${ctx.profile.age}`)
  if (ctx.profile.goals?.length)
    personalInfo.push(
      `goals=${ctx.profile.goals.map((g) => g.replace('_', ' ')).join(', ')}`,
    )
  if (ctx.profile.commitment?.length)
    personalInfo.push(`commitment=${ctx.profile.commitment.join(', ')}`)
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

  if (ctx.trainingPatterns) {
    const patterns = ctx.trainingPatterns
    lines.push(
      `Training style (last ${patterns.sessionsAnalyzed} sessions): avg_exercises_per_session=${patterns.averageExercisesPerSession}, avg_working_sets_per_session=${patterns.averageWorkingSetsPerSession}, avg_working_sets_per_exercise=${patterns.averageWorkingSetsPerExercise}${
        typeof patterns.averageRepsPerSet === 'number'
          ? `, avg_reps_per_set=${patterns.averageRepsPerSet}`
          : ''
      }`,
    )

    lines.push(
      `Rep range distribution: 1-5=${patterns.repRangeShare.reps_1_5}%, 6-8=${patterns.repRangeShare.reps_6_8}%, 9-12=${patterns.repRangeShare.reps_9_12}%, 13-20=${patterns.repRangeShare.reps_13_20}%, 21+=${patterns.repRangeShare.reps_21_plus}%`,
    )

    if (patterns.muscleGroups.length) {
      lines.push(
        'Per-session muscle group volume: ' +
          patterns.muscleGroups
            .slice(0, 6)
            .map((group) => {
              const parts = [
                `${group.muscleGroup}: ${group.averageExercisesPerSession} exercises/session`,
                `${group.averageWorkingSetsPerSession} working sets/session`,
              ]

              if (typeof group.averageRepsPerSet === 'number') {
                parts.push(`avg reps ${group.averageRepsPerSet}`)
              }

              return parts.join(', ')
            })
            .join('; '),
      )
    }
  }

  if (ctx.recentWorkouts?.length) {
    lines.push('Recent workouts:')
    ctx.recentWorkouts.forEach((workout) => {
      const workoutHeader = [
        workout.performedAt ? new Date(workout.performedAt).toISOString() : 'Unknown date',
        workout.type ? `type=${workout.type}` : null,
        workout.routineName ? `routine=${workout.routineName}` : null,
      ]
        .filter(Boolean)
        .join(', ')

      lines.push(`- ${workoutHeader}`)

      workout.exercises.forEach((exercise) => {
        const setSummary = exercise.sets
          .map((set) => {
            const repsPart =
              typeof set.reps === 'number' ? `${set.reps}` : '?'
            const weightPart =
              typeof set.weightKg === 'number'
                ? `${Number.isInteger(set.weightKg) ? set.weightKg.toFixed(0) : set.weightKg.toFixed(1)}kg x ${repsPart}`
                : `${repsPart} reps`
            const rpePart =
              typeof set.rpe === 'number' ? ` @RPE${set.rpe}` : ''
            return `${weightPart}${rpePart}`
          })
          .join(', ')

        const suffix =
          typeof exercise.omittedSetCount === 'number' && exercise.omittedSetCount > 0
            ? ` (+${exercise.omittedSetCount} more sets)`
            : ''

        lines.push(`  ${exercise.name}: ${setSummary || 'no set data'}${suffix}`)
      })

      if (
        typeof workout.omittedExerciseCount === 'number' &&
        workout.omittedExerciseCount > 0
      ) {
        lines.push(`  +${workout.omittedExerciseCount} more exercises`)
      }
    })
  }

  if (ctx.strength?.topByEst1RM?.length) {
    const topLiftSummaries = ctx.strength.topByEst1RM.map((lift) => {
      const lastPoint = lift.series[lift.series.length - 1]
      if (!lastPoint) return `${lift.exerciseName}: no data`
      return `${lift.exerciseName}: est1RM=${lastPoint.est1RM.toFixed(1)}kg`
    })
    lines.push('Strength (estimated 1RM): ' + topLiftSummaries.join('; '))
  }

  if (ctx.standards?.overallLevel) {
    const overall = ctx.standards.overallLevel
    const parts = [
      `overall=${overall.level}`,
      `points=${overall.points}/${overall.maxPoints}`,
      `tracked_lifts=${overall.trackedExercises}`,
    ]

    if (overall.nextLevel) {
      parts.push(`next=${overall.nextLevel}`)
      parts.push(`progress=${overall.progress.toFixed(1)}%`)
    }

    if (overall.weakestGroup) {
      parts.push(`weakest_group=${overall.weakestGroup}`)
    }

    lines.push(`Strength standards: ${parts.join(', ')}`)
  }

  if (ctx.standards?.closestUpgrades?.length) {
    const upgrades = ctx.standards.closestUpgrades.map((exercise) => {
      const parts = [`${exercise.exerciseName}: ${exercise.level}`]
      if (exercise.nextLevel) {
        parts.push(`to ${exercise.nextLevel}`)
      }
      if (typeof exercise.gapToNextLevel === 'number') {
        const unit =
          exercise.targetMetric === 'reps' ? 'reps' : 'kg est1RM'
        parts.push(`${exercise.gapToNextLevel} ${unit} remaining`)
      }
      return parts.join(' ')
    })

    lines.push(`Closest standards upgrades: ${upgrades.join('; ')}`)
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

  if (ctx.adherence) {
    const adherenceParts: string[] = []
    adherenceParts.push(`streak=${ctx.adherence.currentStreakWeeks} weeks`)
    adherenceParts.push(
      `this_week=${ctx.adherence.workoutsThisWeek}/${ctx.adherence.weeklyTarget}`,
    )
    adherenceParts.push(`status=${ctx.adherence.adherenceStatus}`)
    adherenceParts.push(
      `avg_last_${ctx.adherence.evaluatedWeeks}_weeks=${ctx.adherence.recentAverageWorkoutsPerWeek}`,
    )

    if (typeof ctx.adherence.daysSinceLastWorkout === 'number') {
      adherenceParts.push(
        `days_since_last_workout=${ctx.adherence.daysSinceLastWorkout}`,
      )
    }

    if (ctx.adherence.hotStreak) {
      adherenceParts.push('hot_streak=true')
    }

    lines.push(`Consistency: ${adherenceParts.join(', ')}`)
  }

  if (ctx.recovery) {
    const leastRecovered = ctx.recovery.muscleRecovery
      .filter(
        (entry) =>
          entry.recoveryStatus === 'not_recovered' ||
          entry.recoveryStatus === 'recovering',
      )
      .slice(0, 3)
      .map(
        (entry) =>
          `${entry.muscleGroup}: ${entry.recoveryPercentage}% (${entry.recoveryStatus})`,
      )

    const recoveryParts = [
      `${ctx.recovery.freshMuscleGroups}/${ctx.recovery.totalMuscleGroups} muscle groups fresh`,
    ]

    if (typeof ctx.recovery.daysSinceLastWorkout === 'number') {
      recoveryParts.push(
        `days_since_last_workout=${ctx.recovery.daysSinceLastWorkout}`,
      )
    }

    if (leastRecovered.length > 0) {
      recoveryParts.push(`least_recovered=${leastRecovered.join('; ')}`)
    }

    lines.push(`Recovery: ${recoveryParts.join(', ')}`)
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
    if (typeof latest.leanMassKg === 'number') {
      metrics.push(`lean_mass=${latest.leanMassKg.toFixed(1)}kg`)
    }
    if (typeof latest.fatMassKg === 'number') {
      metrics.push(`fat_mass=${latest.fatMassKg.toFixed(1)}kg`)
    }
    if (typeof latest.muscleMassKg === 'number') {
      metrics.push(`muscle_mass=${latest.muscleMassKg.toFixed(1)}kg`)
    }
    if (typeof latest.physiqueScores.average === 'number') {
      metrics.push(`physique_avg=${latest.physiqueScores.average.toFixed(1)}/100`)
    }
    lines.push(
      `Latest body scan (${new Date(latest.capturedAt).toISOString()}): ${
        metrics.length > 0 ? metrics.join(', ') : 'metrics unavailable'
      }`,
    )
    const topPhysiqueAreas = [
      ['shoulders', latest.physiqueScores.shoulders],
      ['back', latest.physiqueScores.back],
      ['chest', latest.physiqueScores.chest],
      ['arms', latest.physiqueScores.arms],
      ['legs', latest.physiqueScores.legs],
      ['abs', latest.physiqueScores.abs],
      ['v_taper', latest.physiqueScores.vTaper],
    ]
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([label, value]) => `${label}=${value}`)

    if (topPhysiqueAreas.length > 0) {
      lines.push(`Physique strengths: ${topPhysiqueAreas.join(', ')}`)
    }

    if (latest.analysisSummary?.trim()) {
      lines.push(`Latest physique note: ${latest.analysisSummary.trim()}`)
    }
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
    if (typeof trend.leanMassDeltaKg === 'number') {
      parts.push(`lean_mass_delta=${trend.leanMassDeltaKg.toFixed(1)}kg`)
    }
    if (typeof trend.fatMassDeltaKg === 'number') {
      parts.push(`fat_mass_delta=${trend.fatMassDeltaKg.toFixed(1)}kg`)
    }
    if (typeof trend.muscleMassDeltaKg === 'number') {
      parts.push(`muscle_mass_delta=${trend.muscleMassDeltaKg.toFixed(1)}kg`)
    }
    if (typeof trend.physiqueAverageDelta === 'number') {
      parts.push(`physique_avg_delta=${trend.physiqueAverageDelta.toFixed(1)}`)
    }

    if (parts.length > 0) {
      lines.push(`Body scan trend (last ${trend.spanDays}d): ${parts.join(', ')}`)
    }
  }

  return lines.join('\n')
}

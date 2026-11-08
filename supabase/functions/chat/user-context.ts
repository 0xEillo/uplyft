// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import {
  summarizeBodyLogContext,
  type BodyLogContextSummary,
} from '../_shared/body-log-context.ts'
import { formatCommitmentSummary } from '../_shared/commitment.ts'
import { getLatestDailyWeightKg } from '../_shared/daily-weight.ts'
import { buildUserStrengthProfile } from '../_shared/strength.ts'
import {
  formatSession,
  SESSION_SELECT,
  toDay,
  type SessionRow,
} from './tools/shared.ts'

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
    experienceLevel?: string | null
    commitment?: string[] | null
    commitmentFrequency?: string | null
    trainingYears?: string | null
    bio?: string | null
  }
  history: {
    sessionsCount: number
    firstSessionDate: string | null
    lastSessionDate: string | null
  }
  trainingPatterns?: TrainingPatternsSummary | null
  recentWorkouts: ReturnType<typeof formatSession>[]
  strength?: {
    level: string
    nextLevel: string | null
    progress: number
    points: number
    maxPoints: number
    trackedLifts: number
    weakestGroup: string | null
    topLifts: string[]
    closestUpgrades: string[]
  } | null
  strengthUnavailable?: string[]
  plans: {
    programs: { name: string; routines: string[] }[]
    routines: string[]
  }
  body?: BodyLogContextSummary | null
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

/**
 * The user snapshot that leads every conversation. It must be deterministic
 * for the same data (no "days ago", no time windows relative to now) so it
 * stays byte-identical, and cached, until the user logs something. Anything
 * time-relative (recovery, weekly pace) is left to tools.
 */
export async function buildUserContextSummary(
  userId: string,
  supabase: SupabaseClient,
): Promise<UserContextSummary> {
  const db = supabase as any
  const [
    profileResult,
    latestWeightKg,
    recentResult,
    countResult,
    firstResult,
    programsResult,
    routinesResult,
    scansResult,
    strengthProfile,
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    getLatestDailyWeightKg(supabase, userId),
    db
      .from('workout_sessions')
      .select(SESSION_SELECT)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(8),
    db.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db
      .from('workout_sessions')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(1),
    db
      .from('user_programs')
      .select('id, name')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true }),
    db
      .from('workout_routines')
      .select('id, name, program_id')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true }),
    db
      .from('body_log_entries')
      .select(
        'id, created_at, weight_kg, body_fat_percentage, bmi, muscle_mass_kg, lean_mass_kg, fat_mass_kg, score_v_taper, score_chest, score_shoulders, score_abs, score_arms, score_back, score_legs, analysis_summary',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
    buildUserStrengthProfile(supabase, userId),
  ])

  const profile = profileResult.data
  if (profileResult.error || !profile) {
    throw profileResult.error || new Error('Profile not found')
  }
  for (const result of [recentResult, countResult, firstResult, programsResult, routinesResult, scansResult]) {
    if (result.error) throw result.error
  }

  const routines = (routinesResult.data ?? []) as { id: string; name: string; program_id: string | null }[]
  const routineNames = new Map(routines.map((routine) => [routine.id, routine.name]))
  const sessions = (recentResult.data ?? []) as SessionRow[]

  const overall = strengthProfile.overallLevel
  const ranks = strengthProfile.exerciseRanks
  const unit = (metric: string) => (metric === 'reps' ? 'reps' : 'kg e1RM')

  return {
    profile: {
      userTag: profile.user_tag,
      displayName: profile.display_name,
      gender: profile.gender,
      heightCm: profile.height_cm,
      weightKg: latestWeightKg,
      age: profile.age,
      goals: profile.goals,
      experienceLevel: profile.experience_level,
      commitment: profile.commitment,
      commitmentFrequency: profile.commitment_frequency,
      trainingYears: profile.training_years,
      bio: profile.bio,
    },
    history: {
      sessionsCount: countResult.count ?? sessions.length,
      firstSessionDate: toDay(firstResult.data?.[0]?.date),
      lastSessionDate: toDay(sessions[0]?.date),
    },
    trainingPatterns: summarizeTrainingPatterns(sessions, { maxSessions: 8 }),
    recentWorkouts: sessions.slice(0, 5).map((session) => formatSession(session, routineNames)),
    strength: overall
      ? {
          level: overall.level,
          nextLevel: overall.nextLevel,
          progress: overall.progress,
          points: overall.points,
          maxPoints: overall.maxPoints,
          trackedLifts: ranks.length,
          weakestGroup: overall.weakestGroup,
          topLifts: ranks
            .slice()
            .sort((a, b) => b.scorePoints - a.scorePoints)
            .slice(0, 5)
            .map((rank) => `${rank.exerciseName}: ${rank.level}, ${roundTo(rank.currentValue)} ${unit(rank.currentMetric)}`),
          closestUpgrades: ranks
            .filter((rank) => rank.nextLevel && rank.gapToNextLevel != null)
            .sort((a, b) => (a.gapToNextLevel ?? Infinity) - (b.gapToNextLevel ?? Infinity))
            .slice(0, 3)
            .map((rank) => `${rank.exerciseName}: ${roundTo(rank.gapToNextLevel!)} ${unit(rank.targetMetric)} to ${rank.nextLevel}`),
        }
      : null,
    ...(strengthProfile.missingRequirements.length
      ? { strengthUnavailable: strengthProfile.missingRequirements }
      : {}),
    plans: {
      programs: ((programsResult.data ?? []) as { id: string; name: string }[]).map((program) => ({
        name: program.name,
        routines: routines.filter((routine) => routine.program_id === program.id).map((routine) => routine.name),
      })),
      routines: routines.filter((routine) => !routine.program_id).map((routine) => routine.name),
    },
    body: summarizeBodyLogContext(scansResult.data ?? []),
  }
}

export function userContextToPrompt(ctx: UserContextSummary): string {
  const lines: string[] = []
  const profile = ctx.profile
  lines.push(`User: ${profile.displayName} (@${profile.userTag})`)

  const personal = [
    profile.gender && `gender=${profile.gender}`,
    profile.age && `age=${profile.age}`,
    profile.heightCm && `height=${profile.heightCm}cm`,
    profile.weightKg && `weight=${profile.weightKg}kg`,
    profile.goals?.length && `goals=${profile.goals.map((goal) => goal.replace(/_/g, ' ')).join(', ')}`,
    profile.experienceLevel && `experience=${profile.experienceLevel}`,
    profile.trainingYears && `training_years=${profile.trainingYears.replace(/_/g, ' ')}`,
    formatCommitmentSummary({
      commitment: profile.commitment,
      commitmentFrequency: profile.commitmentFrequency,
    }) && `commitment=${formatCommitmentSummary({ commitment: profile.commitment, commitmentFrequency: profile.commitmentFrequency })}`,
  ].filter(Boolean)
  if (personal.length) lines.push(`Profile: ${personal.join(', ')}`)
  if (profile.bio?.trim()) lines.push(`Notes from the user: ${profile.bio.trim()}`)

  lines.push(
    ctx.history.sessionsCount > 0
      ? `Workouts logged: ${ctx.history.sessionsCount} (first ${ctx.history.firstSessionDate}, latest ${ctx.history.lastSessionDate})`
      : 'Workouts logged: none yet',
  )

  if (ctx.recentWorkouts.length) {
    lines.push('Recent workouts (sets: weight×reps, w = warm-up, @ = RPE):')
    for (const workout of ctx.recentWorkouts) {
      const header = [
        workout.date,
        'routine' in workout && workout.routine ? `"${workout.routine}"` : null,
        'durationMin' in workout && workout.durationMin ? `${workout.durationMin} min` : null,
        `${workout.workingSets} working sets`,
      ].filter(Boolean)
      lines.push(`- ${header.join(', ')}`)
      for (const exercise of workout.exercises) {
        lines.push(`  ${exercise.name}: ${exercise.sets}`)
      }
    }
  }

  const patterns = ctx.trainingPatterns
  if (patterns) {
    lines.push(
      `Training style (last ${patterns.sessionsAnalyzed} sessions): ${patterns.averageExercisesPerSession} exercises and ${patterns.averageWorkingSetsPerSession} working sets per session, ${patterns.averageWorkingSetsPerExercise} sets per exercise${
        typeof patterns.averageRepsPerSet === 'number' ? `, ${patterns.averageRepsPerSet} reps per set` : ''
      }; rep ranges 1-5 ${patterns.repRangeShare.reps_1_5}%, 6-8 ${patterns.repRangeShare.reps_6_8}%, 9-12 ${patterns.repRangeShare.reps_9_12}%, 13-20 ${patterns.repRangeShare.reps_13_20}%, 21+ ${patterns.repRangeShare.reps_21_plus}%`,
    )
  }

  if (ctx.strength) {
    const strength = ctx.strength
    lines.push(
      `Lifter level: ${strength.level}, ${strength.points}/${strength.maxPoints} points${
        strength.nextLevel ? `, ${roundTo(strength.progress)}% to ${strength.nextLevel}` : ''
      }, ${strength.trackedLifts} ranked lifts${strength.weakestGroup ? `, weakest group ${strength.weakestGroup}` : ''}`,
    )
    if (strength.topLifts.length) lines.push(`Top ranked lifts: ${strength.topLifts.join('; ')}`)
    if (strength.closestUpgrades.length) lines.push(`Closest to leveling up: ${strength.closestUpgrades.join('; ')}`)
  } else if (ctx.strengthUnavailable?.length) {
    lines.push(`Lifter level unavailable until the profile has: ${ctx.strengthUnavailable.join(', ')}`)
  }

  if (ctx.plans.programs.length) {
    lines.push(
      `Programs: ${ctx.plans.programs
        .map((program) => `${program.name} (${program.routines.join(', ') || 'no routines'})`)
        .join('; ')}`,
    )
  }
  if (ctx.plans.routines.length) lines.push(`Routines: ${ctx.plans.routines.join(', ')}`)

  const latest = ctx.body?.latest
  if (latest) {
    const metrics = [
      typeof latest.weightKg === 'number' && `weight ${latest.weightKg.toFixed(1)}kg`,
      typeof latest.bodyFatPercentage === 'number' && `body fat ${latest.bodyFatPercentage.toFixed(1)}%`,
      typeof latest.leanMassKg === 'number' && `lean mass ${latest.leanMassKg.toFixed(1)}kg`,
      typeof latest.physiqueScores.average === 'number' && `physique avg ${latest.physiqueScores.average.toFixed(0)}/100`,
    ].filter(Boolean)
    lines.push(`Latest body scan (${toDay(latest.capturedAt)}): ${metrics.join(', ') || 'no metrics'}`)
    if (latest.analysisSummary?.trim()) lines.push(`Latest physique analysis: ${latest.analysisSummary.trim()}`)
  }

  return lines.join('\n')
}

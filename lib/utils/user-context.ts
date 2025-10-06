import { createServerDatabase } from '@/lib/database-server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export interface UserContextSummary {
  profile: {
    id: string
    userTag: string
    displayName: string
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
  }
}

// Build a compact, token-efficient summary for the LLM
export async function buildUserContextSummary(
  userId: string,
  accessToken?: string,
): Promise<UserContextSummary> {
  const db = createServerDatabase(accessToken)
  const profile = await db.profiles.getById(userId)

  // recent sessions for date bounds and counts
  const recent = await db.workoutSessions.getRecent(userId, 50)
  const sessionsCount = recent?.length || 0
  const firstSessionDate =
    recent.length > 0 ? recent[recent.length - 1].date : undefined
  const lastSessionDate = recent.length > 0 ? recent[0].date : undefined

  // compute total volume (all time best-effort)
  const totalVolumeAllTime = await db.stats.getTotalVolume(userId)

  // derive a few top exercises by simple heuristic (presence + weights)
  const exerciseToBest: Record<string, number> = {}
  for (const session of recent) {
    for (const we of session.workout_exercises || []) {
      const name = we.exercise?.name
      if (!name) continue
      for (const s of we.sets || []) {
        if (typeof s.weight === 'number') {
          if (!exerciseToBest[name] || s.weight > exerciseToBest[name]) {
            exerciseToBest[name] = s.weight
          }
        }
      }
    }
  }

  const topExercisesByMax = Object.entries(exerciseToBest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, bestSingle]) => ({ name, bestSingle }))

  return {
    profile: {
      id: profile.id,
      userTag: profile.user_tag,
      displayName: profile.display_name,
    },
    totals: {
      totalVolumeAllTime: Math.round(totalVolumeAllTime || 0),
      sessionsCount,
      firstSessionDate,
      lastSessionDate,
    },
    highlights: {
      topExercisesByMax,
    },
  }
}

export function userContextToPrompt(ctx: UserContextSummary): string {
  const lines: string[] = []
  lines.push(`User: ${ctx.profile.displayName} (@${ctx.profile.userTag})`)
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
  return lines.join('\n')
}

// Build a complete, flattened dump of a user's data for direct LLM context
// This avoids any context selection/summary heuristics.
export async function buildUserFullContextDump(
  userId: string,
  accessToken?: string,
  options?: { maxSessions?: number },
): Promise<string> {
  const maxSessions = options?.maxSessions ?? 500

  const supabase = createServerSupabaseClient(accessToken)

  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select(
      `
      date,
      type,
      workout_exercises (
        order_index,
        exercise:exercises (
          name,
          muscle_group,
          type,
          equipment
        ),
        sets (
          set_number,
          reps,
          weight,
          rpe
        )
      )
    `,
    )
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .limit(maxSessions)

  if (error) throw error

  type AnySession = any
  const flatSets: Record<string, any>[] = []

  for (const session of (sessions as AnySession[]) || []) {
    for (const we of session.workout_exercises || []) {
      const exercise = we.exercise
      for (const s of we.sets || []) {
        flatSets.push({
          sessionDate: session.date,
          sessionType: session.type,
          exerciseName: exercise?.name,
          exerciseMuscleGroup: exercise?.muscle_group,
          exerciseType: exercise?.type,
          exerciseEquipment: exercise?.equipment,
          exerciseOrderIndex: we.order_index,
          setNumber: s.set_number,
          reps: s.reps,
          weight: s.weight,
          rpe: s.rpe,
        })
      }
    }
  }

  const exercisesMap = new Map<string, any>()
  for (const session of (sessions as AnySession[]) || []) {
    for (const we of session.workout_exercises || []) {
      const ex = we.exercise
      const key = (ex?.name || '').toLowerCase()
      if (key && !exercisesMap.has(key)) {
        exercisesMap.set(key, {
          name: ex?.name,
          muscle_group: ex?.muscle_group,
          type: ex?.type,
          equipment: ex?.equipment,
        })
      }
    }
  }

  const dump = {
    sessions: ((sessions as AnySession[]) || []).map((s) => ({
      date: s.date,
      type: s.type,
    })),
    exercises: Array.from(exercisesMap.values()),
    sets: flatSets,
  }

  return JSON.stringify(dump)
}

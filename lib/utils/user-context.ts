import { createServerDatabase } from '@/lib/database-server'

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
    topExercisesByMax?: Array<{
      name: string
      estMax?: number
      bestSingle?: number
    }>
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

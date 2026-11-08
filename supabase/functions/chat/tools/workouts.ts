// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod@3.25.76'
import { tool } from 'npm:ai@7.0.162'

import {
  bestSet,
  findExercisesByName,
  formatSession,
  isWorkingSet,
  loadRoutineNames,
  round,
  SESSION_SELECT,
  sessionVolumeKg,
  toDay,
  type SessionRow,
  type ToolContext,
} from './shared.ts'

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')

export function workoutTools({ supabase, userId }: ToolContext) {
  return {
    getWorkouts: tool({
      description:
        "The user's logged workouts with every exercise and set, newest first. Filter by exercise and/or date range (filters search the full history, not just recent sessions). Pass sessionId for one workout plus a post-workout analysis: per-exercise comparison with all earlier sessions (PRs, best previous sets, last time performed) and the user's recent baseline. Sets are compact: \"80kg×8\" weight×reps, \"w\" prefix = warm-up, \"@8\" = RPE, \"BW×12\" = bodyweight, \"45s\" = timed.",
      inputSchema: z.object({
        sessionId: z.string().uuid().optional().describe('One specific workout (e.g. the session ID in the turn context).'),
        exerciseName: z
          .string()
          .trim()
          .min(2)
          .max(120)
          .optional()
          .describe('Only sessions containing this exercise (partial names match, e.g. "bench"); each session shows just that exercise.'),
        from: DATE.optional().describe('Earliest date, inclusive.'),
        to: DATE.optional().describe('Latest date, inclusive.'),
        limit: z.number().int().min(1).max(30).optional().describe('Max sessions (default 10).'),
      }),
      execute: async ({ sessionId, exerciseName, from, to, limit = 10 }) => {
        const routineNames = await loadRoutineNames(supabase, userId)

        if (sessionId) return analyzeSession(sessionId, routineNames)

        let exerciseIds: string[] | null = null
        if (exerciseName) {
          const matches = await findExercisesByName(supabase, exerciseName)
          if (matches.length === 0) {
            return { total: 0, sessions: [], note: `No exercise matches "${exerciseName}".` }
          }
          exerciseIds = matches.map((match) => match.id)
        }

        let query = (supabase as any)
          .from('workout_sessions')
          .select(
            exerciseIds
              ? SESSION_SELECT.replace('workout_exercises (', 'workout_exercises!inner (')
              : SESSION_SELECT,
            { count: 'exact' },
          )
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(limit)
        if (exerciseIds) query = query.in('workout_exercises.exercise_id', exerciseIds)
        if (from) query = query.gte('date', `${from}T00:00:00Z`)
        if (to) query = query.lte('date', `${to}T23:59:59.999Z`)

        const { data, error, count } = await query
        if (error) throw error
        const sessions = (data ?? []) as SessionRow[]

        const formatted = sessions.map((session) =>
          formatSession(session, routineNames, { filtered: Boolean(exerciseIds) }),
        )
        // Which exercises the name actually matched in the user's history, so
        // the model can narrow down with an exact name.
        const matched = [...new Set(formatted.flatMap((s) => s.exercises.map((e) => e.name)))]
        return {
          total: count ?? sessions.length,
          returned: sessions.length,
          ...(exerciseIds && matched.length > 1
            ? { matchedExercises: matched, hint: 'Pass one exact name to see only that exercise.' }
            : {}),
          sessions: formatted,
        }
      },
    }),
  }

  async function analyzeSession(sessionId: string, routineNames: Map<string, string>) {
    const { data, error } = await (supabase as any)
      .from('workout_sessions')
      .select(SESSION_SELECT)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (!data) return { found: false }

    const session = data as SessionRow
    const sessionDate = session.date ?? session.created_at ?? new Date().toISOString()
    const exerciseIds = (session.workout_exercises ?? [])
      .map((exercise) => exercise.exercise_id)
      .filter((id): id is string => Boolean(id))

    // Every earlier session that trained any of today's exercises.
    const [history, baseline] = await Promise.all([
      exerciseIds.length
        ? (supabase as any)
            .from('workout_sessions')
            .select(SESSION_SELECT.replace('workout_exercises (', 'workout_exercises!inner ('))
            .eq('user_id', userId)
            .lt('date', sessionDate)
            .in('workout_exercises.exercise_id', exerciseIds)
            .order('date', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
      // The 8 sessions before this one, for a volume/sets baseline.
      (supabase as any)
        .from('workout_sessions')
        .select(SESSION_SELECT)
        .eq('user_id', userId)
        .lt('date', sessionDate)
        .order('date', { ascending: false })
        .limit(8),
    ])
    if (history.error) throw history.error
    if (baseline.error) throw baseline.error

    const previous = (history.data ?? []) as SessionRow[]
    const comparisons = (session.workout_exercises ?? []).map((exercise) => {
      const name = exercise.exercise?.name ?? 'Unknown exercise'
      const today = bestSet(exercise.sets ?? [])
      const appearances = previous.flatMap((prev) =>
        (prev.workout_exercises ?? [])
          .filter((row) => row.exercise_id === exercise.exercise_id)
          .map((row) => ({ date: toDay(prev.date), sets: row.sets ?? [] })),
      )
      if (appearances.length === 0) {
        return { exercise: name, firstTime: true, todayBest: describeBest(today) }
      }

      let previousBest: ReturnType<typeof bestSet> = null
      let previousHeaviest = 0
      for (const appearance of appearances) {
        const best = bestSet(appearance.sets)
        if (best && (!previousBest || best.e1rm > previousBest.e1rm)) previousBest = best
        for (const set of appearance.sets) {
          if (isWorkingSet(set) && typeof set.weight === 'number') {
            previousHeaviest = Math.max(previousHeaviest, set.weight)
          }
        }
      }
      const last = appearances[0]
      const todayHeaviest = Math.max(
        0,
        ...(exercise.sets ?? [])
          .filter((set) => isWorkingSet(set) && typeof set.weight === 'number')
          .map((set) => set.weight!),
      )

      return {
        exercise: name,
        todayBest: describeBest(today),
        previousBest: describeBest(previousBest),
        lastTime: { date: last.date, best: describeBest(bestSet(last.sets)) },
        timesTrainedBefore: appearances.length,
        newE1rmPR: Boolean(today && previousBest && today.e1rm > previousBest.e1rm + 0.01),
        newWeightPR: todayHeaviest > previousHeaviest && previousHeaviest > 0,
      }
    })

    const baselineSessions = (baseline.data ?? []) as SessionRow[]
    const average = (values: number[]) =>
      values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null

    return {
      found: true,
      session: formatSession(session, routineNames),
      comparisons,
      recentBaseline: baselineSessions.length
        ? {
            sessions: baselineSessions.length,
            avgWorkingSets: average(
              baselineSessions.map(
                (prev) =>
                  (prev.workout_exercises ?? []).reduce(
                    (count, exercise) => count + (exercise.sets ?? []).filter(isWorkingSet).length,
                    0,
                  ),
              ),
            ),
            avgExercises: average(
              baselineSessions.map((prev) => (prev.workout_exercises ?? []).length),
            ),
            avgVolumeKg: average(baselineSessions.map(sessionVolumeKg)),
            avgDurationMin: average(
              baselineSessions
                .filter((prev) => typeof prev.duration === 'number' && prev.duration > 0)
                .map((prev) => prev.duration! / 60),
            ),
          }
        : null,
    }
  }
}

function describeBest(best: ReturnType<typeof bestSet>) {
  return best ? `${round(best.weight, 2)}kg×${best.reps} (e1RM ${round(best.e1rm)}kg)` : null
}

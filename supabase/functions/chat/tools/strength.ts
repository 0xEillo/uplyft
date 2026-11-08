// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod@3.25.76'
import { tool } from 'npm:ai@7.0.162'

import {
  buildUserStrengthProfile,
  calculateLifterPointTargets,
  getExerciseStandardsForProfile,
  type ExerciseRankDetails,
} from '../../_shared/strength.ts'
import {
  bestSet,
  findExercisesByName,
  formatInstructions,
  formatSet,
  isWorkingSet,
  memo,
  round,
  sortSets,
  toDay,
  type SessionRow,
  type ToolContext,
} from './shared.ts'

export function strengthTools({ supabase, userId }: ToolContext) {
  const getProfile = memo(() => buildUserStrengthProfile(supabase as any, userId))

  return {
    getStrengthOverview: tool({
      description:
        "The user's lifter level (points out of 10000, level, progress to next level, weakest muscle group, per-group breakdown) and the rank of every standards-tracked lift: level, next level, progress, current estimated 1RM (or reps for bodyweight lifts), the exact target for the next level and the gap to it. Report points exactly as returned.",
      inputSchema: z.object({}),
      execute: async () => {
        const profile = await getProfile()
        if (profile.missingRequirements.length > 0) {
          return {
            available: false,
            missingRequirements: profile.missingRequirements,
            note: 'Strength levels need these profile details first.',
          }
        }
        const overall = profile.overallLevel
        return {
          available: true,
          bodyweightKg: profile.profile.bodyweightKg,
          gender: profile.profile.gender,
          overall: overall
            ? {
                points: overall.points,
                maxPoints: overall.maxPoints,
                level: overall.level,
                nextLevel: overall.nextLevel,
                progressPct: round(overall.progress),
                weakestGroup: overall.weakestGroup,
                groups: Object.values(overall.groupBreakdown).map((group) => ({
                  group: group.group,
                  score: round(group.effectiveScore),
                  topLiftScore: round(group.topExerciseScore),
                  lastTrained: toDay(group.lastTrainedAt),
                  lifts: group.trackedExerciseCount,
                })),
              }
            : null,
          lifts: profile.exerciseRanks
            .slice()
            .sort((a, b) => b.scorePoints - a.scorePoints)
            .map(describeRank),
        }
      },
    }),

    getExerciseProgress: tool({
      description:
        "Everything about one exercise for this user: all-time records (best estimated 1RM, heaviest weight, most reps), progress over time (best set per session), recent sessions, their strength-standard rank with the full level ladder (target for every level), and how to perform it (muscles, equipment, instructions). Works for exercises they haven't logged too (ladder + instructions only).",
      inputSchema: z.object({
        exerciseName: z.string().trim().min(2).max(120).describe('e.g. "bench press", "squat", "pull up".'),
      }),
      execute: async ({ exerciseName }) => {
        const matches = await findExercisesByName(supabase, exerciseName)
        if (matches.length === 0) {
          return { found: false, note: `No exercise matches "${exerciseName}". Try searchExercises.` }
        }

        const { data, error } = await (supabase as any)
          .from('workout_sessions')
          .select(
            `id, date, workout_exercises!inner (exercise_id, sets (set_number, reps, weight, rpe, is_warmup, duration_seconds, notes))`,
          )
          .eq('user_id', userId)
          .in('workout_exercises.exercise_id', matches.map((match) => match.id))
          .order('date', { ascending: true })
          .limit(500)
        if (error) throw error
        const sessions = (data ?? []) as SessionRow[]

        // Sessions per matched exercise; prefer an exact name match, else the
        // most-trained match.
        const countById = new Map<string, number>()
        for (const session of sessions) {
          for (const row of session.workout_exercises ?? []) {
            countById.set(row.exercise_id!, (countById.get(row.exercise_id!) ?? 0) + 1)
          }
        }
        const exact = matches.find((match) => match.name.toLowerCase() === exerciseName.trim().toLowerCase())
        const trained = matches
          .filter((match) => countById.has(match.id))
          .sort((a, b) => (countById.get(b.id) ?? 0) - (countById.get(a.id) ?? 0))
        const exercise =
          (exact && countById.has(exact.id) ? exact : trained[0]) ?? exact ?? matches[0]

        const history = sessions.flatMap((session) =>
          (session.workout_exercises ?? [])
            .filter((row) => row.exercise_id === exercise.id)
            .map((row) => ({ date: toDay(session.date)!, sets: sortSets(row.sets ?? []) })),
        )

        const profile = await getProfile()
        const rank = profile.exerciseRanks.find(
          (entry) =>
            entry.exerciseId === exercise.id ||
            entry.exerciseName.toLowerCase() === exercise.name.toLowerCase(),
        )
        const ladder =
          profile.profile.gender && profile.profile.bodyweightKg
            ? getExerciseStandardsForProfile({
                exerciseName: exercise.name,
                gender: profile.profile.gender,
                bodyweightKg: profile.profile.bodyweightKg,
              })
            : null

        return {
          found: true,
          exercise: {
            name: exercise.name,
            muscleGroup: exercise.muscle_group,
            type: exercise.type,
            equipment: exercise.equipment,
            targetMuscles: exercise.target_muscles,
            secondaryMuscles: exercise.secondary_muscles,
            instructions: formatInstructions(exercise.instructions),
            isCustom: exercise.created_by != null,
          },
          ...(history.length ? summarizeHistory(history) : { timesTrained: 0 }),
          standards: rank
            ? { current: describeRank(rank), ladder: ladder?.levels.map(describeLevel) ?? null }
            : ladder
            ? { current: null, ladder: ladder.levels.map(describeLevel) }
            : profile.missingRequirements.length
            ? { unavailable: profile.missingRequirements }
            : null,
          // Other variations of this name the user has logged.
          otherLoggedVariations: trained
            .filter((match) => match.id !== exercise.id)
            .slice(0, 5)
            .map((match) => `${match.name} (${countById.get(match.id)} sessions)`),
        }
      },
    }),

    getLifterPointTargets: tool({
      description:
        "Exact lift targets that would raise the user's overall lifter score by a number of points: the best lift to improve, target estimated 1RM or reps, practical weight×rep options, projected points and level. Optionally for a specific exercise. Never estimate point math yourself; use this.",
      inputSchema: z.object({
        pointsTarget: z.number().int().min(1).max(2500).describe('How many points to gain.'),
        exerciseName: z.string().trim().min(1).max(120).optional(),
      }),
      execute: async ({ pointsTarget, exerciseName }) =>
        calculateLifterPointTargets({
          profile: await getProfile(),
          requestedPoints: pointsTarget,
          exerciseName,
          includeAlternatives: true,
        }),
    }),
  }
}

function describeRank(rank: ExerciseRankDetails) {
  const unit = rank.currentMetric === 'reps' ? 'reps' : 'kg e1RM'
  return {
    lift: rank.exerciseName,
    level: rank.level,
    nextLevel: rank.nextLevel,
    progressPct: round(rank.progress),
    current: `${round(rank.currentValue)} ${unit}`,
    ...(rank.bestSetWeightKg != null
      ? { bestSet: `${round(rank.bestSetWeightKg, 2)}kg×${rank.bestSetReps}` }
      : {}),
    ...(rank.targetValue != null
      ? { nextTarget: `${round(rank.targetValue)} ${unit}`, gap: `${round(rank.gapToNextLevel ?? 0)} ${unit}` }
      : {}),
    points: round(rank.scorePoints),
    ...(rank.pointsToNextLevel != null ? { pointsToNextLevel: round(rank.pointsToNextLevel) } : {}),
    ...(rank.ratioToBodyweight != null ? { xBodyweight: round(rank.ratioToBodyweight, 2) } : {}),
    lastTrained: toDay(rank.lastTrainedAt),
  }
}

function describeLevel(level: { level: string; targetValue: number; targetMetric: string }) {
  return `${level.level}: ${round(level.targetValue)} ${level.targetMetric === 'reps' ? 'reps' : 'kg e1RM'}`
}

/** Records, trend and recent sessions for one exercise (history oldest first). */
function summarizeHistory(history: { date: string; sets: ReturnType<typeof sortSets> }[]) {
  const perSession = history.map((entry) => ({ ...entry, best: bestSet(entry.sets) }))

  let bestE1rm: { date: string; text: string; e1rm: number } | null = null
  let heaviest: { date: string; text: string; weight: number } | null = null
  let mostReps: { date: string; text: string; reps: number } | null = null
  for (const entry of perSession) {
    if (entry.best && (!bestE1rm || entry.best.e1rm > bestE1rm.e1rm)) {
      bestE1rm = {
        date: entry.date,
        text: `${round(entry.best.weight, 2)}kg×${entry.best.reps}`,
        e1rm: entry.best.e1rm,
      }
    }
    for (const set of entry.sets) {
      if (!isWorkingSet(set)) continue
      if (typeof set.weight === 'number' && (!heaviest || set.weight > heaviest.weight)) {
        heaviest = { date: entry.date, text: formatSet(set), weight: set.weight }
      }
      if (!mostReps || set.reps! > mostReps.reps) {
        mostReps = { date: entry.date, text: formatSet(set), reps: set.reps! }
      }
    }
  }

  const withBest = perSession.filter((entry) => entry.best)
  const latest = withBest.at(-1)
  const changeSince = (days: number) => {
    if (!latest) return null
    const cutoff = new Date(latest.date)
    cutoff.setUTCDate(cutoff.getUTCDate() - days)
    const baseline = withBest.find((entry) => new Date(entry.date) >= cutoff)
    if (!baseline || baseline === latest) return null
    return `${round(latest.best!.e1rm - baseline.best!.e1rm)}kg e1RM since ${baseline.date}`
  }

  return {
    timesTrained: history.length,
    firstTrained: history[0].date,
    lastTrained: history.at(-1)!.date,
    records: {
      bestE1rm: bestE1rm ? { set: bestE1rm.text, e1rmKg: round(bestE1rm.e1rm), date: bestE1rm.date } : null,
      heaviest: heaviest ? { set: heaviest.text, date: heaviest.date } : null,
      mostReps: mostReps ? { set: mostReps.text, date: mostReps.date } : null,
    },
    change: { last30d: changeSince(30), last90d: changeSince(90) },
    // Best set per session for the last 15 sessions (trend), oldest first.
    trend: withBest.slice(-15).map(
      (entry) => `${entry.date}: ${round(entry.best!.weight, 2)}kg×${entry.best!.reps} (e1RM ${round(entry.best!.e1rm)})`,
    ),
    recentSessions: history
      .slice(-5)
      .reverse()
      .map((entry) => ({ date: entry.date, sets: entry.sets.map(formatSet).join(', ') })),
  }
}

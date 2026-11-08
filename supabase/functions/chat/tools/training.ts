// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod@3.25.76'
import { tool } from 'npm:ai@7.0.162'

import {
  buildAdherenceSummary,
  buildRecoverySummary,
} from '../../_shared/readiness.ts'
import { getMuscleGroupDistribution } from '../../_shared/stats.ts'
import { summarizeTrainingPatterns } from '../user-context.ts'
import { daysAgo, round, toDay, type ToolContext } from './shared.ts'

export function trainingTools({ supabase, userId, summary }: ToolContext) {
  return {
    getTrainingSummary: tool({
      description:
        "How the user has been training over a period: consistency (streak, weekly target vs actual, week-by-week counts, workout dates, days since last workout, on/behind pace), training style (exercises and working sets per session, rep-range mix, sets per muscle group), muscle-group volume share with undertrained groups, average session length, and their most-trained exercises. Use for consistency, volume, balance, split and \"how am I doing\" questions.",
      inputSchema: z.object({
        days: z.number().int().min(7).max(180).optional().describe('Look-back window in days (default 28).'),
      }),
      execute: async ({ days = 28 }) => {
        const [sessionsResult, distribution, adherence] = await Promise.all([
          (supabase as any)
            .from('workout_sessions')
            .select(
              `id, date, created_at, duration,
               workout_exercises (order_index, exercise:exercises (name, muscle_group), sets (set_number, reps, weight, rpe, is_warmup))`,
            )
            .eq('user_id', userId)
            .gte('date', `${daysAgo(days)}T00:00:00Z`)
            .order('date', { ascending: false })
            .limit(200),
          getMuscleGroupDistribution(supabase as any, userId, { daysBack: days }),
          buildAdherenceSummary(
            supabase as any,
            userId,
            summary.profile.commitment,
            summary.profile.commitmentFrequency,
            {
              weeksBack: Math.min(Math.max(Math.ceil(days / 7), 2), 16),
              calendarDays: Math.min(Math.max(days, 7), 120),
            },
          ),
        ])
        if (sessionsResult.error) throw sessionsResult.error
        const sessions = (sessionsResult.data ?? []) as any[]

        const patterns = summarizeTrainingPatterns(sessions, { maxSessions: sessions.length })

        const exerciseCounts = new Map<string, number>()
        for (const session of sessions) {
          const names = new Set<string>(
            (session.workout_exercises ?? [])
              .map((row: any) => row.exercise?.name)
              .filter(Boolean),
          )
          for (const name of names) exerciseCounts.set(name, (exerciseCounts.get(name) ?? 0) + 1)
        }
        const durations = sessions
          .map((session) => session.duration)
          .filter((value): value is number => typeof value === 'number' && value > 0)

        return {
          window: { days, from: daysAgo(days), sessions: sessions.length },
          consistency: {
            weeklyTarget: adherence.weeklyTarget,
            ...(adherence.commitmentDays.length ? { plannedDays: adherence.commitmentDays } : {}),
            workoutsThisWeek: adherence.workoutsThisWeek,
            expectedByNow: adherence.expectedWorkoutsByNow,
            status: adherence.adherenceStatus,
            streakWeeks: adherence.currentStreakWeeks,
            avgPerWeek: adherence.recentAverageWorkoutsPerWeek,
            weeksHitTarget: `${adherence.weeksHitTarget}/${adherence.evaluatedWeeks}`,
            weeks: adherence.recentWeeks.map((week) => `${week.weekStart}: ${week.workoutCount}`),
            lastWorkout: toDay(adherence.lastWorkoutDate),
            daysSinceLastWorkout: adherence.daysSinceLastWorkout,
            workoutDates: adherence.recentWorkoutDates.map(toDay),
          },
          style: patterns
            ? {
                avgExercisesPerSession: patterns.averageExercisesPerSession,
                avgWorkingSetsPerSession: patterns.averageWorkingSetsPerSession,
                avgWorkingSetsPerExercise: patterns.averageWorkingSetsPerExercise,
                avgRepsPerSet: patterns.averageRepsPerSet,
                repRangeSharePct: patterns.repRangeShare,
                perMuscleGroup: patterns.muscleGroups.map((group) => ({
                  group: group.muscleGroup,
                  exercisesPerSession: group.averageExercisesPerSession,
                  workingSetsPerSession: group.averageWorkingSetsPerSession,
                  avgReps: group.averageRepsPerSet,
                })),
              }
            : null,
          volumeSharePct: distribution.distribution.map(
            (item) => `${item.muscleGroup}: ${item.percentage}%`,
          ),
          undertrained: distribution.distribution
            .filter((item) => item.percentage < 10)
            .map((item) => item.muscleGroup),
          avgSessionMin: durations.length
            ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 60)
            : null,
          mostTrainedExercises: [...exerciseCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => `${name} (${count} sessions)`),
        }
      },
    }),

    getRecoveryStatus: tool({
      description:
        'Muscle-by-muscle recovery right now: when each group was last trained, how hard, recovery % and status (fresh / recovering / not recovered). Use for "what should I train today", readiness and fatigue questions.',
      inputSchema: z.object({}),
      execute: async () => {
        const recovery = await buildRecoverySummary(supabase as any, userId)
        return {
          lastWorkout: toDay(recovery.lastWorkoutDate),
          daysSinceLastWorkout: recovery.daysSinceLastWorkout,
          fresh: `${recovery.freshMuscleGroups}/${recovery.totalMuscleGroups} muscle groups`,
          muscles: recovery.muscleRecovery.map((entry) => ({
            group: entry.muscleGroup,
            status: entry.recoveryStatus,
            recoveredPct: entry.recoveryPercentage,
            lastTrained: toDay(entry.lastWorkedDate),
            ...(entry.hoursSinceLastWorkout != null
              ? { hoursAgo: round(entry.hoursSinceLastWorkout, 0) }
              : {}),
            ...(entry.intensity ? { intensity: entry.intensity } : {}),
          })),
        }
      },
    }),
  }
}

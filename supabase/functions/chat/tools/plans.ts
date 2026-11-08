// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod@3.25.76'
import { tool } from 'npm:ai@7.0.162'

import { sortByOrder, toDay, type ToolContext } from './shared.ts'

const ROUTINE_DETAIL_SELECT = `
  id, name, notes, program_id, created_at,
  workout_routine_exercises (
    order_index, notes,
    exercise:exercises (name, muscle_group),
    sets:workout_routine_sets (set_number, reps_min, reps_max, rest_seconds)
  )
`

export function planTools({ supabase, userId }: ToolContext) {
  return {
    getPlans: tool({
      description:
        "The user's saved programs and routines (workout templates). Without `name`: every program with its routines, plus standalone routines, each with exercise count and when it was last done. With `name`: the full routine or program — every exercise with its planned sets, rep ranges, rest times and notes.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(200).optional().describe('Routine or program name (partial match).'),
      }),
      execute: async ({ name }) => {
        const [programsResult, routinesResult] = await Promise.all([
          (supabase as any)
            .from('user_programs')
            .select('id, name, description')
            .eq('user_id', userId)
            .eq('is_archived', false)
            .order('created_at', { ascending: true }),
          (supabase as any)
            .from('workout_routines')
            .select(name ? ROUTINE_DETAIL_SELECT : 'id, name, notes, program_id, created_at, workout_routine_exercises (id)')
            .eq('user_id', userId)
            .eq('is_archived', false)
            .order('created_at', { ascending: true }),
        ])
        if (programsResult.error) throw programsResult.error
        if (routinesResult.error) throw routinesResult.error
        const programs = (programsResult.data ?? []) as any[]
        const routines = (routinesResult.data ?? []) as any[]
        const lastDone = await loadLastDone(routines.map((routine) => routine.id))

        if (name) {
          const term = name.toLowerCase()
          const program =
            programs.find((p) => p.name.toLowerCase() === term) ??
            programs.find((p) => p.name.toLowerCase().includes(term))
          const routine =
            routines.find((r) => r.name.toLowerCase() === term) ??
            routines.find((r) => r.name.toLowerCase().includes(term))

          if (program && (!routine || program.name.toLowerCase() === term)) {
            return {
              program: {
                name: program.name,
                ...(program.description ? { description: program.description } : {}),
                routines: routines
                  .filter((r) => r.program_id === program.id)
                  .map((r) => describeRoutine(r, lastDone)),
              },
            }
          }
          if (routine) return { routine: describeRoutine(routine, lastDone) }
          return {
            found: false,
            note: `Nothing named "${name}".`,
            available: [...programs.map((p) => p.name), ...routines.map((r) => r.name)],
          }
        }

        const summarize = (routine: any) => ({
          name: routine.name,
          exercises: routine.workout_routine_exercises?.length ?? 0,
          lastDone: lastDone.get(routine.id) ?? null,
        })
        return {
          programs: programs.map((program) => ({
            name: program.name,
            ...(program.description ? { description: program.description } : {}),
            routines: routines.filter((r) => r.program_id === program.id).map(summarize),
          })),
          routines: routines.filter((r) => !r.program_id).map(summarize),
        }
      },
    }),
  }

  /** Most recent workout date per routine. */
  async function loadLastDone(routineIds: string[]) {
    const lastDone = new Map<string, string>()
    if (routineIds.length === 0) return lastDone
    const { data, error } = await (supabase as any)
      .from('workout_sessions')
      .select('routine_id, date')
      .eq('user_id', userId)
      .in('routine_id', routineIds)
      .order('date', { ascending: false })
      .limit(500)
    if (error) throw error
    for (const row of (data ?? []) as { routine_id: string; date: string }[]) {
      if (!lastDone.has(row.routine_id)) lastDone.set(row.routine_id, toDay(row.date)!)
    }
    return lastDone
  }
}

function describeRoutine(routine: any, lastDone: Map<string, string>) {
  return {
    name: routine.name,
    ...(routine.notes?.trim() ? { notes: routine.notes.trim() } : {}),
    lastDone: lastDone.get(routine.id) ?? null,
    exercises: sortByOrder(routine.workout_routine_exercises ?? []).map((row: any) => {
      const sets = (row.sets ?? []).slice().sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0))
      return {
        name: row.exercise?.name ?? 'Unknown exercise',
        ...(row.notes?.trim() ? { notes: row.notes.trim() } : {}),
        plan: describePlannedSets(sets),
      }
    }),
  }
}

/** "3 × 6-8 reps, 150s rest", or one entry per set when they differ. */
function describePlannedSets(sets: any[]) {
  const describe = (set: any) => {
    const reps =
      set.reps_min != null && set.reps_max != null && set.reps_min !== set.reps_max
        ? `${set.reps_min}-${set.reps_max}`
        : `${set.reps_min ?? set.reps_max ?? '?'}`
    return `${reps} reps${set.rest_seconds ? `, ${set.rest_seconds}s rest` : ''}`
  }
  const described = sets.map(describe)
  if (described.length === 0) return 'no sets'
  return described.every((entry) => entry === described[0])
    ? `${described.length} × ${described[0]}`
    : described.join(' | ')
}

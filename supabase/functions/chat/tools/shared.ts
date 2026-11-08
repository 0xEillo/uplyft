// deno-lint-ignore-file no-explicit-any
import type { createUserClient } from '../../_shared/supabase.ts'
import type { UserContextSummary } from '../user-context.ts'

export type Supabase = ReturnType<typeof createUserClient>

export type ToolContext = {
  supabase: Supabase
  userId: string
  summary: UserContextSummary
}

/** Shape of a logged set as selected by the tools. */
export type SetRow = {
  set_number?: number | null
  reps?: number | null
  weight?: number | null
  rpe?: number | null
  is_warmup?: boolean | null
  duration_seconds?: number | null
  notes?: string | null
}

export type WorkoutExerciseRow = {
  order_index?: number | null
  notes?: string | null
  exercise_id?: string | null
  exercise?: { id?: string; name?: string | null; muscle_group?: string | null } | null
  sets?: SetRow[] | null
}

export type SessionRow = {
  id: string
  date: string | null
  created_at?: string | null
  type?: string | null
  notes?: string | null
  duration?: number | null
  routine_id?: string | null
  record_count?: number | null
  workout_exercises?: WorkoutExerciseRow[] | null
}

/** Columns for a full session with exercises and sets. */
export const SESSION_SELECT = `
  id, date, created_at, type, notes, duration, routine_id, record_count,
  workout_exercises (
    order_index, notes, exercise_id,
    exercise:exercises (id, name, muscle_group),
    sets (set_number, reps, weight, rpe, is_warmup, duration_seconds, notes)
  )
`

export const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Epley estimated one-rep max. */
export const estimate1RM = (weight: number, reps: number) => weight * (1 + reps / 30)

export const isWorkingSet = (set: SetRow) =>
  set.is_warmup !== true && typeof set.reps === 'number' && set.reps > 0

export const sortByOrder = <T extends { order_index?: number | null }>(rows: T[]) =>
  rows.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))

export const sortSets = (sets: SetRow[]) =>
  sets.slice().sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))

/** YYYY-MM-DD for a timestamp (UTC). */
export const toDay = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : null

/** ISO date `days` before today (UTC), as YYYY-MM-DD. */
export const daysAgo = (days: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

/**
 * Compact, token-cheap set notation, e.g. "80kg×8 @8", "w40kg×10", "45s",
 * "BW×12". Weights are kg.
 */
export function formatSet(set: SetRow): string {
  const parts: string[] = []
  const hasWeight = typeof set.weight === 'number' && set.weight > 0
  const hasReps = typeof set.reps === 'number' && set.reps > 0
  if (hasWeight && hasReps) parts.push(`${round(set.weight!, 2)}kg×${set.reps}`)
  else if (hasReps) parts.push(`BW×${set.reps}`)
  else if (hasWeight) parts.push(`${round(set.weight!, 2)}kg`)
  if (typeof set.duration_seconds === 'number' && set.duration_seconds > 0) {
    parts.push(`${set.duration_seconds}s`)
  }
  if (parts.length === 0) parts.push('(empty)')
  let text = parts.join(' ')
  if (set.is_warmup === true) text = `w${text}`
  if (typeof set.rpe === 'number') text += ` @${set.rpe}`
  if (set.notes?.trim()) text += ` (${set.notes.trim()})`
  return text
}

export function sessionVolumeKg(session: SessionRow) {
  let volume = 0
  for (const exercise of session.workout_exercises ?? []) {
    for (const set of exercise.sets ?? []) {
      if (!isWorkingSet(set) || typeof set.weight !== 'number') continue
      volume += set.weight * set.reps!
    }
  }
  return Math.round(volume)
}

/** Best working set by estimated 1RM. */
export function bestSet(sets: SetRow[]) {
  let best: { weight: number; reps: number; e1rm: number } | null = null
  for (const set of sets) {
    if (!isWorkingSet(set) || typeof set.weight !== 'number' || set.weight <= 0) continue
    const e1rm = estimate1RM(set.weight, set.reps!)
    if (!best || e1rm > best.e1rm) best = { weight: set.weight, reps: set.reps!, e1rm }
  }
  return best
}

/**
 * A session in compact form: one line of sets per exercise. With
 * `filtered`, the session only holds the exercise being searched for, so
 * session-level totals are left out (they would be misleading).
 */
export function formatSession(
  session: SessionRow,
  routineNames: Map<string, string> = new Map(),
  options: { filtered?: boolean } = {},
) {
  const exercises = sortByOrder(session.workout_exercises ?? [])
  const workingSets = exercises.reduce(
    (count, exercise) => count + (exercise.sets ?? []).filter(isWorkingSet).length,
    0,
  )
  return {
    id: session.id,
    date: toDay(session.date ?? session.created_at),
    ...(session.type ? { type: session.type } : {}),
    ...(session.routine_id && routineNames.get(session.routine_id)
      ? { routine: routineNames.get(session.routine_id) }
      : {}),
    ...(typeof session.duration === 'number' && session.duration > 0
      ? { durationMin: Math.round(session.duration / 60) }
      : {}),
    ...(session.notes?.trim() ? { notes: session.notes.trim() } : {}),
    ...(session.record_count ? { prsSet: session.record_count } : {}),
    ...(options.filtered ? {} : { workingSets, volumeKg: sessionVolumeKg(session) }),
    exercises: exercises.map((exercise) => ({
      name: exercise.exercise?.name ?? 'Unknown exercise',
      ...(exercise.notes?.trim() ? { notes: exercise.notes.trim() } : {}),
      sets: sortSets(exercise.sets ?? []).map(formatSet).join(', '),
    })),
  }
}

/** Routine id → name, for labelling sessions. */
export async function loadRoutineNames(supabase: Supabase, userId: string) {
  const { data } = await (supabase as any)
    .from('workout_routines')
    .select('id, name')
    .eq('user_id', userId)
  return new Map<string, string>(
    ((data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]),
  )
}

/**
 * Exercises matching a name. An exact (case-insensitive) name match wins
 * outright, so "Deadlift (Barbell)" doesn't also pull in "Romanian Deadlift
 * (Barbell)"; otherwise partial matches, shortest names first. Includes the
 * user's own custom exercises (RLS-scoped).
 */
export async function findExercisesByName(
  supabase: Supabase,
  name: string,
  limit = 10,
) {
  const term = name.trim().replace(/[%_]/g, '')
  const { data, error } = await (supabase as any)
    .from('exercises')
    .select(
      'id, name, muscle_group, type, equipment, target_muscles, secondary_muscles, instructions, created_by',
    )
    .ilike('name', `%${term}%`)
    .limit(50)
  if (error) throw error
  const lower = term.toLowerCase()
  const exact = ((data ?? []) as any[]).filter((row) => row.name.toLowerCase() === lower)
  if (exact.length) return exact
  return ((data ?? []) as any[])
    .sort((a, b) => {
      const aExact = a.name.toLowerCase() === lower ? 0 : 1
      const bExact = b.name.toLowerCase() === lower ? 0 : 1
      if (aExact !== bExact) return aExact - bExact
      return a.name.length - b.name.length
    })
    .slice(0, limit)
}

/** Shared lazily-built summaries, so parallel tool calls don't repeat work. */
export function memo<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null
  return () => (promise ??= load())
}

/** Exercise instructions as clean steps ("Step:1 Stand…" → "Stand…"). */
export function formatInstructions(value: unknown): string[] | null {
  const steps = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string' && value.trim()
    ? value.split(/\n+/)
    : []
  const cleaned = steps
    .map((step) => step.replace(/^\s*step\s*:?\s*\d+[.):]?\s*/i, '').trim())
    .filter(Boolean)
  return cleaned.length ? cleaned.slice(0, 8) : null
}

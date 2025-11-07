import { supabase } from '@/lib/supabase'

import { ApiError } from './errors'

export interface CreateRoutineWorkoutParams {
  routineId: string
  date?: string | Date
  notes?: string | null
  type?: string | null
}

export interface CreateRoutineWorkoutResult {
  sessionId: string
}

const toIso = (value?: string | Date): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return value.toISOString()
}

export async function createWorkoutFromRoutine(
  params: CreateRoutineWorkoutParams,
): Promise<CreateRoutineWorkoutResult> {
  const { routineId, date, notes = null, type = 'routine' } = params

  const payload: Record<string, unknown> = {
    p_routine_id: routineId,
    p_notes: notes,
    p_type: type ?? 'routine',
  }

  const isoDate = toIso(date)
  if (isoDate) {
    payload.p_date = isoDate
  }

  const { data, error } = await supabase.rpc(
    'create_workout_from_routine',
    payload,
  )

  if (error || !data) {
    throw new ApiError({
      error: 'Failed to create workout from routine',
      code: 'DB_FAILED',
      details: error,
    })
  }

  return { sessionId: data }
}

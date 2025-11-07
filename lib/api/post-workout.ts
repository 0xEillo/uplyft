import { callSupabaseFunction } from '@/lib/supabase-functions-client'
import { WorkoutSessionWithDetails } from '@/types/database.types'

import { ApiError, ApiErrorCode, toApiErrorShape } from './errors'

export type WeightUnit = 'kg' | 'lb'

export interface WorkoutRequest {
  notes: string
  weightUnit?: WeightUnit
  createWorkout?: boolean
  userId?: string
  workoutTitle?: string
  imageUrl?: string | null
  idempotencyKey?: string
  routineId?: string | null
}

export interface ParsedSet {
  set_number: number
  reps: number | null
  weight?: number | null
  rpe?: number | null
  notes?: string | null
}

export interface ParsedExercise {
  name: string
  order_index: number
  notes?: string | null
  hasRepGaps?: boolean
  sets: ParsedSet[]
}

export interface ParsedWorkout {
  isWorkoutRelated: boolean
  notes?: string | null
  type?: string | null
  exercises: ParsedExercise[]
}

export interface WorkoutMetrics {
  totalExercises: number
  matchedExercises: number
  createdExercises: number
  totalSets: number
}

export interface WorkoutResponse {
  workout: ParsedWorkout
  createdWorkout?: WorkoutSessionWithDetails
  _metrics?: WorkoutMetrics
  correlationId?: string
}

type ErrorPayload = {
  error?: string
  code?: ApiErrorCode
  details?: unknown
  correlationId?: string
}

export async function postWorkout(
  payload: WorkoutRequest,
  accessToken?: string,
): Promise<WorkoutResponse> {
  let response: Response

  try {
    response = await callSupabaseFunction(
      'parse-workout',
      'POST',
      payload,
      {},
      accessToken,
    )
  } catch (networkError) {
    throw new ApiError({
      error: 'Network error calling parse-workout',
      code: 'NETWORK',
      details: networkError,
    })
  }

  let body: any = null
  try {
    body = await response.json()
  } catch {
    // ignore: body remains null
  }

  if (!response.ok) {
    const fallback = {
      error: 'Failed to parse workout',
      code: 'UNKNOWN' as ApiErrorCode,
      httpStatus: response.status,
    }
    const shape = toApiErrorShape(body as ErrorPayload, fallback)
    shape.httpStatus = response.status
    throw new ApiError(shape)
  }

  if (body?.error) {
    const fallback = {
      error: body.error,
      code: (body.code as ApiErrorCode) ?? ('UNKNOWN' as ApiErrorCode),
      details: body.details,
      correlationId: body.correlationId,
      httpStatus: response.status,
    }
    throw new ApiError(fallback)
  }

  return body as WorkoutResponse
}

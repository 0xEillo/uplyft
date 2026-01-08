import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { authorizeUser } from './auth.ts'
import { ApiError, normalizeError, toErrorResponse } from './errors.ts'
import { createCorrelationId, logErrorWithCorrelation } from './metrics.ts'
import { inferWorkoutTitle, parseWorkoutNotes } from './parser.ts'
import { createWorkoutSession } from './persistence.ts'
import { NormalizedWorkout, requestSchema } from './schemas.ts'
import { normalizeWorkout } from './transform.ts'

export async function handleRequest(req: Request): Promise<Response> {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  const correlationId = createCorrelationId()
  console.log(
    `[ParseWorkout][${correlationId}] Request received: ${req.method} ${req.url}`,
  )

  try {
    const rawBody = await req.json()
    console.log(
      `[ParseWorkout][${correlationId}] Payload parsed, keys: ${Object.keys(
        rawBody,
      ).join(', ')}`,
    )
    const payload = requestSchema.parse(rawBody)
    console.log(
      `[ParseWorkout][${correlationId}] Schema validated, userId: ${payload.userId}, createWorkout: ${payload.createWorkout}`,
    )

    if (payload.createWorkout && !payload.userId) {
      throw new ApiError(
        400,
        'ZOD_INVALID',
        'User ID is required for workout creation',
      )
    }

    console.log(`[ParseWorkout][${correlationId}] Calling AI parser...`)
    const parsedWorkout = await parseWorkoutNotes(payload, correlationId)
    console.log(
      `[ParseWorkout][${correlationId}] AI parsing complete, exercises: ${
        parsedWorkout.exercises?.length ?? 0
      }`,
    )

    if (!parsedWorkout.isWorkoutRelated) {
      throw new ApiError(
        400,
        'CONTENT_REFUSED',
        "This doesn't appear to be workout-related content. Please describe your exercises, sets, and reps.",
      )
    }

    if (!Array.isArray(parsedWorkout.exercises)) {
      throw new ApiError(500, 'PARSE_FAILED', 'Invalid workout format from AI')
    }

    if (parsedWorkout.exercises.length === 0) {
      throw new ApiError(
        400,
        'CONTENT_REFUSED',
        'No exercises could be detected. Please include specific exercises with sets and reps.',
      )
    }

    const workoutTitle = inferWorkoutTitle(payload.workoutTitle)

    const normalizedWorkout = normalizeWorkout(
      parsedWorkout,
      payload.weightUnit ?? 'kg',
    )

    const finalWorkout: NormalizedWorkout = {
      ...normalizedWorkout,
      type: workoutTitle ?? undefined,
    }

    logErrorWithCorrelation(correlationId, 'Workout finalized', {
      routineId: payload.routineId,
      workoutTitle: finalWorkout.type,
      exerciseCount: finalWorkout.exercises?.length,
    })

    if (!payload.createWorkout || !payload.userId) {
      return jsonResponse({
        workout: finalWorkout,
        correlationId,
      })
    }

    const { userClient, serviceClient } = await authorizeUser(
      req,
      payload.userId,
    )

    try {
      const { session, metrics } = await createWorkoutSession(
        serviceClient,
        payload.userId,
        finalWorkout,
        payload.notes, // raw workout text for parsing
        payload.description ?? null, // user-provided description from overlay
        payload.imageUrl,
        payload.routineId,
        payload.durationSeconds,
        correlationId,
      )

      const { data: createdWorkout, error: fetchError } = await userClient
        .from('workout_sessions')
        .select(
          `
          *,
          workout_exercises (
            *,
            exercise:exercises (*),
            sets (*)
          )
        `,
        )
        .eq('id', session.id)
        .single()

      if (fetchError) {
        throw fetchError
      }

      return jsonResponse({
        workout: finalWorkout,
        createdWorkout,
        _metrics: metrics,
        correlationId,
      })
    } catch (error) {
      logErrorWithCorrelation(correlationId, 'Workout creation failed', error)

      return jsonResponse({
        workout: finalWorkout,
        error: 'Workout parsed but failed to save to database',
        details: error instanceof Error ? error.message : String(error),
        correlationId,
      })
    }
  } catch (error) {
    console.error(`[ParseWorkout][${correlationId}] Request failed:`, error)
    const apiError = normalizeError(error, inferError(error))
    return toErrorResponse(apiError, correlationId)
  }
}

function inferError(error: unknown): ApiError | undefined {
  if (error instanceof SyntaxError) {
    return new ApiError(400, 'ZOD_INVALID', 'Invalid JSON body', error.message)
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new ApiError(408, 'PARSE_FAILED', 'Workout parsing timed out')
  }

  if (error && typeof error === 'object' && 'issues' in error) {
    const { issues } = error as { issues: unknown }
    return new ApiError(400, 'ZOD_INVALID', 'Invalid request', issues)
  }

  return undefined
}

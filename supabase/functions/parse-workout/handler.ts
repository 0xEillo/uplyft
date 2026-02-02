import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { authorizeUser } from './auth.ts'
import { ApiError, normalizeError, toErrorResponse } from './errors.ts'
import {
    createCorrelationId,
    logErrorWithCorrelation,
    logWithCorrelation,
} from './metrics.ts'
import { inferWorkoutTitle, parseWorkoutNotes } from './parser.ts'
import { createWorkoutSession } from './persistence.ts'
import {
    NormalizedWorkout,
    ParsedWorkout,
    WorkoutRequest,
    requestSchema,
} from './schemas.ts'
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

    const structuredSummary = summarizeStructuredPayload(payload)
    logWithCorrelation(
      correlationId,
      'Structured payload summary',
      structuredSummary,
    )

    // Log offline metadata if present
    if (payload.performedAt) {
      logWithCorrelation(correlationId, 'Offline metadata received', {
        performedAt: payload.performedAt,
        timezoneOffsetMinutes: payload.timezoneOffsetMinutes ?? null,
      })
    }

    if (payload.createWorkout && !payload.userId) {
      throw new ApiError(
        400,
        'ZOD_INVALID',
        'User ID is required for workout creation',
      )
    }

    const structuredParsed = buildStructuredParsedWorkout(payload)
    const hasNotes = Boolean(payload.notes?.trim())

    let parsedWorkout: ParsedWorkout

    if (structuredParsed && hasNotes) {
      // CASE 3: Both structured data AND notes present
      // Parse notes with AI and merge exercises from both sources
      console.log(
        `[ParseWorkout][${correlationId}] Both structured (${structuredParsed.exercises?.length ?? 0} exercises) and notes present, merging...`,
      )

      let notesParsed: ParsedWorkout | null = null
      try {
        notesParsed = await parseWorkoutNotes(payload, correlationId)
        console.log(
          `[ParseWorkout][${correlationId}] AI parsed ${notesParsed.exercises?.length ?? 0} exercises from notes`,
        )
      } catch (error) {
        // If AI parsing fails, log it but continue with just structured data
        console.warn(
          `[ParseWorkout][${correlationId}] AI parsing failed, using structured only:`,
          error instanceof Error ? error.message : String(error),
        )
      }

      parsedWorkout = mergeWorkouts(structuredParsed, notesParsed, correlationId)
      console.log(
        `[ParseWorkout][${correlationId}] Merged result: ${parsedWorkout.exercises?.length ?? 0} exercises`,
      )
    } else if (structuredParsed) {
      // CASE 2: Structured data only (no notes)
      parsedWorkout = structuredParsed
      console.log(
        `[ParseWorkout][${correlationId}] Using structured payload only, exercises: ${
          parsedWorkout.exercises?.length ?? 0
        }`,
      )
    } else {
      // CASE 1: Notes only (no structured data, or structured with no usable sets)
      if (structuredSummary.hasStructuredPayload) {
        console.log(
          `[ParseWorkout][${correlationId}] Structured payload present but no usable sets; falling back to AI`,
        )
      }
      console.log(`[ParseWorkout][${correlationId}] Calling AI parser...`)
      parsedWorkout = await parseWorkoutNotes(payload, correlationId)
      console.log(
        `[ParseWorkout][${correlationId}] AI parsing complete, exercises: ${
          parsedWorkout.exercises?.length ?? 0
        }`,
      )
    }

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

    logWithCorrelation(correlationId, 'Workout finalized', {
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
        payload.performedAt, // client timestamp for offline support
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

// Type for structured exercise input
interface StructuredExerciseInput {
  name?: string
  sets?: Array<{
    weight?: string | number | null
    reps?: string | number | null
    isWarmup?: boolean
  }>
}

function buildStructuredParsedWorkout(
  payload: WorkoutRequest,
): ParsedWorkout | null {
  const exercisesInput = Array.isArray(payload.structuredData)
    ? (payload.structuredData as StructuredExerciseInput[])
    : []

  if (exercisesInput.length === 0) {
    return null
  }

  // DEBUG: Log the raw structured data as received from the client
  console.log('[buildStructuredParsedWorkout] Raw structured data received:', {
    exerciseCount: exercisesInput.length,
    exercises: exercisesInput.map((ex: StructuredExerciseInput, exIdx: number) => ({
      index: exIdx,
      name: ex.name,
      setsCount: ex.sets?.length ?? 0,
      sets: (ex.sets ?? []).map((set, setIdx: number) => ({
        setIndex: setIdx,
        weight: set.weight,
        weightType: typeof set.weight,
        weightCharCodes: typeof set.weight === 'string' ? set.weight.split('').map((c: string) => c.charCodeAt(0)) : null,
        reps: set.reps,
        repsType: typeof set.reps,
        isWarmup: set.isWarmup,
      })),
    })),
  })

  const exercises = exercisesInput
    .map((exercise: StructuredExerciseInput, exerciseIndex: number) => {
      const name = String(exercise.name ?? '').trim()
      if (!name) return null

      const setsInput = Array.isArray(exercise.sets) ? exercise.sets : []
      const sets = setsInput
        .filter((set) => {
          const weight =
            typeof set.weight === 'string' ? set.weight.trim() : set.weight
          const reps = typeof set.reps === 'string' ? set.reps.trim() : set.reps
          return Boolean(weight) || Boolean(reps)
        })
        .map((set, setIndex) => {
          const result = {
            set_number: setIndex + 1,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            rpe: null,
            notes: null,
            is_warmup: set.isWarmup === true,
          }
          
          // DEBUG: Log each set's weight value as we build the parsed workout
          console.log(`[buildStructuredParsedWorkout] Building set for ${name}:`, {
            setNumber: result.set_number,
            rawWeight: set.weight,
            rawReps: set.reps,
            weightType: typeof set.weight,
            builtWeight: result.weight,
            builtReps: result.reps,
          })
          
          return result
        })

      if (sets.length === 0) return null

      return {
        name,
        order_index: exerciseIndex,
        notes: null,
        sets,
      }
    })
    .filter(
      (exercise): exercise is NonNullable<typeof exercise> => exercise !== null,
    )

  if (exercises.length === 0) {
    return null
  }

  return {
    isWorkoutRelated: true,
    notes: null,
    type: null,
    exercises,
  }
}

function summarizeStructuredPayload(payload: WorkoutRequest) {
  const exercisesInput = Array.isArray(payload.structuredData)
    ? payload.structuredData
    : []

  let setsCount = 0
  let setsWithDataCount = 0

  exercisesInput.forEach((exercise) => {
    const sets = Array.isArray(exercise.sets) ? exercise.sets : []
    sets.forEach((set) => {
      setsCount += 1
      const weight =
        typeof set.weight === 'string' ? set.weight.trim() : set.weight
      const reps = typeof set.reps === 'string' ? set.reps.trim() : set.reps
      if (weight || reps) {
        setsWithDataCount += 1
      }
    })
  })

  return {
    isStructuredMode: payload.isStructuredMode ?? false,
    hasStructuredPayload: exercisesInput.length > 0,
    structuredExercisesCount: exercisesInput.length,
    structuredSetsCount: setsCount,
    structuredSetsWithDataCount: setsWithDataCount,
  }
}

/**
 * Normalize exercise name for comparison (lowercase, trim, remove extra whitespace)
 */
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Merge structured workout data with AI-parsed workout from notes.
 * - Structured exercises take priority (they have explicit user input)
 * - Additional exercises from notes are appended if they don't duplicate structured ones
 * - Notes/type from AI parsing are preserved if not null
 */
function mergeWorkouts(
  structured: ParsedWorkout,
  notesParsed: ParsedWorkout | null,
  correlationId: string,
): ParsedWorkout {
  if (!notesParsed || !notesParsed.exercises?.length) {
    // No exercises from notes, just use structured
    return structured
  }

  // Create a set of normalized names from structured exercises for deduplication
  const structuredNames = new Set(
    (structured.exercises ?? []).map((ex) => normalizeExerciseName(ex.name)),
  )

  // Find exercises from notes that aren't already in structured data
  const additionalExercises = (notesParsed.exercises ?? []).filter(
    (ex) => !structuredNames.has(normalizeExerciseName(ex.name)),
  )

  if (additionalExercises.length > 0) {
    console.log(
      `[ParseWorkout][${correlationId}] Adding ${additionalExercises.length} unique exercise(s) from notes: ${additionalExercises.map((e) => e.name).join(', ')}`,
    )
  } else {
    console.log(
      `[ParseWorkout][${correlationId}] No additional unique exercises from notes (all ${notesParsed.exercises.length} were duplicates of structured)`,
    )
  }

  // Reindex the additional exercises to follow the structured ones
  const structuredCount = structured.exercises?.length ?? 0
  const reindexedAdditional = additionalExercises.map((ex, idx) => ({
    ...ex,
    order_index: structuredCount + idx,
  }))

  return {
    isWorkoutRelated: true,
    notes: notesParsed.notes ?? structured.notes ?? null,
    type: notesParsed.type ?? structured.type ?? null,
    exercises: [...(structured.exercises ?? []), ...reindexedAdditional],
  }
}


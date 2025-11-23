// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createCorrelationId, logErrorWithCorrelation } from '../parse-workout/metrics.ts'
import { resolveExercisesWithAgent } from '../parse-workout/resolver/agent.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  const correlationId = createCorrelationId()

  try {
    const { exerciseNames, userId } = await req.json()

    if (!Array.isArray(exerciseNames) || exerciseNames.length === 0) {
      return errorResponse(400, 'exerciseNames array is required')
    }

    if (!userId) {
      return errorResponse(400, 'userId is required')
    }

    const resolutions = await resolveExercisesWithAgent(
      exerciseNames,
      userId,
      correlationId
    )

    // Convert Map to object for JSON response
    const resolutionsObject: Record<string, any> = {}
    for (const [key, value] of resolutions.entries()) {
      resolutionsObject[key] = value
    }

    return jsonResponse({
      resolutions: resolutionsObject,
      correlationId,
    })
  } catch (error) {
    logErrorWithCorrelation(correlationId, 'Exercise resolution failed', error)
    return errorResponse(500, error instanceof Error ? error.message : String(error))
  }
})

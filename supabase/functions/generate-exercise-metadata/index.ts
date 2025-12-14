// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'
// @ts-ignore: Remote import for Deno edge runtime
import { google } from 'npm:@ai-sdk/google@2.0.46'
// @ts-ignore: Remote import for Deno edge runtime
import { generateObject } from 'npm:ai@5.0.60'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'

const requestSchema = z.object({
  exerciseName: z.string().min(1, 'exerciseName is required'),
})

const metadataSchema = z.object({
  muscle_group: z.enum([
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Core',
    'Glutes',
    'Quads',
    'Hamstrings',
    'Calves',
    'Cardio',
    'Full Body',
  ]),
  type: z.enum(['compound', 'isolation']),
  equipment: z.enum([
    'Barbell',
    'Dumbbell',
    'Bodyweight',
    'Cable',
    'Machine',
    'Kettlebell',
    'Resistance Band',
    'Other',
  ]),
})

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const payload = requestSchema.parse(await req.json())

    const result = await generateObject({
      model: google('gemini-2.5-flash-preview-09-2025'),
      schema: metadataSchema,
      prompt: buildPrompt(payload.exerciseName),
    })

    const metadata = metadataSchema.parse(result.object)
    return jsonResponse(metadata)
  } catch (error) {
    console.error('[generate-exercise-metadata] Error:', error)

    if (error instanceof z.ZodError) {
      return errorResponse(400, 'Invalid request', error.errors)
    }

    return jsonResponse(
      {
        muscle_group: 'Full Body',
        type: 'compound',
        equipment: 'other',
        _error: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    )
  }
})

function buildPrompt(exerciseName: string): string {
  return `You are a fitness expert. Analyze the exercise name and determine its metadata.

Exercise name: "${exerciseName}"

Determine:
1. Primary muscle group (Chest|Back|Shoulders|Biceps|Triceps|Core|Glutes|Quads|Hamstrings|Calves|Cardio|Full Body)
2. Type (compound or isolation)
   - Compound: works multiple muscle groups/joints (e.g., Bench Press, Squat, Pull-ups)
   - Isolation: targets single muscle group (e.g., Bicep Curl, Leg Extension, Lateral Raise)
3. Equipment (barbell|dumbbell|bodyweight|cable|machine|kettlebell|resistance band|other)

Return the metadata as JSON.`
}

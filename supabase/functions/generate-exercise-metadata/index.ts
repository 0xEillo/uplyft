// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { getOpenAI } from '../_shared/openai.ts'

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
    'barbell',
    'dumbbell',
    'bodyweight',
    'cable',
    'machine',
    'kettlebell',
    'resistance band',
    'other',
  ]),
})

const client = getOpenAI()

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const payload = requestSchema.parse(await req.json())

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are a fitness expert returning strict JSON metadata for exercises.',
        },
        {
          role: 'user',
          content: buildPrompt(payload.exerciseName),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'exercise_metadata',
          schema: jsonSchema,
        },
      },
    })

    const output = response.output?.[0]
    let parsed: unknown

    if (output && output.type === 'output_text') {
      parsed = JSON.parse(output.text)
    } else if (output && output.type === 'output_json') {
      parsed = output.json
    } else {
      throw new Error('Unexpected response format from OpenAI')
    }

    const metadata = metadataSchema.parse(parsed)
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
  return `Exercise name: "${exerciseName}"

Return JSON with properties:
- muscle_group (Chest|Back|Shoulders|Biceps|Triceps|Core|Glutes|Quads|Hamstrings|Calves|Cardio|Full Body)
- type (compound|isolation)
- equipment (barbell|dumbbell|bodyweight|cable|machine|kettlebell|resistance band|other)`
}

const jsonSchema = {
  type: 'object',
  properties: {
    muscle_group: {
      type: 'string',
      enum: [
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
      ],
    },
    type: {
      type: 'string',
      enum: ['compound', 'isolation'],
    },
    equipment: {
      type: 'string',
      enum: [
        'barbell',
        'dumbbell',
        'bodyweight',
        'cable',
        'machine',
        'kettlebell',
        'resistance band',
        'other',
      ],
    },
  },
  required: ['muscle_group', 'type', 'equipment'],
  additionalProperties: false,
} as const

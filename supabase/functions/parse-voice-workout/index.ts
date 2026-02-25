import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'
import { generateObject } from 'npm:ai'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import {
    GEMINI_FALLBACK_MODEL,
    GEMINI_MODEL,
    openrouter,
} from '../_shared/openrouter.ts'

// Schema for the parsed workout output
const exerciseSetSchema = z.object({
  weight: z
    .string()
    .describe('Weight used as a number string (empty string if not specified)'),
  reps: z
    .string()
    .describe(
      'Reps performed as a number string (empty string if not specified, or duration like "30" for timed exercises)',
    ),
})

const exerciseSchema = z.object({
  name: z
    .string()
    .describe(
      'Proper name of the exercise (e.g., "Bench Press", "Barbell Squat", "Pull-ups")',
    ),
  sets: z
    .array(exerciseSetSchema)
    .describe('Array of sets performed for this exercise'),
})

const voiceWorkoutSchema = z.object({
  title: z
    .string()
    .nullable()
    .describe(
      'Short workout title inferred from the exercises (e.g., "Upper Body", "Leg Day", "Push Day"). Null if unclear.',
    ),
  exercises: z
    .array(exerciseSchema)
    .describe('Array of exercises parsed from the voice transcript'),
})

const requestSchema = z.object({
  text: z.string().min(1).max(5000),
  weightUnit: z.enum(['kg', 'lb']).optional(),
})

const PARSE_TIMEOUT_MS = 15000

async function parseWithModel(
  modelName: string,
  text: string,
  weightUnit: string,
): Promise<z.infer<typeof voiceWorkoutSchema>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error(
      `[ParseVoiceWorkout] AI call (${modelName}) timed out after ${PARSE_TIMEOUT_MS}ms`,
    )
    controller.abort()
  }, PARSE_TIMEOUT_MS)

  const startTime = Date.now()

  try {
    console.log(
      `[ParseVoiceWorkout] Trying ${modelName}, timeout: ${PARSE_TIMEOUT_MS}ms`,
    )

    const model = openrouter.chat(modelName)

    const result = await generateObject({
      model,
      schema: voiceWorkoutSchema,
      messages: [
        {
          role: 'user',
          content: `You are a workout logging assistant. Parse the following voice-transcribed workout text into structured exercise data.

The user dictated their workout via voice, so expect natural speech patterns like:
- "I did bench press 135 for 8 reps then 155 for 6 reps and 175 for 4"
- "squats 225 pounds 5 sets of 5"
- "did 3 sets of pull-ups 10 reps each"
- "deadlift 315 for 3 then 335 for 2 then 365 for 1"
- "overhead press 95 pounds 4 sets of 8"
- "finished with some lateral raises 20 pounds 3 sets of 12"
- "did bench 135 by 10, 185 by 8, 205 by 6"
- "ran for 30 minutes"
- "incline dumbbell press 50s for 10, 55s for 8, 60s for 6"

CRITICAL RULES:
1. Extract EACH exercise as a separate entry with a proper, standard exercise name.
2. Normalize exercise names to their standard gym names (e.g., "bench" → "Bench Press", "squats" → "Barbell Squat", "deads" → "Deadlift", "OHP" → "Overhead Press").
3. Parse weights as plain numbers without units (the app handles units). When the user says "50s" or "50 pound dumbbells", just use "50".
4. The user's weight unit preference is: ${weightUnit}. Interpret ambiguous weights in this unit.
5. When someone says "X sets of Y reps" or "X by Y", create that many individual sets.
6. When someone says "135 for 8, 155 for 6" those are separate sets with different weights.
7. If no weight is mentioned for an exercise, leave weight as empty string.
8. If no reps are mentioned, leave reps as empty string.
9. For timed exercises (e.g., "30 seconds"), put the time value in reps.
10. If the same exercise is mentioned multiple times, combine all sets under one exercise entry.
11. Generate a short, descriptive title for the workout based on the muscle groups or exercises mentioned.

Voice transcript:
"${text}"`,
        },
      ],
      abortSignal: controller.signal,
    })

    const elapsed = Date.now() - startTime
    console.log(`[ParseVoiceWorkout] ${modelName} succeeded in ${elapsed}ms`)
    console.log(
      `[ParseVoiceWorkout] Response usage: ${JSON.stringify(result.usage ?? 'N/A')}`,
    )

    return result.object
  } finally {
    clearTimeout(timeoutId)
  }
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const body = await req.json()
    const { text, weightUnit } = requestSchema.parse(body)

    console.log('[ParseVoiceWorkout] Received text:', {
      textLength: text.length,
      textPreview: text.substring(0, 100),
      weightUnit,
    })

    let parsed: z.infer<typeof voiceWorkoutSchema>

    try {
      parsed = await parseWithModel(
        GEMINI_MODEL,
        text,
        weightUnit ?? 'lb',
      )
    } catch (primaryError) {
      console.error(
        `[ParseVoiceWorkout] ${GEMINI_MODEL} failed:`,
        primaryError,
      )

      console.log(
        `[ParseVoiceWorkout] Falling back to ${GEMINI_FALLBACK_MODEL}...`,
      )

      try {
        parsed = await parseWithModel(
          GEMINI_FALLBACK_MODEL,
          text,
          weightUnit ?? 'lb',
        )
      } catch (fallbackError) {
        console.error(
          `[ParseVoiceWorkout] ${GEMINI_FALLBACK_MODEL} also failed:`,
          fallbackError,
        )
        throw new Error('Failed to parse voice workout')
      }
    }

    console.log('[ParseVoiceWorkout] Parsed result:', {
      title: parsed.title,
      exerciseCount: parsed.exercises.length,
      exerciseNames: parsed.exercises.map((e) => e.name),
    })

    return jsonResponse({
      title: parsed.title,
      exercises: parsed.exercises,
    })
  } catch (error) {
    console.error('[ParseVoiceWorkout] Error:', error)
    if (error instanceof z.ZodError) {
      return errorResponse(400, 'Invalid request', error.errors)
    }
    return errorResponse(
      500,
      'Failed to parse workout from voice. Please try again.',
    )
  }
})

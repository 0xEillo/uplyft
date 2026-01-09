// @ts-ignore: Remote import for Deno edge runtime
import { generateObject } from 'npm:ai'
import { openrouter } from '../_shared/openrouter.ts'
import {
  PARSER_FALLBACK_MODEL,
  PARSER_MODEL,
  PARSE_TIMEOUT_MS,
} from './constants.ts'
import { ApiError } from './errors.ts'
import { ParsedWorkout, WorkoutRequest, workoutSchema } from './schemas.ts'

async function tryGenerateWithModel(
  modelName: string,
  prompt: string,
  correlationId: string,
): Promise<ParsedWorkout> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error(
      `[ParseWorkout][${correlationId}] AI call (${modelName}) timed out after ${PARSE_TIMEOUT_MS}ms`,
    )
    controller.abort()
  }, PARSE_TIMEOUT_MS)

  const startTime = Date.now()

  try {
    console.log(
      `[ParseWorkout][${correlationId}] Trying ${modelName}, timeout: ${PARSE_TIMEOUT_MS}ms`,
    )

    const model = openrouter.chat(modelName)
    const structured = await generateObject({
      model,
      schema: workoutSchema,
      prompt,
      abortSignal: controller.signal,
    })

    const elapsed = Date.now() - startTime
    console.log(
      `[ParseWorkout][${correlationId}] ${modelName} succeeded in ${elapsed}ms`,
    )
    console.log(
      `[ParseWorkout][${correlationId}] Response usage: ${JSON.stringify(
        structured.usage ?? 'N/A',
      )}`,
    )
    return structured.object
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function parseWorkoutNotes(
  payload: WorkoutRequest,
  correlationId: string,
): Promise<ParsedWorkout> {
  const prompt = buildParsePrompt(payload.notes, payload.weightUnit ?? 'kg')

  console.log(
    `[ParseWorkout][${correlationId}] Prompt length: ${prompt.length} chars, notes length: ${payload.notes.length} chars`,
  )
  console.log(
    `[ParseWorkout][${correlationId}] Notes preview: "${payload.notes.slice(
      0,
      200,
    )}${payload.notes.length > 200 ? '...' : ''}"`,
  )

  // Try primary model first
  try {
    return await tryGenerateWithModel(PARSER_MODEL, prompt, correlationId)
  } catch (primaryError) {
    console.error(
      `[ParseWorkout][${correlationId}] ${PARSER_MODEL} failed: ${
        primaryError instanceof Error
          ? primaryError.message
          : String(primaryError)
      }`,
    )

    // Check for content refusal - don't retry
    if (
      primaryError &&
      typeof primaryError === 'object' &&
      'cause' in primaryError &&
      (primaryError as { cause?: { refusal?: unknown } }).cause?.refusal
    ) {
      throw new ApiError(
        400,
        'CONTENT_REFUSED',
        'AI refused to process this content for safety reasons',
      )
    }

    // Try fallback model
    console.log(
      `[ParseWorkout][${correlationId}] Falling back to ${PARSER_FALLBACK_MODEL}...`,
    )

    try {
      return await tryGenerateWithModel(
        PARSER_FALLBACK_MODEL,
        prompt,
        correlationId,
      )
    } catch (fallbackError) {
      console.error(
        `[ParseWorkout][${correlationId}] ${PARSER_FALLBACK_MODEL} also failed: ${
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError)
        }`,
      )

      // Check for content refusal on fallback
      if (
        fallbackError &&
        typeof fallbackError === 'object' &&
        'cause' in fallbackError &&
        (fallbackError as { cause?: { refusal?: unknown } }).cause?.refusal
      ) {
        throw new ApiError(
          400,
          'CONTENT_REFUSED',
          'AI refused to process this content for safety reasons',
        )
      }

      // Both models failed
      throw new ApiError(
        500,
        'PARSE_FAILED',
        'Workout parsing failed (both models)',
        {
          primaryModel: PARSER_MODEL,
          primaryError:
            primaryError instanceof Error
              ? primaryError.message
              : String(primaryError),
          fallbackModel: PARSER_FALLBACK_MODEL,
          fallbackError:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        },
      )
    }
  }
}

export function inferWorkoutTitle(
  existingTitle: string | undefined,
): string | undefined {
  // Title is required in the UI, so this just trims and returns it
  return existingTitle?.trim() || undefined
}

function buildParsePrompt(notes: string, weightUnit: 'kg' | 'lb'): string {
  const conversionInstructions =
    weightUnit === 'lb'
      ? 'If weights are in kg, convert to lbs using this formula: weight_in_lbs = weight_in_kg × 2.20462'
      : 'If weights are in lbs, convert to kg using this formula: weight_in_kg = weight_in_lbs ÷ 2.20462'

  return `You are a workout tracking assistant. Parse the following workout notes and extract structured data that matches our database schema.

User's Workout Notes:
"${notes}"

Weight Unit: ${weightUnit}

Instructions:
1. Extract each exercise with its name, sets, reps, and weight
2. Preserve the order of exercises as they appear in the notes
3. If the user mentions warm-up sets or sets without specific reps, include them but mark reps as null
4. Convert all weights to ${weightUnit}. ${conversionInstructions}
5. Extract RPE (Rate of Perceived Exertion) if mentioned
6. Leave all 'notes' and 'type' fields as null - we handle those separately

Return structured data following the schema.`
}

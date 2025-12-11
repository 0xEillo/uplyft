// @ts-ignore: Remote import for Deno edge runtime
import { openai } from 'npm:@ai-sdk/openai@2.0.42'
// @ts-ignore: Remote import for Deno edge runtime
import { generateObject } from 'npm:ai@5.0.60'

import { PARSER_MODEL } from './constants.ts'
import { ApiError } from './errors.ts'
import { logWithCorrelation } from './metrics.ts'
import { ParsedWorkout, WorkoutRequest, workoutSchema } from './schemas.ts'

const parserModel = openai(PARSER_MODEL)

export async function parseWorkoutNotes(
  payload: WorkoutRequest,
  correlationId: string,
): Promise<ParsedWorkout> {
  try {
    logWithCorrelation(
      correlationId,
      `Parsing workout notes (unit=${payload.weightUnit ?? 'kg'})`,
    )

    const structured = await generateObject({
      model: parserModel,
      schema: workoutSchema,
      prompt: buildParsePrompt(payload.notes, payload.weightUnit ?? 'kg'),
    })

    return structured.object
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'cause' in error &&
      (error as { cause?: { refusal?: unknown } }).cause?.refusal
    ) {
      throw new ApiError(
        400,
        'CONTENT_REFUSED',
        'AI refused to process this content for safety reasons',
      )
    }

    throw new ApiError(
      500,
      'PARSE_FAILED',
      'Workout parsing failed',
      error instanceof Error ? error.message : String(error),
    )
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

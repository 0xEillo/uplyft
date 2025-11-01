import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'

import { PARSER_MODEL, TITLE_MODEL } from './constants.ts'
import { ApiError } from './errors.ts'
import { logWithCorrelation } from './metrics.ts'
import { ParsedWorkout, WorkoutRequest, workoutSchema } from './schemas.ts'

const parserModel = openai(PARSER_MODEL)
const titleModel = openai(TITLE_MODEL)

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

export async function inferWorkoutTitle(
  existingTitle: string | undefined,
  parsedWorkout: ParsedWorkout,
  correlationId: string,
): Promise<string | undefined> {
  if (existingTitle?.trim()) {
    return existingTitle.trim()
  }

  if (parsedWorkout.type?.trim()) {
    return parsedWorkout.type.trim()
  }

  if (
    !Array.isArray(parsedWorkout.exercises) ||
    parsedWorkout.exercises.length === 0
  ) {
    return undefined
  }

  try {
    const exerciseList = parsedWorkout.exercises
      .map((ex) => `${ex.name} (${ex.sets.length} sets)`)
      .join(', ')

    const titleResult = await generateText({
      model: titleModel,
      prompt: buildTitlePrompt(exerciseList),
    })

    const title = titleResult.text.trim()
    logWithCorrelation(correlationId, `Generated workout title: ${title}`)
    return title || undefined
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'Title generation failed, falling back to undefined',
      error,
    )
    return undefined
  }
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
6. Extract any exercise-specific notes
7. Try to infer the workout type if possible (e.g., "Push Day", "Pull Day", "Leg Day", "Upper Body", "Full Body")
8. IMPORTANT: The 'notes' field should ONLY contain explicit user comments or descriptions about the workout (e.g., "Felt great today!", "New PR!", "Struggled with form"). If the user didn't provide any description or comment about the workout session itself, leave the notes field as null.

Return structured data following the schema.`
}

function buildTitlePrompt(exerciseList: string): string {
  return `You are a fitness expert analyzing workout sessions. Based on the exercises performed, generate a concise workout title (2-3 words max).

Exercises performed: ${exerciseList}

Guidelines:
- Use standard workout split terminology: Upper Body, Lower Body, Push, Pull, Glutes, Quads, Hamstrings, Calves, Full Body, Core, Cardio, Arms, Shoulders, Back, Chest
- If it's a specific split, use that (e.g., "Push Session", "Pull Session", "Glute Session")
- If it's mixed, use broader terms (e.g., "Upper Body", "Full Body")
- Keep it SHORT and specific (2-3 words maximum)
- IMPORTANT: Use proper capitalization (Title Case) - capitalize the first letter of each major word
- Examples: "Upper Body", "Lower Body", "Push Session", "Pull Session", "Glute Session", "Full Body"

Return ONLY the title with proper capitalization, nothing else.`
}

import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'

// Database schema matching our Supabase tables
const workoutSchema = z.object({
  // Workout session level
  notes: z
    .string()
    .nullish()
    .describe(
      'High-level workout notes or description from the user (e.g., "Great upper body day!")',
    ),
  type: z
    .string()
    .nullish()
    .describe(
      'Workout type like "upper body", "leg day", "full body", "cardio", etc',
    ),

  // Exercises performed
  exercises: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            'Standardized exercise name (e.g., "Bench Press", "Squat", "Deadlift")',
          ),
        order_index: z
          .number()
          .describe('Order of exercise in workout (1, 2, 3, etc)'),
        type: z
          .string()
          .nullish()
          .describe(
            'Exercise pattern type like "5x5", "pyramid", "1RM", "dropset", etc',
          ),
        notes: z
          .string()
          .nullish()
          .describe(
            'Notes specific to this exercise (e.g., "felt heavy today")',
          ),

        // Sets for this exercise
        sets: z.array(
          z.object({
            set_number: z.number().describe('Set number (1, 2, 3, etc)'),
            reps: z
              .number()
              .min(1)
              .describe(
                'Number of repetitions performed (REQUIRED - must be at least 1)',
              ),
            weight: z
              .number()
              .nullish()
              .describe('Weight in pounds (null for bodyweight)'),
            rpe: z
              .number()
              .nullish()
              .describe('Rate of Perceived Exertion (1-10 scale)'),
            notes: z
              .string()
              .nullish()
              .describe(
                'Notes about this specific set (e.g., "failed last rep")',
              ),
          }),
        ),
      }),
    )
    .describe('List of exercises performed in order'),
})

export async function POST(request: Request) {
  try {
    const { notes } = await request.json()

    if (!notes || typeof notes !== 'string') {
      return Response.json({ error: 'Notes are required' }, { status: 400 })
    }

    const result = await generateObject({
      model: openai('gpt-5'),
      schema: workoutSchema,
      prompt: `You are a workout tracking assistant. Parse the following workout notes and extract structured data that matches our database schema.

User's Workout Notes:
"${notes}"

INSTRUCTIONS:
1. Standardize exercise names (e.g., "bench" → "Bench Press", "squat" → "Squat")
2. Parse sets format like "5x5 @ 225" → 5 sets of 5 reps at 225lbs each
3. If no weight mentioned for bodyweight exercises (push-ups, pull-ups), leave weight null
4. Detect workout patterns (5x5, pyramid, etc) and populate the 'type' field
5. Extract any workout-level notes or feelings
6. Order exercises as they appear in the notes (order_index: 1, 2, 3...)
7. Number sets starting from 1 for each exercise
8. CRITICAL: Every set MUST have a reps value (cannot be null). If reps are not specified in the notes, infer a reasonable default (e.g., 5 reps for strength exercises, 10 for accessories)

EXPECTED OUTPUT FORMAT (JSON):
{
  "notes": "Great upper body workout, felt strong today!",
  "type": "upper body",
  "exercises": [
    {
      "name": "Bench Press",
      "order_index": 1,
      "type": "5x5",
      "notes": "PR attempt",
      "sets": [
        { "set_number": 1, "reps": 5, "weight": 225, "rpe": 7 },
        { "set_number": 2, "reps": 5, "weight": 225, "rpe": 8 },
        { "set_number": 3, "reps": 5, "weight": 225, "rpe": 8.5 },
        { "set_number": 4, "reps": 5, "weight": 225, "rpe": 9 },
        { "set_number": 5, "reps": 5, "weight": 225, "rpe": 9.5 }
      ]
    },
    {
      "name": "Incline Dumbbell Press",
      "order_index": 2,
      "type": "pyramid",
      "notes": null,
      "sets": [
        { "set_number": 1, "reps": 10, "weight": 60, "rpe": null },
        { "set_number": 2, "reps": 8, "weight": 70, "rpe": null },
        { "set_number": 3, "reps": 6, "weight": 80, "rpe": null }
      ]
    },
    {
      "name": "Push-ups",
      "order_index": 3,
      "type": null,
      "notes": "bodyweight burnout",
      "sets": [
        { "set_number": 1, "reps": 25, "weight": null, "rpe": null },
        { "set_number": 2, "reps": 20, "weight": null, "rpe": null },
        { "set_number": 3, "reps": 15, "weight": null, "rpe": null }
      ]
    }
  ]
}

IMPORTANT: Return ONLY valid JSON in this exact structure. Make sure exercises is ALWAYS an array, even if empty.`,
    })

    // Handle the result from Structured Outputs
    const workout = result.object

    // With Structured Outputs enabled, the response is guaranteed to match the schema
    // However, we still validate to handle edge cases
    if (!Array.isArray(workout.exercises)) {
      console.error('AI returned invalid exercises format:', workout.exercises)
      return Response.json(
        { error: 'Invalid workout format from AI' },
        { status: 500 },
      )
    }

    // Check if exercises array is empty
    if (workout.exercises.length === 0) {
      return Response.json(
        { error: 'No exercises detected in workout notes' },
        { status: 400 },
      )
    }

    // Generate workout title if not provided
    let workoutType = workout.type
    if (!workoutType && workout.exercises.length > 0) {
      const exerciseList = workout.exercises
        .map((ex) => `${ex.name} (${ex.sets.length} sets)`)
        .join(', ')

      const titleResult = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: `You are a fitness expert analyzing workout sessions. Based on the exercises performed, generate a concise workout title (2-3 words max).

Exercises performed: ${exerciseList}

Guidelines:
- Use standard workout split terminology: Upper Body, Lower Body, Push, Pull, Legs, Full Body, Core, Cardio, Arms, Shoulders, Back, Chest
- If it's a specific split, use that (e.g., "Push Session", "Pull Session", "Leg Session")
- If it's mixed, use broader terms (e.g., "Upper Body", "Full Body")
- Keep it SHORT and specific (2-3 words maximum)
- IMPORTANT: Use proper capitalization (Title Case) - capitalize the first letter of each major word
- Examples: "Upper Body", "Lower Body", "Push Session", "Pull Session", "Leg Session", "Full Body"

Return ONLY the title with proper capitalization, nothing else.`,
      })

      workoutType = titleResult.text.trim()
    }

    return Response.json({
      workout: {
        ...workout,
        type: workoutType,
      },
    })
  } catch (error) {
    // Handle Structured Outputs errors
    // Possible errors: refusal, content_filter, max_tokens, etc.
    console.error('Error parsing workout:', error)

    // Check for refusal (safety-based rejections)
    if (error?.cause?.refusal) {
      return Response.json(
        { error: 'AI refused to process this content for safety reasons' },
        { status: 400 },
      )
    }

    return Response.json(
      { error: 'Failed to parse workout. Please try again.' },
      { status: 500 },
    )
  }
}

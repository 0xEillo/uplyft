import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'

// Database schema matching our Supabase tables
const workoutSchema = z.object({
  // Validation field
  isWorkoutRelated: z
    .boolean()
    .describe(
      'Whether the input is actually workout/fitness related content. Set to false if the input is nonsense, unrelated topics, spam, or random text',
    ),

  // Workout session level
  notes: z
    .string()
    .nullish()
    .describe(
      'ONLY subjective feelings/observations about the workout (e.g., "Great session, felt strong!" or "Shoulder was sore today"). Do NOT include workout data like sets/reps/weights here.',
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
        notes: z
          .string()
          .nullish()
          .describe(
            'ONLY subjective observations about this exercise (e.g., "felt heavy today" or "form was off"). Do NOT include set/rep/weight data here.',
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
              .describe('Weight in kilograms (null for bodyweight)'),
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
      model: openai('gpt-5-nano'),
      schema: workoutSchema,
      prompt: `You are a workout tracking assistant. Parse the following workout notes and extract structured data that matches our database schema.

User's Workout Notes:
"${notes}"

INSTRUCTIONS:
0. FIRST: Determine if the input is actually workout/fitness related content:
   - Set isWorkoutRelated to TRUE if the input describes exercises, sets, reps, weights, fitness activities, or workout sessions
   - Set isWorkoutRelated to FALSE if the input is:
     * Random nonsense or gibberish (e.g., "asdflkj", "blah blah blah")
     * Unrelated topics (e.g., recipes, weather, shopping lists)
     * Spam or inappropriate content
     * Generic conversation with no workout information
   - If isWorkoutRelated is FALSE, set exercises to an empty array and return immediately

1. Standardize exercise names using these guidelines:
   - Use proper capitalization (e.g., "Bench Press", "Squat", "Deadlift")
   - When equipment is specified, include it (e.g., "Dumbbell Curl", "Barbell Row")
   - When equipment is NOT specified, use the most common variant:
     * "bench" or "bench press" → "Bench Press" (barbell is implied)
     * "squat" → "Squat" (barbell is implied)
     * "deadlift" → "Deadlift" (barbell is implied)
     * "curl" or "bicep curl" → "Dumbbell Curl" (most common)
     * "shoulder press" or "press" → "Dumbbell Shoulder Press" (most common)
     * "row" → "Bent Over Row" (barbell is implied)
   - Examples: "db bench" → "Dumbbell Bench Press", "bb curl" → "Barbell Curl"

2. **CRITICAL - CREATE INDIVIDUAL SET OBJECTS:**
   - When the user says "3 sets of 5 reps" → Create 3 SEPARATE set objects, each with 5 reps
   - When the user says "5x5 @ 100kg" → Create 5 SEPARATE set objects, each with 5 reps at 100kg
   - When the user says "4 sets of 8-12 reps" → Create 4 SEPARATE set objects with varying reps (8, 10, 12, 12)
   - NEVER create just one set object when multiple sets are mentioned!
   - Examples:
     * "Bench press 3 sets of 5 reps @ 100kg" = [{set_number: 1, reps: 5, weight: 100}, {set_number: 2, reps: 5, weight: 100}, {set_number: 3, reps: 5, weight: 100}]
     * "Squat 5x5 @ 140kg" = 5 separate set objects, numbered 1-5, each with 5 reps at 140kg
     * "Deadlift 3 sets" = 3 separate set objects with reasonable default reps (e.g., 5 each)

3. **SEPARATE WORKOUT DATA FROM NOTES:**
   - Workout data (sets, reps, weights) goes into the structured "sets" array
   - The "notes" fields are ONLY for subjective feelings/observations
   - Examples of GOOD notes: "felt strong today", "shoulder was sore", "PR attempt!", "form was great"
   - Examples of BAD notes: "5x5 @ 100kg", "3 sets of 10 reps", "did 4 sets" ❌ (this is data, not notes!)
   - If there are no subjective observations, leave notes as null

4. If no weight mentioned for bodyweight exercises (push-ups, pull-ups), leave weight null
5. Extract any workout-level feelings or observations into the workout notes field
6. Order exercises as they appear in the notes (order_index: 1, 2, 3...)
7. Number sets starting from 1 for each exercise (set_number: 1, 2, 3, etc.)
8. CRITICAL: Every set MUST have a reps value (cannot be null). If reps are not specified in the notes, infer a reasonable default (e.g., 5 reps for strength exercises, 10 for accessories)
9. IMPORTANT: Keep weights in kilograms as provided by the user. Do NOT convert to pounds.

EXPECTED OUTPUT FORMAT (JSON):
{
  "isWorkoutRelated": true,
  "notes": "Great upper body workout, felt strong today!",
  "type": "upper body",
  "exercises": [
    {
      "name": "Bench Press",
      "order_index": 1,
      "notes": "PR attempt! Form felt solid",
      "sets": [
        { "set_number": 1, "reps": 5, "weight": 100, "rpe": 7 },
        { "set_number": 2, "reps": 5, "weight": 100, "rpe": 8 },
        { "set_number": 3, "reps": 5, "weight": 100, "rpe": 8.5 },
        { "set_number": 4, "reps": 5, "weight": 100, "rpe": 9 },
        { "set_number": 5, "reps": 5, "weight": 100, "rpe": 9.5 }
      ]
    },
    {
      "name": "Incline Dumbbell Press",
      "order_index": 2,
      "notes": "Felt heavy today",
      "sets": [
        { "set_number": 1, "reps": 10, "weight": 27.5, "rpe": null },
        { "set_number": 2, "reps": 8, "weight": 32.5, "rpe": null },
        { "set_number": 3, "reps": 6, "weight": 37.5, "rpe": null }
      ]
    },
    {
      "name": "Push-ups",
      "order_index": 3,
      "notes": "Burnout set to failure",
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

    // Check if the input is actually workout-related
    if (!workout.isWorkoutRelated) {
      return Response.json(
        {
          error:
            "This doesn't appear to be workout-related content. Please describe your exercises, sets, and reps.",
        },
        { status: 400 },
      )
    }

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
        {
          error:
            'No exercises could be detected. Please include specific exercises with sets and reps.',
        },
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
        model: openai('gpt-5-nano'),
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

    // Remove validation field before returning
    const { isWorkoutRelated, ...workoutData } = workout

    return Response.json({
      workout: {
        ...workoutData,
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

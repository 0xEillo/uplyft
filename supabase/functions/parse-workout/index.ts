// deno-lint-ignore-file no-explicit-any
import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

const workoutSchema = z.object({
  isWorkoutRelated: z.boolean(),
  notes: z.string().nullish(),
  type: z.string().nullish(),
  exercises: z
    .array(
      z.object({
        name: z.string(),
        order_index: z.number(),
        notes: z.string().nullish(),
        sets: z.array(
          z.object({
            set_number: z.number(),
            // Allow null/undefined reps for warm-up or non-quantified sets; we'll filter before DB insert
            reps: z.number().int().min(1).nullable().optional(),
            weight: z.number().nullable().optional(),
            rpe: z.number().nullable().optional(),
            notes: z.string().nullish(),
          }),
        ),
      }),
    )
    .describe('List of exercises performed in order'),
})

const requestSchema = z.object({
  notes: z.string(),
  weightUnit: z.enum(['kg', 'lb']).optional().default('kg'),
  createWorkout: z.boolean().optional(),
  userId: z.string().optional(),
  workoutTitle: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
})

const openaiClient = openai('gpt-5-mini')

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const body = await req.json()
    console.log('Request body:', JSON.stringify(body))

    const payload = requestSchema.parse(body)
    console.log('Parsed payload:', JSON.stringify(payload))

    if (payload.createWorkout && !payload.userId) {
      return errorResponse(400, 'User ID is required for workout creation')
    }

    const structured = await generateObject({
      model: openaiClient,
      schema: workoutSchema,
      prompt: buildParsePrompt(payload.notes, payload.weightUnit),
    })

    const workout = structured.object

    if (!workout.isWorkoutRelated) {
      return errorResponse(
        400,
        "This doesn't appear to be workout-related content. Please describe your exercises, sets, and reps.",
      )
    }

    if (!Array.isArray(workout.exercises)) {
      console.error('AI returned invalid exercises format:', workout.exercises)
      return errorResponse(500, 'Invalid workout format from AI')
    }

    if (workout.exercises.length === 0) {
      return errorResponse(
        400,
        'No exercises could be detected. Please include specific exercises with sets and reps.',
      )
    }

    let workoutType = payload.workoutTitle || workout.type || undefined
    if (!workoutType && workout.exercises.length > 0) {
      const exerciseList = workout.exercises
        .map((ex) => `${ex.name} (${ex.sets.length} sets)`)
        .join(', ')

      const titleResult = await generateText({
        model: openai('gpt-4.1-nano'),
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

    const { isWorkoutRelated, ...workoutData } = workout

    const finalWorkout = {
      ...workoutData,
      type: workoutType,
      notes: workoutData.notes ?? undefined,
      exercises: workoutData.exercises.map((ex) => {
        const sets = Array.isArray(ex.sets) ? ex.sets : []

        const validSets = sets
          .filter(
            (set) =>
              typeof set.reps === 'number' &&
              Number.isFinite(set.reps) &&
              set.reps >= 1,
          )
          .map((set) => ({
            ...set,
            reps: set.reps as number,
            weight: set.weight ?? undefined,
            rpe: set.rpe ?? undefined,
            notes: set.notes ?? undefined,
          }))

        const warmupSets = sets.filter((set) => set.reps == null)
        const warmupNotes = warmupSets
          .map((s) => s?.notes)
          .filter((n): n is string => Boolean(n && n.trim()))
        const mergedNotes =
          [
            ex.notes,
            warmupNotes.length
              ? `Warm-up: ${warmupNotes.join('; ')}`
              : undefined,
          ]
            .filter(Boolean)
            .join('\n') || undefined

        return {
          ...ex,
          notes: mergedNotes,
          sets: validSets,
        }
      }),
    }

    if (payload.createWorkout && payload.userId) {
      const bearer = req.headers.get('Authorization')
      const accessToken = bearer?.startsWith('Bearer ')
        ? bearer.slice('Bearer '.length).trim()
        : undefined

      const supabase = createUserClient(accessToken)
      const serviceClient = createServiceClient()

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', payload.userId)
          .single()

        if (profileError || !profile) {
          return errorResponse(401, 'Unauthorized')
        }

        const session = await createWorkoutSession(
          serviceClient,
          payload.userId,
          finalWorkout,
          payload.notes,
          payload.imageUrl,
        )

        const { data: completeWorkout, error: fetchError } = await supabase
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

        if (fetchError) throw fetchError

        return jsonResponse({
          workout: finalWorkout,
          createdWorkout: completeWorkout,
        })
      } catch (dbError) {
        console.error('Error creating workout in database:', dbError)
        return jsonResponse({
          workout: finalWorkout,
          error: 'Workout parsed but failed to save to database',
          details: dbError instanceof Error ? dbError.message : String(dbError),
        })
      }
    }

    return jsonResponse({ workout: finalWorkout })
  } catch (error) {
    console.error('Error parsing workout:', error)
    if (error instanceof z.ZodError) {
      return errorResponse(400, 'Invalid request', error.errors)
    }

    if (
      error &&
      typeof error === 'object' &&
      'cause' in error &&
      (error as any).cause &&
      typeof (error as any).cause === 'object' &&
      'refusal' in ((error as any).cause as Record<string, unknown>)
    ) {
      return errorResponse(
        400,
        'AI refused to process this content for safety reasons',
      )
    }

    return errorResponse(500, 'Failed to parse workout. Please try again.')
  }
})

function buildParsePrompt(notes: string, weightUnit: 'kg' | 'lb'): string {
  return `You are a workout tracking assistant. Parse the following workout notes and extract structured data that matches our database schema.

User's Workout Notes:
"${notes}"

[... shortened instructions omitted for brevity ...]
` // Use original prompt from app/api/parse-workout+api.ts
}

async function createWorkoutSession(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  parsedWorkout: any,
  rawText: string,
  imageUrl?: string,
) {
  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId,
      raw_text: rawText,
      notes: parsedWorkout.notes,
      type: parsedWorkout.type,
      image_url: imageUrl || null,
    })
    .select()
    .single()

  if (sessionError) throw sessionError

  if (!Array.isArray(parsedWorkout.exercises)) {
    throw new Error('Invalid workout data: exercises must be an array')
  }

  const uniqueExerciseNames = [
    ...new Set(parsedWorkout.exercises.map((ex: any) => ex.name.toLowerCase())),
  ]

  const serviceSupabase = supabase
  const exercises = await Promise.all(
    uniqueExerciseNames.map((name) =>
      getOrCreateExercise(
        serviceSupabase,
        name,
        userId,
        parsedWorkout.exercises,
      ),
    ),
  )

  const exerciseMap = new Map<string, any>()
  uniqueExerciseNames.forEach((name, index) => {
    exerciseMap.set(name, exercises[index])
  })

  const workoutExercisesToInsert = parsedWorkout.exercises.map(
    (parsedEx: any) => {
      const exercise = exerciseMap.get(parsedEx.name.toLowerCase())
      if (!exercise) {
        throw new Error(`Exercise not found: ${parsedEx.name}`)
      }

      return {
        session_id: session.id,
        exercise_id: exercise.id,
        order_index: parsedEx.order_index,
        notes: parsedEx.notes,
      }
    },
  )

  const { data: workoutExercises, error: weError } = await supabase
    .from('workout_exercises')
    .insert(workoutExercisesToInsert)
    .select()

  if (weError) throw weError

  const allSetsToInsert = parsedWorkout.exercises.flatMap(
    (parsedEx: any, index: number) => {
      const workoutExercise = workoutExercises[index]
      const validSets = (parsedEx.sets || []).filter(
        (set: any) =>
          typeof set.reps === 'number' &&
          Number.isFinite(set.reps) &&
          set.reps >= 1,
      )

      return validSets.map((set: any) => ({
        workout_exercise_id: workoutExercise.id,
        set_number: set.set_number,
        reps: set.reps,
        weight: set.weight ?? null,
        rpe: set.rpe ?? null,
        notes: set.notes ?? null,
      }))
    },
  )

  if (allSetsToInsert.length > 0) {
    const { error: setsError } = await supabase
      .from('sets')
      .insert(allSetsToInsert)
    if (setsError) throw setsError
  }

  return session
}

async function generateExerciseMetadata(exerciseName: string): Promise<{
  muscle_group: string
  type: string
  equipment: string
}> {
  const { generateObject } = await import('ai')
  const { openai } = await import('@ai-sdk/openai')
  const { z } = await import('https://esm.sh/zod@3.25.76')

  const exerciseMetadataSchema = z.object({
    muscle_group: z.enum([
      'Chest',
      'Back',
      'Legs',
      'Shoulders',
      'Biceps',
      'Triceps',
      'Core',
      'Glutes',
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

  try {
    const result = await generateObject({
      model: openai('gpt-4.1-nano'),
      schema: exerciseMetadataSchema,
      prompt: `You are a fitness expert. Analyze the exercise name and determine its metadata.

Exercise name: "${exerciseName}"

Determine:
1. Primary muscle group (Chest, Back, Legs, Shoulders, Biceps, Triceps, Core, Glutes, Cardio, Full Body)
2. Type (compound or isolation)
   - Compound: works multiple muscle groups/joints (e.g., Bench Press, Squat, Pull-ups)
   - Isolation: targets single muscle group (e.g., Bicep Curl, Leg Extension, Lateral Raise)
3. Equipment (barbell, dumbbell, bodyweight, cable, machine, kettlebell, resistance band, other)

Examples:
- "Bench Press" → muscle_group: Chest, type: compound, equipment: barbell
- "Dumbbell Curl" → muscle_group: Biceps, type: isolation, equipment: dumbbell
- "Push-ups" → muscle_group: Chest, type: compound, equipment: bodyweight
- "Lat Pulldown" → muscle_group: Back, type: compound, equipment: cable
- "Leg Extension" → muscle_group: Legs, type: isolation, equipment: machine

Return the metadata as JSON.`,
    })

    return result.object
  } catch (error) {
    console.error('Error generating exercise metadata:', error)
    // Return sensible defaults if AI fails
    return {
      muscle_group: 'Full Body',
      type: 'compound',
      equipment: 'other',
    }
  }
}

async function getOrCreateExercise(
  supabase: ReturnType<typeof createServiceClient>,
  name: string,
  userId: string,
  exercises: any[],
) {
  const originalName = exercises.find(
    (ex: any) => ex.name.toLowerCase() === name,
  )?.name

  const trimmedName = (originalName || name).trim()

  if (!trimmedName) {
    throw new Error('Exercise name cannot be empty')
  }

  if (trimmedName.length > 100) {
    throw new Error('Exercise name too long (max 100 characters)')
  }

  if (/<script|javascript:|on\w+=/i.test(trimmedName)) {
    throw new Error('Invalid exercise name')
  }

  const { data: exactMatch } = await supabase
    .from('exercises')
    .select('*')
    .ilike('name', trimmedName)
    .single()

  if (exactMatch) return exactMatch

  const { data: aliasMatches } = await supabase
    .from('exercises')
    .select('*')
    .contains('aliases', [trimmedName.toLowerCase()])

  if (aliasMatches && aliasMatches.length > 0) {
    return aliasMatches[0]
  }

  // No match found - create new exercise with AI-generated metadata
  const metadata = await generateExerciseMetadata(trimmedName)

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: trimmedName,
      created_by: userId,
      muscle_group: metadata.muscle_group,
      type: metadata.type,
      equipment: metadata.equipment,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

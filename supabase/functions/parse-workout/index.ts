// deno-lint-ignore-file no-explicit-any
import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import OpenAI from 'https://esm.sh/openai@4.73.1'
import { z } from 'https://esm.sh/zod@3.25.76'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'
import {
  createExerciseInput,
  createExerciseTool,
  handleCreateExercise,
  handleSearchExercises,
  searchExercisesInput,
  searchExercisesTool,
} from '../_shared/tools.ts'

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

// Initialize OpenAI client for tool calling (using direct SDK)
const openaiToolClient = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

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
        model: openai('gpt-4.1-mini'),
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

        const { session, metrics } = await createWorkoutSession(
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

        console.log(`[Workout Parser] Metrics:`, JSON.stringify(metrics))

        return jsonResponse({
          workout: finalWorkout,
          createdWorkout: completeWorkout,
          _metrics: metrics,
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

Weight Unit: ${weightUnit}

Instructions:
1. Extract each exercise with its name, sets, reps, and weight
2. Preserve the order of exercises as they appear in the notes
3. If the user mentions warm-up sets or sets without specific reps, include them but mark reps as null
4. Convert all weights to ${weightUnit}
5. Extract RPE (Rate of Perceived Exertion) if mentioned
6. Extract any exercise-specific notes
7. Try to infer the workout type if possible (e.g., "Push Day", "Pull Day", "Leg Day", "Upper Body", "Full Body")

Return structured data following the schema.`
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

  const exercises = parsedWorkout.exercises
  console.log(
    `[Workout Parser] Processing workout ${session.id} with ${exercises.length} exercise(s)`,
  )

  // Resolve all exercises using the OpenAI agent with tools
  const exerciseResolutions = await resolveExercisesWithAgent(
    exercises.map((ex: any) => ex.name),
    userId,
  )

  console.log(
    `[Workout Parser] Agent resolved ${exerciseResolutions.size} exercises (${
      Array.from(exerciseResolutions.values()).filter((r) => r.wasCreated)
        .length
    } created, ${
      Array.from(exerciseResolutions.values()).filter((r) => !r.wasCreated)
        .length
    } matched)`,
  )

  // Build workout_exercises to insert
  const workoutExercisesToInsert = exercises.map((parsedEx: any) => {
    const resolution = exerciseResolutions.get(parsedEx.name)

    if (!resolution) {
      throw new Error(
        `Agent failed to resolve exercise: ${parsedEx.name}. This should not happen.`,
      )
    }

    return {
      session_id: session.id,
      exercise_id: resolution.exerciseId,
      order_index: parsedEx.order_index,
      notes: parsedEx.notes,
    }
  })

  const { data: workoutExercises, error: weError } = await supabase
    .from('workout_exercises')
    .insert(workoutExercisesToInsert)
    .select()

  if (weError) throw weError

  const allSetsToInsert = exercises.flatMap((parsedEx: any, index: number) => {
    const workoutExercise = workoutExercises[index]
    const validSets = (parsedEx.sets || []).filter(
      (set: any) =>
        typeof set.reps === 'number' &&
        Number.isFinite(set.reps) &&
        set.reps >= 1,
    )

    return validSets.map((set: any, setIndex: number) => ({
      workout_exercise_id: workoutExercise.id,
      set_number: set.set_number ?? setIndex + 1,
      reps: set.reps,
      weight: set.weight ?? null,
      rpe: set.rpe ?? null,
      notes: set.notes ?? null,
    }))
  })

  if (allSetsToInsert.length > 0) {
    const { error: setsError } = await supabase
      .from('sets')
      .insert(allSetsToInsert)
    if (setsError) throw setsError
  }

  console.log(
    `[Workout Parser] Completed workout ${session.id}: ${workoutExercises.length} exercises, ${allSetsToInsert.length} sets`,
  )

  const metrics = {
    totalExercises: exercises.length,
    matchedExercises: Array.from(exerciseResolutions.values()).filter(
      (r) => !r.wasCreated,
    ).length,
    createdExercises: Array.from(exerciseResolutions.values()).filter(
      (r) => r.wasCreated,
    ).length,
    totalSets: allSetsToInsert.length,
  }

  return { session, metrics }
}

interface ExerciseResolution {
  exerciseId: string
  exerciseName: string
  wasCreated: boolean
}

async function resolveExercisesWithAgent(
  exerciseNames: string[],
  userId: string,
): Promise<Map<string, ExerciseResolution>> {
  console.log(
    `[Agent] Starting exercise resolution for ${exerciseNames.length} exercises`,
  )

  const resolutions = new Map<string, ExerciseResolution>()

  // Build the agent prompt
  const exerciseList = exerciseNames
    .map((name, i) => `${i + 1}. ${name}`)
    .join('\n')

  const systemPrompt = `You are a fitness exercise database assistant. Your job is to help resolve exercise names to existing database entries or create new ones when needed.

For each exercise the user provides:
1. Use searchExercises tool to find potential matches in the database
2. If you find a good match (similarity >= 0.5), use that exercise ID and tell me which exercise from the list it resolves
3. If no good match exists, use createExercise tool to create a new exercise entry

Guidelines:
- Be lenient with variations (e.g., "bench press" = "barbell bench press")
- Consider equipment variations (e.g., "dumbbell curl" vs "barbell curl" are different)
- Look at aliases to find alternative names
- When creating exercises, infer metadata (muscle_group, type, equipment) from the name

After resolving all exercises, provide a summary listing each original exercise name and the exercise ID it was resolved to.

You must resolve ALL exercises provided.`

  const userPrompt = `Please resolve the following exercises:

${exerciseList}

For each exercise, search for it first, then decide whether to use an existing match or create a new one. You MUST provide resolutions for all ${exerciseNames.length} exercises.

After you've resolved all exercises, provide a final summary in this exact format:
RESOLUTIONS:
1. [Original Exercise Name] -> [Exercise ID] (matched/created)
2. [Original Exercise Name] -> [Exercise ID] (matched/created)
etc.`

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    let iterationCount = 0
    const maxIterations = 20 // Safety limit

    while (iterationCount < maxIterations) {
      iterationCount++

      const response = await openaiToolClient.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: [searchExercisesTool, createExerciseTool],
        tool_choice: 'auto',
      })

      const choice = response.choices[0]

      if (!choice) {
        throw new Error('No response choice from OpenAI')
      }

      // Add assistant's response to conversation
      messages.push(choice.message)

      // Check if agent wants to call tools
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        console.log(
          `[Agent] Iteration ${iterationCount}: Processing ${choice.message.tool_calls.length} tool calls`,
        )

        // Execute all tool calls
        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name
          const toolArgs = JSON.parse(toolCall.function.arguments)

          console.log(
            `[Agent] Tool call: ${toolName}(${JSON.stringify(toolArgs)})`,
          )

          let toolResult: any

          try {
            if (toolName === 'searchExercises') {
              const validatedArgs = searchExercisesInput.parse(toolArgs)
              toolResult = await handleSearchExercises(validatedArgs)
            } else if (toolName === 'createExercise') {
              const validatedArgs = createExerciseInput.parse(toolArgs)
              toolResult = await handleCreateExercise(validatedArgs, userId)

              // Track created exercise
              const originalName = validatedArgs.name
              if (!resolutions.has(originalName)) {
                resolutions.set(originalName, {
                  exerciseId: toolResult.id,
                  exerciseName: toolResult.name,
                  wasCreated: true,
                })
              }
            } else {
              toolResult = { error: `Unknown tool: ${toolName}` }
            }
          } catch (error) {
            console.error(`[Agent] Tool ${toolName} failed:`, error)
            toolResult = {
              error: error instanceof Error ? error.message : String(error),
            }
          }

          if (toolName === 'searchExercises' && toolResult?.candidates) {
            const preview = toolResult.candidates
              .slice(0, 5)
              .map((candidate: any) => ({
                id: candidate.id,
                name: candidate.name,
                similarity: Number(
                  candidate.similarity?.toFixed?.(3) ?? candidate.similarity,
                ),
                muscle_group: candidate.muscle_group,
                type: candidate.type,
                equipment: candidate.equipment,
                aliases: Array.isArray(candidate.aliases)
                  ? candidate.aliases.slice(0, 5)
                  : candidate.aliases,
              }))
            console.log(
              `[Agent] searchExercises results preview (${
                toolResult.candidates.length
              } total): ${JSON.stringify(preview)}`,
            )
          }

          // Add tool result to conversation
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          })
        }

        // Continue loop to let agent process tool results
        continue
      }

      // Agent finished (no more tool calls)
      console.log(`[Agent] Completed after ${iterationCount} iterations`)

      // Parse agent's final response to extract exercise resolutions
      const finalContent = choice.message.content || ''
      console.log(`[Agent] Final response: ${finalContent}`)

      // Try to parse the RESOLUTIONS section from the agent's response
      const resolutionRegex = /(\d+)\.\s+(.+?)\s+->\s+([a-f0-9-]{36})\s+\((matched|created)\)/gi
      let match: RegExpExecArray | null

      while ((match = resolutionRegex.exec(finalContent)) !== null) {
        const originalName = match[2].trim()
        const exerciseId = match[3]
        const wasCreated = match[4] === 'created'

        // Find the actual exercise name in our list (case-insensitive match)
        const actualName = exerciseNames.find(
          (n) => n.toLowerCase() === originalName.toLowerCase(),
        )

        if (actualName && !resolutions.has(actualName)) {
          // Try to get the exercise name from the database
          try {
            const supabase = createServiceClient()
            const { data } = await supabase
              .from('exercises')
              .select('name')
              .eq('id', exerciseId)
              .single()

            resolutions.set(actualName, {
              exerciseId,
              exerciseName: data?.name || originalName,
              wasCreated,
            })
          } catch (error) {
            console.warn(
              `[Agent] Could not fetch exercise name for ${exerciseId}, using original name`,
            )
            resolutions.set(actualName, {
              exerciseId,
              exerciseName: originalName,
              wasCreated,
            })
          }
        }
      }

      // Fallback: if agent didn't explicitly track everything, try to match based on tool calls
      for (const name of exerciseNames) {
        if (!resolutions.has(name)) {
          // Try searching one more time to find it
          console.warn(
            `[Agent] Missing resolution for "${name}", attempting fallback search`,
          )
          try {
            const searchResult = await handleSearchExercises({
              query: name,
              limit: 1,
            })
            if (
              searchResult.candidates.length > 0 &&
              searchResult.candidates[0].similarity >= 0.5
            ) {
              const match = searchResult.candidates[0]
              resolutions.set(name, {
                exerciseId: match.id,
                exerciseName: match.name,
                wasCreated: false,
              })
            } else {
              // Create it as last resort
              const createResult = await handleCreateExercise({ name }, userId)
              resolutions.set(name, {
                exerciseId: createResult.id,
                exerciseName: createResult.name,
                wasCreated: true,
              })
            }
          } catch (error) {
            console.error(`[Agent] Fallback failed for "${name}":`, error)
            throw new Error(`Failed to resolve exercise: ${name}`)
          }
        }
      }

      break
    }

    if (iterationCount >= maxIterations) {
      throw new Error('Agent exceeded maximum iterations')
    }
  } catch (error) {
    console.error('[Agent] Error during exercise resolution:', error)
    throw error
  }

  // Validate we got all resolutions
  for (const name of exerciseNames) {
    if (!resolutions.has(name)) {
      throw new Error(`Agent failed to resolve exercise: ${name}`)
    }
  }

  return resolutions
}

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'
import { google } from 'npm:@ai-sdk/google@2.0.46'
import { openai } from 'npm:@ai-sdk/openai@2.0.42'
import { streamText, tool } from 'npm:ai@5.0.60'

import { corsHeaders, errorResponse, handleCors } from '../_shared/cors.ts'
import {
    getExercisePercentile,
    getExerciseStrengthProgressByName,
    getMuscleGroupDistribution,
    getStrengthScoreProgress,
    getTopExercisesByEstimated1RM,
} from '../_shared/stats.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'
import { buildUserContextSummary, userContextToPrompt } from './user-context.ts'

const messagesSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

type Message = z.infer<typeof messagesSchema>

const imageSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string(),
  }),
})

const workoutContextSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  exercises: z.array(z.object({
    name: z.string(),
    setsCount: z.number(),
    sets: z.array(z.object({
      weight: z.string().optional(),
      reps: z.string().optional(),
    })).optional(),
  })).optional(),
}).optional()

const requestSchema = z.object({
  messages: z.array(messagesSchema),
  userId: z.string().optional(),
  weightUnit: z.enum(['kg', 'lb']).optional(),
  images: z.array(imageSchema).optional(),
  workoutContext: workoutContextSchema,
})

type WorkoutSessionWithDetails = {
  id: string
  date: string | null
  type: string | null
  notes: string | null
  created_at?: string | null
  routine_id?: string | null
  workout_exercises?:
    | {
        exercise?: { name?: string | null } | null
        order_index?: number | null
        notes?: string | null
        sets?:
          | {
              set_number?: number | null
              reps?: number | null
              weight?: number | null
              rpe?: number | null
            }[]
          | null
      }[]
    | null
}

type BodyLogRecord = {
  id: string
  created_at: string
  weight_kg: number | null
  body_fat_percentage: number | null
  bmi: number | null
  file_path?: string | null
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const payload = requestSchema.parse(await req.json())

    const bearer = req.headers.get('Authorization')
    const accessToken = bearer?.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length).trim()
      : undefined

    let systemPrompt: string | undefined
    let tools: Record<string, ReturnType<typeof tool>> | undefined

    if (payload.userId?.trim()) {
      try {
        const { summary, tools: chatTools } = await buildUserContext(
          payload.userId,
          accessToken,
        )
        systemPrompt = buildSystemPrompt(summary, payload.weightUnit, payload.workoutContext)
        tools = chatTools
      } catch (contextError) {
        console.warn('Failed to build user context summary:', contextError)
      }
    }

    // Filter out system messages from client - we use our own system prompt
    const filteredMessages = payload.messages.filter(
      (msg) => msg.role !== 'system',
    )

    // Transform messages to include images in AI SDK format
    const transformedMessages: any[] = filteredMessages.map((msg, index) => {
      // Only add images to the last user message
      if (
        msg.role === 'user' &&
        index === filteredMessages.length - 1 &&
        payload.images &&
        payload.images.length > 0
      ) {
        // Convert to AI SDK format: { type: 'image', image: URL }
        const imageParts = payload.images.map((img) => ({
          type: 'image',
          image: img.image_url.url, // Extract the actual URL from the nested object
        }))

        return {
          role: msg.role,
          content: [{ type: 'text', text: msg.content }, ...imageParts],
        }
      }
      // Return message with string content wrapped properly
      return {
        role: msg.role,
        content: msg.content,
      }
    })

    // Use OpenAI vision model if images are present, otherwise use Gemini
    const modelToUse =
      payload.images && payload.images.length > 0
        ? openai('gpt-4o')
        : google('gemini-1.5-flash')

    const result = streamText({
      model: modelToUse,
      messages: transformedMessages as any,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(tools ? { tools } : {}),
      stopWhen: ({ steps }) =>
        steps[steps.length - 1]?.finishReason !== 'tool-calls',
      onError: (error) => {
        console.error('❌ [streamText] response error:', error)
      },
    })

    return result.toTextStreamResponse({
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error in chat function:', error)
    if (error instanceof z.ZodError) {
      return errorResponse(400, 'Invalid request', error.errors)
    }
    return errorResponse(500, 'Failed to process chat request')
  }
})

async function buildUserContext(
  userId: string,
  accessToken?: string,
): Promise<{
  summary: Awaited<ReturnType<typeof buildUserContextSummary>>
  tools: Record<string, ReturnType<typeof tool>>
}> {
  const supabase = createUserClient(accessToken)
  const serviceSupabase = createServiceClient()

  const summary = await buildUserContextSummary(userId, supabase)

  const tools: Record<string, ReturnType<typeof tool>> = {
    getWorkoutSlice: tool({
      description:
        "Fetch a concise slice of the user's workout history. Provide filters instead of asking for everything.",
      inputSchema: z
        .object({
          exerciseName: z.string().trim().min(1).max(120).optional(),
          since: z
            .string()
            .trim()
            .min(1)
            .max(40)
            .describe(
              'ISO 8601 timestamp; sessions on/after this date are returned',
            )
            .optional(),
          limitSessions: z.number().int().min(1).max(20).optional(),
        })
        .partial(),
      execute: async ({ exerciseName, since, limitSessions } = {}) => {
        const normalizedExercise = exerciseName?.toLowerCase()
        const resolvedLimit = Math.min(Math.max(limitSessions ?? 5, 1), 20)

        const { data, error } = await supabase
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
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(Math.max(resolvedLimit, 5))

        if (error) throw error

        const sessions = (data as WorkoutSessionWithDetails[]) || []
        const sinceDate = since ? new Date(since) : undefined
        const filtered = sessions.filter((session) => {
          if (sinceDate && !Number.isNaN(sinceDate.getTime())) {
            const compareSource = session.date
            if (compareSource) {
              const compareDate = new Date(compareSource)
              if (
                !Number.isNaN(compareDate.getTime()) &&
                compareDate < sinceDate
              ) {
                return false
              }
            }
          }

          if (!normalizedExercise) return true

          return (session.workout_exercises || []).some((we) =>
            we.exercise?.name?.toLowerCase().includes(normalizedExercise || ''),
          )
        })

        const limitedSessions = filtered.slice(0, resolvedLimit)

        return limitedSessions.map((session) => ({
          id: session.id,
          date: session.date,
          type: session.type,
          notes: session.notes,
          routineId: session.routine_id ?? null,
          exercises: (session.workout_exercises || []).map((we) => ({
            name: we.exercise?.name,
            order: we.order_index,
            notes: we.notes,
            sets: (we.sets || []).map((set) => ({
              setNumber: set.set_number,
              reps: set.reps,
              weight: set.weight,
              rpe: set.rpe,
            })),
          })),
        }))
      },
    }),
    getWorkoutRoutines: tool({
      description:
        "List the user's workout routines or load a specific routine with details. You can search by routine name or routine ID.",
      inputSchema: z
        .object({
          routineId: z.string().uuid().optional(),
          routineName: z.string().trim().min(1).max(200).optional(),
          limit: z.number().int().min(1).max(20).optional(),
          includeExercises: z.boolean().optional(),
        })
        .partial(),
      execute: async ({
        routineId,
        routineName,
        limit,
        includeExercises,
      } = {}) => {
        const toIso = (value?: string | null) => {
          if (!value) return undefined
          const date = new Date(value)
          return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
        }

        // Handle fetching a single routine by ID or name
        if (routineId?.trim() || routineName?.trim()) {
          let query = supabase
            .from('workout_routines')
            .select(
              `
              id,
              name,
              notes,
              is_archived,
              created_at,
              updated_at,
              workout_routine_exercises (
                id,
                order_index,
                notes,
                exercise:exercises (*),
                sets:workout_routine_sets (*)
              )
            `,
            )
            .eq('user_id', userId)

          if (routineId?.trim()) {
            query = query.eq('id', routineId.trim())
          } else if (routineName?.trim()) {
            query = query.ilike('name', routineName.trim())
          }

          const { data: routine, error } = await query.single()

          if (error || !routine) {
            throw error || new Error('Routine not found')
          }

          const {
            data: lastSession,
            error: lastSessionError,
          } = await supabase
            .from('workout_sessions')
            .select('id, date, created_at, type, notes')
            .eq('user_id', userId)
            .eq('routine_id', routine.id)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (lastSessionError && lastSessionError.code !== 'PGRST116') {
            throw lastSessionError
          }

          const sortedExercises = (routine.workout_routine_exercises || [])
            .slice()
            .sort(
              (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0),
            )

          const formattedExercises = sortedExercises.map((exercise: any) => {
            const sortedSets = (exercise.sets || [])
              .slice()
              .sort(
                (a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0),
              )

            return {
              id: exercise.id,
              name: exercise.exercise?.name,
              order: exercise.order_index,
              notes: exercise.notes,
              setCount: sortedSets.length,
              sets:
                includeExercises === false
                  ? undefined
                  : sortedSets.map((set: any) => ({
                      id: set.id,
                      setNumber: set.set_number,
                      repsMin: set.reps_min,
                      repsMax: set.reps_max,
                      restSeconds: set.rest_seconds,
                    })),
            }
          })

          return {
            routine: {
              id: routine.id,
              name: routine.name,
              notes: routine.notes,
              isArchived: routine.is_archived,
              createdAt: routine.created_at,
              updatedAt: routine.updated_at,
              exerciseCount: formattedExercises.length,
              lastUsedAt: toIso(lastSession?.date ?? lastSession?.created_at),
              lastSessionId: lastSession?.id ?? undefined,
              exercises: formattedExercises,
            },
          }
        }

        const resolvedLimit = Math.min(Math.max(limit ?? 5, 1), 20)

        const { data: routines, error } = await supabase
          .from('workout_routines')
          .select(
            `
            id,
            name,
            notes,
            is_archived,
            created_at,
            updated_at,
            workout_routine_exercises (
              id,
              order_index,
              notes,
              exercise:exercises (name),
              sets:workout_routine_sets (id, set_number, reps_min, reps_max, rest_seconds)
            )
          `,
          )
          .eq('user_id', userId)
          .eq('is_archived', false)
          .order('updated_at', { ascending: false })
          .limit(resolvedLimit)

        if (error) throw error

        const routineList = routines || []
        const routineIds = routineList.map((routine: any) => routine.id)

        const usageByRoutine = new Map<
          string,
          { lastUsedAt?: string; lastSessionId?: string }
        >()

        if (routineIds.length > 0) {
          const { data: usageRows, error: usageError } = await supabase
            .from('workout_sessions')
            .select('id, date, created_at, routine_id')
            .eq('user_id', userId)
            .in('routine_id', routineIds)
            .order('date', { ascending: false })
            .limit(routineIds.length * 3)

          if (usageError && usageError.code !== 'PGRST103') {
            throw usageError
          }

          for (const row of usageRows || []) {
            const rId = row.routine_id
            if (!rId || usageByRoutine.has(rId)) continue
            usageByRoutine.set(rId, {
              lastUsedAt: toIso(row.date ?? row.created_at),
              lastSessionId: row.id,
            })
          }
        }

        const shouldIncludeExercises = includeExercises === true

        return {
          routines: routineList.map((routine: any) => {
            const usage = usageByRoutine.get(routine.id)
            const sortedExercises = (routine.workout_routine_exercises || [])
              .slice()
              .sort(
                (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0),
              )

            return {
              id: routine.id,
              name: routine.name,
              notes: routine.notes,
              isArchived: routine.is_archived,
              createdAt: routine.created_at,
              updatedAt: routine.updated_at,
              exerciseCount: sortedExercises.length,
              lastUsedAt: usage?.lastUsedAt,
              lastSessionId: usage?.lastSessionId,
              exercises: shouldIncludeExercises
                ? sortedExercises.map((exercise: any) => ({
                    id: exercise.id,
                    name: exercise.exercise?.name,
                    order: exercise.order_index,
                    notes: exercise.notes,
                    setCount: (exercise.sets || []).length,
                    sets: (exercise.sets || [])
                      .slice()
                      .sort(
                        (a: any, b: any) =>
                          (a.set_number ?? 0) - (b.set_number ?? 0),
                      )
                      .map((set: any) => ({
                        id: set.id,
                        setNumber: set.set_number,
                        repsMin: set.reps_min,
                        repsMax: set.reps_max,
                        restSeconds: set.rest_seconds,
                      })),
                  }))
                : undefined,
            }
          }),
        }
      },
    }),
    getPersonalRecords: tool({
      description:
        "Return the user's strongest sets (PRs). Call this when summarizing best lifts or asking about max weight/reps.",
      inputSchema: z
        .object({
          exerciseName: z.string().trim().min(1).max(120).optional(),
          limit: z.number().int().min(1).max(20).optional(),
        })
        .partial(),
      execute: async ({ exerciseName, limit } = {}) => {
        const { data, error } = await supabase
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
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(200)

        if (error) throw error

        const sessions = (data as WorkoutSessionWithDetails[]) || []
        const normalizedExercise = exerciseName?.toLowerCase()
        const prByExercise = new Map<
          string,
          {
            weight: number
            reps: number | null
            sessionDate: string | null
            sessionType: string | null
            sessionId: string
            routineId: string | null
          }
        >()

        for (const session of sessions) {
          const sessionRoutineId = session.routine_id ?? null
          for (const we of session.workout_exercises || []) {
            const name = we.exercise?.name
            if (!name) continue
            if (
              normalizedExercise &&
              !name.toLowerCase().includes(normalizedExercise)
            ) {
              continue
            }

            for (const set of we.sets || []) {
              if (typeof set.weight !== 'number') continue

              const current = prByExercise.get(name)
              if (!current || set.weight > current.weight) {
                prByExercise.set(name, {
                  weight: set.weight,
                  reps: set.reps ?? null,
                  sessionDate: session.date ?? null,
                  sessionType: session.type,
                  sessionId: session.id,
                  routineId: sessionRoutineId,
                })
              }
            }
          }
        }

        const entries = Array.from(prByExercise.entries())
          .map(([name, record]) => ({
            exercise: name,
            bestWeight: record.weight,
            reps: record.reps,
            sessionDate: record.sessionDate,
            sessionType: record.sessionType,
            sessionId: record.sessionId,
            routineId: record.routineId,
          }))
          .sort((a, b) => b.bestWeight - a.bestWeight)

        return entries.slice(0, Math.min(limit ?? 5, 20))
      },
    }),
    getBodyLogSnapshots: tool({
      description:
        'Fetch body scan snapshots (images + metrics). Use pagination (before/after) instead of requesting the entire history at once.',
      inputSchema: z
        .object({
          limit: z.number().int().min(1).max(15).optional(),
          before: z
            .string()
            .trim()
            .min(1)
            .max(40)
            .describe(
              'ISO 8601 timestamp; only scans earlier than this are returned',
            )
            .optional(),
          after: z
            .string()
            .trim()
            .min(1)
            .max(40)
            .describe(
              'ISO 8601 timestamp; only scans later than this are returned',
            )
            .optional(),
          includeUrls: z
            .boolean()
            .default(false)
            .describe(
              'For privacy, image URLs are omitted by default. Set true only when the user explicitly requests a link.',
            )
            .optional(),
        })
        .partial(),
      execute: async ({ limit, before, after, includeUrls } = {}) => {
        const resolvedLimit = Math.min(Math.max(limit ?? 5, 1), 25)

        const { data, error } = await supabase
          .from('body_log_images')
          .select(
            `
            id,
            created_at,
            weight_kg,
            body_fat_percentage,
            bmi,
            file_path
          `,
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(resolvedLimit)

        if (error) throw error

        const records = (data as BodyLogRecord[]) ?? []

        const filtered = records.filter((record) => {
          if (before?.trim()) {
            const beforeDate = new Date(before.trim())
            if (
              !Number.isNaN(beforeDate.getTime()) &&
              new Date(record.created_at) >= beforeDate
            ) {
              return false
            }
          }

          if (after?.trim()) {
            const afterDate = new Date(after.trim())
            if (
              !Number.isNaN(afterDate.getTime()) &&
              new Date(record.created_at) <= afterDate
            ) {
              return false
            }
          }

          return true
        })

        return filtered.map((record) => ({
          id: record.id,
          capturedAt: record.created_at,
          metrics: {
            weightKg: record.weight_kg,
            bodyFatPercentage: record.body_fat_percentage,
            bmi: record.bmi,
          },
          image:
            includeUrls && record.file_path
              ? {
                  filePath: record.file_path,
                }
              : undefined,
        }))
      },
    }),
    getStrengthProgress: tool({
      description:
        "Return estimated 1RM progress for the user's lifts. Call with an exercise name or let the tool choose a few top lifts.",
      inputSchema: z
        .object({
          exerciseName: z.string().trim().min(1).max(120).optional(),
          daysBack: z.number().int().min(7).max(365).optional(),
          limit: z.number().int().min(1).max(5).optional(),
        })
        .passthrough()
        .partial(),
      execute: async ({ exerciseName, daysBack, limit } = {}) => {
        if (exerciseName?.trim()) {
          const result = await getExerciseStrengthProgressByName(
            supabase,
            userId,
            exerciseName.trim(),
            {
              daysBack,
            },
          )
          if (!result) {
            return {
              exercises: [],
            }
          }
          return {
            exercises: [result],
          }
        }

        const top = await getTopExercisesByEstimated1RM(supabase, userId, {
          daysBack,
          limit,
        })
        return {
          exercises: top,
        }
      },
    }),
    getStrengthScoreProgress: tool({
      description:
        "Return the user's cumulative strength score (sum of best estimated 1RMs) over time.",
      inputSchema: z
        .object({
          daysBack: z.number().int().min(7).max(365).optional(),
        })
        .partial(),
      execute: async ({ daysBack } = {}) => {
        const series = await getStrengthScoreProgress(supabase, userId, {
          daysBack,
        })
        return { series }
      },
    }),
    getMuscleBalance: tool({
      description:
        'Summarize training volume by muscle group and flag gaps. Use when asked about balance or neglected muscles.',
      inputSchema: z
        .object({
          daysBack: z.number().int().min(7).max(365).optional(),
          thresholdPercent: z.number().min(1).max(50).default(10).optional(),
        })
        .partial(),
      execute: async ({ daysBack, thresholdPercent } = {}) => {
        const { distribution, totalVolume } = await getMuscleGroupDistribution(
          supabase,
          userId,
          {
            daysBack,
          },
        )

        const threshold = Math.min(Math.max(thresholdPercent ?? 10, 1), 50)
        const undertrained = distribution
          .filter((item) => item.percentage < threshold)
          .map((item) => item.muscleGroup)

        return {
          totalVolume,
          distribution,
          undertrained,
        }
      },
    }),
    getLeaderboardPercentile: tool({
      description:
        "Return the user's percentile rank for a given exercise compared to all users.",
      inputSchema: z.object({
        exerciseName: z.string().trim().min(1).max(120),
        includeDetails: z.boolean().optional(),
      }),
      execute: async ({ exerciseName, includeDetails = false }) => {
        const percentile = await getExercisePercentile(
          serviceSupabase,
          userId,
          exerciseName,
        )

        if (!percentile) {
          return {
            found: false,
            exerciseName,
          }
        }

        return {
          found: true,
          exerciseName: percentile.exerciseName,
          percentile: percentile.percentile,
          totalUsers: percentile.totalUsers,
          userMax1RM: percentile.userMax1RM,
          genderPercentile: percentile.genderPercentile ?? null,
          genderWeightPercentile: percentile.genderWeightPercentile ?? null,
          ...(includeDetails ? { exerciseId: percentile.exerciseId } : {}),
        }
      },
    }),
    searchExercises: tool({
      description:
        'Search the exercise database to get a pool of exercises. Fetch at least 10-15 exercises per muscle group to have options to choose from. Returns exercise name, type (compound/isolation), equipment, and muscle info.',
      inputSchema: z
        .object({
          query: z
            .string()
            .optional()
            .describe('Optional text to match in exercise name'),
          targetMuscle: z
            .string()
            .optional()
            .describe(
              'MUST be one of: Back, Biceps, Calves, Cardio, Chest, Core, Forearms, Full Body, Glutes, Hamstrings, Quads, Shoulders, Triceps',
            ),
          equipment: z
            .string()
            .optional()
            .describe(
              'Optional filter. MUST be one of: barbell, bodyweight, cable, dumbbell, kettlebell, machine, resistance band',
            ),
          limit: z.number().int().min(1).max(50).default(20).optional(),
        })
        .partial(),
      execute: async ({ query, targetMuscle, equipment, limit = 20 } = {}) => {
        console.log('🔍 [searchExercises] Called with:', {
          query,
          targetMuscle,
          equipment,
          limit,
        })

        // Map common synonyms to canonical muscle group names
        // Canonical groups: Back, Biceps, Calves, Cardio, Chest, Core, Forearms, Full Body, Glutes, Hamstrings, Quads, Shoulders, Triceps
        const muscleMapping: Record<string, string> = {
          // Quads synonyms
          quadriceps: 'Quads',
          quads: 'Quads',
          legs: 'Quads',
          'lower body': 'Quads',
          thighs: 'Quads',
          adductors: 'Quads',
          'inner thigh': 'Quads',

          // Chest synonyms
          pecs: 'Chest',
          pectorals: 'Chest',
          chest: 'Chest',

          // Back synonyms
          lats: 'Back',
          latissimus: 'Back',
          traps: 'Back',
          trapezius: 'Back',
          rhomboids: 'Back',
          'lower back': 'Back',
          'upper back': 'Back',
          'mid back': 'Back',

          // Core synonyms
          abs: 'Core',
          abdominals: 'Core',
          obliques: 'Core',
          'serratus anterior': 'Core',
          serratus: 'Core',

          // Shoulders synonyms
          delts: 'Shoulders',
          deltoids: 'Shoulders',
          'front delts': 'Shoulders',
          'rear delts': 'Shoulders',
          'side delts': 'Shoulders',

          // Glutes synonyms
          glutes: 'Glutes',
          butt: 'Glutes',
          hips: 'Glutes',
          abductors: 'Glutes',
          'hip abductors': 'Glutes',

          // Arms
          arms: 'Biceps',

          // Cardio synonyms
          'cardiovascular system': 'Cardio',
          cardio: 'Cardio',
          conditioning: 'Cardio',
        }

        const equipmentMapping: Record<string, string> = {
          dumbbells: 'Dumbbell',
          dumbbell: 'Dumbbell',
          barbells: 'Barbell',
          barbell: 'Barbell',
          cables: 'Cable',
          cable: 'Cable',
          machines: 'Machine',
          machine: 'Machine',
          'body weight': 'Bodyweight',
          bodyweight: 'Bodyweight',
          'free weights': 'Dumbbell',
          bands: 'Resistance Band',
          'resistance band': 'Resistance Band',
          kettlebell: 'Kettlebell',
          kettlebells: 'Kettlebell',
        }

        const mappedMuscle = targetMuscle
          ? muscleMapping[targetMuscle.toLowerCase()] || targetMuscle
          : undefined

        const mappedEquipment = equipment
          ? equipmentMapping[equipment.toLowerCase()] || equipment
          : undefined

        let dbQuery = supabase
          .from('exercises')
          .select(
            'id, name, muscle_group, target_muscles, body_parts, equipment, equipments, type, gif_url',
          )
          .limit(limit)
          .order('name', { ascending: true })

        if (query) {
          dbQuery = dbQuery.ilike('name', `%${query}%`)
        }

        if (mappedMuscle) {
          // Search in muscle_group (text) - case insensitive
          dbQuery = dbQuery.ilike('muscle_group', `%${mappedMuscle}%`)
        }

        if (mappedEquipment) {
          // Search in equipment (text) - case insensitive
          dbQuery = dbQuery.ilike('equipment', `%${mappedEquipment}%`)
        }

        const { data, error } = await dbQuery

        if (error) {
          console.error(
            '❌ [searchExercises] Error searching exercises:',
            error,
          )
          return { exercises: [] }
        }

        console.log(
          `✅ [searchExercises] Found ${
            data?.length ?? 0
          } exercises. Top match: ${data?.[0]?.name ?? 'None'}`,
        )

        return {
          exercises: data?.map((ex) => ({
            id: ex.id,
            name: ex.name,
            type: ex.type || 'unknown', // compound, isolation, or unknown
            equipment: ex.equipment || ex.equipments?.[0] || 'unknown',
            muscleGroup: ex.muscle_group,
            targetMuscles: ex.target_muscles,
          })),
        }
      },
    }),
  }

  return { summary, tools }
}

const WORKOUT_JSON_SCHEMA = `{
  "title": "Workout Title",
  "description": "Brief description",
  "estimatedDuration": 45,
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": [
        {
          "type": "warmup" | "working",
          "reps": "12" | "8-10",
          "restSeconds": 60
        }
      ]
    }
  ]
}`

function buildSystemPrompt(
  summary: Awaited<ReturnType<typeof buildUserContextSummary>>,
  weightUnit: 'kg' | 'lb' = 'kg',
  workoutContext?: z.infer<typeof workoutContextSchema>,
): string {
  // Build current workout context section if there's a workout in progress
  const workoutInProgressSection = buildWorkoutInProgressSection(workoutContext)
  
  return [
    "You are the Rep AI gym training copilot. Keep responses short, digestible, and conversational—like you're texting between sets. Don't dump all your knowledge at once. Start with the essentials, and if they want more detail, they'll ask.",
    'User context:\n' + userContextToPrompt(summary),
    `Weight preferences: The user prefers ${
      weightUnit === 'kg' ? 'kilograms (kg)' : 'pounds (lbs)'
    }. When discussing weights, use their preferred unit. All stored weights are in kg, so convert when displaying.`,
    "Ground answers in the user's actual data when relevant. If the data is missing, say so. Keep suggestions actionable and tied to their metrics. If asked about 1 rep max, calculate it using epley's formula (do not show the calculation).",
    'If the user asks about saved routines or templates by name, call the getWorkoutRoutines tool with the routineName parameter. The user context above shows available routine names.',
    'WORKOUT GENERATION:',
    "If (and ONLY if) the user explicitly asks you to create, plan, or generate a workout/routine (e.g. 'Create a chest workout', 'Plan a leg day'), you MUST output the response as a valid JSON object matching the schema below. Do not wrap it in markdown blocks. Do not include any other text.",
    "If the user is just asking a question (e.g. 'Tell me about progressive overload', 'What is a good rep range?'), answer normally with text.",
    `JSON Schema for Workout Plans:\n${WORKOUT_JSON_SCHEMA}`,
    'CRITICAL: EXERCISE SELECTION & NAMING:',
    'You DO NOT natively know which exercises exist in our database. You MUST use the `searchExercises` tool to find valid exercises before creating a workout.',
    '',
    'EXERCISE SELECTION STRATEGY:',
    '1. When creating a workout, call `searchExercises` with the target muscle group and limit=15-20 to get a POOL of options.',
    '2. Review ALL returned exercises and intelligently SELECT the best ones based on:',
    "   - User's available equipment and preferences",
    "   - Exercise variety (don't pick 3 bench press variations - pick different movement patterns)",
    '   - Start with compound movements, then isolation',
    '   - Balance pushing/pulling movements where applicable',
    "   - Consider the user's experience level (beginners: simpler exercises)",
    '3. Use ONLY the exact `name` strings returned by the tool. Do not guess or modify names.',
    '4. If you need exercises for multiple muscle groups, call searchExercises multiple times.',
    '',
    'Example for "chest workout":',
    '- Call searchExercises with targetMuscle="Chest", limit=20',
    '- From results, SELECT diverse exercises: e.g., Barbell Bench Press (compound), Incline Dumbbell Press (upper chest), Cable Fly (isolation)',
    "- Don't just pick the first 4 exercises returned - choose strategically!",
    '',
    'VALID MUSCLE GROUPS: Back, Biceps, Calves, Cardio, Chest, Core, Forearms, Full Body, Glutes, Hamstrings, Quads, Shoulders, Triceps',
    'VALID EQUIPMENT: barbell, bodyweight, cable, dumbbell, kettlebell, machine, resistance band',
    '',
    'EXERCISE SUGGESTIONS FORMAT:',
    'Whenever you suggest, recommend, or mention specific exercises (whether adding to a workout, replacing an exercise, or just discussing options), ALWAYS include a JSON array at the END of your response with the exercise details.',
    'Format: [{"name": "Exercise Name", "sets": 3, "reps": "8-10"}, ...]',
    'This applies when:',
    '- User asks you to add exercises to their workout',
    '- User asks for exercise alternatives or replacements',
    '- You recommend exercises in your response',
    '- You discuss specific exercises the user could try',
    'Example: "I\'d suggest adding some tricep work to balance your push day. Here are a couple options:\\n[{\\"name\\": \\"Tricep Pushdown\\", \\"sets\\": 3, \\"reps\\": \\"12-15\\"}, {\\"name\\": \\"Overhead Tricep Extension\\", \\"sets\\": 3, \\"reps\\": \\"10-12\\"}]"',
    'Do NOT include the JSON for general exercise questions like "what muscles does bench press work?" - only when actually suggesting exercises to add/do.',
    workoutInProgressSection,
  ].filter(Boolean).join('\n\n')
}

function buildWorkoutInProgressSection(
  workoutContext?: z.infer<typeof workoutContextSchema>,
): string {
  if (!workoutContext) return ''
  
  const hasTitle = workoutContext.title?.trim()
  const hasNotes = workoutContext.notes?.trim()
  const hasExercises = workoutContext.exercises && workoutContext.exercises.length > 0
  
  if (!hasTitle && !hasNotes && !hasExercises) return ''
  
  const lines: string[] = [
    'CURRENT WORKOUT IN PROGRESS:',
    'The user is currently creating/logging a workout. Use this context to provide relevant suggestions, modifications, or exercise recommendations.',
  ]
  
  if (hasTitle) {
    lines.push(`Workout Title: "${workoutContext.title}"`)
  }
  
  if (hasNotes) {
    lines.push(`Notes/Description: "${workoutContext.notes}"`)
  }
  
  if (hasExercises) {
    const exerciseList = workoutContext.exercises!.map(
      (e: { name: string; setsCount: number; sets?: { weight?: string; reps?: string }[] }, i: number) => {
        let exerciseLine = `${i + 1}. ${e.name}`
        
        // Include set details if available
        if (e.sets && e.sets.length > 0) {
          const setDetails = e.sets.map((set, setIdx) => {
            const parts: string[] = []
            if (set.weight) parts.push(`${set.weight}`)
            if (set.reps) parts.push(`${set.reps} reps`)
            return parts.length > 0 ? `Set ${setIdx + 1}: ${parts.join(' x ')}` : null
          }).filter(Boolean).join(', ')
          
          if (setDetails) {
            exerciseLine += ` - ${setDetails}`
          } else {
            exerciseLine += ` (${e.setsCount} sets planned)`
          }
        } else {
          exerciseLine += ` (${e.setsCount} sets planned)`
        }
        
        return exerciseLine
      }
    ).join('\n')
    lines.push(`Current Exercises:\n${exerciseList}`)
  }
  
  lines.push(
    'When the user asks for suggestions, exercise replacements, or modifications, consider this context.',
    'If they ask to add exercises, suggest ones that complement their current workout.',
    'If they ask to replace an exercise, suggest alternatives based on the exercise being replaced.',
  )
  
  return lines.join('\n')
}

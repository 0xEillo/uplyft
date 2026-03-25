// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'
import { openai } from 'npm:@ai-sdk/openai@2.0.42'
import { streamText, tool } from 'npm:ai'
import { GEMINI_MODEL, openrouter } from '../_shared/openrouter.ts'

import { summarizeBodyLogContext } from '../_shared/body-log-context.ts'
import { corsHeaders, errorResponse, handleCors } from '../_shared/cors.ts'
import {
  buildAdherenceSummary,
  buildRecoverySummary,
} from '../_shared/readiness.ts'
import {
  getExerciseStrengthProgressByName,
  getMuscleGroupDistribution,
  getTopExercisesByEstimated1RM,
} from '../_shared/stats.ts'
import {
  buildUserStrengthProfile,
  getExerciseStandardsForProfile,
} from '../_shared/strength.ts'
import { createUserClient } from '../_shared/supabase.ts'
import {
  buildUserContextSummary,
  summarizeTrainingPatterns,
  userContextToPrompt,
} from './user-context.ts'

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

type ChatImagePart =
  | {
      type: 'image'
      image: string
      mediaType?: string
    }
  | {
      type: 'image'
      image: URL
      mediaType?: string
    }

const workoutContextSchema = z
  .object({
    title: z.string().optional(),
    notes: z.string().optional(),
    exercises: z
      .array(
        z.object({
          name: z.string(),
          setsCount: z.number(),
          sets: z
            .array(
              z.object({
                weight: z.string().optional(),
                reps: z.string().optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  })
  .optional()

const dailyLogSummarySchema = z
  .object({
    logDate: z.string().optional(),
    totals: z
      .object({
        calories: z.number().nonnegative().optional(),
        protein_g: z.number().nonnegative().optional(),
        carbs_g: z.number().nonnegative().optional(),
        fat_g: z.number().nonnegative().optional(),
        meal_count: z.number().int().nonnegative().optional(),
      })
      .partial()
      .optional(),
    goals: z
      .object({
        calorie_goal: z.number().nonnegative().nullable().optional(),
        protein_goal_g: z.number().nonnegative().nullable().optional(),
      })
      .partial()
      .optional(),
  })
  .partial()
  .optional()

const requestSchema = z.object({
  messages: z.array(messagesSchema),
  userId: z.string().optional(),
  weightUnit: z.enum(['kg', 'lb']).optional(),
  coachSystemPrompt: z.string().max(4000).optional(),
  equipmentPreference: z
    .enum([
      'full_gym',
      'home_minimal',
      'dumbbells_only',
      'bodyweight',
      'barbell_only',
    ])
    .optional(),
  images: z.array(imageSchema).optional(),
  workoutContext: workoutContextSchema,
  dailyLogSummary: dailyLogSummarySchema,
  scanMode: z.enum(['food_label']).optional(), // hint for specialised routing
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
  muscle_mass_kg?: number | null
  lean_mass_kg?: number | null
  fat_mass_kg?: number | null
  score_v_taper?: number | null
  score_chest?: number | null
  score_shoulders?: number | null
  score_abs?: number | null
  score_arms?: number | null
  score_back?: number | null
  score_legs?: number | null
  analysis_summary?: string | null
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
    console.log('[chat-edge] Request received:', {
      hasUserId: Boolean(payload.userId?.trim()),
      messagesCount: payload.messages.length,
      hasCoachSystemPrompt: Boolean(payload.coachSystemPrompt?.trim()),
      equipmentPreference: payload.equipmentPreference ?? null,
      hasImages: Boolean(payload.images && payload.images.length > 0),
      hasWorkoutContext: Boolean(payload.workoutContext),
      hasDailyLogSummary: Boolean(payload.dailyLogSummary),
      dailyLogDate: payload.dailyLogSummary?.logDate,
    })

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
        systemPrompt = buildSystemPrompt(
          summary,
          payload.weightUnit,
          payload.coachSystemPrompt,
          payload.equipmentPreference,
          payload.workoutContext,
          payload.dailyLogSummary,
        )
        tools = chatTools
        console.log('[chat-edge] User context built successfully', {
          userId: payload.userId,
          toolsCount: Object.keys(chatTools || {}).length,
        })
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
        const imageParts = payload.images.map((img) =>
          toAiSdkImagePart(img.image_url.url),
        )

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
    console.log('[chat-edge] Messages transformed:', {
      filteredCount: filteredMessages.length,
      transformedCount: transformedMessages.length,
      includesImageParts: Boolean(payload.images && payload.images.length > 0),
    })

    // Route to Gemini for food label scans (better OCR for dense printed text),
    // GPT-4o for other image messages, Gemini for text-only
    const isFoodLabelScan = payload.scanMode === 'food_label'
    const hasImages = Boolean(payload.images && payload.images.length > 0)
    const modelToUse = isFoodLabelScan
      ? openrouter.chat(GEMINI_MODEL) // Gemini: superior OCR on nutrition label text
      : hasImages
      ? openai('gpt-4o') // GPT-4o: general food photo understanding
      : openrouter.chat(GEMINI_MODEL) // Gemini: text-only chat
    console.log('[chat-edge] Model selected:', {
      model: isFoodLabelScan
        ? `openrouter:${GEMINI_MODEL} (food_label OCR)`
        : hasImages
        ? 'openai:gpt-4o'
        : `openrouter:${GEMINI_MODEL}`,
    })

    const latestUserMessage = [...filteredMessages]
      .reverse()
      .find((msg) => msg.role === 'user')
    console.log('[chat-edge] Latest user message snapshot:', {
      textPreview: latestUserMessage?.content?.slice(0, 120) ?? '',
      hasDailyTotals: Boolean(payload.dailyLogSummary?.totals),
      dailyTotals: payload.dailyLogSummary?.totals,
    })

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
    console.log('[chat-edge] streamText started')

    return result.toTextStreamResponse({
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'none',
        'Cache-Control': 'no-cache',
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

function toAiSdkImagePart(url: string): ChatImagePart {
  if (url.startsWith('data:')) {
    const parsed = parseDataUrl(url)
    if (parsed) {
      return {
        type: 'image',
        image: parsed.data,
        mediaType: parsed.mediaType,
      }
    }
  }

  try {
    return {
      type: 'image',
      image: new URL(url),
    }
  } catch {
    return {
      type: 'image',
      image: url,
    }
  }
}

function parseDataUrl(
  value: string,
): { mediaType?: string; data: string } | null {
  const match = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i)
  if (!match) return null

  return {
    mediaType: match[1] || undefined,
    data: match[2],
  }
}

async function buildUserContext(
  userId: string,
  accessToken?: string,
): Promise<{
  summary: Awaited<ReturnType<typeof buildUserContextSummary>>
  tools: Record<string, ReturnType<typeof tool>>
}> {
  const supabase = createUserClient(accessToken)

  const summary = await buildUserContextSummary(userId, supabase)
  let strengthProfilePromise: Promise<
    Awaited<ReturnType<typeof buildUserStrengthProfile>>
  > | null = null
  let recoverySummaryPromise: Promise<
    Awaited<ReturnType<typeof buildRecoverySummary>>
  > | null = null
  let adherenceSummaryPromise: Promise<
    Awaited<ReturnType<typeof buildAdherenceSummary>>
  > | null = null

  const getStrengthProfile = () => {
    if (!strengthProfilePromise) {
      strengthProfilePromise = buildUserStrengthProfile(supabase, userId)
    }

    return strengthProfilePromise
  }

  const getRecoverySummary = () => {
    if (!recoverySummaryPromise) {
      recoverySummaryPromise = buildRecoverySummary(supabase, userId)
    }

    return recoverySummaryPromise
  }

  const getAdherenceSummary = () => {
    if (!adherenceSummaryPromise) {
      adherenceSummaryPromise = buildAdherenceSummary(
        supabase,
        userId,
        summary.profile.commitment,
        summary.profile.commitmentFrequency,
      )
    }

    return adherenceSummaryPromise
  }

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
    getTrainingPatterns: tool({
      description:
        'Summarize how the user has been training recently: exercises per session, working sets, rep-range tendencies, and muscle-group volume per session. Use this for questions about too much volume, too many exercises, rep ranges, split quality, or how to train better.',
      inputSchema: z
        .object({
          daysBack: z.number().int().min(7).max(180).optional(),
          limitSessions: z.number().int().min(3).max(20).optional(),
        })
        .partial(),
      execute: async ({ daysBack, limitSessions } = {}) => {
        const resolvedLimit = Math.min(Math.max(limitSessions ?? 8, 3), 20)

        let query = supabase
          .from('workout_sessions')
          .select(
            `
            id,
            date,
            created_at,
            type,
            workout_exercises (
              order_index,
              exercise:exercises (name, muscle_group),
              sets (set_number, reps, weight, rpe, is_warmup)
            )
          `,
          )
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(resolvedLimit)

        if (typeof daysBack === 'number' && Number.isFinite(daysBack)) {
          const cutoff = new Date()
          cutoff.setUTCDate(cutoff.getUTCDate() - daysBack)
          query = query.gte('created_at', cutoff.toISOString())
        }

        const { data, error } = await query
        if (error) throw error

        const summary = summarizeTrainingPatterns((data as any[]) || [], {
          maxSessions: resolvedLimit,
        })

        return summary ?? { sessionsAnalyzed: 0, muscleGroups: [] }
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
    getBodyCompositionProgress: tool({
      description:
        'Fetch body composition and physique scan history, including lean mass, fat mass, muscle mass, physique scores, and coach notes.',
      inputSchema: z
        .object({
          limit: z.number().int().min(1).max(20).optional(),
          before: z
            .string()
            .trim()
            .min(1)
            .max(40)
            .describe(
              'ISO 8601 timestamp; only entries earlier than this are returned',
            )
            .optional(),
          after: z
            .string()
            .trim()
            .min(1)
            .max(40)
            .describe(
              'ISO 8601 timestamp; only entries later than this are returned',
            )
            .optional(),
          includeAnalysisSummary: z.boolean().optional(),
          includeTrend: z.boolean().optional(),
        })
        .partial(),
      execute: async ({
        limit,
        before,
        after,
        includeAnalysisSummary = true,
        includeTrend = true,
      } = {}) => {
        const resolvedLimit = Math.min(Math.max(limit ?? 8, 1), 20)

        const { data, error } = await supabase
          .from('body_log_entries')
          .select(
            `
            id,
            created_at,
            weight_kg,
            body_fat_percentage,
            bmi,
            muscle_mass_kg,
            lean_mass_kg,
            fat_mass_kg,
            score_v_taper,
            score_chest,
            score_shoulders,
            score_abs,
            score_arms,
            score_back,
            score_legs,
            analysis_summary
          `,
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(Math.max(resolvedLimit, 12))

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

        const entries = filtered.slice(0, resolvedLimit).map((record) => ({
          id: record.id,
          capturedAt: record.created_at,
          metrics: {
            weightKg: record.weight_kg,
            bodyFatPercentage: record.body_fat_percentage,
            bmi: record.bmi,
            muscleMassKg: record.muscle_mass_kg ?? null,
            leanMassKg: record.lean_mass_kg ?? null,
            fatMassKg: record.fat_mass_kg ?? null,
          },
          physiqueScores: {
            vTaper: record.score_v_taper ?? null,
            chest: record.score_chest ?? null,
            shoulders: record.score_shoulders ?? null,
            abs: record.score_abs ?? null,
            arms: record.score_arms ?? null,
            back: record.score_back ?? null,
            legs: record.score_legs ?? null,
          },
          ...(includeAnalysisSummary
            ? { analysisSummary: record.analysis_summary ?? null }
            : {}),
        }))

        const summary = includeTrend ? summarizeBodyLogContext(filtered) : null

        return {
          returned: entries.length,
          entries,
          ...(summary?.latest ? { latest: summary.latest } : {}),
          ...(summary?.trend ? { trend: summary.trend } : {}),
        }
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
    getExerciseStandards: tool({
      description:
        "Return the full strength standards ladder for an exercise, including exact target values for each level and the user's current placement when available.",
      inputSchema: z.object({
        exerciseName: z.string().trim().min(1).max(120),
        includeUserSnapshot: z.boolean().optional(),
      }),
      execute: async ({ exerciseName, includeUserSnapshot = true }) => {
        const strengthProfile = await getStrengthProfile()

        if (strengthProfile.missingRequirements.length > 0) {
          return {
            available: false,
            missingRequirements: strengthProfile.missingRequirements,
            exerciseName,
          }
        }

        const standards = getExerciseStandardsForProfile({
          exerciseName,
          gender: strengthProfile.profile.gender!,
          bodyweightKg: strengthProfile.profile.bodyweightKg!,
        })

        if (!standards) {
          return {
            available: false,
            exerciseName,
            reason: 'No strength standards found for this exercise.',
          }
        }

        const normalizedInput = exerciseName.trim().toLowerCase()
        const currentRank =
          strengthProfile.exerciseRanks.find((rank) => {
            const exercise = rank.exerciseName.trim().toLowerCase()
            const canonical = rank.canonicalExerciseName.trim().toLowerCase()
            const matchedCanonical = standards.canonicalExerciseName
              .trim()
              .toLowerCase()

            return (
              exercise === normalizedInput ||
              canonical === normalizedInput ||
              canonical === matchedCanonical
            )
          }) ?? null

        return {
          available: true,
          exerciseName: standards.canonicalExerciseName,
          gender: standards.gender,
          bodyweightKg: standards.bodyweightKg,
          isRepBased: standards.isRepBased,
          tier: standards.tier,
          levels: standards.levels,
          ...(includeUserSnapshot
            ? {
                current: currentRank
                  ? {
                      level: currentRank.level,
                      nextLevel: currentRank.nextLevel,
                      progress: currentRank.progress,
                      currentValue: currentRank.currentValue,
                      currentMetric: currentRank.currentMetric,
                      targetValue: currentRank.targetValue,
                      targetMetric: currentRank.targetMetric,
                      gapToNextLevel: currentRank.gapToNextLevel,
                      bestSetWeightKg: currentRank.bestSetWeightKg,
                      bestSetReps: currentRank.bestSetReps,
                    }
                  : null,
              }
            : {}),
        }
      },
    }),
    getLifterLevel: tool({
      description:
        "Return the user's current lifter level, total points, next-level progress, and optional muscle-group breakdown.",
      inputSchema: z
        .object({
          includeGroupBreakdown: z.boolean().optional(),
        })
        .partial(),
      execute: async ({ includeGroupBreakdown = false } = {}) => {
        const strengthProfile = await getStrengthProfile()

        if (strengthProfile.missingRequirements.length > 0) {
          return {
            available: false,
            missingRequirements: strengthProfile.missingRequirements,
            trackedExercises: strengthProfile.exerciseRanks.length,
            profile: strengthProfile.profile,
          }
        }

        if (!strengthProfile.overallLevel) {
          return {
            available: false,
            reason: 'No ranked exercises found yet.',
            trackedExercises: 0,
            profile: strengthProfile.profile,
          }
        }

        const overallLevel = strengthProfile.overallLevel

        return {
          available: true,
          profile: strengthProfile.profile,
          trackedExercises: strengthProfile.exerciseRanks.length,
          points: overallLevel.points,
          maxPoints: overallLevel.maxPoints,
          level: overallLevel.level,
          nextLevel: overallLevel.nextLevel,
          progress: overallLevel.progress,
          liftsTracked: overallLevel.liftsTracked,
          weakestGroup: overallLevel.weakestGroup,
          ...(includeGroupBreakdown
            ? { groupBreakdown: overallLevel.groupBreakdown }
            : {}),
        }
      },
    }),
    getExerciseRanks: tool({
      description:
        "Return exercise rank details for the user's standards-backed lifts, including current rank, next level, progress, and gap to level up. Use limit and offset when you need the full list.",
      inputSchema: z
        .object({
          exerciseName: z.string().trim().min(1).max(120).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).max(500).optional(),
          sortBy: z
            .enum([
              'highest_rank',
              'closest_to_next_level',
              'highest_points',
              'most_recent',
            ])
            .optional(),
        })
        .partial(),
      execute: async ({
        exerciseName,
        limit,
        offset,
        sortBy = 'highest_rank',
      } = {}) => {
        const strengthProfile = await getStrengthProfile()

        if (strengthProfile.missingRequirements.length > 0) {
          return {
            available: false,
            missingRequirements: strengthProfile.missingRequirements,
            exerciseRanks: [],
            totalTracked: 0,
            profile: strengthProfile.profile,
          }
        }

        const normalizedExercise = exerciseName?.trim().toLowerCase()
        let exerciseRanks = [...strengthProfile.exerciseRanks]

        if (normalizedExercise) {
          exerciseRanks = exerciseRanks.filter((exercise) => {
            const name = exercise.exerciseName.toLowerCase()
            const canonical = exercise.canonicalExerciseName.toLowerCase()
            return (
              name.includes(normalizedExercise) ||
              canonical.includes(normalizedExercise)
            )
          })
        }

        if (sortBy === 'closest_to_next_level') {
          exerciseRanks.sort((left, right) => {
            const leftGap = left.gapToNextLevel ?? Number.POSITIVE_INFINITY
            const rightGap = right.gapToNextLevel ?? Number.POSITIVE_INFINITY

            if (leftGap !== rightGap) return leftGap - rightGap
            if (right.progress !== left.progress) {
              return right.progress - left.progress
            }
            return right.scorePoints - left.scorePoints
          })
        } else if (sortBy === 'highest_points') {
          exerciseRanks.sort((left, right) => {
            if (right.scorePoints !== left.scorePoints) {
              return right.scorePoints - left.scorePoints
            }
            return right.progress - left.progress
          })
        } else if (sortBy === 'most_recent') {
          exerciseRanks.sort((left, right) => {
            const leftTime = left.lastTrainedAt
              ? new Date(left.lastTrainedAt).getTime()
              : Number.NEGATIVE_INFINITY
            const rightTime = right.lastTrainedAt
              ? new Date(right.lastTrainedAt).getTime()
              : Number.NEGATIVE_INFINITY
            return rightTime - leftTime
          })
        }

        const resolvedOffset = Math.max(0, offset ?? 0)
        const resolvedLimit = Math.min(Math.max(limit ?? 50, 1), 100)
        const pagedRanks = exerciseRanks.slice(
          resolvedOffset,
          resolvedOffset + resolvedLimit,
        )

        return {
          available: true,
          profile: strengthProfile.profile,
          totalTracked: exerciseRanks.length,
          returned: pagedRanks.length,
          offset: resolvedOffset,
          hasMore: resolvedOffset + pagedRanks.length < exerciseRanks.length,
          exerciseRanks: pagedRanks,
        }
      },
    }),
    getRecoveryStatus: tool({
      description:
        "Return muscle-by-muscle recovery/readiness, including how recovered each area is and what's still fatigued.",
      inputSchema: z
        .object({
          muscleGroup: z.string().trim().min(1).max(80).optional(),
          includeRecovered: z.boolean().optional(),
          limit: z.number().int().min(1).max(20).optional(),
        })
        .partial(),
      execute: async ({ muscleGroup, includeRecovered = true, limit } = {}) => {
        const recoverySummary = await getRecoverySummary()
        const normalizedMuscleGroup = muscleGroup?.trim().toLowerCase()

        let muscleRecovery = [...recoverySummary.muscleRecovery]
        if (!includeRecovered) {
          muscleRecovery = muscleRecovery.filter(
            (entry) =>
              entry.recoveryStatus === 'not_recovered' ||
              entry.recoveryStatus === 'recovering',
          )
        }

        if (normalizedMuscleGroup) {
          muscleRecovery = muscleRecovery.filter((entry) =>
            entry.muscleGroup.toLowerCase().includes(normalizedMuscleGroup),
          )
        }

        const resolvedLimit = Math.min(Math.max(limit ?? 12, 1), 20)

        return {
          lastWorkoutDate: recoverySummary.lastWorkoutDate,
          daysSinceLastWorkout: recoverySummary.daysSinceLastWorkout,
          freshMuscleGroups: recoverySummary.freshMuscleGroups,
          totalMuscleGroups: recoverySummary.totalMuscleGroups,
          returned: Math.min(muscleRecovery.length, resolvedLimit),
          muscleRecovery: muscleRecovery.slice(0, resolvedLimit),
        }
      },
    }),
    getConsistencyAdherence: tool({
      description:
        'Return workout consistency and adherence context, including streak, weekly target, recent workout calendar dates, and whether the user is on pace.',
      inputSchema: z
        .object({
          weeksBack: z.number().int().min(2).max(16).optional(),
          calendarDays: z.number().int().min(7).max(120).optional(),
        })
        .partial(),
      execute: async ({ weeksBack, calendarDays } = {}) => {
        const adherenceSummary = await buildAdherenceSummary(
          supabase,
          userId,
          summary.profile.commitment,
          summary.profile.commitmentFrequency,
          {
            weeksBack,
            calendarDays,
          },
        )

        return adherenceSummary
      },
    }),
    searchExercises: tool({
      description:
        'Search the SYSTEM exercise database (non-custom only) to get a pool of exercises. Fetch at least 10-15 exercises per muscle group to have options to choose from. Returns exercise name, type (compound/isolation), equipment, and muscle info.',
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
          .is('created_by', null)
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
    getDetailedNutritionLog: tool({
      description:
        'Fetch detailed nutrition information for a specific day, including individual meals, their descriptions, macros, and timestamps. Use this when the user asks about specific meals or needs to see the detailed breakdown of their daily nutrition.',
      inputSchema: z.object({
        logDate: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
          .describe(
            'The date to fetch meals for in YYYY-MM-DD format (e.g. 2025-03-02). Use the date from the CURRENT DAILY NUTRITION CONTEXT if the user is asking about today.',
          ),
      }),
      execute: async ({ logDate }: { logDate: string }) => {
        const { data: entry } = await supabase
          .from('daily_log_entries')
          .select('id')
          .eq('user_id', userId)
          .eq('log_date', logDate)
          .maybeSingle()

        if (!entry) {
          return { logDate, meals: [] }
        }

        const { data: meals, error } = await supabase
          .from('daily_log_meals')
          .select(
            'id, description, calories, protein_g, carbs_g, fat_g, created_at, source',
          )
          .eq('user_id', userId)
          .eq('daily_log_entry_id', entry.id)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error fetching meals:', error)
          return { logDate, error: 'Failed to fetch meals' }
        }

        return {
          logDate,
          meals: meals || [],
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
          "reps": "6-8" | "10-12",
          "restSeconds": 60
        }
      ]
    }
  ]
}`

const PROGRAM_JSON_SCHEMA = `{
  "title": "Program Title",
  "description": "3-5 sentence coaching brief covering split structure, how to run the week, effort/progression guidance, and recovery/rest-day guidance",
  "goal": "Hypertrophy",
  "frequency": "4 days/week",
  "routines": [
    {
      "name": "Upper 1",
      "duration": "60 min",
      "exerciseCount": 6,
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": "6-8"
        }
      ]
    }
  ]
}`

function buildSystemPrompt(
  summary: Awaited<ReturnType<typeof buildUserContextSummary>>,
  weightUnit: 'kg' | 'lb' = 'kg',
  coachSystemPrompt?: string,
  equipmentPreference?: z.infer<typeof requestSchema>['equipmentPreference'],
  workoutContext?: z.infer<typeof workoutContextSchema>,
  dailyLogSummary?: z.infer<typeof dailyLogSummarySchema>,
): string {
  // Build current workout context section if there's a workout in progress
  const workoutInProgressSection = buildWorkoutInProgressSection(workoutContext)
  const dailyLogSection = buildDailyLogSection(dailyLogSummary)
  const equipmentPreferenceLabel =
    equipmentPreference === 'full_gym'
      ? 'Full gym'
      : equipmentPreference === 'home_minimal'
      ? 'Home / minimal equipment'
      : equipmentPreference === 'dumbbells_only'
      ? 'Dumbbells only'
      : equipmentPreference === 'bodyweight'
      ? 'Bodyweight only'
      : equipmentPreference === 'barbell_only'
      ? 'Barbell only'
      : null

  return [
    `You are the Rep AI gym training copilot—a knowledgeable training coach, not a lecture bot.

CONVERSATIONAL RULES (HIGHEST PRIORITY):
- Match your response length to the user's message. "Hey" → "Hey! What's up?" NOT a paragraph.
- Casual greetings get casual replies. Don't info-dump on "good morning".
- Be natural. You're texting between sets, not writing an essay.
- Only elaborate when they actually ask a question or want details.
- If they ask something simple, answer simply. One sentence is often enough.
- Save the detailed explanations for when they specifically ask "why" or "how" or want to learn more.
- Lead with the answer, not a recap. The first 1-2 sentences should directly answer what they asked.
- For broad coaching questions like "what should I improve?" or "what should I focus on?", identify the 1-3 highest-leverage changes only. Do not dump every possible issue.
- Do not repeat all available stats. Mention only the metrics that actually support the recommendation.
- Never mention internal or ambiguous metrics unless you can clearly explain what they mean in plain language.
- Be direct and useful, not motivational or preachy. No filler, no generic hype.
- Ask at most one clarifying question only if you are truly blocked. Otherwise give the best answer with a brief assumption if needed.`,
    ...(coachSystemPrompt
      ? [
          'COACH PERSONALITY (STYLE ONLY):',
          coachSystemPrompt,
          'Use this coach personality for tone and communication style only. Keep the training programming defaults the same across coaches.',
        ]
      : []),
    'User context:\n' + userContextToPrompt(summary),
    `Weight preferences: The user prefers ${
      weightUnit === 'kg' ? 'kilograms (kg)' : 'pounds (lbs)'
    }. When discussing weights, use their preferred unit. All stored weights are in kg, so convert when displaying.`,
    ...(equipmentPreferenceLabel
      ? [
          `Available equipment preference: ${equipmentPreferenceLabel}. When generating workouts, routines, programs, or exercise suggestions, stay within this setup unless the user explicitly says they have access to different equipment for this request.`,
        ]
      : []),
    "Ground answers in the user's actual data when relevant. If the data is missing, say so. Keep suggestions actionable and tied to their metrics. If asked about 1 rep max, calculate it using epley's formula (do not show the calculation).",
    'The recent-workout context above is important. Use it to understand what the user is actually training right now: exercise selection, set counts, reps, loads, and recent patterns.',
    "Do not confuse your coaching defaults with the user's actual behavior. Never describe 6-8 / 10-12, low-volume training, or any other coach default as what the user is currently doing unless their logged data supports it.",
    'When discussing rep ranges, set counts, volume, or training style, first interpret the user’s actual logged training pattern. If you then give a recommendation, clearly frame it as your advice or preferred training method, not as their current approach.',
    'If the user asks whether their rep ranges are good, whether they should change reps, or how they currently train, use the training-pattern data first. Prefer wording like "your recent training is mostly..." or "my recommendation would be..."',
    'When giving coaching advice, prioritize in this order: 1) adherence/consistency problems, 2) recovery/readiness constraints, 3) standards/rank bottlenecks and weak muscle groups, 4) body composition or nutrition issues, 5) exercise-selection fine-tuning.',
    "Base advice on the user's actual goal when possible. For strength goals, prioritize standards, rank gaps, lift selection, recovery, and consistency. For physique or weight goals, prioritize body composition, nutrition, adherence, and muscle balance.",
    'If the user asks what to improve, why progress is slow, what to focus on next, whether they are on track, or what to change, diagnose before advising. Use the relevant tools instead of answering from generic gym knowledge alone.',
    'When data is available, make recommendations concrete: name the lift, muscle group, nutrition target, recovery issue, or cadence issue that matters most, and say what to do next.',
    'Use the recent training-pattern context to judge how the user actually trains: exercise count, working sets, rep ranges, and per-muscle session volume. This is especially important for advice about too much volume, too little volume, poor exercise selection, or inappropriate rep ranges.',
    'If the user asks about their current training, recent workouts, recent exercise choices, whether their split/program makes sense, why a lift is or is not moving, or wants feedback on what they have been doing lately, use getWorkoutSlice.',
    'If the user asks how to train better, whether they are doing too many exercises or sets, whether their rep ranges make sense, whether they are overdoing a muscle group like chest, or how their programming structure looks, call getTrainingPatterns.',
    'If the user asks about lifter level, points, exercise ranks, full standards ladders, target weights or reps for Beginner/Novice/Intermediate/Advanced/Elite/World Class, next level targets, or which lift is closest to leveling up, call getLifterLevel, getExerciseRanks, and/or getExerciseStandards.',
    'If the user asks for their exact current points, score, or lifter level, always call getLifterLevel first and report the exact returned points value. Do not infer it from the level name or round it to the level threshold.',
    'If the user asks about recovery, readiness, what muscle is fresh, whether they should train something today, or what is still fatigued, call getRecoveryStatus.',
    'If the user asks about consistency, streaks, workout calendar, momentum, cadence, or whether they are on track with training frequency, call getConsistencyAdherence.',
    'If the user asks about physique, body composition, body scans, lean mass, fat mass, muscle mass, or visual strengths/weak points, call getBodyCompositionProgress.',
    'If the user asks about meals, calories, protein, macros, what they ate on a given day, or wants a daily nutrition breakdown, call getDetailedNutritionLog.',
    'For broad self-improvement questions, combine multiple tools when useful. Common pattern: getTrainingPatterns + getWorkoutSlice + getConsistencyAdherence + getRecoveryStatus + getLifterLevel/getExerciseRanks, and include getBodyCompositionProgress or getDetailedNutritionLog when physique or nutrition is relevant.',
    'If the user asks about saved routines or templates by name, call the getWorkoutRoutines tool with the routineName parameter. The user context above shows available routine names.',
    ...(dailyLogSummary
      ? [
          'NUTRITION LOGGING (CHAT-FIRST):',
          'If the user message is logging food (text/voice shorthand like "had my usual breakfast" or a food photo), respond like a supportive coach and provide an approximate estimate.',
          'When nutrition logging is detected, append this machine-readable block at the very end of your response with no markdown wrapping:',
          '<food_log>{"action":"log","summary":"short meal summary","calories":450,"protein_g":35,"carbs_g":38,"fat_g":16,"confidence":"medium","source":"text"}</food_log>',
          'For corrections to the most recent meal estimate ("actually that was cauliflower rice"), use action="update_last" and output corrected macros.',
          'If the user says "usual" (e.g., "had my usual breakfast"), infer from prior chat context when possible instead of forcing manual detail entry.',
          'Use confidence values only: low, medium, high.',
          'Do not ask for confirmation of every ingredient. Fast estimate > perfect precision. Ask at most one clarifying question only if confidence is low.',
          'Keep tone judgment-free. Avoid shaming language. If over target, suggest a calm adjustment for the next meal/day.',
          'Only include <food_log> block when the message is actually about food logging/correction.',
        ]
      : []),
    'WORKOUT GENERATION:',
    'DEFAULT PROGRAMMING STYLE (ALL COACHES):',
    '- This section defines your recommended default programming style for generated plans. It does NOT describe what the user is currently doing.',
    '- Use a high-intensity, low-volume approach by default.',
    '- Working sets per exercise: mostly 2; sometimes 3 for compound movements; never more than 3 working sets.',
    '- Rep targets: compounds 6-8 reps, isolations 10-12 reps.',
    '- Warm-up sets are separate and do not count toward working set totals.',
    '- Warm-up logic: if a movement is the first one in the workout to meaningfully train/load a muscle group that has not been warmed up yet, give it 3 warm-up sets.',
    '- If that muscle group has already been warmed up earlier in the workout by a previous exercise, give the new exercise just 1 warm-up set.',
    "- Judge this by the movement's primary muscles and the order of exercises in the workout.",
    '- Use this default unless the user explicitly asks for a different style.',
    'WORKOUT PLANNING CONVERSATION RULE:',
    '- For free-form workout/routine requests, do NOT jump straight into generating a plan if important inputs are missing.',
    '- First gather the key planning inputs conversationally: split or muscle focus, training frequency/days per week, available equipment, session duration, and any clear goal or intensity preference.',
    '- Ask only the highest-value missing question(s) next, keep it short, and carry forward what the user has already decided.',
    '- If the user gives a partial answer, continue the planning conversation instead of generating the workout immediately.',
    '- Once you have enough information to build a solid plan, briefly confirm the setup in natural language.',
    '- Only then generate the workout plan as JSON if the user has clearly asked you to build it now, or if their intent to proceed is obvious from the conversation.',
    '- If the user says to choose for them, use reasonable defaults and then generate the JSON plan.',
    '- If the user asks for a multi-day split, weekly plan, program, or schedule with multiple distinct sessions, generate a PROGRAM object, not a single workout object.',
    '- If the user asks for one training session or one reusable routine template, generate a WORKOUT object.',
    '- For program JSON, include every exercise for every routine in the `exercises` array. Do not truncate previews. `exerciseCount` must match the full number of exercises in that routine.',
    '- For program JSON, keep the same default programming style: mostly 2 working sets, sometimes 3 for compounds, never more than 3.',
    '- For program JSON, use clear routine names like "Upper 1", "Lower 1", "Push", "Pull", "Legs", or goal-specific session names when appropriate.',
    '- For program JSON, the `description` must read like a real coach brief, not a tagline.',
    '- In the program `description`, explain: 1) how the user should schedule the days across the week, 2) how hard to push working sets, 3) how to progress week to week, and 4) any useful recovery/rest-day guidance.',
    '- Keep the program `description` practical and specific to the request. Mention frequency, rest spacing, progression, and execution cues in plain language.',
    '- Program descriptions should usually be 3-5 sentences, dense with guidance, and still concise enough to fit in a card when collapsed.',
    "If (and ONLY if) you are actually generating the workout/routine/program, output the response as a valid JSON object matching the correct schema below. Do not wrap it in markdown blocks. Do not include any other text.",
    "If the user is just asking a question (e.g. 'Tell me about progressive overload', 'What is a good rep range?'), answer normally with text.",
    `JSON Schema for Workout Plans:\n${WORKOUT_JSON_SCHEMA}`,
    `JSON Schema for Programs:\n${PROGRAM_JSON_SCHEMA}`,
    'CRITICAL: EXERCISE SELECTION & NAMING:',
    'You DO NOT natively know which exercises exist in our database. You MUST use the `searchExercises` tool to find valid exercises before creating a workout, routine, or program OR suggesting/replacing exercises.',
    'Never use custom/user-created exercises (anything with created_by not null). Only system exercises are allowed.',
    '',
    'EXERCISE SELECTION STRATEGY:',
    '1. When creating a workout/program OR suggesting/replacing exercises, call `searchExercises` with the target muscle group and limit=15-20 to get a POOL of options.',
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
    'Before suggesting/recommending/replacing specific exercises, call `searchExercises` and use only exercise names returned by that tool.',
    'Whenever you suggest, recommend, or mention specific exercises (whether adding to a workout, replacing an exercise, or just discussing options), ALWAYS include a JSON array at the END of your response with the exercise details.',
    'Format: [{"name": "Exercise Name", "sets": 2, "reps": "6-8"}, ...]',
    'Use sets=2 for most exercises; sets=3 only when needed (typically compounds), never 4.',
    'Use reps="6-8" for compound movements and reps="10-12" for isolation movements by default.',
    'This applies when:',
    '- User asks you to add exercises to their workout',
    '- User asks for exercise alternatives or replacements',
    '- You recommend exercises in your response',
    '- You discuss specific exercises the user could try',
    'Example: "I\'d suggest adding some tricep work to balance your push day. Here are a couple options:\\n[{\\"name\\": \\"Tricep Pushdown\\", \\"sets\\": 2, \\"reps\\": \\"10-12\\"}, {\\"name\\": \\"Overhead Tricep Extension\\", \\"sets\\": 2, \\"reps\\": \\"10-12\\"}]"',
    'Do NOT include the JSON for general exercise questions like "what muscles does bench press work?" - only when actually suggesting exercises to add/do.',
    dailyLogSection,
    workoutInProgressSection,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildWorkoutInProgressSection(
  workoutContext?: z.infer<typeof workoutContextSchema>,
): string {
  if (!workoutContext) return ''

  const hasTitle = workoutContext.title?.trim()
  const hasNotes = workoutContext.notes?.trim()
  const hasExercises =
    workoutContext.exercises && workoutContext.exercises.length > 0

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
    const exerciseList = workoutContext
      .exercises!.map(
        (
          e: {
            name: string
            setsCount: number
            sets?: { weight?: string; reps?: string }[]
          },
          i: number,
        ) => {
          let exerciseLine = `${i + 1}. ${e.name}`

          // Include set details if available
          if (e.sets && e.sets.length > 0) {
            const setDetails = e.sets
              .map((set, setIdx) => {
                const parts: string[] = []
                if (set.weight) parts.push(`${set.weight}`)
                if (set.reps) parts.push(`${set.reps} reps`)
                return parts.length > 0
                  ? `Set ${setIdx + 1}: ${parts.join(' x ')}`
                  : null
              })
              .filter(Boolean)
              .join(', ')

            if (setDetails) {
              exerciseLine += ` - ${setDetails}`
            } else {
              exerciseLine += ` (${e.setsCount} sets planned)`
            }
          } else {
            exerciseLine += ` (${e.setsCount} sets planned)`
          }

          return exerciseLine
        },
      )
      .join('\n')
    lines.push(`Current Exercises:\n${exerciseList}`)
  }

  lines.push(
    'When the user asks for suggestions, exercise replacements, or modifications, consider this context.',
    'If they ask to add exercises, suggest ones that complement their current workout.',
    'If they ask to replace an exercise, suggest alternatives based on the exercise being replaced.',
  )

  return lines.join('\n')
}

function buildDailyLogSection(
  dailyLogSummary?: z.infer<typeof dailyLogSummarySchema>,
): string {
  if (!dailyLogSummary) return ''

  const lines: string[] = ['CURRENT DAILY NUTRITION CONTEXT:']
  if (dailyLogSummary.logDate) {
    lines.push(`Date: ${dailyLogSummary.logDate}`)
  }

  const totals = dailyLogSummary.totals
  if (totals) {
    const parts: string[] = []
    if (typeof totals.calories === 'number') {
      parts.push(`calories=${totals.calories}`)
    }
    if (typeof totals.protein_g === 'number') {
      parts.push(`protein=${totals.protein_g}g`)
    }
    if (typeof totals.carbs_g === 'number') {
      parts.push(`carbs=${totals.carbs_g}g`)
    }
    if (typeof totals.fat_g === 'number') {
      parts.push(`fat=${totals.fat_g}g`)
    }
    if (typeof totals.meal_count === 'number') {
      parts.push(`meals=${totals.meal_count}`)
    }
    if (parts.length > 0) {
      lines.push('Today so far: ' + parts.join(', '))
    }
  }

  const goals = dailyLogSummary.goals
  if (goals) {
    const goalParts: string[] = []
    if (typeof goals.calorie_goal === 'number') {
      goalParts.push(`calorie_goal=${goals.calorie_goal}`)
    }
    if (typeof goals.protein_goal_g === 'number') {
      goalParts.push(`protein_goal=${goals.protein_goal_g}g`)
    }
    if (goalParts.length > 0) {
      lines.push('Goals: ' + goalParts.join(', '))
    }
  }

  lines.push(
    'Use this context for adaptive nudges (e.g., low-energy from low carbs or protein pacing suggestions).',
  )

  return lines.join('\n')
}

// deno-lint-ignore-file no-explicit-any
import { openai } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'

import { corsHeaders, errorResponse, handleCors } from '../_shared/cors.ts'
import { createUserClient } from '../_shared/supabase.ts'
import { buildUserContextSummary, userContextToPrompt } from './user-context.ts'

const messagesSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

type Message = z.infer<typeof messagesSchema>

const requestSchema = z.object({
  messages: z.array(messagesSchema),
  userId: z.string().optional(),
  weightUnit: z.enum(['kg', 'lb']).optional(),
})

type WorkoutSessionWithDetails = {
  id: string
  date: string | null
  type: string | null
  notes: string | null
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
        systemPrompt = buildSystemPrompt(summary, payload.weightUnit)
        tools = chatTools
      } catch (contextError) {
        console.warn('Failed to build user context summary:', contextError)
      }
    }

    const result = streamText({
      model: openai('gpt-4.1-mini'),
      messages: payload.messages,
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
          }
        >()

        for (const session of sessions) {
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
  }

  return { summary, tools }
}

function buildSystemPrompt(
  summary: Awaited<ReturnType<typeof buildUserContextSummary>>,
  weightUnit: 'kg' | 'lb' = 'kg',
): string {
  return [
    "You are the Rep AI gym training copilot. Ground every answer in the user's actual data. If the data is missing, say so.",
    'User context:\n' + userContextToPrompt(summary),
    `Weight preferences: The user prefers ${
      weightUnit === 'kg' ? 'kilograms (kg)' : 'pounds (lbs)'
    }. When discussing weights, use their preferred unit. All stored weights are in kg, so convert when displaying.`,
    "When suggesting next steps, keep them actionable, succinct and tied to the metrics you have. If asked about 1 rep max, calculate it using epley's formula (do not show the calculation).",
  ].join('\n\n')
}

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'
import { openai } from 'npm:@ai-sdk/openai@2.0.42'
import { generateText, streamText, tool } from 'npm:ai'
import { trimChatMessagesForRequest } from '../../../lib/ai/chat-history.ts'
import { GEMINI_MODEL, openrouter } from '../_shared/openrouter.ts'

import { summarizeBodyLogContext } from '../_shared/body-log-context.ts'
import {
  corsHeaders,
  errorResponse,
  handleCors,
  jsonResponse,
} from '../_shared/cors.ts'
import {
  getDailyWeightsByLogDate,
  normalizeLogDate,
} from '../_shared/daily-weight.ts'
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
  calculateLifterPointTargets,
  getExerciseStandardsForProfile,
} from '../_shared/strength.ts'
import { createUserClient } from '../_shared/supabase.ts'
import { checkChatRateLimit, rateLimitMessage } from '../_shared/rate-limit.ts'
import {
  buildUserContextSummary,
  summarizeTrainingPatterns,
} from './user-context.ts'
import { buildSystemPrompt } from './system-prompt.ts'

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
    sessionId: z.string().optional(),
    mode: z.enum(['planning', 'analysis']).optional(),
    title: z.string().optional(),
    notes: z.string().optional(),
    stats: z
      .object({
        exerciseCount: z.number().optional(),
        totalSetCount: z.number().optional(),
        workingSetCount: z.number().optional(),
        durationSeconds: z.number().nullable().optional(),
        volumeKg: z.number().nullable().optional(),
        completedAt: z.string().nullable().optional(),
      })
      .optional(),
    prs: z
      .array(
        z.object({
          exerciseName: z.string(),
          kind: z.enum([
            'heaviest-weight',
            'best-1rm',
            'best-set-volume',
          ]),
          label: z.string(),
          value: z.number(),
          previousValue: z.number().optional(),
          weight: z.number(),
          currentReps: z.number(),
          isCurrent: z.boolean(),
        }),
      )
      .optional(),
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

const TEXT_CHAT_FALLBACK_LABEL = 'openai:gpt-4o'

function createCorrelationId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function getChatExecutionConfig(options: {
  hasImages: boolean
  isFoodLabelScan: boolean
}) {
  const { hasImages, isFoodLabelScan } = options

  if (isFoodLabelScan) {
    return {
      model: openrouter.chat(GEMINI_MODEL),
      modelLabel: `openrouter:${GEMINI_MODEL} (food_label OCR)`,
      fallbackModel: openai('gpt-4o'),
      fallbackLabel: TEXT_CHAT_FALLBACK_LABEL,
    }
  }

  if (hasImages) {
    return {
      model: openrouter.chat(GEMINI_MODEL),
      modelLabel: `openrouter:${GEMINI_MODEL}`,
      fallbackModel: openai('gpt-4o'),
      fallbackLabel: TEXT_CHAT_FALLBACK_LABEL,
    }
  }

  return {
    model: openrouter.chat(GEMINI_MODEL),
    modelLabel: `openrouter:${GEMINI_MODEL}`,
    fallbackModel: openai('gpt-4o'),
    fallbackLabel: TEXT_CHAT_FALLBACK_LABEL,
  }
}

function summarizeAiError(error: unknown) {
  if (!(error instanceof Error)) {
    return { error }
  }

  const retryError = error as Error & {
    reason?: unknown
    lastError?: unknown
    errors?: unknown[]
  }
  const nestedError =
    retryError.lastError ??
    retryError.errors?.[retryError.errors.length - 1] ??
    error
  const apiError = nestedError as Error & {
    statusCode?: unknown
    isRetryable?: unknown
    data?: {
      error?: {
        code?: unknown
        metadata?: {
          provider_name?: unknown
          raw?: unknown
        }
      }
    }
  }

  return {
    name: error.name,
    reason: retryError.reason,
    statusCode: apiError.statusCode,
    isRetryable: apiError.isRetryable,
    provider: apiError.data?.error?.metadata?.provider_name,
    providerCode: apiError.data?.error?.code,
    providerMessage: apiError.data?.error?.metadata?.raw ?? error.message,
  }
}

serve(async (req) => {
  const correlationId = createCorrelationId()
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const payload = requestSchema.parse(await req.json())
    console.log(`[chat-edge][${correlationId}] Request received:`, {
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

    if (!accessToken) {
      return errorResponse(401, 'Unauthorized')
    }

    // Resolve the authenticated user from the JWT — never trust payload.userId
    // for rate limiting, since a client could rotate it to bypass quotas.
    let authedUserId: string | null = null
    try {
      const authClient = createUserClient(accessToken)
      const { data: userData, error: authError } =
        await authClient.auth.getUser()
      if (authError || !userData?.user?.id) {
        console.warn(
          `[chat-edge][${correlationId}] Auth resolution failed`,
          authError,
        )
        return errorResponse(401, 'Unauthorized')
      }
      authedUserId = userData.user.id
    } catch (authErr) {
      console.error(
        `[chat-edge][${correlationId}] Failed to verify caller`,
        authErr,
      )
      return errorResponse(401, 'Unauthorized')
    }

    // Rate limit early, before any heavy context build / model call.
    // Image messages route to GPT-4o which is much pricier than the text
    // path, so weight them harder against all windows.
    const requestHasImages = Boolean(payload.images && payload.images.length > 0)
    const rateWeight = requestHasImages ? 4 : 1
    const rateResult = await checkChatRateLimit({
      userId: authedUserId,
      weight: rateWeight,
    })

    if (!rateResult.allowed) {
      console.warn(`[chat-edge][${correlationId}] Rate limited`, {
        userId: authedUserId,
        reason: rateResult.reason,
        retryAfterSeconds: rateResult.retryAfterSeconds,
        minuteCount: rateResult.minuteCount,
        hourCount: rateResult.hourCount,
        dayCount: rateResult.dayCount,
      })

      return jsonResponse(
        {
          error: rateLimitMessage(rateResult.reason),
          code: 'RATE_LIMITED',
          details: {
            reason: rateResult.reason,
            retryAfterSeconds: rateResult.retryAfterSeconds,
            minuteCount: rateResult.minuteCount,
            hourCount: rateResult.hourCount,
            dayCount: rateResult.dayCount,
          },
          correlationId,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateResult.retryAfterSeconds),
            'x-correlation-id': correlationId,
          },
        },
      )
    }

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
        console.log(`[chat-edge][${correlationId}] User context built successfully`, {
          userId: payload.userId,
          toolsCount: Object.keys(chatTools || {}).length,
        })
      } catch (contextError) {
        console.warn(
          `[chat-edge][${correlationId}] Failed to build user context summary:`,
          contextError,
        )
      }
    }

    // Filter out system messages from client - we use our own system prompt
    const filteredMessages = payload.messages.filter(
      (msg) => msg.role !== 'system',
    )
    const trimmedMessages = trimChatMessagesForRequest(filteredMessages)

    // Transform messages to include images in AI SDK format
    const transformedMessages: any[] = trimmedMessages.map((msg, index) => {
      // Only add images to the last user message
      if (
        msg.role === 'user' &&
        index === trimmedMessages.length - 1 &&
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
    console.log(`[chat-edge][${correlationId}] Messages transformed:`, {
      filteredCount: filteredMessages.length,
      trimmedCount: trimmedMessages.length,
      trimmedAwayCount: filteredMessages.length - trimmedMessages.length,
      transformedCount: transformedMessages.length,
      includesImageParts: Boolean(payload.images && payload.images.length > 0),
    })

    // All chat paths use GEMINI_MODEL; GPT-4o is only the generateText fallback.
    const isFoodLabelScan = payload.scanMode === 'food_label'
    const hasImages = Boolean(payload.images && payload.images.length > 0)
    const requestedNoStream = req.headers.get('x-no-stream') === '1'
    const chatExecution = getChatExecutionConfig({
      hasImages,
      isFoodLabelScan,
    })
    const prefersNoStream =
      requestedNoStream || Boolean(chatExecution.fallbackModel)
    console.log(`[chat-edge][${correlationId}] Model selected:`, {
      model: chatExecution.modelLabel,
      fallbackModel: chatExecution.fallbackLabel ?? null,
      prefersNoStream,
      requestedNoStream,
    })

    const latestUserMessage = [...trimmedMessages]
      .reverse()
      .find((msg) => msg.role === 'user')
    console.log(`[chat-edge][${correlationId}] Latest user message snapshot:`, {
      textPreview: latestUserMessage?.content?.slice(0, 120) ?? '',
      hasDailyTotals: Boolean(payload.dailyLogSummary?.totals),
      dailyTotals: payload.dailyLogSummary?.totals,
    })

    const generationOptions = {
      messages: transformedMessages as any,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(tools ? { tools } : {}),
      maxRetries: 1,
      timeout: {
        totalMs: 45000,
        chunkMs: 15000,
      },
      stopWhen: ({ steps }) =>
        steps[steps.length - 1]?.finishReason !== 'tool-calls',
    }

    if (prefersNoStream) {
      try {
        const result = await generateText({
          model: chatExecution.model,
          ...generationOptions,
        })
        console.log(`[chat-edge][${correlationId}] generateText finished`, {
          model: chatExecution.modelLabel,
        })

        return new Response(result.text, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'x-correlation-id': correlationId,
            'x-chat-model': chatExecution.modelLabel,
            'x-chat-response-mode': 'text',
          },
        })
      } catch (primaryError) {
        if (!chatExecution.fallbackModel || !chatExecution.fallbackLabel) {
          console.error(
            `[chat-edge][${correlationId}] Primary generateText failed with no fallback:`,
            summarizeAiError(primaryError),
          )
          throw primaryError
        }

        console.warn(
          `[chat-edge][${correlationId}] Primary generateText failed; trying fallback:`,
          summarizeAiError(primaryError),
        )

        const fallbackResult = await generateText({
          model: chatExecution.fallbackModel,
          ...generationOptions,
        })
        console.log(`[chat-edge][${correlationId}] Fallback generateText finished`, {
          model: chatExecution.fallbackLabel,
        })

        return new Response(fallbackResult.text, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'x-correlation-id': correlationId,
            'x-chat-model': chatExecution.fallbackLabel,
            'x-chat-fallback-used': '1',
            'x-chat-response-mode': 'text',
          },
        })
      }
    }

    const result = streamText({
      model: chatExecution.model,
      ...generationOptions,
      onError: (error) => {
        console.error(
          `❌ [chat-edge][${correlationId}] streamText response error:`,
          error,
        )
      },
    })
    console.log(`[chat-edge][${correlationId}] streamText started`)

    return result.toTextStreamResponse({
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-cache',
        'x-correlation-id': correlationId,
        'x-chat-response-mode': 'stream',
      },
    })
  } catch (error) {
    console.error(`[chat-edge][${correlationId}] Error in chat function:`, error)
    if (error instanceof z.ZodError) {
      return jsonResponse(
        {
          error: 'Invalid request',
          code: 'ZOD_INVALID',
          correlationId,
          details: error.errors,
        },
        { status: 400 },
      )
    }
    return jsonResponse(
      {
        error: 'Failed to process chat request',
        code: 'UNKNOWN',
        correlationId,
      },
      { status: 500 },
    )
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

  const roundTo = (value: number, decimals = 1) => {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }

  const estimateOneRepMax = (weight: number, reps: number) =>
    weight * (1 + reps / 30)

  const calculateExerciseVolumeKg = (
    sets:
      | {
          reps?: number | null
          weight?: number | null
          is_warmup?: boolean | null
          isWarmup?: boolean
        }[]
      | null
      | undefined,
  ) =>
    (sets || []).reduce((sum, set) => {
      const isWarmup = set.isWarmup === true || set.is_warmup === true
      if (isWarmup) return sum
      if (typeof set.reps !== 'number' || set.reps <= 0) return sum
      if (typeof set.weight !== 'number' || set.weight <= 0) return sum
      return sum + set.weight * set.reps
    }, 0)

  const calculateSessionVolumeKg = (
    exercises:
      | {
          sets?:
            | {
                reps?: number | null
                weight?: number | null
                is_warmup?: boolean | null
                isWarmup?: boolean
              }[]
            | null
        }[]
      | null
      | undefined,
  ) =>
    (exercises || []).reduce(
      (sum, exercise) => sum + calculateExerciseVolumeKg(exercise.sets),
      0,
    )

  const countWorkingSets = (
    exercises:
      | {
          sets?:
            | {
                reps?: number | null
                is_warmup?: boolean | null
                isWarmup?: boolean
              }[]
            | null
        }[]
      | null
      | undefined,
  ) =>
    (exercises || []).reduce(
      (sum, exercise) =>
        sum +
        (exercise.sets || []).filter((set) => {
          const isWarmup = set.isWarmup === true || set.is_warmup === true
          if (isWarmup) return false
          return typeof set.reps === 'number' && set.reps > 0
        }).length,
      0,
    )

  const buildExerciseComparisonRows = (
    session: WorkoutSessionWithDetails,
    previousSessions: WorkoutSessionWithDetails[],
  ) => {
    const comparisons: Array<Record<string, unknown>> = []

    for (const exercise of session.workout_exercises || []) {
      const exerciseName = exercise.exercise?.name
      const exerciseId = exercise.exercise_id
      if (!exerciseName || !exerciseId) continue

      const currentWorkingSets = (exercise.sets || []).filter(
        (set) => set.is_warmup !== true,
      )
      const currentBestWeight = currentWorkingSets.reduce<number | null>(
        (best, set) =>
          typeof set.weight === 'number' && (best == null || set.weight > best)
            ? set.weight
            : best,
        null,
      )
      const currentBestSet =
        currentWorkingSets.reduce<{
          weight: number
          reps: number | null
          estimated1RM: number | null
        } | null>((best, set) => {
          if (typeof set.weight !== 'number' || set.weight <= 0) return best
          const estimated1RM =
            typeof set.reps === 'number' && set.reps > 0
              ? estimateOneRepMax(set.weight, set.reps)
              : null
          if (!best) {
            return {
              weight: set.weight,
              reps: set.reps ?? null,
              estimated1RM:
                estimated1RM == null ? null : roundTo(estimated1RM),
            }
          }

          const bestScore =
            best.estimated1RM ?? (best.reps != null ? best.weight : 0)
          const currentScore =
            estimated1RM ?? (set.reps != null ? set.weight : 0)

          if (currentScore > bestScore) {
            return {
              weight: set.weight,
              reps: set.reps ?? null,
              estimated1RM:
                estimated1RM == null ? null : roundTo(estimated1RM),
            }
          }
          return best
        }, null) ?? null
      const currentBest1RM = currentWorkingSets.reduce<number | null>(
        (best, set) => {
          if (
            typeof set.weight !== 'number' ||
            set.weight <= 0 ||
            typeof set.reps !== 'number' ||
            set.reps <= 0
          ) {
            return best
          }
          const value = estimateOneRepMax(set.weight, set.reps)
          return best == null || value > best ? value : best
        },
        null,
      )

      let lastPerformedAt: string | null = null
      let previousBestWeight: number | null = null
      let previousBest1RM: number | null = null
      let previousBestRepsAtCurrentWeight: number | null = null
      const recentHistory: Array<Record<string, unknown>> = []

      outer: for (const prevSession of previousSessions) {
        for (const prevExercise of prevSession.workout_exercises || []) {
          if (prevExercise.exercise_id !== exerciseId) continue
          if (!lastPerformedAt) {
            lastPerformedAt = prevSession.created_at ?? prevSession.date ?? null
          }
          let sessionBestWeight: number | null = null
          let sessionBest1RM: number | null = null
          for (const set of prevExercise.sets || []) {
            if (set.is_warmup === true) continue
            if (
              typeof set.weight === 'number' &&
              (previousBestWeight == null || set.weight > previousBestWeight)
            ) {
              previousBestWeight = set.weight
            }
            if (
              typeof set.weight === 'number' &&
              set.weight > 0 &&
              typeof set.reps === 'number' &&
              set.reps > 0
            ) {
              const est1RM = estimateOneRepMax(set.weight, set.reps)
              if (previousBest1RM == null || est1RM > previousBest1RM) {
                previousBest1RM = est1RM
              }
              if (sessionBest1RM == null || est1RM > sessionBest1RM) {
                sessionBest1RM = est1RM
              }
            }
            if (
              currentBestWeight != null &&
              typeof set.weight === 'number' &&
              set.weight === currentBestWeight &&
              typeof set.reps === 'number' &&
              (previousBestRepsAtCurrentWeight == null ||
                set.reps > previousBestRepsAtCurrentWeight)
            ) {
              previousBestRepsAtCurrentWeight = set.reps
            }
            if (
              typeof set.weight === 'number' &&
              (sessionBestWeight == null || set.weight > sessionBestWeight)
            ) {
              sessionBestWeight = set.weight
            }
          }

          if (recentHistory.length < 3) {
            recentHistory.push({
              performedAt: prevSession.created_at ?? prevSession.date ?? null,
              bestWeight: sessionBestWeight,
              bestEstimated1RM:
                sessionBest1RM == null ? null : roundTo(sessionBest1RM),
            })
          }
          continue outer
        }
      }

      comparisons.push({
        exerciseName,
        currentBestSet,
        currentBestWeight,
        previousBestRepsAtCurrentWeight,
        previousBestWeight,
        currentBestEstimated1RM:
          currentBest1RM == null ? null : roundTo(currentBest1RM),
        previousBestEstimated1RM:
          previousBest1RM == null ? null : roundTo(previousBest1RM),
        lastPerformedAt,
        recentHistory,
      })
    }

    return comparisons
  }

  const tools: Record<string, ReturnType<typeof tool>> = {
    getWorkoutAnalysisSnapshot: tool({
      description:
        'Build a coach-grade snapshot for one completed workout: exact session details, PR highlights, recent baseline comparisons, recovery, consistency, and exercise-by-exercise context.',
      inputSchema: z.object({
        sessionId: z.string().uuid(),
      }),
      execute: async ({ sessionId }) => {
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
          .eq('id', sessionId)
          .eq('user_id', userId)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          return { found: false, snapshot: null }
        }

        const session = data as WorkoutSessionWithDetails
        const createdAt = session.created_at ?? session.date ?? null

        let previousQuery = supabase
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
          .order('created_at', { ascending: false })
          .limit(12)

        if (createdAt) {
          previousQuery = previousQuery.lt('created_at', createdAt)
        }

        const { data: previousData, error: previousError } = await previousQuery
        if (previousError) throw previousError

        const previousSessions = (previousData as WorkoutSessionWithDetails[]) || []
        const previousPatterns =
          summarizeTrainingPatterns(previousSessions as any[], { maxSessions: 8 }) ??
          null

        const exactSessionVolumeKg = calculateSessionVolumeKg(
          session.workout_exercises,
        )
        const recentVolumes = previousSessions
          .map((prev) => calculateSessionVolumeKg(prev.workout_exercises))
          .filter((volume) => volume > 0)
        const averageRecentVolumeKg =
          recentVolumes.length > 0
            ? roundTo(
                recentVolumes.reduce((sum, volume) => sum + volume, 0) /
                  recentVolumes.length,
              )
            : null

        const sessionMuscleGroups = Array.from(
          new Set(
            (session.workout_exercises || [])
              .map((exercise) => exercise.exercise?.muscle_group)
              .filter(
                (muscleGroup): muscleGroup is string =>
                  typeof muscleGroup === 'string' && muscleGroup.length > 0,
              ),
          ),
        )

        const [recoverySummary, adherenceSummary, muscleBalance] =
          await Promise.all([
            getRecoverySummary(),
            getAdherenceSummary(),
            getMuscleGroupDistribution(supabase, userId, { daysBack: 60 }),
          ])

        return {
          found: true,
          snapshot: {
            session: {
              id: session.id,
              date: session.date,
              createdAt,
              type: session.type,
              notes: session.notes,
              durationSeconds: (session as any).duration ?? null,
              exerciseCount: (session.workout_exercises || []).length,
              totalSetCount: (session.workout_exercises || []).reduce(
                (sum, exercise) => sum + (exercise.sets?.length || 0),
                0,
              ),
              workingSetCount: countWorkingSets(session.workout_exercises),
              volumeKg: roundTo(exactSessionVolumeKg),
              muscleGroups: sessionMuscleGroups,
              exercises: (session.workout_exercises || []).map((exercise) => ({
                name: exercise.exercise?.name,
                muscleGroup: exercise.exercise?.muscle_group ?? null,
                setCount: exercise.sets?.length || 0,
                workingSetCount: (exercise.sets || []).filter(
                  (set) => set.is_warmup !== true,
                ).length,
                volumeKg: roundTo(calculateExerciseVolumeKg(exercise.sets)),
                sets: (exercise.sets || []).map((set) => ({
                  setNumber: set.set_number,
                  reps: set.reps,
                  weight: set.weight,
                  rpe: set.rpe,
                  isWarmup: set.is_warmup === true,
                })),
              })),
            },
            recentBaseline: previousPatterns
              ? {
                  sessionsAnalyzed: previousPatterns.sessionsAnalyzed,
                  averageExercisesPerSession:
                    previousPatterns.averageExercisesPerSession,
                  averageWorkingSetsPerSession:
                    previousPatterns.averageWorkingSetsPerSession,
                  averageWorkingSetsPerExercise:
                    previousPatterns.averageWorkingSetsPerExercise,
                  averageRepsPerSet: previousPatterns.averageRepsPerSet,
                  averageVolumeKg: averageRecentVolumeKg,
                }
              : null,
            exerciseComparisons: buildExerciseComparisonRows(
              session,
              previousSessions,
            ),
            relevantRecovery: recoverySummary.muscleRecovery.filter((entry) =>
              sessionMuscleGroups.includes(entry.muscleGroup),
            ),
            adherence: {
              weeklyTarget: adherenceSummary.weeklyTarget,
              workoutsThisWeek: adherenceSummary.workoutsThisWeek,
              expectedWorkoutsByNow: adherenceSummary.expectedWorkoutsByNow,
              currentStreakWeeks: adherenceSummary.currentStreakWeeks,
              recentAverageWorkoutsPerWeek:
                adherenceSummary.recentAverageWorkoutsPerWeek,
              daysSinceLastWorkout: adherenceSummary.daysSinceLastWorkout,
              adherenceStatus: adherenceSummary.adherenceStatus,
            },
            muscleBalance: {
              distribution: muscleBalance.distribution,
              totalVolume: muscleBalance.totalVolume,
            },
          },
        }
      },
    }),
    getWorkoutSessionById: tool({
      description:
        "Fetch one exact workout session by its ID, including exercise and set details. Use this for post-workout analysis of a specific logged session.",
      inputSchema: z.object({
        sessionId: z.string().uuid(),
      }),
      execute: async ({ sessionId }) => {
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
          .eq('id', sessionId)
          .eq('user_id', userId)
          .maybeSingle()

        if (error) throw error

        if (!data) {
          return {
            session: null,
            found: false,
          }
        }

        const session = data as WorkoutSessionWithDetails
        const exercises = (session.workout_exercises || []).map((we) => ({
          name: we.exercise?.name,
          order: we.order_index,
          notes: we.notes,
          sets: (we.sets || []).map((set) => ({
            setNumber: set.set_number,
            reps: set.reps,
            weight: set.weight,
            rpe: set.rpe,
            isWarmup: (set as any).is_warmup ?? false,
          })),
        }))

        const totalSetCount = exercises.reduce(
          (sum, exercise) => sum + exercise.sets.length,
          0,
        )
        const workingSetCount = exercises.reduce(
          (sum, exercise) =>
            sum + exercise.sets.filter((set) => !set.isWarmup).length,
          0,
        )

        return {
          found: true,
          session: {
            id: session.id,
            date: session.date,
            createdAt: session.created_at ?? null,
            type: session.type,
            notes: session.notes,
            durationSeconds: (session as any).duration ?? null,
            routineId: session.routine_id ?? null,
            exerciseCount: exercises.length,
            totalSetCount,
            workingSetCount,
            exercises,
          },
        }
      },
    }),
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

	        const weightByDate = await getDailyWeightsByLogDate(
	          supabase,
	          userId,
	          filtered.map((record) => record.created_at),
	        )

	        return filtered.map((record) => ({
	          id: record.id,
	          capturedAt: record.created_at,
	          metrics: {
	            weightKg:
	              weightByDate.get(normalizeLogDate(record.created_at)) ??
	              record.weight_kg,
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

	        const weightByDate = await getDailyWeightsByLogDate(
	          supabase,
	          userId,
	          filtered.map((record) => record.created_at),
	        )

	        const entries = filtered.slice(0, resolvedLimit).map((record) => ({
	          id: record.id,
	          capturedAt: record.created_at,
	          metrics: {
	            weightKg:
	              weightByDate.get(normalizeLogDate(record.created_at)) ??
	              record.weight_kg,
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
    getLifterPointTargets: tool({
      description:
        "Calculate exact lift targets that would increase the user's overall lifter score by a requested number of points. Use for questions like 'how do I gain 10 points?', 'what do I need to bench for +15 points?', or 'best lift to level up my score'.",
      inputSchema: z
        .object({
          pointsTarget: z.number().int().min(1).max(250),
          exerciseName: z.string().trim().min(1).max(120).optional(),
          includeAlternatives: z.boolean().optional(),
        })
        .partial({
          exerciseName: true,
          includeAlternatives: true,
        }),
      execute: async ({
        pointsTarget,
        exerciseName,
        includeAlternatives = true,
      }) => {
        const strengthProfile = await getStrengthProfile()

        return calculateLifterPointTargets({
          profile: strengthProfile,
          requestedPoints: pointsTarget,
          exerciseName,
          includeAlternatives,
        })
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

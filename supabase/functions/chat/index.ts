// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod@3.25.76'
import {
  createTextStreamResponse,
  generateText,
  streamText,
  toTextStream,
} from 'npm:ai@7.0.162'

import { trimChatMessagesForRequest } from '../../../lib/ai/chat-history.ts'
import {
  corsHeaders,
  errorResponse,
  handleCors,
  jsonResponse,
} from '../_shared/cors.ts'
import { GEMINI_MODEL } from '../_shared/openrouter.ts'
import {
  checkChatRateLimit,
  FREE_CHAT_DAY_LIMIT,
  freeLimitMessage,
  rateLimitMessage,
} from '../_shared/rate-limit.ts'
import { isProSubscriber } from '../_shared/subscription.ts'
import { createUserClient } from '../_shared/supabase.ts'
import { createChatCallOptions, type ChatUsageSummary } from './agent.ts'
import { buildModelMessages, type ChatImage } from './messages.ts'
import { buildTurnContext, buildUserSnapshot } from './prompt.ts'
import { buildUserContext } from './tools/index.ts'

const messagesSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

const imageSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string(),
  }),
})

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
  // Ignored. Sent by older app versions that had selectable coach personas.
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
  // Ignored apart from logDate (the user's local date). Sent by app builds
  // that still had food logging.
  dailyLogSummary: dailyLogSummarySchema,
  scanMode: z.enum(['food_label']).optional(), // hint for specialised routing
})

type ChatPayload = z.infer<typeof requestSchema>

function createCorrelationId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

Deno.serve(async (req) => {
  const correlationId = createCorrelationId()
  const log = (message: string, data?: unknown) =>
    console.log(`[chat][${correlationId}] ${message}`, data ?? '')

  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed')

  try {
    const payload = requestSchema.parse(await req.json())

    const bearer = req.headers.get('Authorization')
    const accessToken = bearer?.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length).trim()
      : undefined
    if (!accessToken) return errorResponse(401, 'Unauthorized')

    // Resolve the user from the JWT. Never trust payload.userId: a client
    // could rotate it to dodge rate limits or point at someone else's data.
    const { data: userData, error: authError } =
      await createUserClient(accessToken).auth.getUser()
    const userId = userData?.user?.id
    if (authError || !userId) {
      console.warn(`[chat][${correlationId}] Auth failed`, authError)
      return errorResponse(401, 'Unauthorized')
    }

    const limited = await enforceRateLimit(userId, payload, correlationId)
    if (limited) return limited

    // --- Build the prompt (see prompt.ts for the caching layout) -----------
    let snapshot: string | undefined
    let tools: Awaited<ReturnType<typeof buildUserContext>>['tools'] | undefined
    try {
      const context = await buildUserContext(userId, accessToken)
      snapshot = buildUserSnapshot(context.summary, {
        weightUnit: payload.weightUnit,
        equipmentPreference: payload.equipmentPreference,
      })
      tools = context.tools
    } catch (contextError) {
      // Degrade to a plain chat rather than failing the request.
      console.warn(
        `[chat][${correlationId}] Failed to build user context`,
        contextError,
      )
    }

    const history = trimChatMessagesForRequest(
      payload.messages.flatMap((message) =>
        // System messages are ours to write; empty turns (e.g. a failed
        // reply) make providers return nothing.
        message.role === 'system' || !message.content.trim()
          ? []
          : [{ role: message.role, content: message.content }],
      ),
    )
    const messages = buildModelMessages({
      snapshot,
      history,
      turnContext: buildTurnContext({
        today: payload.dailyLogSummary?.logDate ?? new Date().toISOString().slice(0, 10),
        workoutContext: payload.workoutContext,
      }),
      images: (payload.images ?? []).map((image) =>
        toImagePart(image.image_url.url),
      ),
    })

    log('Request', {
      historyMessages: history.length,
      droppedMessages: payload.messages.length - history.length,
      hasSnapshot: Boolean(snapshot),
      toolCount: tools ? Object.keys(tools).length : 0,
      images: payload.images?.length ?? 0,
      hasWorkoutContext: Boolean(payload.workoutContext),
    })

    const headers = {
      ...corsHeaders,
      'Cache-Control': 'no-cache',
      'x-correlation-id': correlationId,
      'x-chat-model': GEMINI_MODEL,
    }

    const stream = req.headers.get('x-no-stream') !== '1'
    let usage: ChatUsageSummary | undefined
    const options = createChatCallOptions({
      messages,
      tools,
      stream,
      onUsage: (summary) => {
        usage = summary
        log('Usage', summary)
      },
    })

    if (!stream) {
      const result = await generateText(options)
      return new Response(result.text, {
        headers: {
          ...headers,
          'Content-Type': 'text/plain; charset=utf-8',
          'x-chat-response-mode': 'text',
          // Token/cache stats for this turn (streamed replies only log them).
          ...(usage ? { 'x-chat-usage': JSON.stringify(usage) } : {}),
        },
      })
    }

    const result = streamText({
      ...options,
      onError: ({ error }) =>
        console.error(`[chat][${correlationId}] Stream error`, error),
    })
    return createTextStreamResponse({
      stream: toTextStream({ stream: result.stream }),
      headers: { ...headers, 'x-chat-response-mode': 'stream' },
    })
  } catch (error) {
    console.error(`[chat][${correlationId}] Request failed`, error)
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
      { error: 'Failed to process chat request', code: 'UNKNOWN', correlationId },
      { status: 500 },
    )
  }
})

/** Returns a 429 response when the user is over their chat allowance. */
async function enforceRateLimit(
  userId: string,
  payload: ChatPayload,
  correlationId: string,
): Promise<Response | null> {
  // Image requests cost more, so weight them harder against every window.
  const weight = payload.images?.length ? 4 : 1
  // Free users get a smaller daily allowance; Pro keeps the default limits.
  let isPro = await isProSubscriber(userId)
  let rate = await checkChatRateLimit({
    userId,
    weight,
    dayLimit: isPro ? undefined : FREE_CHAT_DAY_LIMIT,
  })

  // Before rejecting a free user on the daily cap, re-check RevenueCat
  // bypassing the cache in case they just upgraded. A rejected check does
  // not record usage, so retrying with the Pro limits is safe.
  if (!rate.allowed && !isPro && rate.reason === 'day') {
    isPro = await isProSubscriber(userId, { forceRefresh: true })
    if (isPro) rate = await checkChatRateLimit({ userId, weight })
  }

  if (rate.allowed) return null

  const isFreeLimit = !isPro && rate.reason === 'day'
  console.warn(`[chat][${correlationId}] Rate limited`, {
    userId,
    isPro,
    reason: rate.reason,
    retryAfterSeconds: rate.retryAfterSeconds,
  })

  return jsonResponse(
    {
      error: isFreeLimit ? freeLimitMessage() : rateLimitMessage(rate.reason),
      code: isFreeLimit ? 'FREE_LIMIT_REACHED' : 'RATE_LIMITED',
      details: {
        reason: rate.reason,
        retryAfterSeconds: rate.retryAfterSeconds,
        minuteCount: rate.minuteCount,
        hourCount: rate.hourCount,
        dayCount: rate.dayCount,
      },
      correlationId,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(rate.retryAfterSeconds),
        'x-correlation-id': correlationId,
      },
    },
  )
}

function toImagePart(url: string): ChatImage {
  const dataUrl = url.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i)
  if (dataUrl) {
    return { type: 'image', image: dataUrl[2], mediaType: dataUrl[1] || undefined }
  }
  try {
    return { type: 'image', image: new URL(url) }
  } catch {
    return { type: 'image', image: url }
  }
}

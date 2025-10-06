import { openai } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { z } from 'zod'

import { createServerDatabase } from '@/lib/database-server'
import {
  buildUserContextSummary,
  userContextToPrompt,
} from '@/lib/utils/user-context'

export async function POST(request: Request) {
  try {
    const { messages, userId } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Messages are required' }, { status: 400 })
    }

    const bearer = request.headers.get('Authorization')
    const accessToken = bearer?.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length).trim() || undefined
      : undefined

    let systemPrompt: string | undefined

    if (typeof userId === 'string' && userId.trim()) {
      try {
        const summary = await buildUserContextSummary(userId, accessToken)

        systemPrompt = [
          "You are the UpLyft training copilot. Ground every answer in the user's actual data. If the data is missing, say so.",
          'User context:\n' + userContextToPrompt(summary),
          'When suggesting next steps, keep them actionable and tied to the metrics you have.',
        ].join('\n\n')
      } catch (contextError) {
        console.warn('Failed to build user context summary:', contextError)
      }
    }

    const tools =
      typeof userId === 'string' && userId.trim()
        ? {
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
                const db = createServerDatabase(accessToken)

                const normalizedExercise = exerciseName?.toLowerCase()
                const resolvedLimit = Math.min(
                  Math.max(limitSessions ?? 5, 1),
                  20,
                )

                const sessions = await db.workoutSessions.getRecent(
                  userId,
                  Math.max(resolvedLimit, 5),
                )

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
                    we.exercise?.name
                      ?.toLowerCase()
                      .includes(normalizedExercise),
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
          }
        : undefined

    const result = streamText({
      model: openai('gpt-5-nano'),
      messages,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(tools ? { tools } : {}),
      stopWhen: ({ steps }) =>
        steps[steps.length - 1]?.finishReason !== 'tool-calls',
      onError: (error) => {
        console.error('❌ [streamText] response error:', error)
      },
    })

    const response = result.toTextStreamResponse()

    return response
  } catch (error) {
    console.error('Error in chat API:', error)
    return Response.json(
      { error: 'Failed to process chat request' },
      { status: 500 },
    )
  }
}

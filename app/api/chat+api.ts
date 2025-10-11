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
    const { messages, userId, weightUnit = 'kg' } = await request.json()

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
          "You are the Rep AI training copilot. Ground every answer in the user's actual data. If the data is missing, say so.",
          'User context:\n' + userContextToPrompt(summary),
          `Weight preferences: The user prefers ${
            weightUnit === 'kg' ? 'kilograms (kg)' : 'pounds (lbs)'
          }. When discussing weights, use their preferred unit. All stored weights are in kg, so convert when displaying.`,
          'When suggesting next steps, keep them actionable and tied to the metrics you have. If asked about 1 rep max. Calculate it based on their data (do not inlcude maths or formulas in responses)',
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
                const db = createServerDatabase(accessToken)

                const sessions = await db.workoutSessions.getRecent(userId, 200)
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

                const limited = entries.slice(0, Math.min(limit ?? 5, 20))

                return limited
              },
            }),
          }
        : undefined

    const result = streamText({
      model: openai('gpt-4.1-nano'),
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

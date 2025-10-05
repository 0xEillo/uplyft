import { createServerDatabase } from '@/lib/database-server'
import { buildUserContextSummary, userContextToPrompt } from '@/lib/utils/user-context'
import { openai } from '@ai-sdk/openai'
import { streamText, type CoreMessage } from 'ai'
import { z } from 'zod'

function buildContext(messages: CoreMessage[], userContext?: string): CoreMessage[] {
  const sys: CoreMessage = {
    role: 'system',
    content:
      `You are a helpful and knowledgeable fitness AI assistant integrated into a workout tracking app.\n\n` +
      (userContext ? `USER CONTEXT:\n${userContext}\n\n` : '') +
      `Your role is to:\n` +
      `- Answer questions about fitness, training, and exercise\n` +
      `- Provide workout advice and motivation\n` +
      `- Explain exercise techniques and programming\n` +
      `- Help users understand their fitness journey\n\n` +
      `Keep your responses:\n` +
      `- Concise and actionable\n` +
      `- Encouraging and supportive\n` +
      `- Evidence-based when giving advice\n` +
      `- Omit any match or calculation reasoning\n` +
      `- Conversational and friendly`,
  }
  const windowSize = 16
  const recent = Array.isArray(messages) ? messages.slice(-windowSize) : []
  return [sys, ...recent]
}

export async function POST(request: Request) {
  try {
    const { messages, userId } = await request.json()
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Build compact user context if userId is provided
    let userContext: string | undefined
    if (userId && typeof userId === 'string') {
      try {
        const summary = await buildUserContextSummary(userId, accessToken)
        userContext = userContextToPrompt(summary)
      } catch (e) {
        console.warn('Could not build user context:', e)
      }
    }

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: buildContext(messages, userContext),
      temperature: 0.3,
      tools: {
        getExerciseProgress: {
          description: 'Return concise progress for an exercise: max weights over time and trend',
          inputSchema: z.object({
            name: z.string().describe('Exercise name, e.g., "Bench Press"'),
            daysBack: z.number().int().positive().max(365).optional(),
          }),
          execute: async ({ name, daysBack }) => {
            if (!userId || typeof userId !== 'string') {
              return { error: 'No user context available' }
            }
            const db = createServerDatabase(accessToken)
            const ex = await db.exercises.findByName(name)
            const exact = ex?.find((e) => e.name.toLowerCase() === name.toLowerCase()) || ex?.[0]
            if (!exact) return { error: `Exercise not found: ${name}` }
            const progress = await db.stats.getExerciseWeightProgress(userId, exact.id, daysBack)
            return { exerciseId: exact.id, exerciseName: exact.name, points: progress }
          },
        },
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Error in chat API:', error)
    return Response.json(
      { error: 'Failed to process chat request' },
      { status: 500 },
    )
  }
}

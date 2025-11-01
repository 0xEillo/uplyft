import { OpenAI } from '../deps.ts'

import { createServiceClient } from '../../_shared/supabase.ts'
import {
  createExerciseInput,
  createExerciseTool,
  handleCreateExercise,
  handleSearchExercises,
  searchExercisesInput,
  searchExercisesTool,
} from '../../_shared/tools.ts'
import { AGENT_MAX_ITERATIONS, AGENT_MODEL } from '../constants.ts'
import { logWithCorrelation } from '../metrics.ts'

export interface ExerciseResolution {
  exerciseId: string
  exerciseName: string
  wasCreated: boolean
}

const apiKey = ((globalThis as unknown) as {
  Deno?: { env: { get(key: string): string | undefined } }
}).Deno?.env.get('OPENAI_API_KEY')

const openaiToolClient = new OpenAI({
  apiKey,
})

export async function resolveExercisesWithAgent(
  exerciseNames: string[],
  userId: string,
  correlationId: string,
): Promise<Map<string, ExerciseResolution>> {
  logWithCorrelation(
    correlationId,
    `Agent resolving ${exerciseNames.length} exercises`,
  )

  const resolutions = new Map<string, ExerciseResolution>()

  const exerciseList = exerciseNames
    .map((name, index) => `${index + 1}. ${name}`)
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

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let iterationCount = 0
  const serviceClient = createServiceClient()

  while (iterationCount < AGENT_MAX_ITERATIONS) {
    iterationCount += 1

    const response = await openaiToolClient.chat.completions.create({
      model: AGENT_MODEL,
      messages,
      tools: [searchExercisesTool, createExerciseTool],
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    if (!choice) {
      throw new Error('No response choice from OpenAI')
    }

    messages.push(choice.message)

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      logWithCorrelation(
        correlationId,
        `[Agent] Iteration ${iterationCount}: processing ${choice.message.tool_calls.length} tool call(s)`,
      )

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments)

        logWithCorrelation(
          correlationId,
          `[Agent] Tool call: ${toolName}(${JSON.stringify(toolArgs)})`,
        )

        let toolResult: unknown

        try {
          if (toolName === 'searchExercises') {
            const validatedArgs = searchExercisesInput.parse(toolArgs)
            toolResult = await handleSearchExercises(validatedArgs)
          } else if (toolName === 'createExercise') {
            const validatedArgs = createExerciseInput.parse(toolArgs)
            const result = await handleCreateExercise(validatedArgs, userId)
            toolResult = result

            if (!resolutions.has(validatedArgs.name)) {
              resolutions.set(validatedArgs.name, {
                exerciseId: result.id,
                exerciseName: result.name,
                wasCreated: true,
              })
            }
          } else {
            toolResult = { error: `Unknown tool: ${toolName}` }
          }
        } catch (error) {
          logWithCorrelation(
            correlationId,
            `[Agent] Tool ${toolName} failed`,
            error,
          )
          toolResult = {
            error: error instanceof Error ? error.message : String(error),
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        })
      }

      continue
    }

    logWithCorrelation(
      correlationId,
      `[Agent] Completed after ${iterationCount} iteration(s)`,
    )

    const finalContent = choice.message.content || ''
    logWithCorrelation(correlationId, `[Agent] Final response: ${finalContent}`)

    const resolutionRegex = /(\d+)\.\s+(.+?)\s+->\s+([a-f0-9-]{36})\s+\((matched|created)\)/gi
    let match: RegExpExecArray | null

    while ((match = resolutionRegex.exec(finalContent)) !== null) {
      const originalName = match[2].trim()
      const exerciseId = match[3]
      const wasCreated = match[4] === 'created'

      const actualName = exerciseNames.find(
        (name) => name.toLowerCase() === originalName.toLowerCase(),
      )

      if (actualName && !resolutions.has(actualName)) {
        try {
          const { data } = await serviceClient
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
          logWithCorrelation(
            correlationId,
            `[Agent] Could not fetch exercise name for ${exerciseId}, using original name`,
            error,
          )
          resolutions.set(actualName, {
            exerciseId,
            exerciseName: originalName,
            wasCreated,
          })
        }
      }
    }

    for (const name of exerciseNames) {
      if (resolutions.has(name)) continue

      logWithCorrelation(
        correlationId,
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
          const matchCandidate = searchResult.candidates[0]
          resolutions.set(name, {
            exerciseId: matchCandidate.id,
            exerciseName: matchCandidate.name,
            wasCreated: false,
          })
        } else {
          const createResult = await handleCreateExercise({ name }, userId)
          resolutions.set(name, {
            exerciseId: createResult.id,
            exerciseName: createResult.name,
            wasCreated: true,
          })
        }
      } catch (error) {
        logWithCorrelation(
          correlationId,
          `[Agent] Fallback failed for "${name}"`,
          error,
        )
        throw error
      }
    }

    break
  }

  if (iterationCount >= AGENT_MAX_ITERATIONS) {
    throw new Error('Agent exceeded maximum iterations')
  }

  for (const name of exerciseNames) {
    if (!resolutions.has(name)) {
      throw new Error(`Agent failed to resolve exercise: ${name}`)
    }
  }

  return resolutions
}

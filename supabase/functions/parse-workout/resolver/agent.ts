// @ts-ignore: Remote import for Deno edge runtime
import { google } from 'npm:@ai-sdk/google@2.0.46'
// @ts-ignore: Remote import for Deno edge runtime
import { generateObject } from 'npm:ai@5.0.60'
// @ts-ignore: Remote import for Deno edge runtime
import { z } from 'https://esm.sh/zod@3.25.76'

import {
  handleCreateExercise,
  handleSearchExercises,
} from '../../_shared/tools.ts'
import { logWithCorrelation } from '../metrics.ts'

const TRIGRAM_CONFIDENCE_THRESHOLD = 0.6

export interface ExerciseResolution {
  exerciseId: string
  exerciseName: string
  wasCreated: boolean
}

interface CandidateForAI {
  id: string
  name: string
  similarity: number
  aliases?: string[]
}

const aiResolutionSchema = z.object({
  decision: z.enum(['match', 'create']).describe(
    'Whether to match an existing exercise or create a new one'
  ),
  matchedExerciseId: z
    .string()
    .nullable()
    .describe('The ID of the matched exercise if decision is "match"'),
  newExerciseName: z
    .string()
    .nullable()
    .describe('The name for the new exercise if decision is "create"'),
  reasoning: z
    .string()
    .describe('Brief explanation of why this decision was made'),
})

export async function resolveExercises(
  exerciseNames: string[],
  userId: string,
  correlationId: string,
): Promise<Map<string, ExerciseResolution>> {
  logWithCorrelation(
    correlationId,
    `Resolving ${exerciseNames.length} exercises`,
  )

  const resolutions = new Map<string, ExerciseResolution>()
  const needsAIResolution: Array<{
    name: string
    candidates: CandidateForAI[]
  }> = []

  for (const name of exerciseNames) {
    try {
      const searchResult = await handleSearchExercises(
        { query: name, limit: 10 },
        userId,
      )

      const bestMatch = searchResult.candidates[0]

      if (bestMatch && bestMatch.similarity >= TRIGRAM_CONFIDENCE_THRESHOLD) {
        resolutions.set(name, {
          exerciseId: bestMatch.id,
          exerciseName: bestMatch.name,
          wasCreated: false,
        })
      } else {
        needsAIResolution.push({
          name,
          candidates: searchResult.candidates.slice(0, 15).map((c: any) => ({
            id: c.id,
            name: c.name,
            similarity: c.similarity,
            aliases: c.aliases,
          })),
        })
      }
    } catch (error) {
      needsAIResolution.push({ name, candidates: [] })
    }
  }

  if (needsAIResolution.length > 0) {
    for (const { name, candidates } of needsAIResolution) {
      try {
        const resolution = await resolveWithAI(name, candidates, correlationId)

        if (resolution.decision === 'match' && resolution.matchedExerciseId) {
          const matchedCandidate = candidates.find(
            (c) => c.id === resolution.matchedExerciseId,
          )
          resolutions.set(name, {
            exerciseId: resolution.matchedExerciseId,
            exerciseName: matchedCandidate?.name ?? name,
            wasCreated: false,
          })
        } else {
          const newName = resolution.newExerciseName || name
          const created = await handleCreateExercise({ name: newName }, userId)
          resolutions.set(name, {
            exerciseId: created.id,
            exerciseName: created.name,
            wasCreated: true,
          })
        }
      } catch (error) {
        const created = await handleCreateExercise({ name }, userId)
        resolutions.set(name, {
          exerciseId: created.id,
          exerciseName: created.name,
          wasCreated: true,
        })
      }
    }
  }

  for (const name of exerciseNames) {
    if (!resolutions.has(name)) {
      throw new Error(`Failed to resolve exercise: ${name}`)
    }
  }

  return resolutions
}

async function resolveWithAI(
  exerciseName: string,
  candidates: CandidateForAI[],
  correlationId: string,
): Promise<z.infer<typeof aiResolutionSchema>> {
  const candidateList =
    candidates.length > 0
      ? candidates
          .map(
            (c, i) =>
              `${i + 1}. ID: "${c.id}" | Name: "${c.name}" (similarity: ${c.similarity.toFixed(2)}${
                c.aliases?.length ? `, aliases: ${c.aliases.join(', ')}` : ''
              })`,
          )
          .join('\n')
      : 'No candidates found in database.'

  const prompt = `You are a fitness exercise database assistant. A user logged an exercise called "${exerciseName}".

Here are potential matches from our database:
${candidateList}

Your task:
1. If one of the candidates is clearly the same exercise (just a different name/spelling), choose "match" and return the candidate's ID (the UUID string)
2. If none of the candidates match AND this appears to be a real, specific exercise, choose "create"
3. Consider common variations: "bench" = "bench press", "squats" = "squat", "pullups" = "pull-ups"

IMPORTANT: When matching, you must return the exact ID (UUID) from the candidate list, NOT the exercise name.

Be lenient with matching - prefer matching over creating when reasonable.`

  const result = await generateObject({
    model: google('gemini-3-flash-preview'),
    schema: aiResolutionSchema,
    prompt,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingLevel: 'low',
        },
      },
    },
  })

  return result.object
}

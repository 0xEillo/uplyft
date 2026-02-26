// @ts-ignore: Remote import for Deno edge runtime
import { generateObject } from 'npm:ai'
// @ts-ignore: Remote import for Deno edge runtime
import { z } from 'https://esm.sh/zod@3.25.76'
import { GEMINI_MODEL, openrouter } from '../../_shared/openrouter.ts'
import { createServiceClient } from '../../_shared/supabase.ts'
import {
  BatchSearchRpcRow,
  buildBatchResolverCandidateMap,
  rankCandidatesForResolver,
  ResolverCandidate,
} from './search-utils.ts'

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

interface CandidateForAI extends ResolverCandidate {}

interface ResolverSearchResult {
  name: string
  searchResult: { candidates: CandidateForAI[] } | null
  error: unknown | null
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
  const uniqueExerciseNames = Array.from(new Set(exerciseNames))

  // Phase 1: Batch trigram search to reduce DB round-trips (with safe fallback
  // to the legacy per-exercise RPC path if the batch RPC isn't deployed yet).
  const searchResults = await batchSearchExercisesForResolver(
    uniqueExerciseNames,
    userId,
    correlationId,
  )

  const needsAIResolution: Array<{
    name: string
    candidates: CandidateForAI[]
  }> = []

  for (const { name, searchResult, error } of searchResults) {
    if (error || !searchResult) {
      needsAIResolution.push({ name, candidates: [] })
      continue
    }

    const bestMatch = searchResult.candidates[0]
    const normalizedName = name.toLowerCase().trim()
    const bestMatchName =
      typeof bestMatch?.name === 'string'
        ? bestMatch.name.toLowerCase().trim()
        : null
    const bestMatchAliases = Array.isArray(bestMatch?.aliases)
      ? bestMatch.aliases
      : []
    const isExactTopCandidateMatch = Boolean(
      bestMatch &&
      (bestMatchName === normalizedName ||
        bestMatchAliases.some(
          (alias: string) => alias.toLowerCase().trim() === normalizedName,
        )),
    )

    if (
      bestMatch &&
      (isExactTopCandidateMatch ||
        bestMatch.similarity >= TRIGRAM_CONFIDENCE_THRESHOLD)
    ) {
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
  }

  // Phase 2: Run AI decisions in parallel, but apply side effects (create/match)
  // afterward to avoid duplicate creation races within a single invocation.
  if (needsAIResolution.length > 0) {
    const aiResults = await Promise.all(
      needsAIResolution.map(async ({ name, candidates }) => {
        try {
          const resolution = await resolveWithAI(name, candidates, correlationId)
          return { name, candidates, resolution }
        } catch {
          return { name, candidates, resolution: null }
        }
      }),
    )

    for (const { name, candidates, resolution } of aiResults) {
      try {
        if (resolution?.decision === 'match' && resolution.matchedExerciseId) {
          const matchedCandidate = candidates.find(
            (c) => c.id === resolution.matchedExerciseId,
          )
          resolutions.set(name, {
            exerciseId: resolution.matchedExerciseId,
            exerciseName: matchedCandidate?.name ?? name,
            wasCreated: false,
          })
          continue
        }

        const newName = resolution?.newExerciseName || name
        const created = await handleCreateExercise({ name: newName }, userId)
        resolutions.set(name, {
          exerciseId: created.id,
          exerciseName: created.name,
          wasCreated: true,
        })
      } catch {
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

async function batchSearchExercisesForResolver(
  exerciseNames: string[],
  userId: string,
  correlationId: string,
): Promise<ResolverSearchResult[]> {
  if (exerciseNames.length === 0) return []

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('match_exercises_trgm_batch', {
      search_queries: exerciseNames,
      requesting_user_id: userId,
      match_count: 10,
      similarity_threshold: 0.35,
    })

    if (error) throw error

    const rows = (Array.isArray(data) ? data : []) as BatchSearchRpcRow[]
    const candidatesByQuery = buildBatchResolverCandidateMap(exerciseNames, rows, 10)

    return exerciseNames.map((name) => ({
      name,
      searchResult: {
        candidates: candidatesByQuery.get(name) ?? [],
      },
      error: null,
    }))
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'Batch trigram search unavailable; falling back to per-exercise RPC',
      {
        error: error instanceof Error ? error.message : String(error),
      },
    )

    return Promise.all(
      exerciseNames.map(async (name) => {
        try {
          const searchResult = await handleSearchExercises(
            { query: name, limit: 10 },
            userId,
          )
          return { name, searchResult, error: null }
        } catch (searchError) {
          return { name, searchResult: null, error: searchError }
        }
      }),
    )
  }
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
    model: openrouter.chat(GEMINI_MODEL),
    schema: aiResolutionSchema,
    prompt,
  })

  return result.object
}

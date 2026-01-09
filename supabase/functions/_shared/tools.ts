// @ts-ignore: Remote import for Deno edge runtime
import { google } from 'npm:@ai-sdk/google'
// @ts-ignore: Remote import for Deno edge runtime
import { z } from 'https://esm.sh/zod@3.25.76'
// @ts-ignore: Remote import for Deno edge runtime
import { generateObject } from 'npm:ai'

import { createServiceClient } from './supabase.ts'

// ============================================================================
// Tool Input/Output Schemas
// ============================================================================

export const searchExercisesInput = z.object({
  query: z.string().describe('The exercise name to search for'),
  limit: z.number().int().min(1).max(25).optional().default(20),
})

export const exerciseCandidate = z.object({
  id: z.string(),
  name: z.string(),
  similarity: z.number(),
  aliases: z.array(z.string()).optional(),
  muscle_group: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  equipment: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
})

export const searchExercisesOutput = z.object({
  candidates: z.array(exerciseCandidate),
})

export const createExerciseInput = z.object({
  name: z.string().min(1).describe('The exercise name'),
  muscle_group: z
    .enum([
      'Chest',
      'Back',
      'Shoulders',
      'Biceps',
      'Triceps',
      'Core',
      'Glutes',
      'Quads',
      'Hamstrings',
      'Calves',
      'Cardio',
      'Full Body',
    ])
    .nullable()
    .optional(),
  type: z.enum(['compound', 'isolation']).nullable().optional(),
  equipment: z
    .enum([
      'Barbell',
      'Dumbbell',
      'Bodyweight',
      'Cable',
      'Machine',
      'Kettlebell',
      'Resistance Band',
      'Other',
    ])
    .nullable()
    .optional(),
})

export const createExerciseOutput = z.object({
  id: z.string(),
  name: z.string(),
})

// ============================================================================
// OpenAI Tool Definitions
// ============================================================================

export const searchExercisesTool = {
  type: 'function' as const,
  function: {
    name: 'searchExercises',
    description:
      'Search for exercises in the database by name. Returns a list of candidate exercises with similarity scores, aliases, and metadata. Use this to find existing exercises before creating new ones.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The exercise name to search for (e.g., "bench press", "squat")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (1-25, default 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
}

export const createExerciseTool = {
  type: 'function' as const,
  function: {
    name: 'createExercise',
    description:
      'Create a new exercise in the database. Only use this when searchExercises returns no good matches. You should provide the exercise name and optionally its metadata (muscle_group, type, equipment).',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The exercise name (e.g., "Barbell Bench Press")',
        },
        muscle_group: {
          type: 'string',
          enum: [
            'Chest',
            'Back',
            'Shoulders',
            'Biceps',
            'Triceps',
            'Core',
            'Glutes',
            'Quads',
            'Hamstrings',
            'Calves',
            'Cardio',
            'Full Body',
          ],
          description: 'Primary muscle group targeted',
        },
        type: {
          type: 'string',
          enum: ['compound', 'isolation'],
          description:
            'Exercise type (compound = multi-joint, isolation = single muscle)',
        },
        equipment: {
          type: 'string',
          enum: [
            'Barbell',
            'Dumbbell',
            'Bodyweight',
            'Cable',
            'Machine',
            'Kettlebell',
            'Resistance Band',
            'Other',
          ],
          description: 'Equipment used for the exercise',
        },
      },
      required: ['name'],
    },
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Tool Handler Functions
// ============================================================================

export async function handleSearchExercises(
  args: z.infer<typeof searchExercisesInput>,
  userId: string,
): Promise<z.infer<typeof searchExercisesOutput>> {
  console.log(
    `[Tool: searchExercises] query="${args.query}", limit=${args.limit}`,
  )

  const supabase = createServiceClient()
  const limit = args.limit ?? 10

  const candidateMap = new Map<string, z.infer<typeof exerciseCandidate>>()

  const addCandidates = (rows: any[], source: string) => {
    for (const row of rows) {
      const createdBy =
        typeof row.created_by === 'string' ? row.created_by : null
      if (createdBy && createdBy !== userId) {
        continue
      }
      const candidate: z.infer<typeof exerciseCandidate> = {
        id: row.id,
        name: row.name,
        similarity: typeof row.similarity === 'number' ? row.similarity : 0,
        aliases: row.aliases || [],
        muscle_group: row.muscle_group,
        type: row.type,
        equipment: row.equipment,
        created_by: createdBy,
      }

      const existing = candidateMap.get(candidate.id)
      if (!existing || candidate.similarity > existing.similarity) {
        candidateMap.set(candidate.id, candidate)
      }
    }

    if (rows.length > 0) {
      const best = rows[0]
      const formattedBest = Number(
        (best.similarity?.toFixed?.(3) ?? best.similarity) as number,
      )
      console.log(
        `[Tool: searchExercises] ${source} found ${rows.length} results (best=${formattedBest})`,
      )
    } else {
      console.log(`[Tool: searchExercises] ${source} found no results`)
    }
  }

  // Trigram search (name + aliases)
  try {
    const { data, error } = await supabase.rpc('match_exercises_trgm', {
      search_query: args.query,
      requesting_user_id: userId,
      match_count: limit,
      similarity_threshold: 0.35,
    })

    if (error) throw error

    const trigramRows = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      aliases: row.aliases || [],
      muscle_group: row.muscle_group,
      type: row.type,
      equipment: row.equipment,
      similarity:
        typeof row.best_similarity === 'number' ? row.best_similarity : 0,
    }))

    addCandidates(trigramRows, 'Trigram search')
  } catch (error) {
    console.warn('[Tool: searchExercises] Trigram search failed:', error)
  }

  const candidates = Array.from(candidateMap.values())
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit)

  if (candidates.length > 0) {
    const preview = candidates.slice(0, 5).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      similarity: Number(
        candidate.similarity?.toFixed?.(3) ?? candidate.similarity,
      ),
      aliases: candidate.aliases?.slice(0, 5) ?? [],
    }))
    console.log(
      `[Tool: searchExercises] Candidates preview (${candidates.length} total):`,
      JSON.stringify(preview),
    )
  }

  return { candidates }
}

/**
 * Normalizes exercise names to title case (each word starts with capital letter)
 * Examples: "leg press" -> "Leg Press", "bench press" -> "Bench Press"
 */
function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      // Handle hyphenated words (e.g., "push-ups" -> "Push-ups")
      if (word.includes('-')) {
        return word
          .split('-')
          .map(
            (part) =>
              part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
          )
          .join('-')
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

export async function handleCreateExercise(
  args: z.infer<typeof createExerciseInput>,
  userId: string,
): Promise<z.infer<typeof createExerciseOutput>> {
  console.log(`[Tool: createExercise] name="${args.name}"`)

  const trimmedName = args.name.trim()

  if (!trimmedName) {
    throw new Error('Exercise name cannot be empty')
  }

  if (trimmedName.length > 100) {
    throw new Error('Exercise name too long (max 100 characters)')
  }

  // Security check
  if (/<script|javascript:|on\w+=/i.test(trimmedName)) {
    throw new Error('Invalid exercise name')
  }

  // Normalize to title case (e.g., "leg press" -> "Leg Press")
  const normalizedName = normalizeExerciseName(trimmedName)
  const searchName = normalizedName.toLowerCase()

  const supabase = createServiceClient()

  // Check for exact match first
  const { data: exactMatch } = await supabase
    .from('exercises')
    .select('*')
    .ilike('name', normalizedName)
    .or(`created_by.is.null,created_by.eq.${userId}`)
    .single()

  if (exactMatch) {
    console.log(
      `[Tool: createExercise] Found exact match, returning existing: ${exactMatch.id}`,
    )
    return { id: exactMatch.id, name: exactMatch.name }
  }

  // Respect aliases (stored in lower-case) before creating duplicates
  const { data: aliasMatches, error: aliasError } = await supabase
    .from('exercises')
    .select('*')
    .contains('aliases', [searchName])
    .or(`created_by.is.null,created_by.eq.${userId}`)
    .limit(1)

  if (aliasError) {
    console.warn('[Tool: createExercise] Alias check failed:', aliasError)
  } else if (aliasMatches && aliasMatches.length > 0) {
    const aliasMatch = aliasMatches[0]
    console.log(
      `[Tool: createExercise] Found alias match, returning existing: ${aliasMatch.id}`,
    )
    return { id: aliasMatch.id, name: aliasMatch.name }
  }

  // Generate metadata if not provided
  let metadata = {
    muscle_group: args.muscle_group || null,
    type: args.type || null,
    equipment: args.equipment || null,
  }

  // If any metadata is missing, use AI to fill it in
  if (!metadata.muscle_group || !metadata.type || !metadata.equipment) {
    const generated = await generateExerciseMetadata(normalizedName)
    metadata = {
      muscle_group: args.muscle_group || generated.muscle_group,
      type: args.type || generated.type,
      equipment: args.equipment || generated.equipment,
    }
  }

  // Insert new exercise
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: normalizedName,
      created_by: userId,
      muscle_group: metadata.muscle_group,
      type: metadata.type,
      equipment: metadata.equipment,
    })
    .select('id, name')
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create exercise')

  console.log(`[Tool: createExercise] Created new exercise: ${data.id}`)

  return { id: data.id, name: data.name }
}

async function generateExerciseMetadata(
  exerciseName: string,
): Promise<{
  muscle_group: string
  type: string
  equipment: string
}> {
  const exerciseMetadataSchema = z.object({
    muscle_group: z.enum([
      'Chest',
      'Back',
      'Shoulders',
      'Biceps',
      'Triceps',
      'Core',
      'Glutes',
      'Quads',
      'Hamstrings',
      'Calves',
      'Cardio',
      'Full Body',
    ]),
    type: z.enum(['compound', 'isolation']),
    equipment: z.enum([
      'Barbell',
      'Dumbbell',
      'Bodyweight',
      'Cable',
      'Machine',
      'Kettlebell',
      'Resistance Band',
      'Other',
    ]),
  })

  try {
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: exerciseMetadataSchema,
      prompt: `You are a fitness expert. Analyze the exercise name and determine its metadata.

Exercise name: "${exerciseName}"

Determine:
1. Primary muscle group (Chest, Back, Legs, Shoulders, Biceps, Triceps, Core, Glutes, Cardio, Full Body)
2. Type (compound or isolation)
   - Compound: works multiple muscle groups/joints (e.g., Bench Press, Squat, Pull-ups)
   - Isolation: targets single muscle group (e.g., Bicep Curl, Leg Extension, Lateral Raise)
3. Equipment (barbell, dumbbell, bodyweight, cable, machine, kettlebell, resistance band, other)

Examples:
- "Bench Press" → muscle_group: Chest, type: compound, equipment: barbell
- "Dumbbell Curl" → muscle_group: Biceps, type: isolation, equipment: dumbbell
- "Push-ups" → muscle_group: Chest, type: compound, equipment: bodyweight
- "Lat Pulldown" → muscle_group: Back, type: compound, equipment: cable
- "Leg Extension" → muscle_group: Legs, type: isolation, equipment: machine

Return the metadata as JSON.`,
      providerOptions: {
        google: {},
      },
    })

    return result.object
  } catch (error) {
    console.error(
      '[generateExerciseMetadata] Error generating metadata:',
      error,
    )
    // Return sensible defaults if AI fails
    return {
      muscle_group: 'Full Body',
      type: 'compound',
      equipment: 'other',
    }
  }
}

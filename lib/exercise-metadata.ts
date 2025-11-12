import { z } from 'zod'

import { supabase } from '@/lib/supabase'
import { callSupabaseFunction } from '@/lib/supabase-functions-client'

const exerciseMetadataSchema = z.object({
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
    .describe('Primary muscle group targeted by this exercise'),
  type: z
    .enum(['compound', 'isolation'])
    .describe(
      'Compound exercises work multiple muscle groups and joints. Isolation exercises target a single muscle group.',
    ),
  equipment: z
    .enum([
      'barbell',
      'dumbbell',
      'bodyweight',
      'cable',
      'machine',
      'kettlebell',
      'resistance band',
      'other',
    ])
    .describe('Primary equipment needed for this exercise'),
})

export type ExerciseMetadata = z.infer<typeof exerciseMetadataSchema>

/**
 * Uses AI to infer exercise metadata (muscle group, type, equipment) from exercise name
 */
export async function generateExerciseMetadata(
  exerciseName: string,
): Promise<ExerciseMetadata> {
  const trimmedName = exerciseName.trim()
  if (!trimmedName) {
    throw new Error('Exercise name cannot be empty')
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    const response = await callSupabaseFunction(
      'generate-exercise-metadata',
      'POST',
      { exerciseName: trimmedName },
      undefined,
      accessToken,
    )

    if (!response.ok) {
      throw new Error(`Edge function error (${response.status})`)
    }

    const payload = await response.json()
    return exerciseMetadataSchema.parse(payload)
  } catch (error) {
    console.error('Error generating exercise metadata:', error)
    // Return sensible defaults if AI fails
    return {
      muscle_group: 'Full Body',
      type: 'compound',
      equipment: 'other',
    }
  }
}

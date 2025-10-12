import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

const exerciseMetadataSchema = z.object({
  muscle_group: z
    .enum([
      'Chest',
      'Back',
      'Legs',
      'Shoulders',
      'Biceps',
      'Triceps',
      'Core',
      'Glutes',
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
  try {
    const result = await generateObject({
      model: openai('gpt-4.1-nano'),
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
    })

    return result.object
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

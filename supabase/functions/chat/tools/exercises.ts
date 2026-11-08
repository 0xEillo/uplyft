// deno-lint-ignore-file no-explicit-any
import { z } from 'npm:zod@3.25.76'
import { tool } from 'npm:ai@7.0.162'

import { formatInstructions, type ToolContext } from './shared.ts'

const MUSCLE_GROUPS = [
  'Back', 'Biceps', 'Calves', 'Cardio', 'Chest', 'Core', 'Forearms',
  'Full Body', 'Glutes', 'Hamstrings', 'Quads', 'Shoulders', 'Triceps',
] as const

const EQUIPMENT = [
  'barbell', 'bodyweight', 'cable', 'dumbbell', 'kettlebell', 'machine', 'resistance band',
] as const

// Common synonyms → canonical muscle group.
const MUSCLE_SYNONYMS: Record<string, string> = {
  quadriceps: 'Quads', legs: 'Quads', 'lower body': 'Quads', thighs: 'Quads', adductors: 'Quads',
  pecs: 'Chest', pectorals: 'Chest',
  lats: 'Back', traps: 'Back', rhomboids: 'Back', 'lower back': 'Back', 'upper back': 'Back',
  abs: 'Core', abdominals: 'Core', obliques: 'Core',
  delts: 'Shoulders', deltoids: 'Shoulders', 'rear delts': 'Shoulders', 'side delts': 'Shoulders',
  butt: 'Glutes', hips: 'Glutes', abductors: 'Glutes',
  arms: 'Biceps', conditioning: 'Cardio',
}

export function exerciseTools({ supabase }: ToolContext) {
  return {
    searchExercises: tool({
      description:
        "Search the app's exercise library (the only valid exercise names for workouts, programs and suggestions). Filter by name text, muscle group and/or equipment. Returns name, type (compound/isolation), equipment and muscles; set details=true to also get step-by-step instructions and secondary muscles.",
      inputSchema: z.object({
        query: z.string().trim().max(120).optional().describe('Text in the exercise name, e.g. "row".'),
        muscleGroup: z.string().optional().describe(`One of: ${MUSCLE_GROUPS.join(', ')}.`),
        equipment: z.string().optional().describe(`One of: ${EQUIPMENT.join(', ')}.`),
        details: z.boolean().optional().describe('Include instructions and secondary muscles (use for form/how-to questions).'),
        limit: z.number().int().min(1).max(40).optional().describe('Default 20.'),
      }),
      execute: async ({ query, muscleGroup, equipment, details = false, limit = 20 }) => {
        const muscle = muscleGroup
          ? MUSCLE_SYNONYMS[muscleGroup.trim().toLowerCase()] ?? muscleGroup.trim()
          : undefined
        const gear = equipment?.trim().toLowerCase().replace(/s$/, '').replace('body weight', 'bodyweight')

        let request = (supabase as any)
          .from('exercises')
          .select(
            details
              ? 'name, type, equipment, muscle_group, target_muscles, secondary_muscles, instructions'
              : 'name, type, equipment, muscle_group, target_muscles',
          )
          .is('created_by', null)
          .order('name', { ascending: true })
          .limit(limit)
        if (query) request = request.ilike('name', `%${query.replace(/[%_]/g, '')}%`)
        if (muscle) request = request.ilike('muscle_group', `%${muscle}%`)
        if (gear) request = request.ilike('equipment', `%${gear}%`)

        const { data, error } = await request
        if (error) throw error
        return {
          exercises: ((data ?? []) as any[]).map((exercise) => ({
            name: exercise.name,
            type: exercise.type ?? 'unknown',
            equipment: exercise.equipment ?? 'unknown',
            muscleGroup: exercise.muscle_group,
            targetMuscles: exercise.target_muscles,
            ...(details
              ? {
                  secondaryMuscles: exercise.secondary_muscles,
                  instructions: formatInstructions(exercise.instructions),
                }
              : {}),
          })),
        }
      },
    }),
  }
}

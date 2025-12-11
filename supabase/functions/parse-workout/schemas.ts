import { z } from './deps.ts'

export const workoutSchema = z.object({
  isWorkoutRelated: z.boolean(),
  notes: z.string().nullish(),
  type: z.string().nullish(),
  exercises: z
    .array(
      z.object({
        name: z.string(),
        order_index: z.number(),
        notes: z.string().nullish(),
        sets: z.array(
          z.object({
            set_number: z.number().optional(),
            reps: z.number().int().min(1).nullable().optional(),
            weight: z.number().nullable().optional(),
            rpe: z.number().nullable().optional(),
            notes: z.string().nullish(),
          }),
        ),
      }),
    )
    .describe('List of exercises performed in order'),
})

export const requestSchema = z.object({
  notes: z.string(),
  weightUnit: z.enum(['kg', 'lb']).optional().default('kg'),
  createWorkout: z.boolean().optional(),
  userId: z.string().optional(),
  workoutTitle: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  routineId: z.string().nullable().optional(),
  durationSeconds: z.number().int().min(0).optional(),
})

export type WorkoutRequest = z.infer<typeof requestSchema>
export type ParsedWorkout = z.infer<typeof workoutSchema>

export interface NormalizedSet {
  set_number: number
  reps: number | null
  weight?: number | null
  rpe?: number | null
  notes?: string | null
}

export interface NormalizedExercise {
  name: string
  order_index: number
  notes?: string | null
  hasRepGaps: boolean
  sets: NormalizedSet[]
}

export interface NormalizedWorkout {
  notes?: string | null
  type?: string | null
  exercises: NormalizedExercise[]
}

export interface WorkoutMetrics {
  totalExercises: number
  matchedExercises: number
  createdExercises: number
  totalSets: number
}

import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'

export interface RoutineTemplateSet {
  setNumber: number
  repsMin: number | null
  repsMax: number | null
  restSeconds: number | null
}

export interface RoutineTemplateExercise {
  id: string
  name: string
  orderIndex: number
  sets: RoutineTemplateSet[]
}

export function buildStructuredDraftFromRoutineTemplate(
  exercises: RoutineTemplateExercise[],
): StructuredExerciseDraft[] {
  return [...exercises]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name || 'Exercise',
      sets: [...(exercise.sets || [])]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({
          weight: '',
          reps: '',
          targetRepsMin: set.repsMin ?? null,
          targetRepsMax: set.repsMax ?? null,
          targetRestSeconds: set.restSeconds ?? null,
        })),
    }))
}

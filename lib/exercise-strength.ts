import { isRepBasedExercise } from './exercise-standards-config'
import { estimateOneRepMaxKg } from './strength-progress'

export interface ExerciseStrengthSetInput {
  reps: number | null | undefined
  weight: number | null | undefined
}

export function getExerciseStrengthMetric(
  exerciseName: string,
  set: ExerciseStrengthSetInput,
): number | null {
  const reps = set.reps
  if (!Number.isFinite(reps) || !reps || reps <= 0) {
    return null
  }

  if (isRepBasedExercise(exerciseName)) {
    return reps
  }

  const weight = set.weight
  if (!Number.isFinite(weight) || !weight || weight <= 0) {
    return null
  }

  return estimateOneRepMaxKg(weight, reps)
}

export function getExerciseRecordWeightKey(
  exerciseName: string,
  weight: number | null | undefined,
): number | null {
  if (isRepBasedExercise(exerciseName)) {
    return Number.isFinite(weight) && weight && weight > 0 ? weight : 0
  }

  return Number.isFinite(weight) && weight && weight > 0 ? weight : null
}

import {
  getTargetMusclesForBodyPart,
  type BodyPartSlug,
} from './body-mapping'
import {
  type ExerciseStandardsConfig,
  getTrackableExercisesForMuscle,
} from './exercise-standards-config'
import { resolveExerciseSpecificMuscle } from './strength-display-groups'

export function getTrackableExercisesForBodyPart(
  bodyPartSlug: BodyPartSlug | null | undefined,
): ExerciseStandardsConfig[] {
  const seen = new Map<string, ExerciseStandardsConfig>()

  getTargetMusclesForBodyPart(bodyPartSlug).forEach((muscle) => {
    getTrackableExercisesForMuscle(muscle).forEach((exercise) => {
      seen.set(exercise.name, exercise)
    })
  })

  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function exerciseMatchesBodyPart(
  exercise: { exerciseName: string; muscleGroup?: string | null },
  bodyPartSlug: BodyPartSlug | null | undefined,
): boolean {
  const targetMuscles = getTargetMusclesForBodyPart(bodyPartSlug)
  if (targetMuscles.length === 0) return false

  const resolvedMuscle = resolveExerciseSpecificMuscle(
    exercise.exerciseName,
    exercise.muscleGroup,
  )

  return resolvedMuscle ? targetMuscles.includes(resolvedMuscle) : false
}

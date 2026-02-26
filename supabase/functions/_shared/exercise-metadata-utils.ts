export type ExerciseMetadataShape = {
  muscle_group: string | null
  type: string | null
  equipment: string | null
}

export type ExerciseMetadataComplete = {
  muscle_group: string
  type: string
  equipment: string
}

export const DEFAULT_EXERCISE_METADATA: ExerciseMetadataComplete = {
  muscle_group: 'Full Body',
  type: 'compound',
  equipment: 'Other',
}

export function buildExerciseMetadataPlan(provided: ExerciseMetadataShape): {
  needsEnrichment: boolean
  insertMetadata: ExerciseMetadataComplete
} {
  const needsEnrichment =
    !provided.muscle_group || !provided.type || !provided.equipment

  return {
    needsEnrichment,
    insertMetadata: {
      muscle_group: provided.muscle_group ?? DEFAULT_EXERCISE_METADATA.muscle_group,
      type: provided.type ?? DEFAULT_EXERCISE_METADATA.type,
      equipment: provided.equipment ?? DEFAULT_EXERCISE_METADATA.equipment,
    },
  }
}

export function buildExerciseMetadataEnrichmentUpdates(
  provided: ExerciseMetadataShape,
  generated: ExerciseMetadataComplete,
): Record<string, string> {
  const updates: Record<string, string> = {}
  if (!provided.muscle_group) updates.muscle_group = generated.muscle_group
  if (!provided.type) updates.type = generated.type
  if (!provided.equipment) updates.equipment = generated.equipment
  return updates
}

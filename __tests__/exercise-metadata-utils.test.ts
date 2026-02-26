import {
  buildExerciseMetadataEnrichmentUpdates,
  buildExerciseMetadataPlan,
  DEFAULT_EXERCISE_METADATA,
} from '../supabase/functions/_shared/exercise-metadata-utils'

describe('exercise metadata utils', () => {
  test('does not require enrichment when all metadata is provided', () => {
    const plan = buildExerciseMetadataPlan({
      muscle_group: 'Chest',
      type: 'compound',
      equipment: 'Barbell',
    })

    expect(plan.needsEnrichment).toBe(false)
    expect(plan.insertMetadata).toEqual({
      muscle_group: 'Chest',
      type: 'compound',
      equipment: 'Barbell',
    })
  })

  test('fills missing metadata with defaults and flags enrichment', () => {
    const plan = buildExerciseMetadataPlan({
      muscle_group: null,
      type: 'isolation',
      equipment: null,
    })

    expect(plan.needsEnrichment).toBe(true)
    expect(plan.insertMetadata).toEqual({
      muscle_group: DEFAULT_EXERCISE_METADATA.muscle_group,
      type: 'isolation',
      equipment: DEFAULT_EXERCISE_METADATA.equipment,
    })
  })

  test('builds enrichment updates only for missing fields', () => {
    const updates = buildExerciseMetadataEnrichmentUpdates(
      {
        muscle_group: null,
        type: 'compound',
        equipment: null,
      },
      {
        muscle_group: 'Back',
        type: 'isolation',
        equipment: 'Cable',
      },
    )

    expect(updates).toEqual({
      muscle_group: 'Back',
      equipment: 'Cable',
    })
  })

  test('returns no enrichment updates when nothing is missing', () => {
    const updates = buildExerciseMetadataEnrichmentUpdates(
      {
        muscle_group: 'Legs',
        type: 'compound',
        equipment: 'Machine',
      },
      {
        muscle_group: 'Chest',
        type: 'isolation',
        equipment: 'Cable',
      },
    )

    expect(updates).toEqual({})
  })

  test('preserves capitalized Other equipment default/update values', () => {
    const plan = buildExerciseMetadataPlan({
      muscle_group: null,
      type: null,
      equipment: null,
    })
    expect(plan.insertMetadata.equipment).toBe('Other')

    const updates = buildExerciseMetadataEnrichmentUpdates(
      {
        muscle_group: null,
        type: null,
        equipment: null,
      },
      {
        muscle_group: 'Full Body',
        type: 'compound',
        equipment: 'Other',
      },
    )
    expect(updates.equipment).toBe('Other')
  })
})

// Body part slugs supported by react-native-body-highlighter
export type BodyPartSlug =
  | 'trapezius'
  | 'triceps'
  | 'forearm'
  | 'adductors'
  | 'calves'
  | 'hair'
  | 'neck'
  | 'deltoids'
  | 'hands'
  | 'feet'
  | 'head'
  | 'ankles'
  | 'tibialis'
  | 'obliques'
  | 'chest'
  | 'biceps'
  | 'abs'
  | 'quadriceps'
  | 'knees'
  | 'upper-back'
  | 'lower-back'
  | 'hamstring'
  | 'gluteal'

export const ALL_BODY_PART_SLUGS: BodyPartSlug[] = [
  'trapezius',
  'triceps',
  'forearm',
  'adductors',
  'calves',
  'hair',
  'neck',
  'deltoids',
  'hands',
  'feet',
  'head',
  'ankles',
  'tibialis',
  'obliques',
  'chest',
  'biceps',
  'abs',
  'quadriceps',
  'knees',
  'upper-back',
  'lower-back',
  'hamstring',
  'gluteal',
]

type BodyPartMetadata = {
  displayName?: string
  primaryMuscle?: string
  targetMuscles?: string[]
}

const BODY_PART_METADATA: Partial<Record<BodyPartSlug, BodyPartMetadata>> = {
  chest: {
    displayName: 'Chest',
    primaryMuscle: 'Chest',
  },
  triceps: {
    displayName: 'Triceps',
    primaryMuscle: 'Triceps',
  },
  deltoids: {
    displayName: 'Shoulders',
    primaryMuscle: 'Shoulders',
  },
  biceps: {
    displayName: 'Biceps',
    primaryMuscle: 'Biceps',
  },
  'upper-back': {
    displayName: 'Upper Back',
    primaryMuscle: 'Back',
    targetMuscles: ['Back'],
  },
  forearm: {
    displayName: 'Forearms',
    primaryMuscle: 'Forearms',
  },
  trapezius: {
    displayName: 'Traps',
    primaryMuscle: 'Traps',
    targetMuscles: ['Traps'],
  },
  quadriceps: {
    displayName: 'Quads',
    primaryMuscle: 'Quads',
  },
  hamstring: {
    displayName: 'Hamstrings',
    primaryMuscle: 'Hamstrings',
  },
  gluteal: {
    displayName: 'Glutes',
    primaryMuscle: 'Glutes',
  },
  calves: {
    displayName: 'Calves',
    primaryMuscle: 'Calves',
  },
  adductors: {
    displayName: 'Adductors',
    primaryMuscle: 'Adductors',
  },
  'lower-back': {
    displayName: 'Lower Back',
    primaryMuscle: 'Lower Back',
    targetMuscles: ['Lower Back'],
  },
  abs: {
    displayName: 'Abs',
    primaryMuscle: 'Core',
    targetMuscles: ['Core'],
  },
  obliques: {
    displayName: 'Obliques',
    primaryMuscle: 'Core',
    targetMuscles: ['Core'],
  },
}

// Human-readable names for body parts
export const BODY_PART_DISPLAY_NAMES: Partial<Record<BodyPartSlug, string>> =
  Object.fromEntries(
    Object.entries(BODY_PART_METADATA)
      .filter(([, metadata]) => metadata.displayName)
      .map(([slug, metadata]) => [slug, metadata.displayName]),
  ) as Partial<Record<BodyPartSlug, string>>

/**
 * Maps a body part slug to the primary muscle group name used by the body views.
 */
export const BODY_PART_TO_DATABASE_MUSCLE: Partial<
  Record<BodyPartSlug, string>
> = Object.fromEntries(
  Object.entries(BODY_PART_METADATA)
    .filter(([, metadata]) => metadata.primaryMuscle)
    .map(([slug, metadata]) => [slug, metadata.primaryMuscle]),
) as Partial<Record<BodyPartSlug, string>>

export function getBodyPartDisplayName(
  bodyPartSlug: BodyPartSlug | null | undefined,
): string | null {
  if (!bodyPartSlug) return null
  return BODY_PART_DISPLAY_NAMES[bodyPartSlug] ?? null
}

export function getPrimaryMuscleForBodyPart(
  bodyPartSlug: BodyPartSlug | null | undefined,
): string | null {
  if (!bodyPartSlug) return null
  return BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug] ?? null
}

export function getTargetMusclesForBodyPart(
  bodyPartSlug: BodyPartSlug | null | undefined,
): string[] {
  if (!bodyPartSlug) return []

  const metadata = BODY_PART_METADATA[bodyPartSlug]
  if (!metadata) return []

  if (metadata.targetMuscles) {
    return metadata.targetMuscles
  }

  return metadata.primaryMuscle ? [metadata.primaryMuscle] : []
}

export function findBodyPartSlugForMuscle(
  muscleGroup: string | null | undefined,
): BodyPartSlug | null {
  if (!muscleGroup) return null

  const match = Object.entries(BODY_PART_TO_DATABASE_MUSCLE).find(
    ([, primaryMuscle]) => primaryMuscle === muscleGroup,
  )

  return (match?.[0] as BodyPartSlug | undefined) ?? null
}

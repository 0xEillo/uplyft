/**
 * Body Mapping Configuration
 * Maps exercise groups (Push/Pull/Lower) to body highlighter anatomical slugs
 */

import type { ExerciseGroup } from './exercise-standards-config'

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

// Maps from ExerciseGroup to body highlighter slugs
export const EXERCISE_GROUP_TO_BODY_PARTS: Record<ExerciseGroup, BodyPartSlug[]> = {
  Push: ['chest', 'triceps', 'deltoids'],
  Pull: ['biceps', 'upper-back', 'forearm', 'trapezius'],
  Lower: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'],
  Other: [],
}

// Reverse mapping: body part slug → ExerciseGroup
export const BODY_PART_TO_EXERCISE_GROUP: Partial<Record<BodyPartSlug, ExerciseGroup>> = {
  chest: 'Push',
  triceps: 'Push',
  deltoids: 'Push',
  biceps: 'Pull',
  'upper-back': 'Pull',
  forearm: 'Pull',
  trapezius: 'Pull',
  quadriceps: 'Lower',
  hamstring: 'Lower',
  gluteal: 'Lower',
  calves: 'Lower',
  adductors: 'Lower',
}

// Human-readable names for body parts
export const BODY_PART_DISPLAY_NAMES: Partial<Record<BodyPartSlug, string>> = {
  chest: 'Chest',
  triceps: 'Triceps',
  deltoids: 'Shoulders',
  biceps: 'Biceps',
  'upper-back': 'Upper Back',
  forearm: 'Forearms',
  trapezius: 'Traps',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  gluteal: 'Glutes',
  calves: 'Calves',
  adductors: 'Adductors',
  'lower-back': 'Lower Back',
  abs: 'Abs',
  obliques: 'Obliques',
}

// Get all body parts that should be highlighted (have data)
export function getHighlightedBodyParts(
  groupsWithData: Set<ExerciseGroup>
): BodyPartSlug[] {
  const parts: BodyPartSlug[] = []
  
  for (const group of groupsWithData) {
    const bodyParts = EXERCISE_GROUP_TO_BODY_PARTS[group]
    if (bodyParts) {
      parts.push(...bodyParts)
    }
  }
  
  return parts
}

// Get the exercise group for a body part slug
export function getExerciseGroupForBodyPart(slug: BodyPartSlug): ExerciseGroup | null {
  return BODY_PART_TO_EXERCISE_GROUP[slug] || null
}

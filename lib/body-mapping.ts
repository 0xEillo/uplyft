/**
 * Body Mapping Configuration
 * Maps exercise groups (Push/Pull/Lower) to body highlighter anatomical slugs
 */


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

/**
 * Maps a body part slug to the corresponding muscle group name in the database.
 * This is used for precise filtering of exercises.
 */
export const BODY_PART_TO_DATABASE_MUSCLE: Record<string, string> = {
  deltoids: 'Shoulders',
  chest: 'Chest',
  triceps: 'Triceps',
  biceps: 'Biceps',
  'upper-back': 'Back',
  'lower-back': 'Lower Back',
  forearm: 'Forearms',
  trapezius: 'Traps',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  gluteal: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  obliques: 'Abs',
}


/**
 * Strength Standards Classification
 * Based on established strength standards from StrengthLevel.com and similar sources
 * Standards are relative to bodyweight for major compound lifts
 *
 * Level lookups live in supabase/functions/_shared/strength-core.ts (shared
 * with the edge functions). Exercise names match case-insensitively.
 */

import {
  getStandardsLadder as getCoreStandardsLadder,
  type StrengthStandard,
} from '../supabase/functions/_shared/strength-core'
import type { StrengthLevel } from './exercise-standards-config'

export {
  clampStrengthProgress,
  getStrengthStandard,
  hasStrengthStandards,
} from '../supabase/functions/_shared/strength-core'

/**
 * Get the full ladder of standards for an exercise (for display purposes)
 */
export function getStandardsLadder(
  exerciseName: string,
  gender: 'male' | 'female',
): StrengthStandard[] | null {
  return getCoreStandardsLadder(exerciseName, gender) as StrengthStandard[] | null
}

// Re-export types for convenience
export type { StrengthLevel, StrengthStandard }

/**
 * Strength Standards Classification
 * Based on established strength standards from StrengthLevel.com and similar sources
 * Standards are relative to bodyweight for major compound lifts
 *
 * This module now imports from exercise-standards-config.ts for a single source of truth
 */

import {
    EXERCISES_WITH_STANDARDS,
    getExerciseNameMap,
    type StrengthLevel,
    type StrengthStandard,
} from './exercise-standards-config'

// Create lookup maps for fast access
const exerciseNameMap = getExerciseNameMap()

/**
 * Get the strength standard for a given exercise
 */
export function getStrengthStandard(
  exerciseName: string,
  gender: 'male' | 'female',
  bodyweight: number,
  oneRepMax: number,
): {
  level: StrengthLevel
  standard: StrengthStandard
  nextLevel: StrengthStandard | null
  progress: number // 0-100 progress to next level
} | null {
  // Get exercise config (handles both main names and aliases)
  const config = exerciseNameMap.get(exerciseName)
  if (!config) {
    return null
  }

  const standards = config[gender]
  const ratio = oneRepMax / bodyweight

  // Find current level
  let currentLevel = standards[0]
  let nextLevel: StrengthStandard | null = null
  let levelIndex = -1

  for (let i = standards.length - 1; i >= 0; i--) {
    if (ratio >= standards[i].multiplier) {
      currentLevel = standards[i]
      levelIndex = i
      nextLevel = i < standards.length - 1 ? standards[i + 1] : null
      break
    }
  }

  // Calculate progress to next level
  let progress = 100 // Default to 100% if at max level
  
  if (levelIndex === -1 && standards.length > 0) {
    // Below the first milestone
    nextLevel = standards[0]
    const nextThreshold = nextLevel.multiplier
    progress = nextThreshold > 0 ? (ratio / nextThreshold) * 100 : 0
  } else if (nextLevel) {
    const currentThreshold = currentLevel.multiplier
    const nextThreshold = nextLevel.multiplier
    const range = nextThreshold - currentThreshold
    const currentProgress = ratio - currentThreshold
    progress = range > 0 ? (currentProgress / range) * 100 : 0
  }

  return {
    level: levelIndex === -1 ? 'Untrained' : currentLevel.level,
    standard: currentLevel,
    nextLevel,
    progress: clampStrengthProgress(progress),
  }
}

export function clampStrengthProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, progress))
}

/**
 * Get all available standards for display
 */
export function getAvailableStandards(): string[] {
  return EXERCISES_WITH_STANDARDS.map((config) => config.name)
}

/**
 * Check if an exercise has strength standards defined
 */
export function hasStrengthStandards(exerciseName: string): boolean {
  return exerciseNameMap.has(exerciseName)
}

/**
 * Get the full ladder of standards for an exercise (for display purposes)
 */
export function getStandardsLadder(
  exerciseName: string,
  gender: 'male' | 'female',
): StrengthStandard[] | null {
  const config = exerciseNameMap.get(exerciseName)
  if (!config) {
    return null
  }

  return config[gender]
}

// Re-export types for convenience
export type { StrengthLevel, StrengthStandard }

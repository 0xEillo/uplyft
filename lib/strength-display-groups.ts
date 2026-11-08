import {
  getStrengthExerciseTier,
  muscleToStrengthGroup,
  resolveExerciseSpecificMuscle,
} from '../supabase/functions/_shared/strength-core'
import {
  getOverallStrengthGroupLevelProgress,
  type OverallStrengthGroup,
  type OverallStrengthGroupBreakdown,
} from './overall-strength-score'
import type { StrengthLevel } from './exercise-standards-config'
import {
  scoreToLevelProgress,
  toLevelScore,
  type StrengthGender,
} from './strength-progress'
import { getStrengthStandard } from './strength-standards'

export type DisplayStrengthGroup = OverallStrengthGroup

export interface DisplayStrengthGroupData<TExercise> {
  name: DisplayStrengthGroup
  level: StrengthLevel
  progress: number
  exercises: TExercise[]
  averageScore: number
}

export interface SpecificMuscleGroupData<TExercise> {
  name: string
  level: StrengthLevel
  progress: number
  exercises: TExercise[]
  averageScore: number
}

export { resolveExerciseSpecificMuscle }

const REPRESENTATIVE_ANCHOR_EXERCISE_DECAY = 0.75
const REPRESENTATIVE_SUPPORT_UPLIFT_FACTOR = 0.95
const REPRESENTATIVE_SUPPORT_MAX_UPLIFT = 1
const REPRESENTATIVE_SUPPORT_TIER_WEIGHTS: Record<1 | 2 | 3, number> = {
  1: 1,
  2: 0.7,
  3: 0.5,
}

export const DISPLAY_STRENGTH_GROUP_ORDER: DisplayStrengthGroup[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
]

export function resolveDatabaseMuscleToDisplayGroup(
  muscleName: string | null | undefined,
): DisplayStrengthGroup | null {
  return muscleToStrengthGroup(muscleName)
}

function calculateWeightedAverage(
  values: number[],
  weights: number[],
): number {
  if (values.length === 0 || values.length !== weights.length) {
    return 0
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight <= 0) return 0

  return values.reduce((sum, value, index) => sum + value * weights[index], 0) /
    totalWeight
}

export function buildDisplayStrengthGroupData<
  TExercise extends { exerciseName: string; muscleGroup?: string | null },
>(input: {
  exercises: TExercise[]
  groupBreakdown: Record<
    DisplayStrengthGroup,
    Pick<OverallStrengthGroupBreakdown, 'effectiveScore'>
  >
}): DisplayStrengthGroupData<TExercise>[] {
  const groupedExercises = new Map<DisplayStrengthGroup, TExercise[]>()

  DISPLAY_STRENGTH_GROUP_ORDER.forEach((group) => {
    groupedExercises.set(group, [])
  })

  input.exercises.forEach((exercise) => {
    const specificMuscle = resolveExerciseSpecificMuscle(
      exercise.exerciseName,
      exercise.muscleGroup,
    )
    const group = muscleToStrengthGroup(specificMuscle)
    if (!group) return
    groupedExercises.get(group)?.push(exercise)
  })

  return DISPLAY_STRENGTH_GROUP_ORDER.map((group) => {
    const breakdown = input.groupBreakdown[group]
    const aggregateRank = getOverallStrengthGroupLevelProgress(breakdown)

    return {
      name: group,
      level: aggregateRank.level,
      progress: aggregateRank.progress,
      exercises: groupedExercises.get(group) ?? [],
      averageScore: breakdown.effectiveScore,
    }
  })
}

export function buildSpecificMuscleGroupData<
  TExercise extends {
    exerciseName: string
    muscleGroup?: string | null
    max1RM: number
    lastTrainedAt?: string | null
  },
>(input: {
  gender: StrengthGender
  bodyweightKg: number
  exercises: TExercise[]
  now?: Date
}): SpecificMuscleGroupData<TExercise>[] {
  const groupState = new Map<
    string,
    {
      exercises: TExercise[]
      representativeScores: Array<{ score: number; tier: 1 | 2 | 3 }>
      lastTrainedAt: string | null
    }
  >()

  input.exercises.forEach((exercise) => {
    const strengthInfo = getStrengthStandard(
      exercise.exerciseName,
      input.gender,
      input.bodyweightKg,
      exercise.max1RM,
    )
    if (!strengthInfo) return

    const primaryMuscle = resolveExerciseSpecificMuscle(
      exercise.exerciseName,
      exercise.muscleGroup,
    )

    const tier = getStrengthExerciseTier(exercise.exerciseName)
    const representativeScore = toLevelScore(
      strengthInfo.level,
      strengthInfo.progress,
    )

    ;[primaryMuscle].forEach((muscle) => {
      if (!muscle) return

      const existing = groupState.get(muscle) ?? {
        exercises: [],
        representativeScores: [],
        lastTrainedAt: null,
      }

      existing.exercises.push(exercise)
      existing.representativeScores.push({
        score: representativeScore,
        tier,
      })

      const existingTime = existing.lastTrainedAt
        ? new Date(existing.lastTrainedAt).getTime()
        : Number.NEGATIVE_INFINITY
      const nextTime = exercise.lastTrainedAt
        ? new Date(exercise.lastTrainedAt).getTime()
        : Number.NEGATIVE_INFINITY

      if (Number.isFinite(nextTime) && nextTime > existingTime) {
        existing.lastTrainedAt = exercise.lastTrainedAt ?? null
      }

      groupState.set(muscle, existing)
    })
  })

  return Array.from(groupState.entries())
    .map(([name, state]) => {
      const bestTier = state.representativeScores.reduce<1 | 2 | 3>(
        (currentBest, entry) => Math.min(currentBest, entry.tier) as 1 | 2 | 3,
        3,
      )
      const anchorScores = state.representativeScores
        .filter((entry) => entry.tier === bestTier)
        .map((entry) => entry.score)
        .sort((a, b) => b - a)
      const anchorScore = calculateWeightedAverage(
        anchorScores.slice(0, 2),
        anchorScores.slice(0, 2).map((_, index) =>
          Math.pow(REPRESENTATIVE_ANCHOR_EXERCISE_DECAY, index),
        ),
      )
      const supportScore = calculateWeightedAverage(
        state.representativeScores.map((entry) => entry.score),
        state.representativeScores.map(
          (entry) => REPRESENTATIVE_SUPPORT_TIER_WEIGHTS[entry.tier],
        ),
      )
      // Anchor on the best available tier, then let broader support nudge the
      // displayed muscle level upward without allowing lower-tier work to drag it down.
      const supportLift = Math.max(0, supportScore - anchorScore)
      const uplift = Math.min(
        REPRESENTATIVE_SUPPORT_MAX_UPLIFT,
        supportLift * REPRESENTATIVE_SUPPORT_UPLIFT_FACTOR,
      )
      const effectiveScore = anchorScore + uplift
      const rank = scoreToLevelProgress(effectiveScore)

      return {
        name,
        level: rank.level,
        progress: rank.progress,
        exercises: state.exercises,
        averageScore: effectiveScore,
      }
    })
    .sort((a, b) => b.averageScore - a.averageScore)
}

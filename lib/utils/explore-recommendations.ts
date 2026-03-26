import { getWeeklyCommitmentTarget } from '@/lib/commitment'
import type {
  ExploreLevel,
  ExploreProgramWithRoutines,
  Goal,
  Profile,
} from '@/types/database.types'

export type ExploreProgramListItem = ExploreProgramWithRoutines & {
  routine_count: number
}

export type EquipmentPreference =
  | 'full_gym'
  | 'home_minimal'
  | 'dumbbells_only'
  | 'bodyweight'
  | 'barbell_only'

type RecommendationProfile = Pick<
  Profile,
  'goals' | 'experience_level' | 'commitment' | 'commitment_frequency'
>

const LEVEL_ORDER: Record<ExploreLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
}

const EQUIPMENT_WEIGHTS: Record<string, number> = {
  barbell: 10,
  machine: 9,
  cable: 8,
  dumbbell: 7,
  bodyweight: 2,
}

const EQUIPMENT_ACCESS: Record<EquipmentPreference, Set<string>> = {
  full_gym: new Set(['barbell', 'machine', 'cable', 'dumbbell', 'bodyweight']),
  home_minimal: new Set(['dumbbell', 'bodyweight']),
  dumbbells_only: new Set(['dumbbell', 'bodyweight']),
  bodyweight: new Set(['bodyweight']),
  barbell_only: new Set(['barbell', 'bodyweight']),
}

const RELATED_GOAL_MATCHES: Record<Goal, Goal[]> = {
  build_muscle: ['gain_strength', 'general_fitness'],
  gain_strength: ['build_muscle', 'general_fitness'],
  lose_fat: ['general_fitness', 'improve_cardio'],
  improve_cardio: ['lose_fat', 'general_fitness'],
  become_flexible: ['general_fitness'],
  general_fitness: [
    'build_muscle',
    'gain_strength',
    'lose_fat',
    'improve_cardio',
    'become_flexible',
  ],
}

function normalizeProgramGoal(goal: string | null): Goal | null {
  switch (goal) {
    case 'build_muscle':
      return 'build_muscle'
    case 'get_stronger':
    case 'gain_strength':
      return 'gain_strength'
    case 'lose_fat':
      return 'lose_fat'
    case 'improve_cardio':
      return 'improve_cardio'
    case 'become_flexible':
      return 'become_flexible'
    case 'general_fitness':
      return 'general_fitness'
    default:
      return null
  }
}

function normalizeEquipmentLabel(label: string): string {
  const normalized = label.trim().toLowerCase()

  if (normalized.includes('barbell')) return 'barbell'
  if (normalized.includes('machine')) return 'machine'
  if (normalized.includes('cable')) return 'cable'
  if (
    normalized.includes('dumbbell') ||
    normalized.includes('kettlebell')
  ) {
    return 'dumbbell'
  }
  if (
    normalized.includes('bodyweight') ||
    normalized.includes('body weight')
  ) {
    return 'bodyweight'
  }

  return normalized
}

function getProgramEquipment(program: ExploreProgramListItem): Set<string> {
  return new Set(
    program.routines.flatMap((routine) =>
      (routine.equipment ?? []).map(normalizeEquipmentLabel),
    ),
  )
}

function getPopularityScore(program: ExploreProgramListItem): number {
  const equipments = getProgramEquipment(program)
  const equipmentScore = Array.from(equipments).reduce(
    (total, equipment) => total + (EQUIPMENT_WEIGHTS[equipment] ?? 1),
    0,
  )
  const gymBias = Array.from(equipments).some((equipment) =>
    ['barbell', 'machine', 'cable'].includes(equipment),
  )
    ? 25
    : 0
  const bodyweightOnlyPenalty =
    equipments.size === 1 && equipments.has('bodyweight') ? -20 : 0
  const editorialOrderScore = Math.max(0, 20 - program.display_order)
  const routineCadenceScore =
    program.routine_count >= 3 && program.routine_count <= 4 ? 8 : 0

  return (
    equipmentScore +
    gymBias +
    bodyweightOnlyPenalty +
    editorialOrderScore +
    routineCadenceScore
  )
}

function getGoalScore(
  program: ExploreProgramListItem,
  profile: RecommendationProfile | null | undefined,
): number {
  if (!profile?.goals?.length) return 0

  const programGoal = normalizeProgramGoal(program.goal)
  if (!programGoal) return 0

  if (profile.goals.includes(programGoal)) {
    return 45
  }

  const hasRelatedGoal = profile.goals.some((goal) =>
    RELATED_GOAL_MATCHES[goal]?.includes(programGoal),
  )

  return hasRelatedGoal ? 18 : 0
}

function getExperienceScore(
  program: ExploreProgramListItem,
  profile: RecommendationProfile | null | undefined,
): number {
  if (!profile?.experience_level || !program.level) return 0

  const diff =
    LEVEL_ORDER[program.level] - LEVEL_ORDER[profile.experience_level]

  if (diff === 0) return 24
  if (diff === -1) return 14
  if (diff === 1) return 6
  if (diff <= -2) return 8

  return -12
}

function getCommitmentScore(
  program: ExploreProgramListItem,
  profile: RecommendationProfile | null | undefined,
): number {
  if (!profile) return 0

  const weeklyTarget = getWeeklyCommitmentTarget(profile)
  const diff = Math.abs(weeklyTarget - Math.max(program.routine_count, 1))

  return Math.max(0, 18 - diff * 6)
}

function getEquipmentScore(
  program: ExploreProgramListItem,
  equipmentPreference: EquipmentPreference | null | undefined,
): number {
  if (!equipmentPreference) return 0

  const equipments = Array.from(getProgramEquipment(program))
  if (equipments.length === 0) return 0

  const allowed = EQUIPMENT_ACCESS[equipmentPreference]
  const covered = equipments.filter((equipment) => allowed.has(equipment)).length
  const coverageRatio = covered / equipments.length

  if (equipmentPreference === 'bodyweight') {
    return coverageRatio === 1 ? 32 : -28
  }

  if (coverageRatio === 1) return 24
  if (coverageRatio >= 0.67) return 10
  if (coverageRatio >= 0.34) return -8

  return -24
}

function comparePrograms(
  a: ExploreProgramListItem,
  b: ExploreProgramListItem,
  score: (program: ExploreProgramListItem) => number,
): number {
  const scoreDiff = score(b) - score(a)
  if (scoreDiff !== 0) return scoreDiff

  const displayOrderDiff = a.display_order - b.display_order
  if (displayOrderDiff !== 0) return displayOrderDiff

  const routineCountDiff = b.routine_count - a.routine_count
  if (routineCountDiff !== 0) return routineCountDiff

  return a.name.localeCompare(b.name)
}

export function parseStoredEquipmentPreference(
  rawValue: string | null,
): EquipmentPreference | null {
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue)
    if (
      parsed === 'full_gym' ||
      parsed === 'home_minimal' ||
      parsed === 'dumbbells_only' ||
      parsed === 'bodyweight' ||
      parsed === 'barbell_only'
    ) {
      return parsed
    }
  } catch {
    if (
      rawValue === 'full_gym' ||
      rawValue === 'home_minimal' ||
      rawValue === 'dumbbells_only' ||
      rawValue === 'bodyweight' ||
      rawValue === 'barbell_only'
    ) {
      return rawValue
    }
  }

  return null
}

export function sortProgramsByPopularity(
  programs: ExploreProgramListItem[],
): ExploreProgramListItem[] {
  return [...programs].sort((a, b) =>
    comparePrograms(a, b, getPopularityScore),
  )
}

export function sortProgramsForUser(
  programs: ExploreProgramListItem[],
  options?: {
    profile?: RecommendationProfile | null
    equipmentPreference?: EquipmentPreference | null
  },
): ExploreProgramListItem[] {
  const { profile = null, equipmentPreference = null } = options ?? {}

  return [...programs].sort((a, b) =>
    comparePrograms(a, b, (program) => {
      const recommendationScore =
        getGoalScore(program, profile) +
        getExperienceScore(program, profile) +
        getCommitmentScore(program, profile) +
        getEquipmentScore(program, equipmentPreference) +
        getPopularityScore(program) * 0.15

      return recommendationScore
    }),
  )
}

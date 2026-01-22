import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { BODY_PART_TO_DATABASE_MUSCLE, type BodyPartSlug } from '@/lib/body-mapping'
import { database } from '@/lib/database'
import type { Set as DbSet, Exercise, Profile } from '@/types/database.types'

export type RecoveryStatus = 'not_recovered' | 'recovering' | 'recovered' | 'untrained'

export type WorkoutIntensity = 'light' | 'moderate' | 'heavy'

export interface MuscleRecoveryData {
  muscleGroup: string
  lastWorkedDate: Date | null
  hoursSinceLastWorkout: number | null
  recoveryStatus: RecoveryStatus
  recoveryPercentage: number // 0-100, where 0 = just worked out, 100 = fully recovered
  intensity: WorkoutIntensity | null
  recoveryTimeHours: number | null // How long this muscle needs to fully recover
}

export interface RecoveryOverview {
  daysSinceLastWorkout: number | null
  freshMuscleGroups: number
  totalMuscleGroups: number
}

export interface UseRecoveryDataResult {
  profile: Profile | null
  muscleRecoveryData: Map<string, MuscleRecoveryData>
  lastWorkoutDate: Date | null
  recoveryOverview: RecoveryOverview
  isLoading: boolean
  refreshing: boolean
  onRefresh: () => void
  getRecoveryForBodyPart: (bodyPartSlug: BodyPartSlug) => MuscleRecoveryData | null
}

// Intensity thresholds based on "effective sets"
// Effective sets = actual sets × weight multiplier
const LIGHT_THRESHOLD = 4 // < 4 effective sets = light
const MODERATE_THRESHOLD = 8 // 4-8 effective sets = moderate
// > 8 effective sets = heavy

// Recovery times in hours for each intensity level
const RECOVERY_TIMES: Record<WorkoutIntensity, number> = {
  light: 36, // 1.5 days
  moderate: 54, // 2.25 days
  heavy: 72, // 3 days
}

// When weight is used, multiply sets by this factor
const WEIGHTED_MULTIPLIER = 1.5

const RECOVERY_STATUS_COLORS: Record<RecoveryStatus, string> = {
  not_recovered: '#EF4444', // Red - needs rest
  recovering: '#F59E0B', // Amber - getting there
  recovered: '#10B981', // Green - ready (not shown on chart)
  untrained: '#6B7280', // Gray - no data
}

// Gradient colors for recovery spectrum
// Red (0%) -> Light Orange (80%) for recovering muscles
// Dark charcoal (100%) for fully recovered (matches strength chart body baseline)
const RECOVERY_GRADIENT_COLORS = [
  '#991B1B', // 0-20% - Very Strong Red
  '#DC2626', // 20-40% - Red
  '#F97316', // 40-60% - Orange
  '#FB923C', // 60-80% - Light Orange
  '#FDBA74', // 80-99% - Very Light Orange
  '#374151', // 100% - Dark Charcoal (recovered, matches strength body baseline)
]


// We use intensity 1-10 for the gradient steps
const RECOVERY_STATUS_INTENSITY: Record<RecoveryStatus, number> = {
  not_recovered: 1, 
  recovering: 3,    
  recovered: 6,    
  untrained: 0,
}

const RECOVERY_STATUS_LABELS: Record<RecoveryStatus, string> = {
  not_recovered: 'Not Recovered',
  recovering: 'Recovering',
  recovered: 'Recovered',
  untrained: 'No Data',
}

type RecoverySessionResult = {
  id: string
  created_at: string
  date: string
  workout_exercises?: {
    exercise?: Pick<Exercise, 'muscle_group' | 'secondary_muscles'>
    sets?: Pick<DbSet, 'weight'>[]
  }[]
}

/**
 * Map to normalize secondary muscle names to match primary muscle_group format
 * Secondary muscles in the database are lowercase and may use different naming
 * Primary muscle_group values are: Back, Biceps, Calves, Cardio, Chest, Core, Forearms, Full Body, Glutes, Hamstrings, Quads, Shoulders, Triceps
 */
const SECONDARY_MUSCLE_MAP: Record<string, string> = {
  // Direct mappings (lowercase to capitalized)
  'biceps': 'Biceps',
  'triceps': 'Triceps',
  'forearms': 'Forearms',
  'glutes': 'Glutes',
  'hamstrings': 'Hamstrings',
  'calves': 'Calves',
  'core': 'Core',
  'back': 'Back',
  'chest': 'Chest',

  // Naming differences
  'quadriceps': 'Quads',
  'quads': 'Quads',

  // Shoulder variations
  'shoulders': 'Shoulders',
  'deltoids': 'Shoulders',
  'rear deltoids': 'Shoulders',
  'front deltoids': 'Shoulders',

  // Back variations
  'lats': 'Back',
  'rhomboids': 'Back',
  'trapezius': 'Back',
  'traps': 'Back',
  'lower back': 'Back',
  'upper back': 'Back',
}

/**
 * Normalize a secondary muscle name to match the primary muscle_group format
 */
function normalizeSecondaryMuscle(muscle: string): string | null {
  const normalized = SECONDARY_MUSCLE_MAP[muscle.toLowerCase()]
  return normalized || null
}

/**
 * Calculate workout intensity based on sets and whether weights were used
 */
function calculateIntensity(
  totalSets: number,
  hadWeightedSets: boolean
): WorkoutIntensity {
  // Calculate effective sets - weighted exercises count more
  const effectiveSets = hadWeightedSets ? totalSets * WEIGHTED_MULTIPLIER : totalSets

  if (effectiveSets < LIGHT_THRESHOLD) {
    return 'light'
  } else if (effectiveSets < MODERATE_THRESHOLD) {
    return 'moderate'
  } else {
    return 'heavy'
  }
}

/**
 * Get recovery status based on hours since last workout and required recovery time
 */
export function getRecoveryStatusWithIntensity(
  hoursSinceLastWorkout: number | null,
  recoveryTimeHours: number
): RecoveryStatus {
  if (hoursSinceLastWorkout === null) {
    return 'untrained'
  }

  // Calculate thresholds relative to the required recovery time
  const notRecoveredThreshold = recoveryTimeHours * 0.33 // First third = not recovered
  const recoveringThreshold = recoveryTimeHours // Full time = recovered

  if (hoursSinceLastWorkout < notRecoveredThreshold) {
    return 'not_recovered'
  } else if (hoursSinceLastWorkout < recoveringThreshold) {
    return 'recovering'
  } else {
    return 'recovered'
  }
}

/**
 * Get color for recovery status
 */
export function getRecoveryColor(status: RecoveryStatus): string {
  return RECOVERY_STATUS_COLORS[status]
}

/**
 * Get intensity value for body highlighter (1-4 based on recovery status)
 * @deprecated Use getRecoveryIntensityFromPercentage for gradient-based coloring
 */
export function getRecoveryIntensity(status: RecoveryStatus): number {
  return RECOVERY_STATUS_INTENSITY[status]
}

/**
 * Calculate recovery percentage (0-100) based on hours since workout and recovery time
 * 0% = just worked out, 100% = fully recovered
 */
export function calculateRecoveryPercentage(
  hoursSinceLastWorkout: number | null,
  recoveryTimeHours: number | null
): number {
  if (hoursSinceLastWorkout === null || recoveryTimeHours === null) {
    return 100 // Untrained = fully recovered (won't be shown)
  }
  
  const percentage = Math.min(100, (hoursSinceLastWorkout / recoveryTimeHours) * 100)
  return Math.round(percentage)
}

/**
 * Get intensity value for body highlighter based on recovery percentage
 * Returns 1-6 for gradient steps, or 0 for untrained (not shown)
 */
export function getRecoveryIntensityFromPercentage(recoveryPercentage: number): number {
  if (recoveryPercentage > 100) return 0
  
  // Map 0-100% to intensity 1-6
  if (recoveryPercentage === 100) return 6
  
  // 5 steps before 100% (0-19, 20-39, 40-59, 60-79, 80-99)
  const intensity = Math.floor(recoveryPercentage / 20) + 1
  return Math.min(6, Math.max(1, intensity))
}

/**
 * Get color for recovery based on percentage (0-100)
 * Uses smooth gradient interpolation
 */
export function getRecoveryColorFromPercentage(recoveryPercentage: number): string {
  if (recoveryPercentage >= 100) {
    return RECOVERY_GRADIENT_COLORS[RECOVERY_GRADIENT_COLORS.length - 1] // 100% - Blue-tinted light gray
  }

  // 6 colors map to 0-20, 20-40, 40-60, 60-80, 80-100
  const index = Math.floor(Math.max(0, Math.min(99, recoveryPercentage)) / 20)
  return RECOVERY_GRADIENT_COLORS[index]
}

/**
 * Get the recovery gradient colors array for the body highlighter
 * This provides all 11 gradient colors for the Body component
 */
export function getRecoveryGradientColors(): string[] {
  return RECOVERY_GRADIENT_COLORS
}

/**
 * Get display text for recovery status
 */
export function getRecoveryLabel(status: RecoveryStatus): string {
  return RECOVERY_STATUS_LABELS[status]
}

export function useRecoveryData(): UseRecoveryDataResult {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [muscleRecoveryData, setMuscleRecoveryData] = useState<Map<string, MuscleRecoveryData>>(
    () => new Map(),
  )
  const [lastWorkoutDate, setLastWorkoutDate] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async (): Promise<void> => {
    if (!user?.id) return

    try {
      // Load profile data
      const profileData = await database.profiles.getById(user.id)
      setProfile(profileData)

      // Get all workout sessions from last 7 days to calculate recovery
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 7)

      // Query workout sessions with exercise muscle groups and sets
      const { data, error } = await database.workoutSessions.getWithMuscleGroups(
        user.id,
        cutoffDate
      )

      if (error) {
        console.error('Error loading recovery data:', error)
        return
      }

      // Build a map of muscle group -> [{ date, sets, hadWeights }]
      // We track ALL workouts for each muscle to aggregate them
      const muscleWorkoutHistory = new Map<
        string,
        { date: Date; sets: number; hadWeight: boolean }[]
      >()
      let mostRecentWorkout: Date | null = null

      const sessions = data as unknown as RecoverySessionResult[] | null | undefined
      sessions?.forEach((session) => {
        const sessionDate = new Date(session.date || session.created_at)

        // Track overall last workout
        if (!mostRecentWorkout || sessionDate > mostRecentWorkout) {
          mostRecentWorkout = sessionDate
        }

        // Group sets by muscle group for this session
        const sessionMuscleData = new Map<string, { sets: number; hadWeight: boolean }>()

        session.workout_exercises?.forEach((we) => {
          const primaryMuscle = we.exercise?.muscle_group
          const secondaryMuscles: string[] = we.exercise?.secondary_muscles || []

          const sets = we.sets || []
          const setCount = sets.length
          const hadWeight = sets.some((s) => s.weight && s.weight > 0)

          // Track primary muscle group
          if (primaryMuscle) {
            const existing = sessionMuscleData.get(primaryMuscle) || { sets: 0, hadWeight: false }
            sessionMuscleData.set(primaryMuscle, {
              sets: existing.sets + setCount,
              hadWeight: existing.hadWeight || hadWeight,
            })
          }

          // Track secondary muscles at reduced intensity (50% of sets)
          // This accounts for the fact that secondary muscles are worked but not as intensely
          secondaryMuscles.forEach((rawSecondaryMuscle: string) => {
            // Normalize the secondary muscle name to match primary muscle_group format
            const secondaryMuscle = normalizeSecondaryMuscle(rawSecondaryMuscle)

            // Skip if we couldn't normalize or if it's the same as primary
            if (!secondaryMuscle || secondaryMuscle === primaryMuscle) return

            const existing = sessionMuscleData.get(secondaryMuscle) || { sets: 0, hadWeight: false }
            // Secondary muscles count as half the sets for intensity calculation
            const secondarySets = Math.ceil(setCount * 0.5)
            sessionMuscleData.set(secondaryMuscle, {
              sets: existing.sets + secondarySets,
              hadWeight: existing.hadWeight || hadWeight,
            })
          })
        })
        // Update the history map - add this session's data for each muscle
        sessionMuscleData.forEach((sessionGroupData, muscleGroup) => {
          const history = muscleWorkoutHistory.get(muscleGroup) || []
          history.push({
            date: sessionDate,
            sets: sessionGroupData.sets,
            hadWeight: sessionGroupData.hadWeight,
          })
          muscleWorkoutHistory.set(muscleGroup, history)
        })
      })

      setLastWorkoutDate(mostRecentWorkout)

      // Calculate recovery status for each muscle group
      const now = new Date()
      const recoveryMap = new Map<string, MuscleRecoveryData>()

      // Get all known muscle groups from body mapping
      const allMuscleGroups = new Set(Object.values(BODY_PART_TO_DATABASE_MUSCLE))

      allMuscleGroups.forEach((muscleGroup) => {
        const history = muscleWorkoutHistory.get(muscleGroup)

        if (!history || history.length === 0) {
          // No workout data for this muscle
          recoveryMap.set(muscleGroup, {
            muscleGroup,
            lastWorkedDate: null,
            hoursSinceLastWorkout: null,
            recoveryStatus: 'untrained',
            recoveryPercentage: 100, // Untrained = fully recovered
            intensity: null,
            recoveryTimeHours: null,
          })
          return
        }

        // Find the most recent session's date
        const sortedHistory = [...history].sort((a, b) => b.date.getTime() - a.date.getTime())
        const lastSessionDate = sortedHistory[0].date
        
        // Aggregate all sets within 24 hours of the last session
        let totalSets = 0
        let hadWeightedSets = false
        const boutThreshold = 24 * 60 * 60 * 1000 // 24 hours in ms
        
        history.forEach(workout => {
          const timeDiff = Math.abs(lastSessionDate.getTime() - workout.date.getTime())
          if (timeDiff <= boutThreshold) {
            totalSets += workout.sets
            if (workout.hadWeight) hadWeightedSets = true
          }
        })

        const hoursSinceLastWorkout = (now.getTime() - lastSessionDate.getTime()) / (1000 * 60 * 60)
        const intensity = calculateIntensity(totalSets, hadWeightedSets)
        const recoveryTimeHours = RECOVERY_TIMES[intensity]
        const recoveryStatus = getRecoveryStatusWithIntensity(hoursSinceLastWorkout, recoveryTimeHours)
        const recoveryPercentage = calculateRecoveryPercentage(hoursSinceLastWorkout, recoveryTimeHours)

        recoveryMap.set(muscleGroup, {
          muscleGroup,
          lastWorkedDate: lastSessionDate,
          hoursSinceLastWorkout,
          recoveryStatus,
          recoveryPercentage,
          intensity,
          recoveryTimeHours,
        })
      })
      
      setMuscleRecoveryData(recoveryMap)
    } catch (error) {
      console.error('Error loading recovery data:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  // Calculate overview stats
  const recoveryOverview = useMemo((): RecoveryOverview => {
    let recoveringCount = 0
    let totalMuscleGroups = 0

    muscleRecoveryData.forEach((data) => {
      totalMuscleGroups++
      // Count muscles that are still recovering (not fresh)
      if (data.recoveryStatus === 'not_recovered' || data.recoveryStatus === 'recovering') {
        recoveringCount++
      }
    })

    // Fresh = total - recovering
    const freshMuscleGroups = totalMuscleGroups - recoveringCount

    // Calculate days since last workout
    let daysSinceLastWorkout: number | null = null
    if (lastWorkoutDate) {
      const now = new Date()
      daysSinceLastWorkout = Math.floor(
        (now.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    }

    return {
      daysSinceLastWorkout,
      freshMuscleGroups,
      totalMuscleGroups,
    }
  }, [muscleRecoveryData, lastWorkoutDate])

  // Get recovery data for a specific body part slug
  const getRecoveryForBodyPart = useCallback(
    (bodyPartSlug: BodyPartSlug): MuscleRecoveryData | null => {
      const muscleGroup = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug]
      if (!muscleGroup) return null
      return muscleRecoveryData.get(muscleGroup) || null
    },
    [muscleRecoveryData]
  )

  return {
    profile,
    muscleRecoveryData,
    lastWorkoutDate,
    recoveryOverview,
    isLoading,
    refreshing,
    onRefresh,
    getRecoveryForBodyPart,
  }
}

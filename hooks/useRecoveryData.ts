import { useAuth } from '@/contexts/auth-context'
import { BODY_PART_TO_DATABASE_MUSCLE, type BodyPartSlug } from '@/lib/body-mapping'
import { database } from '@/lib/database'
import type { Set as DbSet, Exercise, Profile } from '@/types/database.types'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type RecoveryStatus = 'not_recovered' | 'recovering' | 'recovered' | 'untrained'

export type WorkoutIntensity = 'light' | 'moderate' | 'heavy'

export interface MuscleRecoveryData {
  muscleGroup: string
  lastWorkedDate: Date | null
  hoursSinceLastWorkout: number | null
  recoveryStatus: RecoveryStatus
  intensity: WorkoutIntensity | null
  recoveryTimeHours: number | null // How long this muscle needs to fully recover
}

export interface RecoveryOverview {
  daysSinceLastWorkout: number | null
  freshMuscleGroups: number
  totalMuscleGroups: number
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
  const colors = {
    not_recovered: '#EF4444', // Red - needs rest
    recovering: '#F59E0B', // Amber - getting there
    recovered: '#10B981', // Green - ready (not shown on chart)
    untrained: '#6B7280', // Gray - no data
  }
  return colors[status]
}

/**
 * Get intensity value for body highlighter (1-4 based on recovery status)
 */
export function getRecoveryIntensity(status: RecoveryStatus): number {
  const intensities = {
    not_recovered: 1,
    recovering: 2,
    recovered: 0, // Not shown on chart
    untrained: 0,
  }
  return intensities[status]
}

/**
 * Get display text for recovery status
 */
export function getRecoveryLabel(status: RecoveryStatus): string {
  const labels = {
    not_recovered: 'Not Recovered',
    recovering: 'Recovering',
    recovered: 'Recovered',
    untrained: 'No Data',
  }
  return labels[status]
}

export function useRecoveryData() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [muscleRecoveryData, setMuscleRecoveryData] = useState<Map<string, MuscleRecoveryData>>(new Map())
  const [lastWorkoutDate, setLastWorkoutDate] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
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

      // Build a map of muscle group -> { date, totalSets, hadWeights }
      // We track the MOST RECENT workout for each muscle with its intensity
      const muscleWorkoutData = new Map<string, {
        date: Date
        totalSets: number
        hadWeightedSets: boolean
      }>()
      let mostRecentWorkout: Date | null = null

      type RecoverySessionResult = {
        id: string
        created_at: string
        workout_exercises?: {
          exercise?: Pick<Exercise, 'muscle_group' | 'secondary_muscles'>
          sets?: Pick<DbSet, 'weight'>[]
        }[]
      }
      ;(data as unknown as RecoverySessionResult[])?.forEach((session) => {
        const sessionDate = new Date(session.created_at)

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

        // Update the main map - only keep the most recent workout per muscle
        sessionMuscleData.forEach((data, muscleGroup) => {
          const existing = muscleWorkoutData.get(muscleGroup)
          if (!existing || sessionDate > existing.date) {
            muscleWorkoutData.set(muscleGroup, {
              date: sessionDate,
              totalSets: data.sets,
              hadWeightedSets: data.hadWeight,
            })
          }
        })
      })

      setLastWorkoutDate(mostRecentWorkout)

      // Calculate recovery status for each muscle group
      const now = new Date()
      const recoveryMap = new Map<string, MuscleRecoveryData>()

      // Get all known muscle groups from body mapping
      const allMuscleGroups = new Set(Object.values(BODY_PART_TO_DATABASE_MUSCLE))

      allMuscleGroups.forEach((muscleGroup) => {
        const workoutData = muscleWorkoutData.get(muscleGroup)

        if (!workoutData) {
          // No workout data for this muscle
          recoveryMap.set(muscleGroup, {
            muscleGroup,
            lastWorkedDate: null,
            hoursSinceLastWorkout: null,
            recoveryStatus: 'untrained',
            intensity: null,
            recoveryTimeHours: null,
          })
          return
        }

        const hoursSinceLastWorkout = (now.getTime() - workoutData.date.getTime()) / (1000 * 60 * 60)
        const intensity = calculateIntensity(workoutData.totalSets, workoutData.hadWeightedSets)
        const recoveryTimeHours = RECOVERY_TIMES[intensity]
        const recoveryStatus = getRecoveryStatusWithIntensity(hoursSinceLastWorkout, recoveryTimeHours)

        recoveryMap.set(muscleGroup, {
          muscleGroup,
          lastWorkedDate: workoutData.date,
          hoursSinceLastWorkout,
          recoveryStatus,
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

import { useCallback } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
    getLastPerformanceForExercise,
    getSetPerformance,
    SetPerformance,
} from '@/lib/services/exerciseHistoryService'
import type { StructuredExerciseDraft, StructuredSetDraft } from '@/lib/utils/workout-draft'

/**
 * Hook for managing exercise history data.
 * Provides utilities to fetch last performance data and create exercises with history.
 */
export function useExerciseHistory() {
  const { user } = useAuth()
  const { convertToPreferred } = useWeightUnits()

  /**
   * Convert a SetPerformance from the history service to display format.
   * Handles weight unit conversion and formatting.
   */
  const formatSetHistoryForDisplay = useCallback(
    (historySet: SetPerformance | null): { weight: string | null; reps: string | null } => {
      if (!historySet) {
        return { weight: null, reps: null }
      }

      const weightInPreferredUnit = historySet.weight
        ? convertToPreferred(historySet.weight)
        : null

      return {
        weight: weightInPreferredUnit
          ? Math.round(weightInPreferredUnit).toString()
          : null,
        reps: historySet.reps?.toString() ?? null,
      }
    },
    [convertToPreferred],
  )

  /**
   * Create an empty set with optional target rep range.
   */
  const createEmptySet = useCallback(
    (
      targetRepsMin: number | null = null,
      targetRepsMax: number | null = null,
      targetRestSeconds: number | null = null,
    ): StructuredSetDraft => ({
      weight: '',
      reps: '',
      lastWorkoutWeight: null,
      lastWorkoutReps: null,
      targetRepsMin,
      targetRepsMax,
      targetRestSeconds,
    }),
    [],
  )

  /**
   * Create a StructuredExerciseDraft with last performance data.
   *
   * Fetches the user's most recent workout for this exercise and populates
   * placeholder values with their previous weight/reps for each set.
   *
   * Standard workout tracker approach:
   * - Match by set number (Set 1 history → Set 1 placeholder)
   * - Show empty placeholders for sets beyond previous workout
   */
  const createExerciseWithHistory = useCallback(
    async (
      exerciseName: string,
      numberOfSets = 1,
      targetRepsMin: number | null = null,
      targetRepsMax: number | null = null,
    ): Promise<StructuredExerciseDraft> => {
      // Create base exercise with empty sets
      const baseExercise: StructuredExerciseDraft = {
        id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        name: exerciseName,
        sets: Array.from({ length: numberOfSets }, () =>
          createEmptySet(targetRepsMin, targetRepsMax),
        ),
      }

      // Early return if user not authenticated
      if (!user?.id) {
        return baseExercise
      }

      try {
        const lastPerformance = await getLastPerformanceForExercise(
          user.id,
          exerciseName,
        )

        if (!lastPerformance?.sets?.length) {
          return baseExercise
        }

        // Enrich each set with history data
        const enrichedSets = baseExercise.sets.map((set, index) => {
          const setNumber = index + 1
          const historySet = lastPerformance.sets.find(
            (s) => s.setNumber === setNumber,
          )
          const formatted = formatSetHistoryForDisplay(historySet ?? null)

          return {
            ...set,
            lastWorkoutWeight: formatted.weight,
            lastWorkoutReps: formatted.reps,
          }
        })

        return { ...baseExercise, sets: enrichedSets }
      } catch (error) {
        console.error('[createExerciseWithHistory] Error:', error)
        return baseExercise
      }
    },
    [user?.id, createEmptySet, formatSetHistoryForDisplay],
  )

  /**
   * Fetch and format history for a specific set number.
   *
   * Used by StructuredWorkoutInput when the user adds new sets via the + button.
   * Returns weight/reps in display format (user's preferred units, stringified).
   */
  const fetchSetHistory = useCallback(
    async (
      exerciseName: string,
      setNumber: number,
    ): Promise<{ weight: string | null; reps: string | null } | null> => {
      if (!user?.id) return null

      try {
        const historySet = await getSetPerformance(user.id, exerciseName, setNumber)
        const formatted = formatSetHistoryForDisplay(historySet)

        // Return null if no data to avoid creating empty placeholders
        if (!formatted.weight && !formatted.reps) {
          return null
        }

        return formatted
      } catch (error) {
        console.error('[fetchSetHistory] Error:', error)
        return null
      }
    },
    [user?.id, formatSetHistoryForDisplay],
  )

  return {
    createExerciseWithHistory,
    createEmptySet,
    fetchSetHistory,
    formatSetHistoryForDisplay,
  }
}

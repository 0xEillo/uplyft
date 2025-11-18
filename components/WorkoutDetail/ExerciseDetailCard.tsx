import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { WorkoutExerciseWithDetails } from '@/types/database.types'
import { useTheme } from '@/contexts/theme-context'
import { getColors } from '@/constants/colors'
import { useUnit , kgToPreferred } from '@/contexts/unit-context'

interface PrDetailForDisplay {
  label: string
  weight: number
  previousReps?: number
  currentReps: number
  isCurrent: boolean
}

export interface ExercisePRInfo {
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  prDetails: PrDetailForDisplay[]
  hasCurrentPR: boolean
}

interface ExerciseDetailCardProps {
  workoutExercise: WorkoutExerciseWithDetails
  prInfo?: ExercisePRInfo
}

export function ExerciseDetailCard({ workoutExercise, prInfo }: ExerciseDetailCardProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const { weightUnit } = useUnit()

  const exercise = workoutExercise.exercise
  const sets = workoutExercise.sets || []

  if (!exercise || sets.length === 0) {
    return null
  }

  // Detect warmup sets (sets that are significantly lighter than the working sets)
  const weights = sets
    .map((s) => s.weight)
    .filter((w): w is number => w !== null)
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0
  const warmupThreshold = maxWeight * 0.7 // Sets below 70% of max weight are considered warmup

  const hasPR = prInfo && prInfo.prSetIndices.size > 0

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {/* Exercise name */}
      <View style={styles.exerciseHeader}>
        <Text style={[styles.exerciseName, { color: colors.primary }]}>
          {exercise.name}
        </Text>
      </View>

      {/* Sets header */}
      <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerCell, styles.setCol, { color: colors.textSecondary }]}>
          SET
        </Text>
        <Text style={[styles.headerCell, styles.weightCol, { color: colors.textSecondary }]}>
          WEIGHT & REPS
        </Text>
        {hasPR && (
          <Text style={[styles.headerCell, styles.prCol, { color: colors.textSecondary }]}>

          </Text>
        )}
      </View>

      {/* Sets list */}
      {sets.map((set, index) => {
        const weight = set.weight
        const reps = set.reps
        const isWarmup = weight !== null && weight < warmupThreshold && maxWeight > 0
        const setHasPR = prInfo?.prSetIndices.has(index)

        let setLabel: string
        if (isWarmup) {
          setLabel = 'W'
        } else {
          setLabel = String(index + 1 - sets.slice(0, index).filter((s) => {
            const w = s.weight
            return w !== null && w < warmupThreshold && maxWeight > 0
          }).length)
        }

        // Format weight and reps
        let weightRepsText: string
        if (weight !== null && reps !== null) {
          const convertedWeight = kgToPreferred(weight, weightUnit)
          const formattedWeight = convertedWeight.toFixed(weightUnit === 'kg' ? 1 : 0)
          weightRepsText = `${formattedWeight}${weightUnit} x ${reps} reps`
        } else if (reps !== null) {
          weightRepsText = `${reps} reps`
        } else if (weight !== null) {
          const convertedWeight = kgToPreferred(weight, weightUnit)
          const formattedWeight = convertedWeight.toFixed(weightUnit === 'kg' ? 1 : 0)
          weightRepsText = `${formattedWeight}${weightUnit}`
        } else {
          weightRepsText = '--'
        }

        return (
          <View
            key={set.id}
            style={[
              styles.setRow,
              index % 2 === 0 && { backgroundColor: colors.backgroundLight },
              setHasPR && { backgroundColor: colors.primaryLight },
            ]}
          >
            <View style={[styles.setCell, styles.setCol]}>
              <Text style={[styles.setNumber, { color: colors.text }]}>
                {setLabel}
              </Text>
            </View>
            <View style={[styles.setCell, styles.weightCol]}>
              <Text style={[styles.setDetail, { color: colors.text }]}>
                {weightRepsText}
              </Text>
            </View>
            {hasPR && (
              <View style={[styles.setCell, styles.prCol]}>
                {setHasPR && prInfo && (
                  <View
                    style={[
                      { backgroundColor: colors.primary },
                      styles.prBadgeSmall,
                      !prInfo.hasCurrentPR && { backgroundColor: colors.textTertiary },
                    ]}
                  >
                    <Text style={styles.prBadgeTextSmall}>PR</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  setCol: {
    width: 60,
  },
  weightCol: {
    flex: 1,
  },
  prCol: {
    width: 40,
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  setCell: {
    justifyContent: 'center',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  setDetail: {
    fontSize: 14,
  },
  prBadgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  prBadgeTextSmall: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})

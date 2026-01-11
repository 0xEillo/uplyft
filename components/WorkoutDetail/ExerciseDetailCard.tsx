import { ExerciseMedia } from '@/components/ExerciseMedia'
import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'
import { kgToPreferred, useUnit } from '@/contexts/unit-context'
import { WorkoutExerciseWithDetails } from '@/types/database.types'
import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { PrTooltip } from '../pr-tooltip'

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
  onExercisePress?: (exerciseId: string) => void
}

export function ExerciseDetailCard({ workoutExercise, prInfo, onExercisePress }: ExerciseDetailCardProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const { weightUnit } = useUnit()
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const exercise = workoutExercise.exercise
  const sets = workoutExercise.sets || []

  if (!exercise || sets.length === 0) {
    return null
  }

  const hasPR = prInfo && prInfo.prSetIndices.size > 0

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {/* Exercise name */}
      <TouchableOpacity
        style={styles.exerciseHeader}
        onPress={() => onExercisePress?.(exercise.id)}
        disabled={!onExercisePress}
        activeOpacity={0.7}
      >
        <ExerciseMedia
          gifUrl={exercise.gif_url}
          mode="thumbnail"
          style={{ width: 52, height: 52, borderRadius: 12 }}
          autoPlay={false}
        />
        <Text style={[styles.exerciseName, { color: colors.primary }]}>
          {exercise.name}
        </Text>
      </TouchableOpacity>

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
      {(() => {
        let workingSetNumber = 0

        return sets.map((set, index) => {
        const weight = set.weight
        const reps = set.reps
        const setHasPR = prInfo?.prSetIndices.has(index)

          const isWarmup = set.is_warmup === true
          if (!isWarmup) {
            workingSetNumber += 1
          }
          const setLabel = isWarmup ? 'W' : String(workingSetNumber)

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
              <View style={[styles.setCell, styles.setCol, styles.centerCell]}>
                <View
                  style={[
                    styles.setBadge,
                    {
                      backgroundColor: isWarmup ? `${colors.warning}25` : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.setBadgeText,
                      { color: isWarmup ? colors.warning : colors.textSecondary },
                    ]}
                  >
                {setLabel}
              </Text>
                </View>
            </View>
            <View style={[styles.setCell, styles.weightCol]}>
              <Text style={[styles.setDetail, { color: colors.text }]}>
                {weightRepsText}
              </Text>
            </View>
            {hasPR && (
              <View style={[styles.setCell, styles.prCol]}>
                {setHasPR && prInfo && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setTooltipVisible(true)}
                    style={[
                      { backgroundColor: colors.primary },
                      styles.prBadgeSmall,
                      !prInfo.hasCurrentPR && {
                        backgroundColor: colors.textTertiary,
                      },
                    ]}
                  >
                    <Text style={styles.prBadgeTextSmall}>PR</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )
        })
      })()}
      {/* PR Tooltip */}
      {prInfo && (
        <PrTooltip
          visible={tooltipVisible}
          onClose={() => setTooltipVisible(false)}
          prDetails={prInfo.prDetails}
          exerciseName={prInfo.exerciseName}
        />
      )}
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
  centerCell: {
    alignItems: 'center',
  },
  setBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  setDetail: {
    fontSize: 14,
  },
  prBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  prBadgeTextSmall: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
})

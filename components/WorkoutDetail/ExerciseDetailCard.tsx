import { useMemo, useState, type ReactElement } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { ExerciseMedia } from '@/components/ExerciseMedia'
import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'
import { kgToPreferred, useUnit } from '@/contexts/unit-context'
import { getLevelColor } from '@/hooks/useStrengthData'
import {
  estimateOneRepMaxKg,
  getProgressDeltaPoints,
  getStrengthGender,
} from '@/lib/strength-progress'
import { getStrengthStandard, hasStrengthStandards } from '@/lib/strength-standards'
import type {
  Profile,
  WorkoutExerciseWithDetails,
} from '@/types/database.types'

import { PrTooltip } from '../pr-tooltip'

interface PrDetailForDisplay {
  kind: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
  label: string
  value: number
  previousValue?: number
  weight: number
  previousReps?: number
  currentReps: number
  setIndices?: number[]
  isCurrent: boolean
}

export interface ExercisePRInfo {
  exerciseId: string
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  prDetails: PrDetailForDisplay[]
  hasCurrentPR: boolean
}

interface ExerciseDetailCardProps {
  workoutExercise: WorkoutExerciseWithDetails
  prInfo?: ExercisePRInfo
  profile?: Profile
  previousBest1RMKg?: number
  onExercisePress?: (exerciseId: string) => void
  hideWarmupSets?: boolean
}

function formatWeightRepsText(
  weightKg: number | null,
  reps: number | null,
  weightUnit: 'kg' | 'lb',
): string {
  const hasWeight =
    typeof weightKg === 'number' && !Number.isNaN(weightKg) && weightKg > 0
  const hasReps = typeof reps === 'number' && !Number.isNaN(reps)

  if (hasWeight && hasReps) {
    const convertedWeight = kgToPreferred(weightKg, weightUnit)
    const formattedWeight = convertedWeight.toFixed(weightUnit === 'kg' ? 1 : 0)
    return `${formattedWeight}${weightUnit} x ${reps} reps`
  }

  if (hasReps) {
    return `${reps} reps`
  }

  if (hasWeight) {
    const convertedWeight = kgToPreferred(weightKg, weightUnit)
    const formattedWeight = convertedWeight.toFixed(weightUnit === 'kg' ? 1 : 0)
    return `${formattedWeight}${weightUnit}`
  }

  return '--'
}

export function ExerciseDetailCard({
  workoutExercise,
  prInfo,
  profile,
  previousBest1RMKg,
  onExercisePress,
  hideWarmupSets = false,
}: ExerciseDetailCardProps): ReactElement | null {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const { weightUnit } = useUnit()
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const gainColor = getLevelColor('Intermediate')

  const exercise = workoutExercise.exercise
  const setEntries = useMemo(
    () =>
      workoutExercise.sets
        .map((set, originalIndex) => ({ set, originalIndex }))
        .filter(({ set }) => !(hideWarmupSets && set.is_warmup === true)),
    [workoutExercise.sets, hideWarmupSets],
  )
  const hasValidSets = setEntries.length > 0
  const fallbackExerciseName =
    typeof workoutExercise.exercise_name === 'string'
      ? workoutExercise.exercise_name
      : 'Custom Exercise'
  const exerciseName = exercise?.name || fallbackExerciseName
  const exercisePressId = exercise?.id || workoutExercise.exercise_id || null

  const strengthProgress = useMemo(() => {
    if (!exercise || setEntries.length === 0) return null
    const strengthGender = getStrengthGender(profile?.gender)
    if (!profile?.weight_kg || !strengthGender) return null
    if (!hasStrengthStandards(exercise.name)) return null

    let sessionBest1RM = 0
    setEntries.forEach(({ set }) => {
      if (set.is_warmup === true) return
      if (!set.weight || !set.reps || set.weight <= 0 || set.reps <= 0) return

      const estimated = estimateOneRepMaxKg(set.weight, set.reps)
      if (estimated > sessionBest1RM) {
        sessionBest1RM = estimated
      }
    })

    const baselineBest1RM =
      typeof previousBest1RMKg === 'number' && previousBest1RMKg > 0
        ? previousBest1RMKg
        : 0
    const postWorkoutBest1RM = Math.max(sessionBest1RM, baselineBest1RM)
    if (postWorkoutBest1RM <= 0) return null

    const currentInfo = getStrengthStandard(
      exercise.name,
      strengthGender,
      profile.weight_kg,
      postWorkoutBest1RM,
    )

    if (!currentInfo) return null

    const hasBaseline = typeof previousBest1RMKg === 'number'
    const baselineInfo = hasBaseline
      ? getStrengthStandard(
          exercise.name,
          strengthGender,
          profile.weight_kg,
          baselineBest1RM,
        )
      : null

    let progressDelta: number | null = null
    if (hasBaseline && baselineInfo) {
      progressDelta = getProgressDeltaPoints(
        { level: baselineInfo.level, progress: baselineInfo.progress },
        { level: currentInfo.level, progress: currentInfo.progress },
      )
    }

    return {
      level: currentInfo.level,
      progress: currentInfo.progress,
      progressDelta,
      accentColor: currentInfo.standard.color,
    }
  }, [
    exercise,
    previousBest1RMKg,
    profile?.gender,
    profile?.weight_kg,
    setEntries,
  ])

  const hasPr = (prInfo?.prSetIndices.size ?? 0) > 0
  const setPrLabelsByIndex = useMemo(() => {
    const mapping = new Map<number, string[]>()
    if (!prInfo) return mapping

    const labelForKind = (
      kind: PrDetailForDisplay['kind'],
    ): 'Weight' | '1RM' | 'Volume' => {
      if (kind === 'best-1rm') return '1RM'
      if (kind === 'best-set-volume') return 'Volume'
      return 'Weight'
    }

    prInfo.prDetails.forEach((detail) => {
      const compactLabel = labelForKind(detail.kind)
      ;(detail.setIndices || []).forEach((setIndex) => {
        const existing = mapping.get(setIndex) || []
        if (!existing.includes(compactLabel)) {
          existing.push(compactLabel)
          mapping.set(setIndex, existing)
        }
      })
    })

    return mapping
  }, [prInfo])

  if (!hasValidSets) {
    return null
  }

  let workingSetNumber = 0
  const setRows = setEntries.map(({ set, originalIndex }, index) => {
    const weight = set.weight
    const reps = set.reps
    const setHasPr = prInfo?.prSetIndices.has(originalIndex) === true
    const setPrLabels = setPrLabelsByIndex.get(originalIndex) || []

    const isWarmup = set.is_warmup === true
    if (!isWarmup) {
      workingSetNumber += 1
    }
    const setLabel = isWarmup ? 'W' : String(workingSetNumber)

    const weightRepsText = formatWeightRepsText(weight, reps, weightUnit)

    return (
      <View
        key={set.id}
        style={[
          styles.setRow,
          index % 2 === 0 && {
            backgroundColor: isDark ? colors.surfaceCard : colors.surfaceSubtle,
          },
        ]}
      >
        <View style={[styles.setCell, styles.setCol, styles.centerCell]}>
          <View
            style={[
              styles.setBadge,
              {
                backgroundColor: isWarmup
                  ? `${colors.statusWarning}25`
                  : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.setBadgeText,
                { color: isWarmup ? colors.statusWarning : colors.textSecondary },
              ]}
            >
              {setLabel}
            </Text>
          </View>
        </View>

        <View style={[styles.setCell, styles.weightCol]}>
          <Text style={[styles.setDetail, { color: colors.textPrimary }]}>
            {weightRepsText}
          </Text>
        </View>

        {hasPr && (
          <View style={[styles.setCell, styles.prCol]}>
            {setHasPr && prInfo && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setTooltipVisible(true)}
                style={styles.prBadgeSmall}
              >
                {(setPrLabels.length > 0 ? setPrLabels : ['Record']).map(
                  (label) => (
                    <View key={`${originalIndex}-${label}`} style={styles.prTagRow}>
                      <Ionicons
                        name={prInfo.hasCurrentPR ? 'trophy' : 'trophy-outline'}
                        size={12}
                        color={
                          prInfo.hasCurrentPR
                            ? '#FFD54A'
                            : colors.textTertiary
                        }
                      />
                      <Text
                        style={[
                          styles.setDetail,
                          styles.prTagText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  ),
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    )
  })

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {/* Exercise name */}
      <TouchableOpacity
        style={styles.exerciseHeader}
        onPress={() => {
          if (!exercisePressId) return
          onExercisePress?.(exercisePressId)
        }}
        disabled={!onExercisePress || !exercisePressId}
        activeOpacity={0.7}
      >
        <ExerciseMedia
          gifUrl={exercise?.gif_url}
          mode="thumbnail"
          style={{ width: 56, height: 56, borderRadius: 14 }}
          autoPlay={false}
          isCustom={exercise ? !!exercise.created_by : true}
        />
        <View
          style={[
            styles.exerciseHeaderContent,
            !strengthProgress && styles.exerciseHeaderContentCentered,
          ]}
        >
          <View style={styles.titleSection}>
            <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>
              {exerciseName}
            </Text>
          </View>
          {strengthProgress && (
            <View style={styles.progressSection}>
              <View style={styles.progressTopRow}>
                <View style={styles.progressMetaRow}>
                  <Text
                    style={[
                      styles.progressLabel,
                      { color: strengthProgress.accentColor },
                    ]}
                  >
                    {strengthProgress.level}
                  </Text>
                  {strengthProgress.progressDelta !== null &&
                    strengthProgress.progressDelta > 0 && (
                    <View style={styles.progressGainChip}>
                      <Text
                        style={[
                          styles.progressGainChipText,
                          { color: gainColor },
                        ]}
                      >
                        ▲ {strengthProgress.progressDelta}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.progressPercent,
                    { color: strengthProgress.accentColor },
                  ]}
                >
                  {Math.round(strengthProgress.progress)}%
                </Text>
              </View>

              <View
                style={[
                  styles.progressBarTrack,
                  { backgroundColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.max(0, Math.min(100, strengthProgress.progress))}%`,
                      backgroundColor: strengthProgress.accentColor,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Sets header + rows: full-width, edge-to-edge */}
      <View style={styles.tableWrapper}>
        <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
          <Text
            style={[
              styles.headerCell,
              styles.setCol,
              { color: colors.textSecondary },
            ]}
          >
            SET
          </Text>
          <Text
            style={[
              styles.headerCell,
              styles.weightCol,
              { color: colors.textSecondary },
            ]}
          >
            WEIGHT & REPS
          </Text>
          {hasPr && (
            <Text
              style={[
                styles.headerCell,
                styles.prCol,
                { color: colors.textSecondary },
              ]}
            />
          )}
        </View>

        {/* Sets list */}
        {setRows}
      </View>
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
    alignItems: 'stretch',
    marginBottom: 12,
    gap: 10,
  },
  exerciseHeaderContent: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  exerciseHeaderContentCentered: {
    justifyContent: 'center',
  },
  titleSection: {
    justifyContent: 'flex-start',
  },
  progressSection: {
    justifyContent: 'flex-end',
    gap: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressGainChip: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 18,
    justifyContent: 'center',
  },
  progressGainChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  tableWrapper: {
    marginHorizontal: -16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
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
    width: 148,
    alignItems: 'flex-end',
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  prTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
})

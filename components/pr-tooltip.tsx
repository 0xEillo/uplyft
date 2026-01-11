import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, type ReactElement } from 'react'
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'

export interface PrDetailForTooltip {
  label: string // e.g., "1RM", "11 reps @ 65kg"
  weight: number // the weight for this PR
  previousReps?: number // previous max reps at this weight
  currentReps: number // current max reps at this weight
  isCurrent: boolean // true if this is still the all-time PR
}

interface PrTooltipProps {
  visible: boolean
  onClose: () => void
  prDetails: PrDetailForTooltip[]
  exerciseName: string
  /** Position of the badge that was tapped */
  position?: { x: number; y: number }
  /** Optional override for weight unit (useful for demos/previews) */
  weightUnitOverride?: 'kg' | 'lb'
}

/**
 * Tooltip component that displays PR details when a PR badge is tapped.
 * Shows the type of PR (1RM, 5-rep max, etc.) and the progression.
 */
export function PrTooltip({
  visible,
  onClose,
  prDetails,
  exerciseName,
  weightUnitOverride,
}: PrTooltipProps): ReactElement {
  const colors = useThemedColors()
  const { weightUnit: userWeightUnit } = useWeightUnits()
  const weightUnit = weightUnitOverride || userWeightUnit
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, fadeAnim, scaleAnim])

  const styles = createStyles(colors)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.tooltipContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.tooltip}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.exerciseTitle} numberOfLines={1}>
                  {exerciseName}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* PR Details */}
            <View style={styles.prList}>
              {prDetails.map((pr, index) => {
                const weightDecimals = weightUnit === 'kg' ? 1 : 0
                const formattedWeight = pr.weight.toFixed(weightDecimals)
                const currentRepsLabel = pr.currentReps === 1 ? 'rep' : 'reps'

                const showBeat =
                  pr.previousReps !== undefined &&
                  pr.previousReps > 0 &&
                  pr.previousReps !== pr.currentReps
                const previousRepsLabel = pr.previousReps === 1 ? 'rep' : 'reps'

                return (
                  <View
                    key={index}
                    style={[styles.prItem, !pr.isCurrent && styles.prItemHistorical]}
                  >
                    <View style={styles.prHeaderRow}>
                      <Text
                        style={[
                          styles.prLabel,
                          !pr.isCurrent && styles.prLabelHistorical,
                        ]}
                      >
                        {pr.isCurrent ? 'New Record' : 'Previous Record'}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.prText,
                        !pr.isCurrent && styles.prTextHistorical,
                      ]}
                    >
                      {formattedWeight}
                      {weightUnit} x {pr.currentReps} {currentRepsLabel}
                    </Text>

                    {showBeat && (
                      <View style={styles.beatContainer}>
                        <Ionicons
                          name="trending-up"
                          size={12}
                          color={colors.success}
                        />
                        <Text style={styles.beatText}>
                          Beat: {pr.previousReps} {previousRepsLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

function createStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    tooltipContainer: {
      maxWidth: '85%',
      minWidth: 280,
    },
    tooltip: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    exerciseTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    prList: {
      gap: 10,
    },
    prItem: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    prItemHistorical: {
      backgroundColor: colors.backgroundLight,
      borderLeftColor: colors.textPlaceholder,
    },
    prText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    prTextHistorical: {
      color: colors.textSecondary,
    },
    prHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    prLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    prLabelHistorical: {
      color: colors.textSecondary,
    },
    beatContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.05)',
    },
    beatText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
    },
  })
}

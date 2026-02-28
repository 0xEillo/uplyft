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
  kind: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
  label: string // e.g., "Heaviest Weight", "Best 1RM", "Best Set Volume"
  value: number // metric value (kg, estimated 1RM kg, or kg*reps)
  previousValue?: number
  weight: number // the set weight used for this PR
  previousReps?: number // legacy field for backwards compatibility
  currentReps: number // reps in the set used for this PR
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

  const formatWeight = (weightKg: number): string => {
    const converted = weightUnit === 'lb' ? weightKg * 2.20462 : weightKg
    const maximumFractionDigits = weightUnit === 'kg' ? 1 : 0
    return `${converted.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    })} ${weightUnit}`
  }

  const formatCategoryValue = (pr: PrDetailForTooltip): string => {
    if (pr.kind === 'best-set-volume') {
      const converted = weightUnit === 'lb' ? pr.value * 2.20462 : pr.value
      return `${converted.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} ${weightUnit}·reps`
    }

    if (pr.kind === 'best-1rm') {
      return `${formatWeight(pr.value)} projected`
    }

    return formatWeight(pr.value)
  }

  const formatPreviousValue = (pr: PrDetailForTooltip): string | null => {
    if (typeof pr.previousValue !== 'number' || pr.previousValue <= 0) {
      return null
    }

    if (pr.kind === 'best-set-volume') {
      const converted =
        weightUnit === 'lb' ? pr.previousValue * 2.20462 : pr.previousValue
      return `${converted.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} ${weightUnit}·reps`
    }

    return formatWeight(pr.previousValue)
  }

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
                const previousValue = formatPreviousValue(pr)

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
                        {pr.label}
                      </Text>
                      {!pr.isCurrent && (
                        <Text style={styles.historicalTag}>Past</Text>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.prText,
                        !pr.isCurrent && styles.prTextHistorical,
                      ]}
                    >
                      {formatCategoryValue(pr)}
                    </Text>

                    <Text style={styles.setContextText}>
                      From {formatWeight(pr.weight)} x {pr.currentReps}{' '}
                      {pr.currentReps === 1 ? 'rep' : 'reps'}
                    </Text>

                    {previousValue && (
                      <Text style={styles.previousValueText}>
                        Previous: {previousValue}
                      </Text>
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
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
      flex: 1,
    },
    prList: {
      gap: 10,
    },
    prItem: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.brandPrimarySoft,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.brandPrimary,
    },
    prItemHistorical: {
      backgroundColor: colors.surfaceSubtle,
      borderLeftColor: colors.textPlaceholder,
    },
    prText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },
    prTextHistorical: {
      color: colors.textSecondary,
    },
    prHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 2,
    },
    prLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.brandPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    prLabelHistorical: {
      color: colors.textSecondary,
    },
    setContextText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 4,
    },
    previousValueText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 2,
    },
    historicalTag: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
  })
}

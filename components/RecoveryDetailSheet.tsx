import {
    getRecoveryColor,
    getRecoveryLabel,
    type RecoveryStatus,
    type WorkoutIntensity,
} from '@/hooks/useRecoveryData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import React from 'react'
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native'
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface RecoveryDetailSheetProps {
  isVisible: boolean
  onClose: () => void
  muscleGroup: string
  recoveryStatus: RecoveryStatus
  hoursSinceLastWorkout: number | null
  lastWorkedDate: Date | null
  intensity: WorkoutIntensity | null
  recoveryTimeHours: number | null
}

export function RecoveryDetailSheet({
  isVisible,
  onClose,
  muscleGroup,
  recoveryStatus,
  hoursSinceLastWorkout,
  lastWorkedDate,
  intensity,
  recoveryTimeHours,
}: RecoveryDetailSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)

  const formatTimeAgo = (hours: number | null): string => {
    if (hours === null) return 'Never trained'

    if (hours < 1) {
      return 'Less than an hour ago'
    } else if (hours < 24) {
      const h = Math.floor(hours)
      return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
    } else {
      const days = Math.floor(hours / 24)
      return `${days} ${days === 1 ? 'day' : 'days'} ago`
    }
  }

  const formatDate = (date: Date | null): string => {
    if (date === null) return '—'
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const getRecoveryMessage = (status: RecoveryStatus): string => {
    switch (status) {
      case 'not_recovered':
        return 'This muscle needs more rest before your next workout. Training now could increase injury risk and reduce gains.'
      case 'recovering':
        return 'This muscle is still recovering. Light training is OK, but wait a bit longer for heavy lifts.'
      case 'recovered':
        return 'This muscle is recovered and ready for your next workout!'
      case 'untrained':
        return 'No workout data available for this muscle group yet.'
    }
  }

  const getRecoveryIcon = (
    status: RecoveryStatus
  ): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'not_recovered':
        return 'warning'
      case 'recovering':
        return 'time'
      case 'recovered':
        return 'checkmark-circle'
      case 'untrained':
        return 'help-circle'
    }
  }

  if (!isVisible) return null

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayPressable} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.duration(250).damping(28).stiffness(300)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.sheetWrapper,
            { paddingBottom: insets.bottom + 16, backfaceVisibility: 'hidden' },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={100} tint="dark" style={styles.sheet}>
              <SheetContent
                styles={styles}
                colors={colors}
                muscleGroup={muscleGroup}
                recoveryStatus={recoveryStatus}
                timeAgo={formatTimeAgo(hoursSinceLastWorkout)}
                lastDate={formatDate(lastWorkedDate)}
                message={getRecoveryMessage(recoveryStatus)}
                icon={getRecoveryIcon(recoveryStatus)}
                intensity={intensity}
                recoveryTimeHours={recoveryTimeHours}
                onClose={onClose}
              />
            </BlurView>
          ) : (
            <View style={[styles.sheet, styles.sheetAndroid]}>
              <SheetContent
                styles={styles}
                colors={colors}
                muscleGroup={muscleGroup}
                recoveryStatus={recoveryStatus}
                timeAgo={formatTimeAgo(hoursSinceLastWorkout)}
                lastDate={formatDate(lastWorkedDate)}
                message={getRecoveryMessage(recoveryStatus)}
                icon={getRecoveryIcon(recoveryStatus)}
                intensity={intensity}
                recoveryTimeHours={recoveryTimeHours}
                onClose={onClose}
              />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

interface SheetContentProps {
  styles: ReturnType<typeof createStyles>
  colors: ReturnType<typeof useThemedColors>
  muscleGroup: string
  recoveryStatus: RecoveryStatus
  timeAgo: string
  lastDate: string
  message: string
  icon: keyof typeof Ionicons.glyphMap
  intensity: WorkoutIntensity | null
  recoveryTimeHours: number | null
  onClose: () => void
}

function SheetContent({
  styles,
  colors,
  muscleGroup,
  recoveryStatus,
  timeAgo,
  lastDate,
  message,
  icon,
  intensity,
  recoveryTimeHours,
  onClose,
}: SheetContentProps) {
  const statusColor = getRecoveryColor(recoveryStatus)

  const formatIntensity = (int: WorkoutIntensity | null): string => {
    if (!int) return '—'
    return int.charAt(0).toUpperCase() + int.slice(1)
  }

  const formatRecoveryTime = (hours: number | null): string => {
    if (!hours) return '—'
    const h = Math.round(hours)
    if (h < 24) return `${h} hours`
    const days = Math.round(h / 24 * 10) / 10
    return `${days} days`
  }

  return (
    <View style={styles.content}>
      {/* Handle Bar */}
      <View style={styles.handleBar} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{muscleGroup}</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Status Badge */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Ionicons name={icon} size={20} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getRecoveryLabel(recoveryStatus)}
          </Text>
        </View>
      </View>

      {/* Last Worked Info */}
      {recoveryStatus !== 'untrained' && (
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Trained</Text>
            <Text style={styles.infoValue}>{timeAgo}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{lastDate}</Text>
          </View>
          {intensity && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Workout Intensity</Text>
              <Text style={styles.infoValue}>{formatIntensity(intensity)}</Text>
            </View>
          )}
          {recoveryTimeHours && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recovery Needed</Text>
              <Text style={styles.infoValue}>{formatRecoveryTime(recoveryTimeHours)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Message */}
      <View style={styles.messageSection}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    overlayPressable: {
      flex: 1,
    },
    sheetWrapper: {
      paddingHorizontal: 12,
    },
    sheet: {
      borderRadius: 24,
      overflow: 'hidden',
      // 1px border masks the white shimmer artifact on iOS during animations
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.3)',
    },
    sheetAndroid: {
      backgroundColor: colors.feedCardBackground,
    },
    content: {
      padding: 20,
      paddingTop: 12,
    },
    handleBar: {
      width: 40,
      height: 4,
      backgroundColor: colors.textPlaceholder,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      marginBottom: 16,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    statusSection: {
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '700',
    },
    infoSection: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    messageSection: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
    },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  })

import { Ionicons } from '@expo/vector-icons'
import type { ReactElement } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'
import { useUnit } from '@/contexts/unit-context'
import { calculateWorkoutStats, formatVolume } from '@/lib/utils/workout-stats'
import type { WorkoutSessionWithDetails } from '@/types/database.types'

interface WorkoutStatsGridProps {
  workout: WorkoutSessionWithDetails
  prCount?: number
}

function formatDurationStopwatch(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`
}

export function WorkoutStatsGrid({
  workout,
  prCount,
}: WorkoutStatsGridProps): ReactElement {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const { weightUnit } = useUnit()

  const stats = calculateWorkoutStats(workout, weightUnit)
  const volumeFormatted = formatVolume(stats.totalVolume, weightUnit)
  const durationDisplay = formatDurationStopwatch(stats.durationSeconds)

  return (
    <View style={styles.container}>
      <View style={styles.statItem}>
        <View style={styles.labelContainer}>
          <Ionicons name="time-outline" size={14} color={colors.statusSuccess} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Duration
          </Text>
        </View>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {durationDisplay}
        </Text>
      </View>

      <View style={[styles.statItem, styles.statItemCenter]}>
        <View style={styles.labelContainer}>
          <Ionicons name="barbell-outline" size={14} color={colors.statusInfo} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Volume
          </Text>
        </View>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {volumeFormatted.value.toLocaleString()} {volumeFormatted.unit}
        </Text>
      </View>

      <View style={[styles.statItem, styles.statItemRight]}>
        <View style={styles.labelContainer}>
          <Ionicons name="trophy-outline" size={14} color={colors.brandPrimary} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Records
          </Text>
        </View>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {prCount ?? stats.prCount}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statItemCenter: {
    alignItems: 'center',
  },
  statItemRight: {
    alignItems: 'flex-end',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  value: {
    fontSize: 20,
    fontWeight: '600',
  },
})

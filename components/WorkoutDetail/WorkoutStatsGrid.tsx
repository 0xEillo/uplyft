import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import {
  calculateWorkoutStats,
  formatVolume,
} from '@/lib/utils/workout-stats'
import { useTheme } from '@/contexts/theme-context'
import { getColors } from '@/constants/colors'
import { useUnit } from '@/contexts/unit-context'

interface WorkoutStatsGridProps {
  workout: WorkoutSessionWithDetails
}

const formatDurationStopwatch = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function WorkoutStatsGrid({ workout }: WorkoutStatsGridProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const { weightUnit } = useUnit()

  const stats = calculateWorkoutStats(workout, weightUnit)
  const volumeFormatted = formatVolume(stats.totalVolume, weightUnit)
  const durationDisplay = formatDurationStopwatch(stats.durationSeconds)

  return (
    <View style={styles.container}>
      <View style={styles.statItem}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Duration
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {durationDisplay}
        </Text>
      </View>

      <View style={[styles.statItem, styles.statItemCenter]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Sets</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {stats.totalSets}
        </Text>
      </View>

      <View style={[styles.statItem, styles.statItemRight]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Volume
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {volumeFormatted.value.toLocaleString()} {volumeFormatted.unit}
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
  label: {
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 20,
    fontWeight: '600',
  },
})

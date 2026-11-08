import type { ReactElement } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'
import { useUnit } from '@/contexts/unit-context'
import { formatDurationClock } from '@/lib/exercise-logging-mode'
import { calculateWorkoutStats, formatVolume } from '@/lib/utils/workout-stats'
import type { WorkoutSessionWithDetails } from '@/types/database.types'

interface WorkoutStatsGridProps {
  workout: WorkoutSessionWithDetails
  prCount?: number
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
  const durationDisplay = formatDurationClock(stats.durationSeconds)
  const volumeDisplay = `${volumeFormatted.value.toLocaleString()} ${volumeFormatted.unit}`

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
          Time
        </Text>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>
          {durationDisplay}
        </Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
          Volume
        </Text>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>
          {volumeDisplay}
        </Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
          Records
        </Text>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>
          {prCount ?? stats.prCount}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 28,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  statItem: {
    alignItems: 'flex-start',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
  },
})

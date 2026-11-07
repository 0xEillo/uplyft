import { useThemedColors } from '@/hooks/useThemedColors'
import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
import { Ionicons } from '@expo/vector-icons'
import React, { memo, useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

interface WeeklySnapshotProps {
  /** From useWeeklyProgress, owned by the screen so the data survives the
   * snapshot moving between the loading view and the list header. */
  progress: WeeklyProgressStats
}

export const WeeklySnapshot = memo(function WeeklySnapshot({
  progress,
}: WeeklySnapshotProps) {
  const colors = useThemedColors()
  const { workouts, durationSeconds, volumeKg, isLoading } = progress

  const styles = useMemo(() => createStyles(colors), [colors])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      </View>
    )
  }

  // Format diff duration to show only hours if > 1h, else fallback to something clean
  const formatDiffDuration = (seconds: number) => {
    const absSeconds = Math.abs(seconds)
    if (absSeconds === 0) return '0h'
    const hours = Math.floor(absSeconds / 3600)
    if (hours > 0) return `${hours}h`
    const mins = Math.floor(absSeconds / 60)
    return `${mins}m`
  }

  const formatTotalDuration = (seconds: number) => {
    if (seconds === 0) return '0h'
    const hours = Math.floor(seconds / 3600)
    if (hours > 0) {
      const mins = Math.floor((seconds % 3600) / 60)
      if (mins > 0 && hours < 10) return `${hours}h ${mins}m`
      return `${hours}h`
    }
    const mins = Math.floor(seconds / 60)
    return `${mins}m`
  }

  // Render "1h 20m" with the numbers in the value style and the h/m units in
  // the same smaller unit style as "kg".
  const renderDuration = (seconds: number) =>
    formatTotalDuration(seconds)
      .split(/(\d+)/)
      .filter(Boolean)
      .map((part, index) =>
        /^\d+$/.test(part) ? (
          <Text key={index} style={styles.metricValue}>
            {part}
          </Text>
        ) : (
          <Text key={index} style={[styles.metricValueUnit, styles.durationUnit]}>
            {part.trim()}
          </Text>
        ),
      )

  const formatVolume = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1).replace(/\.0$/, '')}k`
    }
    return Math.round(kg).toString()
  }

  const renderDiffPill = (
    diff: number,
    previous: number,
    formatValue: (val: number) => string,
    suffix: string = '',
  ) => {
    // No previous week data → no comparison is meaningful, so show nothing
    // rather than a row of grey "– 0" pills.
    const noData = previous === 0
    if (noData) return null
    const isPositive = diff > 0
    const isNegative = diff < 0

    let pillBg: string = colors.surfaceSubtle
    let pillText: string = colors.textTertiary
    let iconColor: string = colors.textTertiary
    let iconName: 'caret-up' | 'caret-down' | 'remove' = 'remove'

    if (isPositive) {
      pillBg = `${colors.statusSuccess}20`
      pillText = colors.statusSuccess
      iconColor = colors.statusSuccess
      iconName = 'caret-up'
    } else if (isNegative) {
      pillBg = colors.surfaceSubtle
      pillText = colors.textTertiary
      iconColor = colors.textTertiary
      iconName = 'caret-down'
    }

    return (
      <View style={[styles.diffPill, { backgroundColor: pillBg }]}>
        <Ionicons
          name={iconName}
          size={10}
          color={iconColor}
          style={styles.diffIcon}
        />
        <Text style={[styles.diffText, { color: pillText }]}>
          {diff === 0
            ? `0${suffix}`
            : `${formatValue(Math.abs(diff))}${suffix}`}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your weekly snapshot</Text>
      </View>

      <View style={styles.metricsRow}>
        {/* Workouts Column */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricLabel}>Workouts</Text>
          <Text style={styles.metricValue}>{workouts.current}</Text>
          {renderDiffPill(workouts.diff, workouts.previous, (val) =>
            val.toString(),
          )}
        </View>

        {/* Duration Column */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricLabel}>Time</Text>
          <View style={styles.valueRow}>
            {renderDuration(durationSeconds.current)}
          </View>
          {renderDiffPill(
            durationSeconds.diff,
            durationSeconds.previous,
            formatDiffDuration,
          )}
        </View>

        {/* Volume Column */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricLabel}>Volume</Text>
          <View style={styles.valueRow}>
            <Text style={styles.metricValue}>
              {formatVolume(volumeKg.current)}
            </Text>
            <Text style={styles.metricValueUnit}> kg</Text>
          </View>
          {renderDiffPill(
            volumeKg.diff,
            volumeKg.previous,
            formatVolume,
            ' kg',
          )}
        </View>
      </View>
    </View>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 20,
      backgroundColor: colors.bg,
      // Same 8pt band the feed uses between cards, so the page has one
      // separator idiom.
      borderBottomWidth: 8,
      borderBottomColor: colors.separator,
    },
    loadingContainer: {
      height: 100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    metricColumn: {
      flex: 1,
      alignItems: 'flex-start',
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    metricValue: {
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    metricValueUnit: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    // Same visual gap as the leading space in " kg".
    durationUnit: {
      marginLeft: 3,
      marginRight: 6,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      marginBottom: 2,
      fontWeight: '500',
    },
    diffPill: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    diffIcon: {
      marginRight: 2,
    },
    diffText: {
      fontSize: 11,
      fontWeight: '600',
    },
  })

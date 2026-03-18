import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

interface WeeklySnapshotProps {
  refreshToken?: number
}

export function WeeklySnapshot({ refreshToken }: WeeklySnapshotProps) {
  const colors = useThemedColors()
  const { workouts, durationSeconds, volumeKg, isLoading } =
    useWeeklyProgress(refreshToken)

  const styles = createStyles(colors)

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
    // No previous week data → always gray, no comparison is meaningful
    const noData = previous === 0
    const isPositive = !noData && diff > 0
    const isNegative = !noData && diff < 0

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
          {noData || diff === 0
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
          <Text style={styles.metricValue}>{workouts.current}</Text>
          <Text style={styles.metricLabel}>Workouts</Text>
          {renderDiffPill(workouts.diff, workouts.previous, (val) =>
            val.toString(),
          )}
        </View>

        {/* Duration Column */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>
            {formatTotalDuration(durationSeconds.current)}
          </Text>
          <Text style={styles.metricLabel}>Time</Text>
          {renderDiffPill(
            durationSeconds.diff,
            durationSeconds.previous,
            formatDiffDuration,
          )}
        </View>

        {/* Volume Column */}
        <View style={styles.metricColumn}>
          <View style={styles.valueRow}>
            <Text style={styles.metricValue}>
              {formatVolume(volumeKg.current)}
            </Text>
            <Text style={styles.metricValueUnit}> kg</Text>
          </View>
          <Text style={styles.metricLabel}>Volume</Text>
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
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
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
      marginBottom: 16,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
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
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    metricValueUnit: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    metricLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 8,
      fontWeight: '500',
    },
    diffPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
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

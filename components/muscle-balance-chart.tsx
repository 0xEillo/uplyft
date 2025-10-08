import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

type TimeRange = '30D' | '3M' | '6M' | 'ALL'

interface MuscleBalanceChartProps {
  userId: string
}

interface MuscleGroupData {
  muscleGroup: string
  volume: number
  percentage: number
}

const MUSCLE_GROUP_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Chest: 'body-outline',
  Back: 'shield-outline',
  Legs: 'walk-outline',
  Shoulders: 'trending-up-outline',
  Biceps: 'fitness-outline',
  Triceps: 'barbell-outline',
  Core: 'ellipse-outline',
  Glutes: 'square-outline',
  Cardio: 'heart-outline',
}

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: '#FF6B6B',
  Back: '#4ECDC4',
  Legs: '#45B7D1',
  Shoulders: '#FFA07A',
  Biceps: '#98D8C8',
  Triceps: '#F4A460',
  Core: '#F7DC6F',
  Glutes: '#BB8FCE',
  Cardio: '#EC7063',
}

/**
 * Muscle balance chart component with optimized rendering.
 * Memoized to prevent unnecessary re-renders.
 */
export const MuscleBalanceChart = memo(function MuscleBalanceChart({
  userId,
}: MuscleBalanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M')
  const [distributionData, setDistributionData] = useState<MuscleGroupData[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(false)
  const colors = useThemedColors()

  const loadDistributionData = useCallback(async () => {
    setIsLoading(true)
    try {
      const daysBack =
        timeRange === '30D'
          ? 30
          : timeRange === '3M'
          ? 90
          : timeRange === '6M'
          ? 180
          : undefined

      const data = await database.stats.getMuscleGroupDistribution(
        userId,
        daysBack,
      )
      setDistributionData(data)
    } catch (error) {
      console.error('Error loading muscle group distribution:', error)
      setDistributionData([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, timeRange])

  useEffect(() => {
    loadDistributionData()
  }, [loadDistributionData])

  // Memoize max percentage calculation
  const maxPercentage = useMemo(
    () =>
      distributionData.length
        ? Math.max(...distributionData.map((d) => d.percentage))
        : 0,
    [distributionData],
  )

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="fitness" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Muscle Balance</Text>
            <Text style={styles.subtitle}>
              Training distribution by muscle group
            </Text>
          </View>
        </View>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['30D', '3M', '6M', 'ALL'] as TimeRange[]).map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              timeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange(range)}
          >
            <Text
              style={[
                styles.timeRangeButtonText,
                timeRange === range && styles.timeRangeButtonTextActive,
              ]}
            >
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : distributionData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="analytics-outline"
              size={48}
              color={colors.textPlaceholder}
            />
            <Text style={styles.emptyText}>
              Complete workouts to see your muscle balance
            </Text>
          </View>
        ) : (
          <View style={styles.barsContainer}>
            {distributionData.map((item, index) => {
              const color =
                MUSCLE_GROUP_COLORS[item.muscleGroup] || colors.primary
              const icon =
                MUSCLE_GROUP_ICONS[item.muscleGroup] || 'barbell-outline'

              return (
                <View key={index} style={styles.barRow}>
                  {/* Muscle Group Info */}
                  <View style={styles.barHeader}>
                    <View style={styles.muscleInfo}>
                      <Ionicons name={icon} size={20} color={color} />
                      <Text style={styles.muscleGroupName}>
                        {item.muscleGroup}
                      </Text>
                    </View>
                    <Text style={styles.percentageText}>
                      {item.percentage}%
                    </Text>
                  </View>

                  {/* Bar */}
                  <View style={styles.barBackground}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${item.percentage}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>

                  {/* Volume */}
                  <Text style={styles.volumeText}>
                    {item.volume.toLocaleString()}kg total
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </View>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    timeRangeContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    timeRangeButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
    },
    timeRangeButtonActive: {
      backgroundColor: colors.primary,
    },
    timeRangeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timeRangeButtonTextActive: {
      color: colors.white,
    },
    chartContainer: {
      backgroundColor: colors.backgroundLight,
      padding: 16,
      borderRadius: 12,
      minHeight: 200,
    },
    loadingContainer: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },
    barsContainer: {
      gap: 20,
    },
    barRow: {
      gap: 8,
    },
    barHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    muscleInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    muscleGroupName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    percentageText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    barBackground: {
      height: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 6,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 6,
    },
    volumeText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  })

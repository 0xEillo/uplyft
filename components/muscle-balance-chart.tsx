import { AppColors } from '@/constants/colors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
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

export function MuscleBalanceChart({ userId }: MuscleBalanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M')
  const [distributionData, setDistributionData] = useState<MuscleGroupData[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadDistributionData()
  }, [userId, timeRange])

  const loadDistributionData = async () => {
    setIsLoading(true)
    try {
      const daysBack =
        timeRange === '30D' ? 30 : timeRange === '3M' ? 90 : timeRange === '6M' ? 180 : undefined

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
  }

  const maxPercentage = distributionData.length
    ? Math.max(...distributionData.map((d) => d.percentage))
    : 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Ionicons name="fitness" size={24} color={AppColors.primary} />
          <Text style={styles.title}>Muscle Balance</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>Training distribution by muscle group</Text>

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
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : distributionData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="analytics-outline"
              size={48}
              color={AppColors.textPlaceholder}
            />
            <Text style={styles.emptyText}>
              Complete workouts to see your muscle balance
            </Text>
          </View>
        ) : (
          <View style={styles.barsContainer}>
            {distributionData.map((item, index) => {
              const color =
                MUSCLE_GROUP_COLORS[item.muscleGroup] || AppColors.primary
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
                    <Text style={styles.percentageText}>{item.percentage}%</Text>
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
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginBottom: 16,
    marginLeft: 32,
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
    backgroundColor: AppColors.backgroundLight,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: AppColors.primary,
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  timeRangeButtonTextActive: {
    color: AppColors.white,
  },
  chartContainer: {
    backgroundColor: AppColors.white,
    padding: 16,
    borderRadius: 12,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
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
    color: AppColors.textTertiary,
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
    color: AppColors.text,
  },
  percentageText: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.text,
  },
  barBackground: {
    height: 12,
    backgroundColor: AppColors.backgroundLight,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  volumeText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
})

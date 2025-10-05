import { AppColors } from '@/constants/colors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

interface StrengthScoreChartProps {
  userId: string
}

export function StrengthScoreChart({ userId }: StrengthScoreChartProps) {
  const [progressData, setProgressData] = useState<
    { date: string; strengthScore: number }[]
  >([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadProgressData()
  }, [userId])

  const loadProgressData = async () => {
    setIsLoading(true)
    try {
      const data = await database.stats.getStrengthScoreProgress(userId)
      setProgressData(data)
    } catch (error) {
      console.error('Error loading strength score data:', error)
      setProgressData([])
    } finally {
      setIsLoading(false)
    }
  }

  // Transform data for the chart
  const chartData = progressData.map((point) => ({
    value: point.strengthScore,
    dataPointText: `${point.strengthScore}`,
  }))

  // Calculate stats
  const maxScore = progressData.length
    ? Math.max(...progressData.map((p) => p.strengthScore))
    : 0
  const latestScore =
    progressData.length > 0
      ? progressData[progressData.length - 1].strengthScore
      : 0
  const firstScore = progressData.length > 0 ? progressData[0].strengthScore : 0
  const scoreChange = latestScore - firstScore
  const percentChange =
    firstScore > 0 ? ((scoreChange / firstScore) * 100).toFixed(1) : '0'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={24} color={AppColors.primary} />
          <Text style={styles.title}>Strength Score</Text>
        </View>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={AppColors.textSecondary}
        />
      </View>

      <Text style={styles.subtitle}>
        Sum of estimated 1RMs across all exercises
      </Text>

      {/* Stats Cards */}
      {progressData.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{latestScore}kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>All-Time Peak</Text>
            <Text style={styles.statValue}>{maxScore}kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Change</Text>
            <Text
              style={[
                styles.statValue,
                scoreChange >= 0 ? styles.statPositive : styles.statNegative,
              ]}
            >
              {scoreChange >= 0 ? '+' : ''}
              {scoreChange}kg
            </Text>
            <Text
              style={[
                styles.statPercentage,
                scoreChange >= 0 ? styles.statPositive : styles.statNegative,
              ]}
            >
              ({percentChange}%)
            </Text>
          </View>
        </View>
      )}

      {/* Chart */}
      <View style={styles.chartContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : chartData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={AppColors.textPlaceholder}
            />
            <Text style={styles.emptyText}>
              Complete a workout to see your strength score
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.yAxisLabel}>(kg)</Text>
            <LineChart
              data={chartData}
              width={340}
              height={220}
              spacing={Math.max(40, 340 / chartData.length)}
              initialSpacing={20}
              endSpacing={20}
              color={AppColors.primary}
              thickness={3}
              startFillColor={AppColors.primaryLight}
              endFillColor={AppColors.white}
              startOpacity={0.4}
              endOpacity={0.1}
              areaChart
              hideDataPoints={false}
              dataPointsColor={AppColors.primary}
              dataPointsRadius={4}
              textColor1={AppColors.textSecondary}
              textShiftY={-8}
              textShiftX={-10}
              textFontSize={10}
              curved
              hideRules
              hideYAxisText
              yAxisColor={AppColors.border}
              xAxisColor={AppColors.border}
              xAxisLabelTextStyle={{
                color: AppColors.textSecondary,
                fontSize: 10,
              }}
              maxValue={Math.ceil(maxScore * 1.1)} // Add 10% padding
            />
          </>
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
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: AppColors.white,
    padding: 12,
    borderRadius: 8,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  statPercentage: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statPositive: {
    color: AppColors.success,
  },
  statNegative: {
    color: AppColors.error,
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
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    height: 220,
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
  yAxisLabel: {
    position: 'absolute',
    top: 16,
    left: 2,
    fontSize: 11,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
})

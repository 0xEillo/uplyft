import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_PADDING = 20
const CHART_WIDTH = SCREEN_WIDTH - GRID_PADDING * 2

interface BodyWeightChartProps {
  userId: string
}

type TimeRange = 'W' | 'M' | 'All'

export function BodyWeightChart({ userId }: BodyWeightChartProps) {
  const colors = useThemedColors()
  const { formatWeight } = useWeightUnits()
  const [data, setData] = useState<{ created_at: string; weight_kg: number }[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('All')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      let daysBack: number | undefined
      if (timeRange === 'W') daysBack = 7
      if (timeRange === 'M') daysBack = 30

      const history = await database.bodyLog.getWeightHistory(userId, daysBack)
      setData(history)
    } catch (error) {
      console.error('Error loading weight history:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, timeRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const styles = createStyles(colors)

  if (isLoading && data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.segmentContainer}>
          {/* Skeleton or just empty container to prevent layout shift */}
        </View>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  // Transform data for chart
  const chartData = data.map((point) => ({
    value: point.weight_kg,
    dataPointText: formatWeight(point.weight_kg),
    label: new Date(point.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }))

  const maxWeight =
    data.length > 0 ? Math.max(...data.map((d) => d.weight_kg)) : 0
  const minWeight =
    data.length > 0 ? Math.min(...data.map((d) => d.weight_kg)) : 0
  const range = maxWeight - minWeight
  // Use aggressive padding (50% of range, min 1kg) to make small changes more visible
  const padding = range === 0 ? 2 : Math.max(1, range * 0.5)

  // Find min and max points with dates
  const minPoint = data.reduce((prev, curr) =>
    curr.weight_kg < prev.weight_kg ? curr : prev,
  )
  const maxPoint = data.reduce((prev, curr) =>
    curr.weight_kg > prev.weight_kg ? curr : prev,
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.segmentContainer}>
        {(['W', 'M', 'All Time'] as const).map((label) => {
          const value = label === 'All Time' ? 'All' : label
          const isActive = timeRange === value
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.segmentButton,
                isActive && styles.segmentButtonActive,
              ]}
              onPress={() => setTimeRange(value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  isActive && styles.segmentTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {data.length < 2 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Not enough data for this period
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.chartWrapper}>
            <LineChart
              data={chartData}
              width={CHART_WIDTH}
              height={200}
              spacing={Math.max(40, CHART_WIDTH / (chartData.length || 1))}
              initialSpacing={20}
              endSpacing={20}
              color={colors.primary}
              thickness={3}
              startFillColor={colors.primaryLight}
              endFillColor={colors.background}
              startOpacity={0.4}
              endOpacity={0.0}
              areaChart
              curved
              hideDataPoints
              hideRules
              hideYAxisText
              yAxisColor="transparent"
              xAxisColor="transparent"
              xAxisLabelTextStyle={{
                color: colors.textSecondary,
                fontSize: 10,
              }}
              maxValue={maxWeight + padding}
              yAxisOffset={Math.max(0, minWeight - padding)}
              pointerConfig={{
                pointerStripHeight: 160,
                pointerStripColor: colors.border,
                pointerStripWidth: 2,
                pointerColor: colors.primary,
                radius: 6,
                pointerLabelWidth: 100,
                pointerLabelHeight: 90,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: false,
                pointerLabelComponent: (
                  items: { value: number; date: string; label: string }[],
                ) => {
                  const item = items[0]
                  return (
                    <View
                      style={{
                        height: 90,
                        width: 100,
                        justifyContent: 'center',
                        marginTop: -30,
                        marginLeft: -40,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 16,
                          backgroundColor: colors.feedCardBackground,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: 'bold',
                            textAlign: 'center',
                            color: colors.text,
                            fontSize: 14,
                          }}
                        >
                          {formatWeight(item.value)}
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                            textAlign: 'center',
                            marginTop: 2,
                          }}
                        >
                          {item.label}
                        </Text>
                      </View>
                    </View>
                  )
                },
              }}
            />
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>Low</Text>
              </View>
              <Text style={styles.statValue}>
                {formatWeight(minPoint.weight_kg)}
              </Text>
              <Text style={styles.statDate}>
                {formatDate(minPoint.created_at)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>High</Text>
              </View>
              <Text style={styles.statValue}>
                {formatWeight(maxPoint.weight_kg)}
              </Text>
              <Text style={styles.statDate}>
                {formatDate(maxPoint.created_at)}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      paddingVertical: 16,
      backgroundColor: colors.background,
    },
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundLight, // Light gray background
      borderRadius: 8,
      padding: 2,
      marginBottom: 16,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 6,
      alignItems: 'center',
      borderRadius: 6,
    },
    segmentButtonActive: {
      backgroundColor: colors.feedCardBackground, // White (or card bg) for active
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
      elevation: 2,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.text,
      fontWeight: '600',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    currentWeight: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    chartWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    emptyState: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyStateText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: colors.feedCardBackground,
      marginTop: 24,
      borderRadius: 16,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    statItem: {
      flex: 1,
      gap: 8,
    },
    statBadge: {
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    statBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    statDate: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  })

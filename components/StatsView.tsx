import { EmptyState } from '@/components/EmptyState'
import { Paywall } from '@/components/paywall'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface StatsViewProps {
  userId: string
}

type TimeRange = 'M' | '6M' | '1Y' | 'ALL'

interface MuscleGroupData {
  muscleGroup: string
  volume: number
  percentage: number
}

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: '#FF6B6B',
  Back: '#4ECDC4',
  Shoulders: '#FFA07A',
  Biceps: '#98D8C8',
  Triceps: '#F4A460',
  Core: '#F7DC6F',
  Glutes: '#BB8FCE',
  Quads: '#45B7D1',
  Hamstrings: '#00B894',
  Calves: '#74B9FF',
  Cardio: '#EC7063',
}

export const StatsView = memo(function StatsView({ userId }: StatsViewProps) {
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()
  const { isProMember } = useSubscription()
  const router = useRouter()

  // Unified time range for all stats (default to M for free users, 6M for pro)
  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    isProMember ? '6M' : 'M',
  )

  // Info modal state
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [infoModalContent, setInfoModalContent] = useState<{
    title: string
    description: string
  } | null>(null)

  const showInfo = (title: string, description: string) => {
    setInfoModalContent({ title, description })
    setInfoModalVisible(true)
  }

  // Strength Progress State
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  )
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [progressData, setProgressData] = useState<
    { date: string; strengthScore: number }[]
  >([])
  const [isLoadingStrength, setIsLoadingStrength] = useState(false)

  // Volume/Muscle Balance State
  const [distributionData, setDistributionData] = useState<MuscleGroupData[]>(
    [],
  )
  const [isLoadingMuscle, setIsLoadingMuscle] = useState(false)

  // Volume Over Time State
  const [volumeProgressData, setVolumeProgressData] = useState<
    { date: string; volume: number }[]
  >([])
  const [isLoadingVolume, setIsLoadingVolume] = useState(false)

  // Paywall state
  const [paywallVisible, setPaywallVisible] = useState(false)

  // Refresh state
  const [refreshing, setRefreshing] = useState(false)

  // Animation refs for modal
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  // Load exercises for selector
  const loadExercises = useCallback(async () => {
    try {
      const data = await database.exercises.getExercisesWithData(userId)
      setExercises(data)
    } catch (error) {
      console.error('Error loading exercises:', error)
    }
  }, [userId])

  // Load strength progress data
  const loadProgressData = useCallback(async () => {
    setIsLoadingStrength(true)
    try {
      if (selectedExercise) {
        const data = await database.stats.getExerciseWeightProgress(
          userId,
          selectedExercise.id,
        )
        setProgressData(
          data.map((d) => ({ date: d.date, strengthScore: d.maxWeight })),
        )
      } else {
        const data = await database.stats.getStrengthScoreProgress(userId)
        setProgressData(data)
      }
    } catch (error) {
      console.error('Error loading strength score data:', error)
      setProgressData([])
    } finally {
      setIsLoadingStrength(false)
    }
  }, [userId, selectedExercise])

  // Helper to convert time range to days back
  const getDaysBack = useCallback((range: TimeRange): number | undefined => {
    switch (range) {
      case 'M':
        return 30
      case '6M':
        return 180
      case '1Y':
        return 365
      case 'ALL':
        return undefined
    }
  }, [])

  // Load muscle distribution data and session stats
  const loadVolumeData = useCallback(async () => {
    setIsLoadingMuscle(true)
    try {
      const daysBack = getDaysBack(timeRange)

      const distribution = await database.stats.getMuscleGroupDistribution(
        userId,
        daysBack,
      )
      setDistributionData(distribution)
    } catch (error) {
      console.error('Error loading volume data:', error)
      setDistributionData([])
    } finally {
      setIsLoadingMuscle(false)
    }
  }, [userId, timeRange, getDaysBack])

  // Load volume over time data
  const loadVolumeProgressData = useCallback(async () => {
    setIsLoadingVolume(true)
    try {
      const daysBack = getDaysBack(timeRange)

      const data = await database.stats.getVolumeProgress(userId, daysBack)
      setVolumeProgressData(data)
    } catch (error) {
      console.error('Error loading volume progress data:', error)
      setVolumeProgressData([])
    } finally {
      setIsLoadingVolume(false)
    }
  }, [userId, timeRange, getDaysBack])

  useEffect(() => {
    loadExercises()
  }, [loadExercises])

  useEffect(() => {
    loadProgressData()
  }, [loadProgressData])

  useEffect(() => {
    loadVolumeData()
    loadVolumeProgressData()
  }, [loadVolumeData, loadVolumeProgressData])

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      loadProgressData(),
      loadVolumeData(),
      loadVolumeProgressData(),
    ])
    setRefreshing(false)
  }, [loadProgressData, loadVolumeData, loadVolumeProgressData])

  // Handle exercise picker modal animations
  useEffect(() => {
    if (showExercisePicker) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [showExercisePicker, slideAnim, backdropAnim])

  // Pan responder for exercise picker swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          setShowExercisePicker(false)
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
            stiffness: 200,
          }).start()
        }
      },
    }),
  ).current

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Memoized helper functions for data aggregation
  const aggregateByWeek = useMemo(
    () => (data: { date: string; strengthScore: number }[]) => {
      const weekMap = new Map<string, { date: string; strengthScore: number }>()

      data.forEach((point) => {
        const date = new Date(point.date)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        const weekKey = `${weekStart.getFullYear()}-W${Math.ceil(
          (weekStart.getTime() -
            new Date(weekStart.getFullYear(), 0, 1).getTime()) /
            604800000,
        )}`

        const existing = weekMap.get(weekKey)
        if (
          !existing ||
          new Date(point.date) > new Date(existing.date) ||
          point.strengthScore > existing.strengthScore
        ) {
          weekMap.set(weekKey, point)
        }
      })

      return Array.from(weekMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    },
    [],
  )

  const aggregateByMonth = useMemo(
    () => (data: { date: string; strengthScore: number }[]) => {
      const monthMap = new Map<
        string,
        { date: string; strengthScore: number }
      >()

      data.forEach((point) => {
        const date = new Date(point.date)
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`

        const existing = monthMap.get(monthKey)
        if (
          !existing ||
          new Date(point.date) > new Date(existing.date) ||
          point.strengthScore > existing.strengthScore
        ) {
          monthMap.set(monthKey, point)
        }
      })

      return Array.from(monthMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    },
    [],
  )

  // Memoized filtered data for strength chart
  const filteredStrengthData = useMemo(() => {
    if (progressData.length === 0) return []

    const now = new Date()
    const daysBack = getDaysBack(timeRange)
    let filtered = progressData

    if (daysBack) {
      const cutoffDate = new Date()
      cutoffDate.setDate(now.getDate() - daysBack)
      filtered = progressData.filter(
        (point) => new Date(point.date) >= cutoffDate,
      )
    }

    // Aggregate based on time range
    if (timeRange === 'M') {
      return filtered
    } else if (timeRange === '6M') {
      return aggregateByWeek(filtered)
    } else {
      return aggregateByMonth(filtered)
    }
  }, [progressData, timeRange, getDaysBack, aggregateByWeek, aggregateByMonth])

  // Volume aggregation helpers
  const aggregateVolumeByWeek = useMemo(
    () => (data: { date: string; volume: number }[]) => {
      const weekMap = new Map<string, { date: string; volume: number }>()

      data.forEach((point) => {
        const date = new Date(point.date)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        const weekKey = `${weekStart.getFullYear()}-W${Math.ceil(
          (weekStart.getTime() -
            new Date(weekStart.getFullYear(), 0, 1).getTime()) /
            604800000,
        )}`

        const existing = weekMap.get(weekKey)
        if (!existing) {
          weekMap.set(weekKey, { date: point.date, volume: point.volume })
        } else {
          weekMap.set(weekKey, {
            date: point.date,
            volume: existing.volume + point.volume,
          })
        }
      })

      return Array.from(weekMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    },
    [],
  )

  const aggregateVolumeByMonth = useMemo(
    () => (data: { date: string; volume: number }[]) => {
      const monthMap = new Map<string, { date: string; volume: number }>()

      data.forEach((point) => {
        const date = new Date(point.date)
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`

        const existing = monthMap.get(monthKey)
        if (!existing) {
          monthMap.set(monthKey, { date: point.date, volume: point.volume })
        } else {
          monthMap.set(monthKey, {
            date: point.date,
            volume: existing.volume + point.volume,
          })
        }
      })

      return Array.from(monthMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    },
    [],
  )

  // Memoized filtered data for volume chart
  const filteredVolumeData = useMemo(() => {
    if (volumeProgressData.length === 0) return []

    // Aggregate based on time range
    if (timeRange === 'M') {
      return volumeProgressData
    } else if (timeRange === '6M') {
      return aggregateVolumeByWeek(volumeProgressData)
    } else {
      return aggregateVolumeByMonth(volumeProgressData)
    }
  }, [
    volumeProgressData,
    timeRange,
    aggregateVolumeByWeek,
    aggregateVolumeByMonth,
  ])

  // Transform data for strength chart
  const strengthChartData = filteredStrengthData.map((point) => ({
    value: point.strengthScore,
    dataPointText: point.strengthScore.toFixed(0),
  }))

  // Transform data for volume chart
  const volumeChartData = filteredVolumeData.map((point) => ({
    value: point.volume,
    dataPointText: point.volume.toFixed(0),
  }))

  // Calculate dynamic chart width and spacing
  const screenWidth = Dimensions.get('window').width
  const baseWidth = screenWidth - 64

  const strengthOptimalSpacing =
    strengthChartData.length > 0
      ? Math.max(40, Math.min(60, baseWidth / (strengthChartData.length + 1)))
      : 50

  const strengthCalculatedWidth = Math.max(
    baseWidth,
    strengthChartData.length * strengthOptimalSpacing + 40,
  )

  const strengthNeedsScroll = strengthCalculatedWidth > baseWidth

  const volumeOptimalSpacing =
    volumeChartData.length > 0
      ? Math.max(40, Math.min(60, baseWidth / (volumeChartData.length + 1)))
      : 50

  const volumeCalculatedWidth = Math.max(
    baseWidth,
    volumeChartData.length * volumeOptimalSpacing + 40,
  )

  const volumeNeedsScroll = volumeCalculatedWidth > baseWidth

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'M':
        return '1 month'
      case '6M':
        return '6 months'
      case '1Y':
        return '1 year'
      case 'ALL':
        return 'All time'
    }
  }

  // Calculate strength stats
  const maxStrengthScore = filteredStrengthData.length
    ? Math.max(...filteredStrengthData.map((p) => p.strengthScore))
    : 0
  const latestStrengthScore =
    filteredStrengthData.length > 0
      ? filteredStrengthData[filteredStrengthData.length - 1].strengthScore
      : 0
  const firstStrengthScore =
    filteredStrengthData.length > 0 ? filteredStrengthData[0].strengthScore : 0
  const strengthScoreChange = latestStrengthScore - firstStrengthScore
  const strengthPercentChange =
    firstStrengthScore > 0
      ? ((strengthScoreChange / firstStrengthScore) * 100).toFixed(1)
      : '0'

  // Calculate volume stats
  const maxVolume = filteredVolumeData.length
    ? Math.max(...filteredVolumeData.map((p) => p.volume))
    : 0
  const latestVolume =
    filteredVolumeData.length > 0
      ? filteredVolumeData[filteredVolumeData.length - 1].volume
      : 0
  const firstVolume =
    filteredVolumeData.length > 0 ? filteredVolumeData[0].volume : 0
  const volumeChange = latestVolume - firstVolume
  const volumePercentChange =
    firstVolume > 0 ? ((volumeChange / firstVolume) * 100).toFixed(1) : '0'

  const formatVolume = (volumeKg: number) => {
    if (weightUnit === 'lb') {
      return (volumeKg * 2.20462).toLocaleString('en-US', {
        maximumFractionDigits: 0,
      })
    }
    return volumeKg.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const styles = createStyles(colors)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.brandPrimary]}
          tintColor={colors.brandPrimary}
        />
      }
    >
      {/* Unified Time Range Selector */}
      <View style={styles.timeRangeHeader}>
        <View style={styles.timeRangeContainer}>
          {(['M', '6M', '1Y', 'ALL'] as TimeRange[]).map((range) => {
            const isRestricted = !isProMember && range !== 'M'
            return (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeButton,
                  timeRange === range && styles.timeRangeButtonActive,
                  isRestricted && styles.timeRangeButtonRestricted,
                ]}
                onPress={() => {
                  if (isRestricted) {
                    setPaywallVisible(true)
                  } else {
                    setTimeRange(range)
                  }
                }}
                disabled={isRestricted && timeRange === range}
              >
                <View style={styles.timeRangeButtonContent}>
                  <Text
                    style={[
                      styles.timeRangeText,
                      timeRange === range && styles.timeRangeTextActive,
                      isRestricted && styles.timeRangeTextRestricted,
                    ]}
                  >
                    {range}
                  </Text>
                  {isRestricted && (
                    <Ionicons
                      name="lock-closed-outline"
                      size={10}
                      color={colors.textTertiary}
                      style={styles.lockIcon}
                    />
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* STRENGTH PROGRESS SECTION */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Strength Progress</Text>
        <TouchableOpacity
          onPress={() =>
            showInfo(
              'Strength Progress',
              "Track how your strength improves over time for each exercise. A rising line means you're getting stronger — lifting more weight or doing more reps than before.",
            )
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Exercise Selector */}
        <TouchableOpacity
          style={styles.exerciseSelector}
          onPress={() => setShowExercisePicker(true)}
        >
          <View style={styles.exerciseSelectorLeft}>
            <Ionicons name="barbell-outline" size={20} color={colors.brandPrimary} />
            <Text style={styles.exerciseSelectorText}>
              {selectedExercise?.name || 'All Exercises'}
            </Text>
          </View>
          <Ionicons
            name="chevron-down"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Stats Cards */}
        {progressData.length > 0 && selectedExercise && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Current 1RM</Text>
              <Text style={styles.statValue}>
                {latestStrengthScore === null || latestStrengthScore === 0
                  ? 'BW'
                  : formatWeight(latestStrengthScore, {
                      maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                    })}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Change</Text>
              <Text
                style={[
                  styles.statValue,
                  strengthScoreChange >= 0
                    ? styles.statPositive
                    : styles.statNegative,
                ]}
              >
                {strengthScoreChange >= 0 ? '+' : ''}
                {strengthPercentChange}%
              </Text>
            </View>
          </View>
        )}

        {/* Chart */}
        <View style={styles.chartContainer}>
          {isLoadingStrength ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : strengthChartData.length === 0 ? (
            <EmptyState
              icon="stats-chart-outline"
              title="No strength data"
              description="Complete a workout to see your strength progress over time."
              buttonText="Log Your First Workout"
              onPress={() => router.push('/(tabs)/create-post')}
            />
          ) : (
            <>
              <Text style={styles.yAxisLabel}>{`(${weightUnit})`}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartScrollContent}
              >
                <LineChart
                  data={strengthChartData}
                  width={strengthCalculatedWidth}
                  height={200}
                  spacing={strengthOptimalSpacing}
                  initialSpacing={20}
                  endSpacing={10}
                  color={colors.brandPrimary}
                  thickness={3}
                  startFillColor={colors.brandPrimarySoft}
                  endFillColor={colors.surface}
                  startOpacity={0.4}
                  endOpacity={0.1}
                  areaChart
                  hideDataPoints={false}
                  dataPointsColor={colors.brandPrimary}
                  dataPointsRadius={4}
                  textColor1={colors.textSecondary}
                  textShiftY={-8}
                  textShiftX={-10}
                  textFontSize={10}
                  curved
                  hideYAxisText
                  yAxisColor={colors.textTertiary}
                  xAxisColor={colors.textTertiary}
                  yAxisThickness={2}
                  xAxisThickness={2}
                  rulesType="solid"
                  rulesColor={colors.border}
                  showVerticalLines
                  verticalLinesColor={colors.border}
                  maxValue={Math.ceil(maxStrengthScore * 1.1)}
                />
              </ScrollView>
              <View style={styles.xAxisEndLabel}>
                <Text style={styles.xAxisEndLabelText}>
                  {getTimeRangeLabel()}
                </Text>
              </View>
              {strengthNeedsScroll && (
                <View style={styles.scrollHint}>
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={colors.textPlaceholder}
                  />
                  <Text style={styles.scrollHintText}>Scroll to see more</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textPlaceholder}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* MUSCLE BALANCE SECTION */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Muscle Balance</Text>
        <TouchableOpacity
          onPress={() =>
            showInfo(
              'Muscle Balance',
              "See which muscle groups you're training the most. This helps you spot imbalances — if one bar is much longer than others, you might be overtraining that area and neglecting others.",
            )
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Horizontal Bar Chart */}
        <View style={styles.muscleChartContainer}>
          {isLoadingMuscle ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : distributionData.length === 0 ? (
            <EmptyState
              icon="pie-chart-outline"
              title="No muscle data"
              description="Complete workouts to see your training balance across muscle groups."
              buttonText="Log Your First Workout"
              onPress={() => router.push('/(tabs)/create-post')}
            />
          ) : (
            <View style={styles.barsContainer}>
              {distributionData.map((item, index) => {
                const color =
                  MUSCLE_GROUP_COLORS[item.muscleGroup] || colors.brandPrimary

                return (
                  <View key={index} style={styles.barRow}>
                    <View style={styles.barHeader}>
                      <View style={styles.muscleInfo}>
                        <Text style={styles.muscleGroupName}>
                          {item.muscleGroup}
                        </Text>
                      </View>
                      <Text style={styles.percentageText}>
                        {item.percentage}%
                      </Text>
                    </View>

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

                    <Text style={styles.volumeText}>
                      {item.volume.toLocaleString()} total reps
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </View>

      {/* VOLUME OVER TIME SECTION */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Volume Over Time</Text>
        <TouchableOpacity
          onPress={() =>
            showInfo(
              'Volume Over Time',
              "Track your total training volume (weight × reps) over time. Increasing volume is one of the best indicators of progress — it means you're doing more work and building more muscle.",
            )
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Stats Cards */}
        {volumeProgressData.length > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Latest Volume</Text>
              <Text style={styles.statValue}>
                {formatVolume(latestVolume)} {weightUnit}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Change</Text>
              <Text
                style={[
                  styles.statValue,
                  volumeChange >= 0 ? styles.statPositive : styles.statNegative,
                ]}
              >
                {volumeChange >= 0 ? '+' : ''}
                {volumePercentChange}%
              </Text>
            </View>
          </View>
        )}

        {/* Volume Chart */}
        <View style={styles.chartContainer}>
          {isLoadingVolume ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : volumeChartData.length === 0 ? (
            <EmptyState
              icon="trending-up-outline"
              title="No volume data"
              description="Track your total weight lifted across all sessions."
              buttonText="Log Your First Workout"
              onPress={() => router.push('/(tabs)/create-post')}
            />
          ) : (
            <>
              <Text style={styles.yAxisLabel}>{`(${weightUnit})`}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartScrollContent}
              >
                <LineChart
                  data={volumeChartData}
                  width={volumeCalculatedWidth}
                  height={200}
                  spacing={volumeOptimalSpacing}
                  initialSpacing={20}
                  endSpacing={10}
                  color={colors.brandPrimary}
                  thickness={3}
                  startFillColor={colors.brandPrimarySoft}
                  endFillColor={colors.surface}
                  startOpacity={0.4}
                  endOpacity={0.1}
                  areaChart
                  hideDataPoints={false}
                  dataPointsColor={colors.brandPrimary}
                  dataPointsRadius={4}
                  textColor1={colors.textSecondary}
                  textShiftY={-8}
                  textShiftX={-10}
                  textFontSize={10}
                  curved
                  hideYAxisText
                  yAxisColor={colors.textTertiary}
                  xAxisColor={colors.textTertiary}
                  yAxisThickness={2}
                  xAxisThickness={2}
                  rulesType="solid"
                  rulesColor={colors.border}
                  showVerticalLines
                  verticalLinesColor={colors.border}
                  maxValue={Math.ceil(maxVolume * 1.1)}
                />
              </ScrollView>
              <View style={styles.xAxisEndLabel}>
                <Text style={styles.xAxisEndLabelText}>
                  {getTimeRangeLabel()}
                </Text>
              </View>
              {volumeNeedsScroll && (
                <View style={styles.scrollHint}>
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={colors.textPlaceholder}
                  />
                  <Text style={styles.scrollHintText}>Scroll to see more</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textPlaceholder}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* Exercise Picker Modal */}
      <Modal
        visible={showExercisePicker}
        transparent
        animationType="none"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropAnim,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowExercisePicker(false)}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.handleContainer}>
              <View
                style={[
                  styles.handle,
                  { backgroundColor: colors.textSecondary },
                ]}
              />
            </View>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Exercise</Text>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView style={styles.exerciseList}>
              <TouchableOpacity
                style={[
                  styles.exerciseItem,
                  !selectedExercise && styles.exerciseItemSelected,
                ]}
                onPress={() => {
                  setSelectedExercise(null)
                  setShowExercisePicker(false)
                  setSearchQuery('')
                }}
              >
                <Text
                  style={[
                    styles.exerciseItemText,
                    !selectedExercise && styles.exerciseItemTextSelected,
                  ]}
                >
                  All Exercises
                </Text>
                {!selectedExercise && (
                  <Ionicons name="checkmark" size={20} color={colors.brandPrimary} />
                )}
              </TouchableOpacity>

              {filteredExercises.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={[
                    styles.exerciseItem,
                    selectedExercise?.id === exercise.id &&
                      styles.exerciseItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedExercise(exercise)
                    setShowExercisePicker(false)
                    setSearchQuery('')
                  }}
                >
                  <Text
                    style={[
                      styles.exerciseItemText,
                      selectedExercise?.id === exercise.id &&
                        styles.exerciseItemTextSelected,
                    ]}
                  >
                    {exercise.name}
                  </Text>
                  {selectedExercise?.id === exercise.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.brandPrimary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Paywall Modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        title="Unlock Volume Analytics"
        message="Track your training volume over time to optimize your progression."
      />

      {/* Info Modal */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <Pressable
          style={styles.infoModalOverlay}
          onPress={() => setInfoModalVisible(false)}
        >
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>{infoModalContent?.title}</Text>
            <Text style={styles.infoModalDescription}>
              {infoModalContent?.description}
            </Text>
            <TouchableOpacity
              style={styles.infoModalButton}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={styles.infoModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    contentContainer: {
      paddingBottom: 100,
    },
    timeRangeHeader: {
      backgroundColor: colors.bg,
      paddingTop: 16,
      paddingBottom: 4,
      paddingHorizontal: 14,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingTop: 20,
      paddingBottom: 12,
    },
    sectionHeaderText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    infoModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    infoModalContent: {
      backgroundColor: colors.bg,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 320,
    },
    infoModalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    infoModalDescription: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    infoModalButton: {
      backgroundColor: colors.brandPrimary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    infoModalButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.surface,
    },
    card: {
      backgroundColor: colors.surface,
      paddingVertical: 16,
      paddingHorizontal: 14,
      borderRadius: 16,
      marginHorizontal: 14,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    exerciseSelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      padding: 14,
      borderRadius: 9999,
      marginBottom: 12,
    },
    exerciseSelectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    exerciseSelectorText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    timeRangeContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    timeRangeButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 9999,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
    },
    timeRangeButtonActive: {
      backgroundColor: colors.brandPrimary,
    },
    timeRangeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timeRangeTextActive: {
      color: colors.surface,
    },
    timeRangeButtonRestricted: {
      opacity: 0.6,
    },
    timeRangeTextRestricted: {
      color: colors.textTertiary,
    },
    timeRangeButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    lockIcon: {
      marginLeft: 2,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
      textAlign: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    statPositive: {
      color: colors.statusSuccess,
    },
    statNegative: {
      color: colors.statusError,
    },
    chartContainer: {
      backgroundColor: colors.surfaceSubtle,
      padding: 16,
      borderRadius: 12,
      minHeight: 260,
      justifyContent: 'center',
      alignItems: 'center',
    },
    muscleChartContainer: {
      backgroundColor: colors.surfaceSubtle,
      padding: 16,
      borderRadius: 12,
      minHeight: 200,
    },
    loadingContainer: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    yAxisLabel: {
      position: 'absolute',
      top: 16,
      left: 2,
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chartScrollContent: {
      paddingRight: 16,
      paddingBottom: 2,
    },
    scrollHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 8,
    },
    scrollHintText: {
      fontSize: 11,
      color: colors.textPlaceholder,
      fontStyle: 'italic',
    },
    xAxisEndLabel: {
      alignItems: 'flex-end',
      paddingRight: 20,
      marginTop: 4,
    },
    xAxisEndLabelText: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    barsContainer: {
      gap: 16,
    },
    barRow: {
      gap: 6,
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
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    percentageText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    barBackground: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 4,
    },
    volumeText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SCREEN_HEIGHT * 0.75,
      paddingBottom: 34,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 20,
      flex: 1,
      flexDirection: 'column',
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      opacity: 0.3,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    searchInput: {
      margin: 16,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 9999,
      fontSize: 16,
      color: colors.textPrimary,
    },
    exerciseList: {
      paddingHorizontal: 16,
    },
    exerciseItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 9999,
      marginBottom: 4,
    },
    exerciseItemSelected: {
      backgroundColor: colors.brandPrimarySoft,
    },
    exerciseItemText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    exerciseItemTextSelected: {
      fontWeight: '600',
      color: colors.brandPrimary,
    },
  })

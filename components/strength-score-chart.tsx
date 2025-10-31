import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface StrengthScoreChartProps {
  userId: string
}

type TimeRange = 'week' | 'month' | 'all'

/**
 * Strength score chart component with memoized data aggregation.
 * Optimized to prevent unnecessary recomputations.
 */
export const StrengthScoreChart = memo(function StrengthScoreChart({
  userId,
}: StrengthScoreChartProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  )
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [progressData, setProgressData] = useState<
    { date: string; strengthScore: number }[]
  >([])
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [isLoading, setIsLoading] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()

  // Animation refs for modal
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current
  const infoSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const infoBackdropAnim = useRef(new Animated.Value(0)).current
  const infoScrollViewRef = useRef<ScrollView>(null)
  const infoScrollOffsetRef = useRef(0)

  const loadExercises = useCallback(async () => {
    try {
      const data = await database.exercises.getExercisesWithData(userId)
      setExercises(data)
    } catch (error) {
      console.error('Error loading exercises:', error)
    }
  }, [userId])

  const loadProgressData = useCallback(async () => {
    setIsLoading(true)
    try {
      if (selectedExercise) {
        // Load individual exercise progress
        const data = await database.stats.getExerciseWeightProgress(
          userId,
          selectedExercise.id,
        )
        setProgressData(
          data.map((d) => ({ date: d.date, strengthScore: d.maxWeight })),
        )
      } else {
        // Load combined strength score
        const data = await database.stats.getStrengthScoreProgress(userId)
        setProgressData(data)
      }
    } catch (error) {
      console.error('Error loading strength score data:', error)
      setProgressData([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, selectedExercise])

  useEffect(() => {
    loadExercises()
  }, [loadExercises])

  useEffect(() => {
    loadProgressData()
  }, [loadProgressData])

  // Handle exercise picker modal animations
  useEffect(() => {
    if (showExercisePicker) {
      // Slide up
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
      // Slide down
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

  // Handle info modal animations
  useEffect(() => {
    if (showInfoModal) {
      // Slide up
      Animated.parallel([
        Animated.spring(infoSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(infoBackdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Slide down
      Animated.parallel([
        Animated.timing(infoSlideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(infoBackdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
      // Reset scroll offset when modal closes
      infoScrollOffsetRef.current = 0
      infoScrollViewRef.current?.scrollTo({ y: 0, animated: false })
    }
  }, [showInfoModal, infoSlideAnim, infoBackdropAnim])

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

  // Pan responder for info modal swipe-to-dismiss - allows swipe from handle/header area
  const infoModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only intercept downward swipes
        return (
          gestureState.dy > 5 && gestureState.dy > Math.abs(gestureState.dx)
        )
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          infoSlideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          setShowInfoModal(false)
        } else {
          Animated.spring(infoSlideAnim, {
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
        // Get week key (year-week format)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay()) // Start of week
        const weekKey = `${weekStart.getFullYear()}-W${Math.ceil(
          (weekStart.getTime() -
            new Date(weekStart.getFullYear(), 0, 1).getTime()) /
            604800000,
        )}`

        // Keep the latest/strongest entry in each week
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
        // Get month key (year-month format)
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`

        // Keep the latest/strongest entry in each month
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

  // Memoized data aggregation - only recomputes when progressData or timeRange changes
  const filteredData = useMemo(() => {
    if (progressData.length === 0) return []

    const now = new Date()
    let filtered = progressData

    // First, filter by time range
    if (timeRange === 'week') {
      const cutoffDate = new Date()
      cutoffDate.setDate(now.getDate() - 7)
      filtered = progressData.filter(
        (point) => new Date(point.date) >= cutoffDate,
      )
    } else if (timeRange === 'month') {
      const cutoffDate = new Date()
      cutoffDate.setMonth(now.getMonth() - 1)
      filtered = progressData.filter(
        (point) => new Date(point.date) >= cutoffDate,
      )
    }

    // Then aggregate based on granularity
    if (timeRange === 'week') {
      // Show all data points for week view
      return filtered
    } else if (timeRange === 'month') {
      // Group by week, show one point per week (latest in each week)
      return aggregateByWeek(filtered)
    } else {
      // All time: group by month, show one point per month
      return aggregateByMonth(filtered)
    }
  }, [progressData, timeRange, aggregateByWeek, aggregateByMonth])

  // Transform data for the chart
  const chartData = filteredData.map((point) => ({
    value: point.strengthScore,
    dataPointText: point.strengthScore.toFixed(0),
  }))

  // Calculate dynamic chart width and spacing
  const screenWidth = Dimensions.get('window').width
  const baseWidth = screenWidth - 64 // Account for padding

  // Calculate optimal spacing based on number of points
  // Aim for 40-60px spacing, but allow scrolling if needed for readability
  const optimalSpacing =
    chartData.length > 0
      ? Math.max(40, Math.min(60, baseWidth / (chartData.length + 1)))
      : 50

  const calculatedWidth = Math.max(
    baseWidth,
    chartData.length * optimalSpacing + 40, // Add padding
  )

  const needsScroll = calculatedWidth > baseWidth

  // Calculate stats
  const maxScore = filteredData.length
    ? Math.max(...filteredData.map((p) => p.strengthScore))
    : 0
  const latestScore =
    filteredData.length > 0
      ? filteredData[filteredData.length - 1].strengthScore
      : 0
  const firstScore = filteredData.length > 0 ? filteredData[0].strengthScore : 0
  const scoreChange = latestScore - firstScore
  const percentChange =
    firstScore > 0 ? ((scoreChange / firstScore) * 100).toFixed(1) : '0'

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="analytics" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Strength Progress</Text>
            <Text style={styles.subtitle}>Tracking estimated 1RM</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => setShowInfoModal(true)}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Exercise Selector */}
      <TouchableOpacity
        style={styles.exerciseSelector}
        onPress={() => setShowExercisePicker(true)}
      >
        <View style={styles.exerciseSelectorLeft}>
          <Ionicons name="barbell-outline" size={20} color={colors.primary} />
          <Text style={styles.exerciseSelectorText}>
            {selectedExercise?.name || 'All Exercises'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        <TouchableOpacity
          style={[
            styles.timeRangeButton,
            timeRange === 'week' && styles.timeRangeButtonActive,
          ]}
          onPress={() => setTimeRange('week')}
        >
          <Text
            style={[
              styles.timeRangeText,
              timeRange === 'week' && styles.timeRangeTextActive,
            ]}
          >
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.timeRangeButton,
            timeRange === 'month' && styles.timeRangeButtonActive,
          ]}
          onPress={() => setTimeRange('month')}
        >
          <Text
            style={[
              styles.timeRangeText,
              timeRange === 'month' && styles.timeRangeTextActive,
            ]}
          >
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.timeRangeButton,
            timeRange === 'all' && styles.timeRangeButtonActive,
          ]}
          onPress={() => setTimeRange('all')}
        >
          <Text
            style={[
              styles.timeRangeText,
              timeRange === 'all' && styles.timeRangeTextActive,
            ]}
          >
            All Time
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      {progressData.length > 0 && selectedExercise && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Current 1RM</Text>
            <Text style={styles.statValue}>
              {latestScore === null || latestScore === 0
                ? 'BW'
                : formatWeight(latestScore, {
                    maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                  })}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Change</Text>
            <Text
              style={[
                styles.statValue,
                scoreChange !== null && scoreChange >= 0
                  ? styles.statPositive
                  : styles.statNegative,
              ]}
            >
              {scoreChange >= 0 ? '+' : ''}
              {percentChange}%
            </Text>
          </View>
        </View>
      )}

      {/* Chart */}
      <View style={styles.chartContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : chartData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={colors.textPlaceholder}
            />
            <Text style={styles.emptyText}>
              Complete a workout to see your strength score
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.yAxisLabel}>{`(${weightUnit})`}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScrollContent}
            >
              <LineChart
                data={chartData}
                width={calculatedWidth}
                height={220}
                spacing={optimalSpacing}
                initialSpacing={20}
                endSpacing={20}
                color={colors.primary}
                thickness={3}
                startFillColor={colors.primaryLight}
                endFillColor={colors.white}
                startOpacity={0.4}
                endOpacity={0.1}
                areaChart
                hideDataPoints={false}
                dataPointsColor={colors.primary}
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
                xAxisLabelTextStyle={{
                  color: colors.textSecondary,
                  fontSize: 10,
                }}
                maxValue={Math.ceil(maxScore * 1.1)} // Add 10% padding
              />
            </ScrollView>
            {needsScroll && (
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
            {/* Handle Bar */}
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
              {/* All Exercises option */}
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
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>

              {/* Individual exercises */}
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
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Info Modal - Bottom Sheet */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.infoModalOverlay}>
          <Animated.View
            style={[
              styles.infoBackdrop,
              {
                opacity: infoBackdropAnim,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowInfoModal(false)}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.infoModalContent,
              {
                transform: [{ translateY: infoSlideAnim }],
              },
            ]}
          >
            {/* Handle Bar */}
            <View
              style={styles.infoHandleContainer}
              {...infoModalPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.infoHandle,
                  { backgroundColor: colors.textSecondary },
                ]}
              />
            </View>

            <View
              style={styles.infoModalHeader}
              {...infoModalPanResponder.panHandlers}
            >
              <Text style={styles.infoModalTitle}>Strength Progress</Text>
            </View>

            <ScrollView
              ref={infoScrollViewRef}
              style={styles.infoModalBody}
              contentContainerStyle={styles.infoModalBodyContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              bounces={true}
              onScroll={(event) => {
                infoScrollOffsetRef.current = event.nativeEvent.contentOffset.y
              }}
              scrollEventThrottle={16}
            >
              <Text style={styles.infoSectionTitle}>What this shows</Text>
              <Text style={styles.infoSectionText}>
                This chart surfaces your estimated one-rep max (1RM) peaks over
                the selected range, so you can spot how your strength is
                trending session to session.
              </Text>

              <Text style={styles.infoSectionTitle}>
                How it&apos;s calculated
              </Text>
              <Text style={styles.infoSectionText}>
                We derive 1RM estimates from your logged sets using the Epley
                formula, prioritise the heaviest quality sets each session, and
                smooth the trend to remove noisy outliers.
              </Text>

              <Text style={styles.infoSectionTitle}>What good looks like</Text>
              <Text style={styles.infoSectionText}>
                <Text style={styles.infoSectionBold}>Steady climb: </Text>
                Fresh highs every few weeks show that your training is working
                {'\n'}
                <Text style={styles.infoSectionBold}>Controlled dips: </Text>
                Short plateaus or dips after deloads are normal, just make sure
                they rebound quickly
              </Text>

              <Text style={styles.infoSectionTitle}>How to improve it</Text>
              <Text style={styles.infoSectionText}>
                Log every heavy set, cycle intensity with planned deloads, and
                chase small weekly weight or rep increases rather than big
                jumps.
              </Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
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
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      flex: 1,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
      flexShrink: 0,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      padding: 12,
      borderRadius: 8,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    statPercentage: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    statPositive: {
      color: colors.success,
    },
    statNegative: {
      color: colors.error,
    },
    chartContainer: {
      backgroundColor: colors.backgroundLight,
      padding: 16,
      borderRadius: 12,
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
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
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
    timeRangeContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    timeRangeButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
    },
    timeRangeButtonActive: {
      backgroundColor: colors.primary,
    },
    timeRangeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timeRangeTextActive: {
      color: colors.white,
    },
    exerciseSelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    exerciseSelectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    exerciseSelectorText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
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
      backgroundColor: colors.white,
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
      color: colors.text,
      letterSpacing: -0.5,
    },
    searchInput: {
      margin: 16,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      fontSize: 16,
      color: colors.text,
    },
    exerciseList: {
      paddingHorizontal: 16,
    },
    exerciseItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      marginBottom: 4,
    },
    exerciseItemSelected: {
      backgroundColor: colors.primaryLight,
    },
    exerciseItemText: {
      fontSize: 16,
      color: colors.text,
    },
    exerciseItemTextSelected: {
      fontWeight: '600',
      color: colors.primary,
    },
    infoButton: {
      padding: 4,
      marginTop: -2,
      marginRight: -4,
    },
    infoModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    infoBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    infoModalContent: {
      backgroundColor: colors.white,
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
    infoHandleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
    },
    infoHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      opacity: 0.3,
    },
    infoModalHeader: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    infoModalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    infoModalBody: {
      flex: 1,
    },
    infoModalBodyContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    infoSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    infoSectionText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    infoSectionBold: {
      fontWeight: '700',
      color: colors.text,
    },
  })

import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
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
  TouchableOpacity,
  View,
} from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface VolumeProgressChartProps {
  userId: string
  timeRange: '30D' | '3M' | '6M' | 'ALL'
}

/**
 * Volume over time chart component with memoized data aggregation.
 * Shows total volume (reps × weight) over time.
 */
export const VolumeProgressChart = memo(function VolumeProgressChart({
  userId,
  timeRange,
}: VolumeProgressChartProps) {
  const [progressData, setProgressData] = useState<
    { date: string; volume: number }[]
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()

  // Animation refs for info modal
  const infoSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const infoBackdropAnim = useRef(new Animated.Value(0)).current
  const infoScrollViewRef = useRef<ScrollView>(null)
  const infoScrollOffsetRef = useRef(0)

  const loadProgressData = useCallback(async () => {
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

      const data = await database.stats.getVolumeProgress(userId, daysBack)
      setProgressData(data)
    } catch (error) {
      console.error('Error loading volume progress data:', error)
      setProgressData([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, timeRange])

  useEffect(() => {
    loadProgressData()
  }, [loadProgressData])

  // Handle info modal animations
  useEffect(() => {
    if (showInfoModal) {
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
      infoScrollOffsetRef.current = 0
      infoScrollViewRef.current?.scrollTo({ y: 0, animated: false })
    }
  }, [showInfoModal, infoSlideAnim, infoBackdropAnim])

  // Pan responder for info modal swipe-to-dismiss
  const infoModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
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

  // Memoized helper functions for data aggregation
  const aggregateByWeek = useMemo(
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

        // Sum volume for each week
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

  const aggregateByMonth = useMemo(
    () => (data: { date: string; volume: number }[]) => {
      const monthMap = new Map<string, { date: string; volume: number }>()

      data.forEach((point) => {
        const date = new Date(point.date)
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`

        // Sum volume for each month
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

  // Memoized data aggregation
  const filteredData = useMemo(() => {
    if (progressData.length === 0) return []

    // Data is already filtered by daysBack in loadProgressData
    // Just aggregate based on time range granularity
    if (timeRange === '30D') {
      // Show all data points for 30 days
      return progressData
    } else if (timeRange === '3M' || timeRange === '6M') {
      // Aggregate by week for 3M and 6M
      return aggregateByWeek(progressData)
    } else {
      // Aggregate by month for ALL
      return aggregateByMonth(progressData)
    }
  }, [progressData, timeRange, aggregateByWeek, aggregateByMonth])

  // Transform data for the chart
  const chartData = filteredData.map((point) => ({
    value: point.volume,
    dataPointText: point.volume.toFixed(0),
  }))

  // Calculate dynamic chart width and spacing
  const screenWidth = Dimensions.get('window').width
  const baseWidth = screenWidth - 64

  const optimalSpacing =
    chartData.length > 0
      ? Math.max(40, Math.min(60, baseWidth / (chartData.length + 1)))
      : 50

  const calculatedWidth = Math.max(
    baseWidth,
    chartData.length * optimalSpacing + 40,
  )

  const needsScroll = calculatedWidth > baseWidth

  // Get end date label for the time range
  const getEndDateLabel = () => {
    const now = new Date()
    if (timeRange === '30D') {
      return '30 days'
    } else if (timeRange === '3M') {
      return '3 months'
    } else if (timeRange === '6M') {
      return '6 months'
    } else {
      return 'All time'
    }
  }

  // Calculate stats
  const maxVolume = filteredData.length
    ? Math.max(...filteredData.map((p) => p.volume))
    : 0
  const latestVolume =
    filteredData.length > 0 ? filteredData[filteredData.length - 1].volume : 0
  const firstVolume = filteredData.length > 0 ? filteredData[0].volume : 0
  const volumeChange = latestVolume - firstVolume
  const percentChange =
    firstVolume > 0 ? ((volumeChange / firstVolume) * 100).toFixed(1) : '0'

  const styles = createStyles(colors)

  // Format volume for display (convert kg to user's preferred unit)
  const formatVolume = (volumeKg: number) => {
    if (weightUnit === 'lb') {
      return (volumeKg * 2.20462).toLocaleString('en-US', {
        maximumFractionDigits: 0,
      })
    }
    return volumeKg.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="trending-up" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Volume Over Time</Text>
            <Text style={styles.subtitle}>Total volume trends over time</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
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
      </View>

      {/* Stats Cards */}
      {progressData.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Latest Volume</Text>
            <Text style={styles.statValue}>
              {formatVolume(latestVolume)} {weightUnit === 'lb' ? 'lb' : 'kg'}
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
              Complete a workout to see your volume over time
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
                height={200}
                spacing={optimalSpacing}
                initialSpacing={20}
                endSpacing={10}
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
                maxValue={Math.ceil(maxVolume * 1.1)}
              />
            </ScrollView>
            <View style={styles.xAxisEndLabel}>
              <Text style={styles.xAxisEndLabelText}>
                {getEndDateLabel()}
              </Text>
            </View>
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

      {/* Info Modal */}
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
              <Text style={styles.infoModalTitle}>Volume Over Time</Text>
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
                This chart tracks your total training volume (reps × weight)
                over time, so you can see how your work capacity is trending
                session to session.
              </Text>

              <Text style={styles.infoSectionTitle}>
                How it&apos;s calculated
              </Text>
              <Text style={styles.infoSectionText}>
                We sum up all the volume from your logged sets (reps × weight)
                for each workout session. For longer time ranges, we aggregate
                by week or month to show trends clearly.
              </Text>

              <Text style={styles.infoSectionTitle}>What good looks like</Text>
              <Text style={styles.infoSectionText}>
                <Text style={styles.infoSectionBold}>Steady growth: </Text>
                Gradual increases in volume show progressive overload is working
                {'\n'}
                <Text style={styles.infoSectionBold}>Controlled dips: </Text>
                Planned deloads or rest weeks will show lower volume, which is
                normal and healthy
              </Text>

              <Text style={styles.infoSectionTitle}>How to improve it</Text>
              <Text style={styles.infoSectionText}>
                Log every set accurately, gradually increase volume over time,
                and balance high-volume weeks with recovery periods to avoid
                overtraining.
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
      backgroundColor: colors.feedCardBackground,
      paddingVertical: 20,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderBottomWidth: 2,
      borderBottomColor: colors.background,
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
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
      borderRadius: 9999,
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
      color: colors.text,
      textAlign: 'center',
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


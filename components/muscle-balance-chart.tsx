import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
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

type TimeRange = '30D' | '3M' | '6M' | 'ALL'

interface MuscleBalanceChartProps {
  userId: string
}

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

/**
 * Muscle balance chart component with optimized rendering.
 * Memoized to prevent unnecessary re-renders.
 */
export const MuscleBalanceChart = memo(function MuscleBalanceChart({
  userId,
}: MuscleBalanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30D')
  const [distributionData, setDistributionData] = useState<MuscleGroupData[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const colors = useThemedColors()
  const { formatWeight } = useWeightUnits()

  // Animation refs for info modal
  const infoSlideAnim = useRef(
    new Animated.Value(Dimensions.get('window').height),
  ).current
  const infoBackdropAnim = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)
  const scrollOffsetRef = useRef(0)

  // Info modal pan responder - allows swipe-to-dismiss from handle/header area
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
          toValue: Dimensions.get('window').height,
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
      scrollOffsetRef.current = 0
      scrollViewRef.current?.scrollTo({ y: 0, animated: false })
    }
  }, [showInfoModal, infoSlideAnim, infoBackdropAnim])

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

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="body" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Muscle Balance</Text>
            <Text style={styles.subtitle}>
              Training distribution by muscle group
            </Text>
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

              return (
                <View key={index} style={styles.barRow}>
                  {/* Muscle Group Info */}
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
                    {formatWeight(item.volume, {
                      maximumFractionDigits: 0,
                    })}{' '}
                    total
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* Info Modal - Bottom Sheet */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.backdrop,
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
              styles.modalContent,
              {
                transform: [{ translateY: infoSlideAnim }],
              },
            ]}
          >
            {/* Handle Bar */}
            <View
              style={styles.handleContainer}
              {...infoModalPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.handle,
                  { backgroundColor: colors.textSecondary },
                ]}
              />
            </View>

            <View
              style={styles.modalHeader}
              {...infoModalPanResponder.panHandlers}
            >
              <Text style={styles.modalTitle}>Muscle Balance</Text>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              bounces={true}
              onScroll={(event) => {
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y
              }}
              scrollEventThrottle={16}
            >
              <Text style={styles.sectionTitle}>What this shows</Text>
              <Text style={styles.sectionText}>
                This breakdown shows where your training volume is landing, so
                you can catch overused and neglected muscle groups at a glance.
              </Text>

              <Text style={styles.sectionTitle}>How it&apos;s calculated</Text>
              <Text style={styles.sectionText}>
                We total the sets × reps × weight you log for each muscle group
                and normalise it over the time range you select. Switch ranges
                to contrast short-term cycles against longer trends.
              </Text>

              <Text style={styles.sectionTitle}>What good looks like</Text>
              <Text style={styles.sectionText}>
                <Text style={styles.sectionBold}>Balanced spread:</Text> Keep
                major muscle groups within ~15-25% of each other to stay
                structurally sound
                {'\n'}
                <Text style={styles.sectionBold}>Controlled focus:</Text>
                Temporary spikes are fine during a block, just avoid letting one
                area dominate for months
              </Text>

              <Text style={styles.sectionTitle}>How to improve it</Text>
              <Text style={styles.sectionText}>
                Rotate primary lifts through upper, lower, and posterior chain
                days, and plug gaps with accessory work that targets muscles you
                rarely hit directly.
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
      flex: 1,
      gap: 12,
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
    timeRangeContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    timeRangeButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 9999,
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
      borderRadius: 9999,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 9999,
    },
    volumeText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    infoButton: {
      padding: 4,
      marginTop: -2,
      marginRight: -4,
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
      maxHeight: Dimensions.get('window').height * 0.75,
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
    modalBody: {
      flex: 1,
    },
    modalBodyContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    sectionBold: {
      fontWeight: '700',
      color: colors.text,
    },
  })

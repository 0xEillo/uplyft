import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
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

interface LeaderboardRanking {
  exerciseId: string
  exerciseName: string
  userMax1RM: number
  percentile: number
  totalUsers: number
  gender?: string | null
  genderPercentile?: number | null
  genderWeightPercentile?: number | null
  weightBucketStart?: number | null
  weightBucketEnd?: number | null
}

interface ExerciseLeaderboardCardProps {
  userId: string
  refreshTrigger?: number
}

/**
 * Exercise leaderboard card showing user's percentile rankings.
 * Features sleek modern design with animated progress bars and tier badges.
 */
type RankingMode = 'weight' | 'overall'

export const ExerciseLeaderboardCard = memo(function ExerciseLeaderboardCard({
  userId,
  refreshTrigger = 0,
}: ExerciseLeaderboardCardProps) {
  const [rankings, setRankings] = useState<LeaderboardRanking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [animatedValues] = useState(() => new Map<string, Animated.Value>())
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [rankingMode, setRankingMode] = useState<RankingMode>('weight')
  const colors = useThemedColors()
  const { formatWeight } = useWeightUnits()

  // Animated value for toggle indicator position
  const toggleIndicatorAnim = useRef(new Animated.Value(0)).current
  const [segmentedControlWidth, setSegmentedControlWidth] = useState(0)

  // Get weight range from rankings (should be consistent across all exercises for the user)
  const weightRange =
    rankings.length > 0 &&
    rankings[0].weightBucketStart != null &&
    rankings[0].weightBucketEnd != null
      ? `${formatWeight(rankings[0].weightBucketStart, { maximumFractionDigits: 0 })}-${formatWeight(rankings[0].weightBucketEnd, { maximumFractionDigits: 0 })}`
      : 'By Weight'

  // Animation refs for info modal
  const infoSlideAnim = useRef(
    new Animated.Value(Dimensions.get('window').height),
  ).current
  const infoBackdropAnim = useRef(new Animated.Value(0)).current

  // ScrollView ref for swipe-to-dismiss detection
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

  const loadRankings = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await database.stats.getUserLeaderboardRankings(userId)
      setRankings(data)

      // Initialize animation values for progress bars
      data.forEach((ranking) => {
        if (!animatedValues.has(ranking.exerciseId)) {
          animatedValues.set(ranking.exerciseId, new Animated.Value(0))
        }
      })

      // Animate progress bars sequentially with stagger
      setTimeout(() => {
        data.forEach((ranking, index) => {
          const animatedValue = animatedValues.get(ranking.exerciseId)
          if (animatedValue) {
            Animated.timing(animatedValue, {
              toValue: ranking.percentile,
              duration: 1000,
              delay: index * 150,
              useNativeDriver: false,
            }).start()
          }
        })
      }, 200)
    } catch (error) {
      console.error('Error loading leaderboard rankings:', error)
      setRankings([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, animatedValues])

  useEffect(() => {
    loadRankings()
  }, [loadRankings, refreshTrigger])

  // Animate toggle indicator when mode changes
  useEffect(() => {
    Animated.spring(toggleIndicatorAnim, {
      toValue: rankingMode === 'weight' ? 0 : 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 300,
    }).start()
  }, [rankingMode, toggleIndicatorAnim])

  const topRankings = rankings.slice(0, 3)
  const remainingRankings = rankings.slice(3)
  const shouldShowExpand = remainingRankings.length > 0

  const styles = createStyles(colors)

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name="podium" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.title}>Leaderboard Rankings</Text>
              <Text style={styles.subtitle}>
                Your percentile ranking on key lifts
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    )
  }

  if (rankings.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name="podium" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.title}>Leaderboard Rankings</Text>
              <Text style={styles.subtitle}>
                Your percentile ranking on key lifts
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Ionicons
            name="barbell-outline"
            size={48}
            color={colors.textPlaceholder}
          />
          <Text style={styles.emptyText}>No key lifts tracked yet</Text>
          <Text style={styles.emptySubtext}>
            Log compound exercises like Bench Press, Squat, or Deadlift to see
            your rankings
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="podium" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Leaderboard Rankings</Text>
            <Text style={styles.subtitle}>
              Your percentile ranking on key lifts
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

      {/* Ranking Mode Toggle */}
      <View style={styles.toggleContainer}>
        <View
          style={styles.segmentedControl}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout
            if (width > 0) {
              setSegmentedControlWidth(width)
            }
          }}
        >
          {segmentedControlWidth > 0 && (
            <Animated.View
            style={[
                styles.toggleIndicator,
                {
                  transform: [
                    {
                      translateX: toggleIndicatorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          0,
                          segmentedControlWidth * 0.5 - 4,
                        ],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          <TouchableOpacity
            style={styles.segmentButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setRankingMode('weight')
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                rankingMode === 'weight' && styles.segmentTextActive,
              ]}
            >
              {weightRange}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.segmentButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setRankingMode('overall')
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                rankingMode === 'overall' && styles.segmentTextActive,
              ]}
            >
              Overall
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Rankings */}
      <View style={styles.rankingsContainer}>
        {topRankings.map((ranking, index) => (
          <RankingRow
            key={ranking.exerciseId}
            ranking={ranking}
            animatedValue={animatedValues.get(ranking.exerciseId)!}
            colors={colors}
            isFirst={index === 0}
            rankingMode={rankingMode}
          />
        ))}
      </View>

      {/* Expanded Rankings */}
      {isExpanded && remainingRankings.length > 0 && (
        <View style={styles.expandedContainer}>
          <ScrollView
            style={styles.expandedScrollView}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {remainingRankings.map((ranking) => (
              <RankingRow
                key={ranking.exerciseId}
                ranking={ranking}
                animatedValue={animatedValues.get(ranking.exerciseId)!}
                colors={colors}
                isCompact
                rankingMode={rankingMode}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Show More Indicator */}
      {shouldShowExpand && !isExpanded && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setIsExpanded(true)
          }}
        >
          <Text style={styles.showMoreText}>
            +{remainingRankings.length} more exercise
            {remainingRankings.length !== 1 ? 's' : ''}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Show Less Button */}
      {shouldShowExpand && isExpanded && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setIsExpanded(false)
          }}
        >
          <Text style={styles.showMoreText}>Show less</Text>
          <Ionicons name="chevron-up" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

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
              <Text style={styles.modalTitle}>Leaderboard Rankings</Text>
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
                These percentiles stack your estimated one-rep max (1RM) against
                the Rep AI community, so you can see exactly where each lift
                stands competitively.
              </Text>

              <Text style={styles.sectionTitle}>How it&apos;s calculated</Text>
              <Text style={styles.sectionText}>
                We convert your best logged sets into fresh 1RM estimates, then
                compare them with lifters who match your gender and your
                body-weight bracket. Your rankings are udpated every time you
                log a new workout.
              </Text>

              <Text style={styles.sectionTitle}>What good looks like</Text>
              <Text style={styles.sectionText}>
                <Text style={styles.sectionBold}>95th+ (Elite):</Text>{' '}
                You&apos;re pacing with top-tier lifters{'\n'}
                <Text style={styles.sectionBold}>90-95th:</Text> Ready to hang
                at advanced meets{'\n'}
                <Text style={styles.sectionBold}>75-90th:</Text> Stronger than
                most dedicated gym-goers{'\n'}
                <Text style={styles.sectionBold}>50-75th:</Text> Rock-solid base
                with plenty of upside
              </Text>

              <Text style={styles.sectionTitle}>How to improve it</Text>
              <Text style={styles.sectionText}>
                Run progressive overload blocks, log every heavy set, tighten
                form so reps stay clean, and guard recovery so your nervous
                system stays sharp.
              </Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  )
})

interface RankingRowProps {
  ranking: LeaderboardRanking
  animatedValue: Animated.Value
  colors: ReturnType<typeof useThemedColors>
  isFirst?: boolean
  isCompact?: boolean
  rankingMode: RankingMode
}

function RankingRow({
  ranking,
  animatedValue,
  colors,
  isFirst = false,
  isCompact = false,
  rankingMode,
}: RankingRowProps) {
  const { formatWeight } = useWeightUnits()
  const styles = createStyles(colors)

  // Determine which percentile to display based on ranking mode
  const hasWeightClass = ranking.genderWeightPercentile != null
  const displayPercentile =
    rankingMode === 'weight' && hasWeightClass
      ? ranking.genderWeightPercentile!
      : ranking.genderPercentile ?? ranking.percentile

  const tierInfo = resolveTierInfo(displayPercentile, colors)

  // Animation state for displayed percentile
  const [displayPercentileText, setDisplayPercentileText] = useState(
    `${displayPercentile}th`,
  )

  useEffect(() => {
    // Update displayed percentile when ranking mode changes
    setDisplayPercentileText(`${displayPercentile}th`)

    // Reset animated value to 0 and animate to new percentile
    animatedValue.setValue(0)
    Animated.timing(animatedValue, {
      toValue: displayPercentile,
      duration: 1000,
      useNativeDriver: false,
    }).start()

    // Add listener for animation updates
    const listener = animatedValue.addListener(({ value }) => {
      const roundedValue = Math.round(value)
      setDisplayPercentileText(`${roundedValue}th`)
    })

    return () => animatedValue.removeListener(listener)
  }, [animatedValue, displayPercentile, rankingMode])

  return (
    <View style={[styles.rankingRow, isCompact && styles.rankingRowCompact]}>
      {/* Exercise Info */}
      <View style={styles.exerciseInfo}>
        <View style={styles.exerciseHeader}>
          <Text
            style={[styles.exerciseName, isFirst && styles.firstExerciseName]}
          >
            {ranking.exerciseName}
          </Text>
          <Text style={styles.weightInfo}>
            {formatWeight(ranking.userMax1RM, { maximumFractionDigits: 0 })} •{' '}
            {ranking.totalUsers} users
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: animatedValue.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                  backgroundColor: tierInfo.color,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.percentileText,
              isFirst && styles.firstPercentileText,
              { color: tierInfo.color },
            ]}
          >
            {displayPercentileText}
          </Text>
        </View>
      </View>
    </View>
  )
}

function resolveTierInfo(
  percentile: number,
  colors: ReturnType<typeof useThemedColors>,
) {
  if (percentile >= 95)
    return { tier: 'Elite', color: '#FFD700', icon: 'trophy' as const }
  if (percentile >= 90)
    return { tier: 'Top 10%', color: '#C0C0C0', icon: 'medal' as const }
  if (percentile >= 75)
    return { tier: 'Top 25%', color: '#CD7F32', icon: 'ribbon' as const }
  if (percentile >= 50)
    return {
      tier: 'Top 50%',
      color: colors.primary,
      icon: 'trending-up' as const,
    }
  return {
    tier: 'Developing',
    color: colors.textSecondary,
    icon: 'fitness' as const,
  }
}

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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
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
    },
    infoButton: {
      padding: 4,
      marginTop: -2,
      marginRight: -4,
    },
    toggleContainer: {
      marginBottom: 20,
      alignItems: 'center',
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundLight,
      borderRadius: 9999,
      padding: 4,
      position: 'relative',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    toggleIndicator: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      width: '48%',
      backgroundColor: colors.primary,
      borderRadius: 9999,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    segmentButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 18,
      zIndex: 1,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.2,
    },
    segmentTextActive: {
      color: colors.white,
      fontWeight: '700',
    },
    loadingContainer: {
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: 12,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 13,
      color: colors.textLight,
      marginTop: 6,
      textAlign: 'center',
      lineHeight: 18,
    },
    rankingsContainer: {
      gap: 16,
    },
    rankingRow: {
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '40',
    },
    rankingRowCompact: {
      paddingBottom: 12,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseHeader: {
      marginBottom: 12,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    firstExerciseName: {
      fontSize: 17,
      fontWeight: '700',
    },
    weightInfo: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    progressTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.backgroundLight,
      borderRadius: 9999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 9999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      position: 'relative',
    },
    percentileText: {
      fontSize: 14,
      fontWeight: '700',
      minWidth: 40,
      textAlign: 'right',
    },
    firstPercentileText: {
      fontSize: 16,
      fontWeight: '800',
    },
    expandedContainer: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border + '40',
    },
    expandedScrollView: {
      maxHeight: 200,
    },
    showMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      marginTop: 8,
      gap: 6,
    },
    showMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
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

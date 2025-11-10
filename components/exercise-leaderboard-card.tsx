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
  const [showNextPercentileModal, setShowNextPercentileModal] = useState(false)
  const [selectedRanking, setSelectedRanking] = useState<LeaderboardRanking | null>(null)
  const [nextPercentileData, setNextPercentileData] = useState<{
    targetPercentile: number
    weightNeeded: number | null
    isLoading: boolean
  } | null>(null)
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

  // Animation refs for next percentile modal
  const nextPercentileSlideAnim = useRef(
    new Animated.Value(Dimensions.get('window').height),
  ).current
  const nextPercentileBackdropAnim = useRef(new Animated.Value(0)).current

  // ScrollView refs for swipe-to-dismiss detection
  const scrollViewRef = useRef<ScrollView>(null)
  const scrollOffsetRef = useRef(0)
  const nextPercentileScrollViewRef = useRef<ScrollView>(null)
  const nextPercentileScrollOffsetRef = useRef(0)

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

  // Next percentile modal pan responder
  const nextPercentileModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          gestureState.dy > 5 && gestureState.dy > Math.abs(gestureState.dx)
        )
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          nextPercentileSlideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          setShowNextPercentileModal(false)
        } else {
          Animated.spring(nextPercentileSlideAnim, {
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

  // Handle next percentile modal animations
  useEffect(() => {
    if (showNextPercentileModal) {
      Animated.parallel([
        Animated.spring(nextPercentileSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(nextPercentileBackdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(nextPercentileSlideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(nextPercentileBackdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
      nextPercentileScrollOffsetRef.current = 0
      nextPercentileScrollViewRef.current?.scrollTo({ y: 0, animated: false })
      setSelectedRanking(null)
      setNextPercentileData(null)
    }
  }, [showNextPercentileModal, nextPercentileSlideAnim, nextPercentileBackdropAnim])

  // Calculate next percentile bracket
  const getNextPercentileBracket = (currentPercentile: number): number => {
    if (currentPercentile >= 95) return 100 // Already at elite, show 100th
    if (currentPercentile >= 90) return 95
    if (currentPercentile >= 75) return 90
    if (currentPercentile >= 50) return 75
    return 50
  }

  // Handle exercise click
  const handleExerciseClick = useCallback(
    async (ranking: LeaderboardRanking) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setSelectedRanking(ranking)
      setShowNextPercentileModal(true)

      // Determine which percentile to use based on ranking mode
      const hasWeightClass = ranking.genderWeightPercentile != null
      const currentPercentile =
        rankingMode === 'weight' && hasWeightClass
          ? ranking.genderWeightPercentile!
          : ranking.genderPercentile ?? ranking.percentile

      const targetPercentile = getNextPercentileBracket(currentPercentile)

      // Special haptic for top percentile users
      if (currentPercentile >= 95) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }

      setNextPercentileData({
        targetPercentile,
        weightNeeded: null,
        isLoading: true,
      })

      // Fetch weight needed
      try {
        const weightNeeded = await database.stats.getWeightForNextPercentile(
          ranking.exerciseId,
          currentPercentile,
          targetPercentile,
          ranking.gender ?? null,
          ranking.weightBucketStart ?? null,
          ranking.weightBucketEnd ?? null,
        )

        setNextPercentileData({
          targetPercentile,
          weightNeeded,
          isLoading: false,
        })
      } catch (error) {
        console.error('Error fetching weight for next percentile:', error)
        setNextPercentileData({
          targetPercentile,
          weightNeeded: null,
          isLoading: false,
        })
      }
    },
    [rankingMode],
  )

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
            onPress={() => handleExerciseClick(ranking)}
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
                onPress={() => handleExerciseClick(ranking)}
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

      {/* Next Percentile Modal */}
      <Modal
        visible={showNextPercentileModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowNextPercentileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: nextPercentileBackdropAnim,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowNextPercentileModal(false)}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: nextPercentileSlideAnim }],
              },
            ]}
          >
            {/* Handle Bar */}
            <View
              style={styles.handleContainer}
              {...nextPercentileModalPanResponder.panHandlers}
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
              {...nextPercentileModalPanResponder.panHandlers}
            >
              <Text style={styles.modalTitle}>
                {selectedRanking?.exerciseName}
              </Text>
            </View>

            <ScrollView
              ref={nextPercentileScrollViewRef}
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              bounces={true}
              onScroll={(event) => {
                nextPercentileScrollOffsetRef.current =
                  event.nativeEvent.contentOffset.y
              }}
              scrollEventThrottle={16}
            >
              {selectedRanking && (
                <>
                  {/* Current Status */}
                  <View style={styles.currentStatusContainer}>
                    <Text style={styles.currentStatusLabel}>Current</Text>
                    <Text style={styles.currentStatusValue}>
                      {(() => {
                        const hasWeightClass =
                          selectedRanking.genderWeightPercentile != null
                        const displayPercentile =
                          rankingMode === 'weight' && hasWeightClass
                            ? selectedRanking.genderWeightPercentile!
                            : selectedRanking.genderPercentile ??
                              selectedRanking.percentile
                        return `${displayPercentile}th percentile`
                      })()}
                    </Text>
                    <Text style={styles.currentWeightValue}>
                      {formatWeight(selectedRanking.userMax1RM, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>

                  {/* Next Bracket */}
                  {nextPercentileData && (
                    <View style={styles.nextBracketContainer}>
                      <Text style={styles.sectionTitle}>Next Bracket</Text>
                      <View style={styles.bracketInfo}>
                        <Text style={styles.bracketPercentile}>
                          {nextPercentileData.targetPercentile}th percentile
                        </Text>
                        {nextPercentileData.isLoading ? (
                          <View style={styles.loadingWeight}>
                            <ActivityIndicator
                              size="small"
                              color={colors.primary}
                            />
                            <Text style={styles.loadingText}>
                              Calculating...
                            </Text>
                          </View>
                        ) : nextPercentileData.weightNeeded ? (
                          (() => {
                            const weightDifference =
                              nextPercentileData.weightNeeded -
                              selectedRanking.userMax1RM
                            const isAlreadyThere = weightDifference <= 0
                            const isTopPercentile =
                              (() => {
                                const hasWeightClass =
                                  selectedRanking.genderWeightPercentile != null
                                const displayPercentile =
                                  rankingMode === 'weight' && hasWeightClass
                                    ? selectedRanking.genderWeightPercentile!
                                    : selectedRanking.genderPercentile ??
                                      selectedRanking.percentile
                                return displayPercentile >= 95
                              })()

                            if (isTopPercentile) {
                              return (
                                <>
                                  <View style={styles.celebrationContainer}>
                                    <Ionicons
                                      name="trophy"
                                      size={32}
                                      color="#FFD700"
                                    />
                                    <Text style={styles.celebrationText}>
                                      Elite Status! 🎉
                                    </Text>
                                    <Text style={styles.celebrationSubtext}>
                                      You're in the top tier of lifters
                                    </Text>
                                  </View>
                                  {nextPercentileData.targetPercentile === 100 && (
                                    <Text style={styles.weightNeededValue}>
                                      {formatWeight(
                                        nextPercentileData.weightNeeded,
                                        {
                                          maximumFractionDigits: 0,
                                        },
                                      )}
                                    </Text>
                                  )}
                                </>
                              )
                            }

                            if (isAlreadyThere) {
                              return (
                                <>
                                  <View style={styles.alreadyThereContainer}>
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={32}
                                      color={colors.primary}
                                    />
                                    <Text style={styles.alreadyThereText}>
                                      You're already there! 🎯
                                    </Text>
                                    <Text style={styles.alreadyThereSubtext}>
                                      Keep pushing to maintain your position
                                    </Text>
                                  </View>
                                </>
                              )
                            }

                            return (
                              <>
                                <Text style={styles.weightNeededLabel}>
                                  You need to lift:
                                </Text>
                                <Text style={styles.weightNeededValue}>
                                  {formatWeight(nextPercentileData.weightNeeded, {
                                    maximumFractionDigits: 0,
                                  })}
                                </Text>
                                <Text style={styles.weightDifference}>
                                  +{formatWeight(weightDifference, {
                                    maximumFractionDigits: 0,
                                  })}{' '}
                                  more
                                </Text>
                              </>
                            )
                          })()
                        ) : (
                          <Text style={styles.errorText}>
                            Unable to calculate weight needed
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Tier Breakdown */}
                  {(() => {
                    if (!selectedRanking) return null

                    const hasWeightClass =
                      selectedRanking.genderWeightPercentile != null
                    const currentPercentile =
                      rankingMode === 'weight' && hasWeightClass
                        ? selectedRanking.genderWeightPercentile!
                        : selectedRanking.genderPercentile ??
                          selectedRanking.percentile

                    const tiers = [
                      {
                        range: '0-49th',
                        label: 'Developing',
                        description: 'Building your foundation',
                        color: colors.textSecondary,
                        min: 0,
                        max: 50,
                      },
                      {
                        range: '50-74th',
                        label: 'Strong',
                        description: 'Stronger than most',
                        color: colors.primary,
                        min: 50,
                        max: 75,
                      },
                      {
                        range: '75-89th',
                        label: 'Advanced',
                        description: 'Top tier strength',
                        color: '#CD7F32',
                        min: 75,
                        max: 90,
                      },
                      {
                        range: '90-94th',
                        label: 'Elite',
                        description: 'Exceptional strength',
                        color: '#C0C0C0',
                        min: 90,
                        max: 95,
                      },
                      {
                        range: '95-100th',
                        label: 'Elite+',
                        description: 'Peak performance',
                        color: '#FFD700',
                        min: 95,
                        max: 101,
                      },
                    ]

                    return (
                      <View style={styles.tierBreakdownContainer}>
                        <Text style={styles.tierBreakdownTitle}>
                          Percentile Tiers
                        </Text>
                        <View style={styles.tierList}>
                          {tiers.map((tier) => {
                            const isCurrent =
                              currentPercentile >= tier.min &&
                              currentPercentile < tier.max
                            return (
                              <View
                                key={tier.range}
                                style={[
                                  styles.tierRow,
                                  isCurrent && styles.tierRowCurrent,
                                ]}
                              >
                                <View style={styles.tierRowLeft}>
                                  <View
                                    style={[
                                      styles.tierIndicator,
                                      { backgroundColor: tier.color },
                                    ]}
                                  />
                                  <View style={styles.tierRowText}>
                                    <Text
                                      style={[
                                        styles.tierLabel,
                                        isCurrent && styles.tierLabelCurrent,
                                      ]}
                                    >
                                      {tier.range} - {tier.label}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.tierDescription,
                                        isCurrent &&
                                          styles.tierDescriptionCurrent,
                                      ]}
                                    >
                                      {tier.description}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            )
                          })}
                        </View>
                      </View>
                    )
                  })()}

                  {/* Tips */}
                  {(() => {
                    if (!nextPercentileData || !selectedRanking) return null

                    const hasWeightClass =
                      selectedRanking.genderWeightPercentile != null
                    const displayPercentile =
                      rankingMode === 'weight' && hasWeightClass
                        ? selectedRanking.genderWeightPercentile!
                        : selectedRanking.genderPercentile ??
                          selectedRanking.percentile
                    const isTopPercentile = displayPercentile >= 95
                    const weightDifference =
                      nextPercentileData.weightNeeded &&
                      selectedRanking.userMax1RM
                        ? nextPercentileData.weightNeeded -
                          selectedRanking.userMax1RM
                        : null
                    const isAlreadyThere =
                      weightDifference !== null && weightDifference <= 0

                    // Don't show tips if already at top percentile or already there
                    if (isTopPercentile || isAlreadyThere) {
                      return null
                    }

                    return (
                      <View style={styles.tipsContainer}>
                        <Text style={styles.sectionTitle}>How to get there</Text>
                        <Text style={styles.sectionText}>
                          <Text style={styles.sectionBold}>
                            Progressive Overload:
                          </Text>{' '}
                          Add 2.5-5kg each week to your working sets{'\n'}
                          <Text style={styles.sectionBold}>Volume:</Text> Aim for
                          3-5 sets of 3-6 reps at 85-90% of your max{'\n'}
                          <Text style={styles.sectionBold}>Form:</Text> Focus on
                          clean, controlled reps to maximize strength gains{'\n'}
                          <Text style={styles.sectionBold}>Recovery:</Text> Ensure
                          adequate rest between heavy sessions
                        </Text>
                      </View>
                    )
                  })()}
                </>
              )}
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
  onPress?: () => void
}

function RankingRow({
  ranking,
  animatedValue,
  colors,
  isFirst = false,
  isCompact = false,
  rankingMode,
  onPress,
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

  const content = (
    <>
      {/* Exercise Info */}
      <View style={styles.exerciseInfo}>
        <View style={styles.exerciseHeader}>
          <Text
            style={[styles.exerciseName, isFirst && styles.firstExerciseName]}
          >
            {ranking.exerciseName}
          </Text>
          <Text style={styles.weightInfo}>
            {formatWeight(ranking.userMax1RM, { maximumFractionDigits: 0 })}
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
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.rankingRow, isCompact && styles.rankingRowCompact]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.rankingRow, isCompact && styles.rankingRowCompact]}>
      {content}
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
    currentStatusContainer: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      alignItems: 'center',
    },
    currentStatusLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    currentStatusValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    currentWeightValue: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primary,
    },
    nextBracketContainer: {
      marginBottom: 20,
    },
    bracketInfo: {
      backgroundColor: colors.primaryLight + '20',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primaryLight,
    },
    bracketPercentile: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 12,
    },
    weightNeededLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    weightNeededValue: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    weightDifference: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    loadingWeight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    errorText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    tipsContainer: {
      marginTop: 8,
    },
    celebrationContainer: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    celebrationText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFD700',
      marginTop: 8,
      marginBottom: 4,
    },
    celebrationSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    alreadyThereContainer: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    alreadyThereText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 8,
      marginBottom: 4,
    },
    alreadyThereSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    tierBreakdownContainer: {
      marginTop: 24,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border + '40',
    },
    tierBreakdownTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tierList: {
      gap: 8,
    },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: 'transparent',
    },
    tierRowCurrent: {
      backgroundColor: colors.primaryLight + '15',
    },
    tierRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    tierIndicator: {
      width: 4,
      height: 32,
      borderRadius: 2,
      marginRight: 12,
    },
    tierRowText: {
      flex: 1,
    },
    tierLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    tierLabelCurrent: {
      color: colors.text,
      fontWeight: '700',
    },
    tierDescription: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    tierDescriptionCurrent: {
      color: colors.textSecondary,
    },
  })

import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { memo, useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
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
}

interface ExerciseLeaderboardCardProps {
  userId: string
  refreshTrigger?: number
}

/**
 * Exercise leaderboard card showing user's percentile rankings.
 * Features sleek modern design with animated progress bars and tier badges.
 */
export const ExerciseLeaderboardCard = memo(function ExerciseLeaderboardCard({
  userId,
  refreshTrigger = 0,
}: ExerciseLeaderboardCardProps) {
  const [rankings, setRankings] = useState<LeaderboardRanking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [animatedValues] = useState(() => new Map<string, Animated.Value>())
  const colors = useThemedColors()
  const { formatWeight } = useWeightUnits()

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

  const getTierInfo = (percentile: number) => {
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

  const topRankings = rankings.slice(0, 3)
  const remainingRankings = rankings.slice(3)
  const shouldShowExpand = rankings.length > 3

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
                Your percentile among all users
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
                Your percentile among all users
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
            <Text style={styles.subtitle}>Your percentile among all users</Text>
          </View>
        </View>
        {shouldShowExpand && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setIsExpanded(!isExpanded)
            }}
          >
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
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
    </View>
  )
})

interface RankingRowProps {
  ranking: LeaderboardRanking
  animatedValue: Animated.Value
  colors: ReturnType<typeof useThemedColors>
  isFirst?: boolean
  isCompact?: boolean
}

function RankingRow({
  ranking,
  animatedValue,
  colors,
  isFirst = false,
  isCompact = false,
}: RankingRowProps) {
  const { formatWeight } = useWeightUnits()
  const tierInfo = getTierInfo(ranking.percentile)
  const styles = createStyles(colors)

  // Format the animated percentile value
  const [displayPercentile, setDisplayPercentile] = useState(
    `${ranking.percentile}th`,
  )

  useEffect(() => {
    // Set initial value
    setDisplayPercentile(`${ranking.percentile}th`)

    const listener = animatedValue.addListener(({ value }) => {
      const roundedValue = Math.round(value)
      setDisplayPercentile(`${roundedValue}th`)
    })

    return () => animatedValue.removeListener(listener)
  }, [animatedValue, ranking.percentile])

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
            {displayPercentile}
          </Text>
        </View>
      </View>
    </View>
  )
}

function getTierInfo(percentile: number) {
  if (percentile >= 95)
    return { tier: 'Elite', color: '#FFD700', icon: 'trophy' as const }
  if (percentile >= 90)
    return { tier: 'Top 10%', color: '#C0C0C0', icon: 'medal' as const }
  if (percentile >= 75)
    return { tier: 'Top 25%', color: '#CD7F32', icon: 'ribbon' as const }
  if (percentile >= 50)
    return { tier: 'Top 50%', color: '#4ECDC4', icon: 'trending-up' as const }
  return { tier: 'Developing', color: '#94A3B8', icon: 'fitness' as const }
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
    },
    expandButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.backgroundLight,
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
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
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
  })

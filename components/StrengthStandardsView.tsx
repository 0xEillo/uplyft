import { Paywall } from '@/components/paywall'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import {
  getStandardsLadder,
  getStrengthStandard,
  hasStrengthStandards,
  type StrengthLevel,
} from '@/lib/strength-standards'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ExerciseRecord {
  weight: number
  maxReps: number
  date: string
  estimated1RM: number
}

interface ExerciseData {
  exerciseId: string
  exerciseName: string
  max1RM: number
  records: ExerciseRecord[]
}

const LEVEL_ORDER: StrengthLevel[] = [
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

const LEVEL_SCORES: Record<StrengthLevel, number> = {
  Beginner: 1,
  Novice: 2,
  Intermediate: 3,
  Advanced: 4,
  Elite: 5,
  'World Class': 6,
}

export function StrengthStandardsView() {
  const { user } = useAuth()
  const { isProMember } = useSubscription()
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exerciseData, setExerciseData] = useState<ExerciseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set(),
  )
  const [paywallVisible, setPaywallVisible] = useState(false)

  const loadData = useCallback(async () => {
    if (!user?.id) return

    try {
      // Load profile data
      const profileData = await database.profiles.getById(user.id)
      setProfile(profileData)

      // Load exercise data
      const data = await database.stats.getMajorCompoundLiftsData(user.id)
      // Sort by max1RM descending
      const sorted = data.sort((a, b) => b.max1RM - a.max1RM)
      setExerciseData(sorted)
    } catch (error) {
      console.error('Error loading strength stats:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  const toggleExercise = useCallback((exerciseId: string) => {
    setExpandedExercises((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) {
        next.delete(exerciseId)
      } else {
        next.add(exerciseId)
      }
      return next
    })
  }, [])

  const navigateToExercise = useCallback(
    (exerciseId: string) => {
      router.push({
        pathname: '/exercise/[exerciseId]',
        params: { exerciseId },
      })
    },
    [router],
  )

  const getStrengthInfo = useCallback(
    (exerciseName: string, max1RM: number) => {
      if (!profile?.gender || !profile?.weight_kg) {
        return null
      }

      if (!hasStrengthStandards(exerciseName)) {
        return null
      }

      return getStrengthStandard(
        exerciseName,
        profile.gender as 'male' | 'female',
        profile.weight_kg,
        max1RM,
      )
    },
    [profile?.gender, profile?.weight_kg],
  )

  const overallLevel = useMemo(() => {
    if (!profile?.gender || !profile?.weight_kg || exerciseData.length === 0) {
      return null
    }

    let totalScore = 0
    let count = 0

    exerciseData.forEach((exercise) => {
      const info = getStrengthInfo(exercise.exerciseName, exercise.max1RM)
      if (info) {
        const baseScore = LEVEL_SCORES[info.level]
        // progress is 0-100, we want 0-1 added to base score
        const exactScore = baseScore + info.progress / 100
        totalScore += exactScore
        count++
      }
    })

    if (count === 0) return null

    const averageScore = totalScore / count
    const levelIndex = Math.floor(averageScore) - 1
    const currentLevel =
      LEVEL_ORDER[Math.max(0, Math.min(levelIndex, LEVEL_ORDER.length - 1))]
    const nextLevel =
      LEVEL_ORDER[Math.min(levelIndex + 1, LEVEL_ORDER.length - 1)]

    // Calculate progress to next level (fractional part of averageScore)
    const progress =
      averageScore >= 6 ? 100 : (averageScore - Math.floor(averageScore)) * 100

    return {
      currentLevel,
      nextLevel: currentLevel === 'World Class' ? null : nextLevel,
      progress,
      liftsTracked: count,
    }
  }, [exerciseData, profile, getStrengthInfo])

  const getLevelColor = (level: StrengthLevel): string => {
    const levelColors = {
      Beginner: '#9CA3AF',
      Novice: '#3B82F6',
      Intermediate: '#10B981',
      Advanced: '#8B5CF6',
      Elite: '#F59E0B',
      'World Class': '#EF4444',
    }
    return levelColors[level]
  }

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading strength data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: 100 + insets.bottom }, // Extra padding for tab bar
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Overall Level Hero Card */}
          {overallLevel && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>LIFTER LEVEL</Text>
              </View>
              <TouchableOpacity 
                style={[styles.heroCard, !isProMember && styles.heroCardLocked]}
                onPress={() => !isProMember && setPaywallVisible(true)}
                activeOpacity={isProMember ? 1 : 0.7}
              >
                {isProMember ? (
                  <>
                    <View style={styles.heroContent}>
                      <View style={styles.heroLeft}>
                        <Text style={styles.heroLevel}>
                          {overallLevel.currentLevel}
                        </Text>
                      </View>
                    </View>
                    {overallLevel.nextLevel && (
                      <View style={styles.heroProgress}>
                        <View style={styles.heroProgressLabels}>
                          <Text style={styles.heroProgressCurrent}>
                            {overallLevel.currentLevel}
                          </Text>
                          <Text style={styles.heroProgressNext}>
                            {overallLevel.nextLevel}
                          </Text>
                        </View>
                        <View style={styles.heroProgressBar}>
                          <View
                            style={[
                              styles.heroProgressFill,
                              {
                                width: `${overallLevel.progress}%`,
                                backgroundColor: colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.heroProgressPercent}>
                          {Math.round(overallLevel.progress)}% to next level
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.lockedHeroContainer}>
                    <View style={[styles.lockedHeroBlur, { backgroundColor: colors.feedCardBackground + 'E0' }]} />
                    <View style={styles.lockedHeroContent}>
                      <View style={styles.lockedIconCircle}>
                        <Ionicons name="lock-closed" size={24} color={colors.primary} />
                      </View>
                      <Text style={styles.unlockTitle}>Unlock Lifter Level</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>YOUR LIFTS</Text>
          </View>

          {/* Exercise Cards */}
          {exerciseData.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons
                  name="barbell-outline"
                  size={48}
                  color={colors.textPlaceholder}
                />
              </View>
              <Text style={styles.emptyTitle}>No compound lifts yet</Text>
              <Text style={styles.emptySubtitle}>
                Start tracking exercises like bench press, squat, and deadlift
                to see your strength standards
              </Text>
            </View>
          ) : (
            exerciseData.map((exercise, index) => {
              const strengthInfo = getStrengthInfo(
                exercise.exerciseName,
                exercise.max1RM,
              )
              const isExpanded = expandedExercises.has(exercise.exerciseId)
              const allLevels = profile?.gender
                ? getStandardsLadder(
                    exercise.exerciseName,
                    profile.gender as 'male' | 'female',
                  )
                : null

              return (
                <View
                  key={exercise.exerciseId}
                  style={[
                    styles.exerciseCard,
                    index === exerciseData.length - 1 && styles.lastCard,
                  ]}
                >
                  {/* Exercise Header */}
                  <TouchableOpacity
                    style={styles.exerciseHeader}
                    onPress={() => navigateToExercise(exercise.exerciseId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exerciseMain}>
                      <Text style={styles.exerciseName}>
                        {exercise.exerciseName}
                      </Text>
                      <View style={styles.exerciseStats}>
                        <Text style={styles.exerciseStatValue}>
                          {formatWeight(exercise.max1RM, {
                            maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                          })}
                        </Text>
                        <Text style={styles.exerciseStatLabel}>1RM</Text>
                      </View>
                    </View>

                    <View style={styles.exerciseRight}>
                      {strengthInfo && !isProMember ? (
                        <TouchableOpacity 
                          style={styles.lockedBadge}
                          onPress={() => setPaywallVisible(true)}
                        >
                          <Ionicons name="lock-closed" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      ) : strengthInfo ? (
                        <View
                          style={[
                            styles.levelBadge,
                            {
                              backgroundColor: getLevelColor(strengthInfo.level),
                            },
                          ]}
                        >
                          <Text style={styles.levelBadgeText}>
                            {strengthInfo.level}
                          </Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation()
                          toggleExercise(exercise.exerciseId)
                        }}
                        style={styles.expandButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Content: All Standards */}
                  {isExpanded && allLevels && profile?.weight_kg && (
                    <>
                      {/* Progress bar for current level */}
                      {strengthInfo && isProMember && (
                        <View style={styles.exerciseProgressContainer}>
                          <View style={styles.exerciseProgressBar}>
                            <View
                              style={[
                                styles.exerciseProgressFill,
                                {
                                  width: `${strengthInfo.progress}%`,
                                  backgroundColor: colors.primary,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      )}
                    <View style={styles.expandedContent}>
                      <View style={styles.standardsGrid}>
                        {allLevels.map((levelStandard, idx) => {
                          const targetWeight = Math.ceil(
                            (profile.weight_kg || 0) * levelStandard.multiplier,
                          )
                          // Only show current level / passed status if PRO
                          const isCurrentLevel =
                            isProMember && strengthInfo?.level === levelStandard.level
                          const isPassed =
                            isProMember && strengthInfo
                              ? allLevels.findIndex(
                                  (l) => l.level === strengthInfo.level,
                                ) >= idx
                              : false

                          return (
                            <View
                              key={levelStandard.level}
                              style={[
                                styles.standardRow,
                                idx === allLevels.length - 1 &&
                                  styles.standardRowLast,
                              ]}
                            >
                              <View style={styles.standardLeft}>
                                <View
                                  style={[
                                    styles.standardIndicator,
                                    {
                                      backgroundColor: isPassed
                                        ? getLevelColor(levelStandard.level)
                                        : colors.backgroundLight,
                                      borderColor: getLevelColor(
                                        levelStandard.level,
                                      ),
                                    },
                                  ]}
                                >
                                  {isPassed && (
                                    <Ionicons
                                      name="checkmark"
                                      size={10}
                                      color="#FFF"
                                    />
                                  )}
                                </View>
                                <View style={styles.standardInfo}>
                                  <Text
                                    style={[
                                      styles.standardLevel,
                                      isCurrentLevel && {
                                        color: getLevelColor(
                                          levelStandard.level,
                                        ),
                                      },
                                    ]}
                                  >
                                    {levelStandard.level}
                                  </Text>
                                  <Text style={styles.standardDesc}>
                                    {levelStandard.description}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.standardRight}>
                                {isProMember ? (
                                  <Text
                                    style={[
                                      styles.standardWeight,
                                      isCurrentLevel && {
                                        color: getLevelColor(
                                          levelStandard.level,
                                        ),
                                      },
                                    ]}
                                  >
                                    {formatWeight(targetWeight, {
                                      maximumFractionDigits:
                                        weightUnit === 'kg' ? 0 : 0,
                                    })}
                                  </Text>
                                ) : (
                                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.6}}>
                                    <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>PRO</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                    </>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* Paywall Modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        title="Unlock Strength Standards"
        message="See your strength level for each lift and track your progress towards Elite."
      />
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: colors.textSecondary,
    },

    // Hero Card
    heroCard: {
      backgroundColor: colors.feedCardBackground,
      marginHorizontal: 0,
      marginBottom: 2,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    heroContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    heroLeft: {
      flex: 1,
    },
    heroLevel: {
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: colors.text,
    },
    heroProgress: {
      marginTop: 20,
    },
    heroProgressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    heroProgressCurrent: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    heroProgressNext: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    heroProgressBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    heroProgressFill: {
      height: '100%',
      borderRadius: 3,
    },
    heroProgressPercent: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 6,
      textAlign: 'center',
    },

    // Locked Hero
    heroCardLocked: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      overflow: 'hidden',
      minHeight: 140,
    },
    lockedHeroContainer: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    lockedHeroBlur: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    lockedHeroContent: {
      alignItems: 'center',
      zIndex: 2,
      position: 'relative',
    },
    lockedIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    unlockTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    unlockSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    // Redacted / Locked Elements
    redactedContainer: {
      justifyContent: 'center',
      gap: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    redactedLine: {
      width: 60,
      height: 16,
      backgroundColor: colors.border,
      borderRadius: 4,
    },
    lockedBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },

    // Section Header
    sectionHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    sectionHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
    },

    // Exercise Cards
    exerciseCard: {
      backgroundColor: colors.feedCardBackground,
      marginBottom: 2,
    },
    lastCard: {
      marginBottom: 0,
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    exerciseMain: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    exerciseStats: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    exerciseStatValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: -0.5,
    },
    exerciseStatLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    exerciseRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    levelBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    levelBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    expandButton: {
      padding: 4,
    },

    // Exercise Progress
    exerciseProgressContainer: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    exerciseProgressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    exerciseProgressFill: {
      height: '100%',
      borderRadius: 2,
    },

    // Expanded Content
    expandedContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    standardsGrid: {
      gap: 0,
    },
    standardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    standardRowLast: {
      borderBottomWidth: 0,
    },
    standardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    standardIndicator: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    standardInfo: {
      flex: 1,
    },
    standardLevel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    standardDesc: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    standardRight: {
      marginLeft: 12,
    },
    standardWeight: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  })

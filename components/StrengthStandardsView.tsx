import { LevelBadge } from '@/components/LevelBadge'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { getExerciseGroup, type ExerciseGroup } from '@/lib/exercise-standards-config'
import {
    getStrengthStandard,
    hasStrengthStandards,
    type StrengthLevel
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
    View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'

interface ExerciseRecord {
  weight: number
  maxReps: number
  date: string
  estimated1RM: number
}

interface ExerciseData {
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  max1RM: number
  records: ExerciseRecord[]
}

interface MuscleGroupData {
  name: string
  level: StrengthLevel
  progress: number
  exercises: ExerciseData[]
  averageScore: number
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



const ProgressRing = ({
  progress,
  size = 32,
  strokeWidth = 3,
  color,
  trackColor,
  children,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color: string
  trackColor: string
  children?: React.ReactNode
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  )
}

export function StrengthStandardsView() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exerciseData, setExerciseData] = useState<ExerciseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showLevelsSheet, setShowLevelsSheet] = useState(false)

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

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
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

    const groupTotals: Record<ExerciseGroup | string, { total: number; count: number }> = {
      'Upper Push': { total: 0, count: 0 },
      'Upper Pull': { total: 0, count: 0 },
      'Lower': { total: 0, count: 0 },
    }

    exerciseData.forEach((exercise) => {
      const info = getStrengthInfo(exercise.exerciseName, exercise.max1RM)
      if (info) {
        const baseScore = LEVEL_SCORES[info.level]
        // progress is 0-100, we want 0-1 added to base score
        const exactScore = baseScore + info.progress / 100
        totalScore += exactScore
        count++

        const group = getExerciseGroup(exercise.exerciseName)
        if (group in groupTotals) {
          groupTotals[group].total += exactScore
          groupTotals[group].count++
        }
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

    // Calculate Balanced Level (Harmonic Mean of group averages)
    // This penalizes neglect of major groups (e.g. strong upper, weak legs)
    const validGroups = Object.entries(groupTotals)
      .filter(([_, data]) => data.count > 0)
      .map(([name, data]) => ({
        name,
        average: data.total / data.count,
      }))

    let balancedScore = 0
    let balancedLevel: StrengthLevel = currentLevel
    let weakestGroup: string | null = null

    if (validGroups.length > 0) {
      // Harmonic mean: n / (1/x1 + 1/x2 + ... + 1/xn)
      const denominator = validGroups.reduce(
        (sum, g) => sum + 1 / g.average,
        0,
      )
      balancedScore = validGroups.length / denominator

      // Find weakest group
      const weakest = validGroups.reduce(
        (min, g) => (g.average < min.average ? g : min),
        validGroups[0],
      )
      
      const strongest = validGroups.reduce(
        (max, g) => (g.average > max.average ? g : max),
        validGroups[0],
      )

      // Only flag as weak if it's significantly dragging down the score (>= 1 full level difference)
      if (strongest.average - weakest.average >= 1.0) {
        weakestGroup = weakest.name
      }

      const balancedIndex = Math.floor(balancedScore) - 1
      balancedLevel =
        LEVEL_ORDER[Math.max(0, Math.min(balancedIndex, LEVEL_ORDER.length - 1))]
    }

    const balancedProgress =
        balancedScore >= 6 ? 100 : (balancedScore - Math.floor(balancedScore)) * 100
    
    const balancedLevelIndex = LEVEL_ORDER.indexOf(balancedLevel)
    const balancedNextLevel = 
        balancedLevelIndex < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[balancedLevelIndex + 1] : null

    return {
      currentLevel,
      nextLevel: currentLevel === 'World Class' ? null : nextLevel,
      progress,
      liftsTracked: count,
      balancedLevel,
      balancedNextLevel,
      balancedProgress,
      balancedScore,
      weakestGroup,
    }
  }, [exerciseData, profile, getStrengthInfo])

  const muscleGroups = useMemo(() => {
    if (!profile?.gender || !profile?.weight_kg || exerciseData.length === 0) {
      return []
    }

    const groups = new Map<string, ExerciseData[]>()
    
    // Group exercises
    exerciseData.forEach((exercise) => {
      const groupName = exercise.muscleGroup || 'Other'
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)?.push(exercise)
    })

    // Calculate stats for each group
    const result: MuscleGroupData[] = []

    groups.forEach((exercises, name) => {
      let totalScore = 0
      let count = 0

      exercises.forEach((exercise) => {
        const info = getStrengthInfo(exercise.exerciseName, exercise.max1RM)
        if (info) {
          const baseScore = LEVEL_SCORES[info.level]
          const exactScore = baseScore + info.progress / 100
          totalScore += exactScore
          count++
        }
      })

      if (count > 0) {
        const averageScore = totalScore / count
        const levelIndex = Math.floor(averageScore) - 1
        const currentLevel =
          LEVEL_ORDER[Math.max(0, Math.min(levelIndex, LEVEL_ORDER.length - 1))]
        
        const progress =
          averageScore >= 6 ? 100 : (averageScore - Math.floor(averageScore)) * 100

        result.push({
          name,
          level: currentLevel,
          progress,
          exercises,
          averageScore,
        })
      }
    })

    // Sort by average score descending
    return result.sort((a, b) => b.averageScore - a.averageScore)
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
                style={styles.heroCard}
                activeOpacity={0.9}
                onPress={() => setShowLevelsSheet(true)}
              >
                <View style={styles.heroContent}>
                  <View style={styles.heroLeft}>
                    <View style={styles.heroLevelContainer}>
                      <Text style={styles.heroLevel}>
                        {overallLevel.balancedLevel}
                      </Text>
                      {overallLevel.weakestGroup && (
                        <View
                          style={{
                            marginTop: 4,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons
                            name="warning-outline"
                            size={14}
                            color="#F59E0B"
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={{ color: colors.textSecondary, fontSize: 12 }}
                          >
                            Held back by {overallLevel.weakestGroup}
                          </Text>
                        </View>
                      )}
                    </View>
                    <LevelBadge
                      level={overallLevel.balancedLevel}
                      size="xl"
                      showTooltipOnPress={false}
                      style={styles.heroLevelImage}
                    />
                  </View>
                </View>
                {overallLevel.balancedNextLevel && (
                  <View style={styles.heroProgress}>
                    <View style={styles.heroProgressLabels}>
                      <Text style={styles.heroProgressCurrent}>
                        {overallLevel.balancedLevel}
                      </Text>
                      <Text style={styles.heroProgressNext}>
                        {overallLevel.balancedNextLevel}
                      </Text>
                    </View>
                    <View style={styles.heroProgressBar}>
                      <View
                        style={[
                          styles.heroProgressFill,
                          {
                            width: `${overallLevel.balancedProgress}%`,
                            backgroundColor: getLevelColor(
                              overallLevel.balancedLevel,
                            ),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.heroProgressPercent}>
                      {Math.round(overallLevel.balancedProgress)}% to next level
                    </Text>
                  </View>
                )}

                {overallLevel.currentLevel !== overallLevel.balancedLevel && (
                  <View
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Peak Potential
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: '600',
                          fontSize: 13,
                        }}
                      >
                        {overallLevel.currentLevel}
                      </Text>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: getLevelColor(
                            overallLevel.currentLevel,
                          ),
                        }}
                      />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>YOUR MUSCLES</Text>
          </View>

          {/* Muscle Groups */}
          {muscleGroups.length === 0 ? (
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
            muscleGroups.map((group) => {
              const isGroupExpanded = expandedGroups.has(group.name)
              
              return (
                <View key={group.name} style={styles.groupContainer}>
                  <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(group.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                    </View>
                    <View style={styles.groupRight}>
                      {!isGroupExpanded && (
                        <View
                          style={[
                            styles.levelBadge,
                            { backgroundColor: getLevelColor(group.level) },
                          ]}
                        >
                          <Text style={styles.levelBadgeText}>{group.level}</Text>
                        </View>
                      )}
                      
                      {group.level !== 'World Class' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {isGroupExpanded && (
                            <Text style={styles.groupProgressText}>
                              {Math.round(group.progress)}%
                            </Text>
                          )}
                          <ProgressRing
                            progress={group.progress}
                            size={32}
                            strokeWidth={3}
                            color={colors.primary}
                            trackColor={colors.border}
                          >
                            <Ionicons
                              name={isGroupExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </ProgressRing>
                        </View>
                      ) : (
                        <Ionicons
                          name={isGroupExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textSecondary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>

                  {isGroupExpanded && (
                    <View style={styles.groupContent}>
                      {group.exercises.map((exercise, index) => {
                        const strengthInfo = getStrengthInfo(
                          exercise.exerciseName,
                          exercise.max1RM,
                        )

                        return (
                          <View
                            key={exercise.exerciseId}
                            style={[
                              styles.exerciseCard,
                              index === group.exercises.length - 1 && styles.lastCard,
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
                                {strengthInfo ? (
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
                              </View>
                            </TouchableOpacity>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* Lifter Levels Sheet */}
      {overallLevel && (
        <LifterLevelsSheet
          isVisible={showLevelsSheet}
          onClose={() => setShowLevelsSheet(false)}
          currentLevel={overallLevel.balancedLevel}
          progressToNext={overallLevel.balancedProgress}
        />
      )}
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
      alignItems: 'center',
    },
    heroLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroLevelContainer: {
      flex: 1,
    },
    heroLevelImage: {
      // Dimensions handled by component size="xl"
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
    
    // Redacted / Locked Elements

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

    // Muscle Groups
    groupContainer: {
      backgroundColor: colors.feedCardBackground,
      marginBottom: 2,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    groupInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    groupName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    groupLevelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    groupRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    groupProgressText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    groupContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  })

import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import { SupportedExercisesSheet } from '@/components/SupportedExercisesSheet'
import {
  getLevelColor,
  getLevelIntensity,
  useStrengthData
} from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getStandardsLadder, type StrengthStandard } from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
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
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'

// Helper to lighten a hex color (copied from LevelBadge for consistency)
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const B = ((num >> 8) & 0x00ff) + amt
  const G = (num & 0x00ff) + amt

  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 +
      (G < 255 ? (G < 1 ? 0 : G) : 255)
    )
      .toString(16)
      .slice(1)
  )
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
  const gradientId = `grad-${color.replace('#', '')}`

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop
              offset="1"
              stopColor={lightenColor(color, 40)}
              stopOpacity="1"
            />
          </LinearGradient>
        </Defs>
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
          stroke={`url(#${gradientId})`}
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
  const colors = useThemedColors()
  const { weightUnit, formatWeight } = useWeightUnits()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  
  const {
    isLoading,
    refreshing,
    onRefresh,
    overallLevel,
    muscleGroups,
    getStrengthInfo,
    exerciseData,
    profile,
  } = useStrengthData()

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showLevelsSheet, setShowLevelsSheet] = useState(false)
  const [showSupportedSheet, setShowSupportedSheet] = useState(false)

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

  // Compute tracked exercises with their level-up progression info
  const trackedExercisesWithProgress = useMemo(() => {
    if (!profile?.gender || !profile?.weight_kg || exerciseData.length === 0) {
      return []
    }

    return exerciseData.map((exercise) => {
      const strengthInfo = getStrengthInfo(exercise.exerciseName, exercise.max1RM)
      if (!strengthInfo) {
        return {
          ...exercise,
          level: null,
          progress: 0,
          nextLevel: null,
          targetWeight: null,
        }
      }

      // Get the standards ladder for this exercise
      const ladder = getStandardsLadder(
        exercise.exerciseName,
        profile.gender as 'male' | 'female'
      )
      
      let targetWeight: number | null = null
      if (ladder && strengthInfo.nextLevel) {
        // Find the multiplier for the next level
        const nextLevelName = strengthInfo.nextLevel.level
        const nextLevelStandard = ladder.find((s: StrengthStandard) => s.level === nextLevelName)
        if (nextLevelStandard && profile.weight_kg) {
          targetWeight = Math.ceil(profile.weight_kg * nextLevelStandard.multiplier)
        }
      }

      return {
        ...exercise,
        level: strengthInfo.level,
        progress: strengthInfo.progress,
        nextLevel: strengthInfo.nextLevel?.level || null,
        targetWeight,
      }
    }).filter(e => e.level !== null) // Only show exercises with standards
      .sort((a, b) => {
        const intensityA = getLevelIntensity(a.level!)
        const intensityB = getLevelIntensity(b.level!)
        if (intensityA !== intensityB) {
          return intensityB - intensityA
        }
        return b.progress - a.progress
      })
  }, [exerciseData, profile, getStrengthInfo])

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
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
              colors={[colors.brandPrimary]}
              tintColor={colors.brandPrimary}
            />
          }
        >
          {/* Overall Level Hero Card */}
          {overallLevel && (
            <View style={styles.heroSection}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroTitle}>Lifter Level</Text>
                {overallLevel.weakestGroup && (
                  <View style={styles.weakPointContainer}>
                    <Ionicons
                      name="warning"
                      size={14}
                      color={colors.statusWarning}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.weakPointText}>
                      Focus on {overallLevel.weakestGroup}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.heroCard}
                activeOpacity={0.9}
                onPress={() => setShowLevelsSheet(true)}
              >
                <View style={styles.heroMainContent}>
                  <View style={styles.heroLeftContent}>
                    <Text style={styles.heroLevelLabel}>Current Level</Text>
                    <Text style={styles.heroLevelValue}>
                      {overallLevel.balancedLevel}
                    </Text>
                    
                    {overallLevel.balancedNextLevel ? (
                      <View style={styles.heroNextLevelContainer}>
                        <Text style={styles.heroNextLevelText}>
                          {Math.round(overallLevel.balancedProgress)}% to {overallLevel.balancedNextLevel}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.heroNextLevelText}>Max Level Reached</Text>
                    )}
                  </View>

                  <View style={styles.heroRightContent}>
                    <LevelBadge
                      level={overallLevel.balancedLevel}
                      size="hero"
                      showTooltipOnPress={false}
                    />
                  </View>
                </View>

                {overallLevel.balancedNextLevel && (
                  <View style={styles.heroProgressBarContainer}>
                    <View style={styles.heroProgressBarBackground}>
                      <View
                        style={[
                          styles.heroProgressBarFill,
                          {
                            width: `${overallLevel.balancedProgress}%`,
                            backgroundColor: getLevelColor(overallLevel.balancedLevel),
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Your Exercises Section - Gamified Exercise Progress */}
          {trackedExercisesWithProgress.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>Your Exercises</Text>
                <View style={styles.exerciseCountBadge}>
                  <Text style={styles.exerciseCountText}>
                    {trackedExercisesWithProgress.length}
                  </Text>
                </View>
              </View>

              <View style={styles.exerciseCardsContainer}>
                {trackedExercisesWithProgress.map((exercise) => {
                  const levelColor = getLevelColor(exercise.level!)
                  return (
                    <TouchableOpacity
                      key={exercise.exerciseId}
                      style={styles.exerciseCard}
                      onPress={() => navigateToExercise(exercise.exerciseId)}
                      activeOpacity={0.7}
                    >
                      {/* Header: Thumbnail + Name + Badge */}
                      <View style={styles.cardHeader}>
                        <ExerciseMediaThumbnail
                          gifUrl={exercise.gifUrl}
                          style={styles.exerciseCardThumbnail}
                        />
                        <View style={styles.cardHeaderContent}>
                          <Text style={styles.exerciseCardName} numberOfLines={1}>
                            {exercise.exerciseName}
                          </Text>
                          <View style={styles.levelBadgeContainer}>
                            <LevelBadge level={exercise.level!} size="small" variant="pill" />
                          </View>
                        </View>
                      </View>

                      {/* Goal Bar Section */}
                      {exercise.targetWeight && exercise.nextLevel ? (
                        <View style={styles.goalSection}>
                          <View style={styles.goalLabels}>
                            <Text style={styles.currentWeightText}>
                              {formatWeight(exercise.max1RM, { maximumFractionDigits: 0 })}
                            </Text>
                            <Text style={styles.targetWeightText}>
                              {formatWeight(exercise.targetWeight, { maximumFractionDigits: 0 })}
                            </Text>
                          </View>

                          {/* The Bar */}
                          <View style={styles.goalBarBg}>
                            <View
                              style={[
                                styles.goalBarFill,
                                {
                                  width: `${Math.min(100, Math.max(5, exercise.progress))}%`,
                                  backgroundColor: levelColor,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.goalSection}>
                          <Text style={styles.maxReachedText}>Max Standards Reached</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          )}

          {/* Section Header - Strength Levels */}
          <View style={[styles.sectionHeader, trackedExercisesWithProgress.length > 0 && { marginTop: 24 }]}>
            <Text style={styles.sectionHeaderText}>Strength Levels</Text>
            <TouchableOpacity 
              onPress={() => setShowSupportedSheet(true)}
              style={styles.infoIcon}
            >
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
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
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setShowSupportedSheet(true)}
              >
                <Text style={styles.emptyButtonText}>View all supported exercises</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.muscleGroupsContainer}>
              {muscleGroups.map((group) => {
                const isGroupExpanded = expandedGroups.has(group.name)
                
                return (
                  <View key={group.name} style={styles.muscleGroupCard}>
                    <TouchableOpacity
                      style={styles.muscleGroupHeader}
                      onPress={() => toggleGroup(group.name)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.muscleGroupHeaderLeft}>
                        <View style={styles.muscleGroupIconContainer}>
                          <Ionicons 
                            name={group.name === 'Lower' ? 'body-outline' : 'barbell-outline'} 
                            size={24} 
                            color={colors.brandPrimary} 
                          />
                        </View>
                        <View>
                          <Text style={styles.muscleGroupName}>{group.name}</Text>
                          <Text style={styles.muscleGroupLevel}>{group.level}</Text>
                        </View>
                      </View>

                      <View style={styles.muscleGroupHeaderRight}>
                        <View style={styles.progressRingContainer}>
                          <ProgressRing
                            progress={group.progress}
                            size={44}
                            strokeWidth={4}
                            color={getLevelColor(group.level)}
                            trackColor={colors.border}
                          >
                            <Text style={[styles.progressRingText, { color: getLevelColor(group.level) }]}>
                              {Math.round(group.progress)}%
                            </Text>
                          </ProgressRing>
                        </View>
                        <Ionicons
                          name={isGroupExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textTertiary}
                          style={{ marginLeft: 12 }}
                        />
                      </View>
                    </TouchableOpacity>

                    {isGroupExpanded && (
                      <View style={styles.muscleGroupContent}>
                        {group.exercises.map((exercise, index) => {
                          const strengthInfo = getStrengthInfo(
                            exercise.exerciseName,
                            exercise.max1RM,
                          )

                          return (
                            <View
                              key={exercise.exerciseId}
                              style={[
                                styles.exerciseItem,
                                index === group.exercises.length - 1 && styles.lastExerciseItem,
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.exerciseRow}
                                onPress={() => navigateToExercise(exercise.exerciseId)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.exerciseInfo}>
                                  <Text style={styles.exerciseName}>
                                    {exercise.exerciseName}
                                  </Text>
                                  <Text style={styles.exerciseWeight}>
                                    {formatWeight(exercise.max1RM, {
                                      maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                                    })}
                                  </Text>
                                </View>

                                {strengthInfo ? (
                                  <View
                                    style={[
                                      styles.exerciseLevelBadge,
                                      { backgroundColor: getLevelColor(strengthInfo.level as any) },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.exerciseLevelText,
                                        { color: '#fff' },
                                      ]}
                                    >
                                      {strengthInfo.level}
                                    </Text>
                                  </View>
                                ) : null}
                              </TouchableOpacity>
                            </View>
                          )
                        })}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
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

      {/* Supported Exercises Sheet */}
      <SupportedExercisesSheet
        isVisible={showSupportedSheet}
        onClose={() => setShowSupportedSheet(false)}
      />
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
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

    // Hero Section
    heroSection: {
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 24,
    },
    heroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    heroTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    weakPointContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.statusWarning + '15',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    weakPointText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.statusWarning,
    },
    heroCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 12,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    },
    heroMainContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroLeftContent: {
      flex: 1,
      justifyContent: 'center',
    },
    heroRightContent: {
      marginLeft: 16,
    },
    heroLevelLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    heroLevelValue: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    heroNextLevelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroNextLevelText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    heroProgressBarContainer: {
      marginTop: 20,
    },
    heroProgressBarBackground: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    heroProgressBarFill: {
      height: '100%',
      borderRadius: 4,
    },

    // Locked Hero
    
    // Redacted / Locked Elements

    // Section Header
    sectionHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionHeaderText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    infoIcon: {
      padding: 4,
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
      backgroundColor: colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    emptyButton: {
      backgroundColor: colors.brandPrimary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },

    // Muscle Groups
    muscleGroupsContainer: {
      paddingHorizontal: 20,
      gap: 8,
    },
    muscleGroupCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      overflow: 'hidden',
    },
    muscleGroupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    muscleGroupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    muscleGroupIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    muscleGroupName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    muscleGroupLevel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    muscleGroupHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    progressRingContainer: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressRingText: {
      fontSize: 10,
      fontWeight: '700',
    },
    muscleGroupContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg + '50', // Slightly darker/different for contrast
    },
    exerciseItem: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lastExerciseItem: {
      borderBottomWidth: 0,
    },
    exerciseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    exerciseWeight: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    exerciseLevelBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.bg,
    },
    exerciseLevelText: {
      fontSize: 12,
      fontWeight: '700',
    },

    // Exercise Cards Section (Your Exercises)
    exerciseCountBadge: {
      backgroundColor: colors.brandPrimary + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    exerciseCountText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brandPrimary,
    },
    exerciseCardsContainer: {
      paddingHorizontal: 20,
      gap: 12,
    },
    exerciseCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 16,
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    exerciseCardThumbnail: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: colors.bg,
      overflow: 'hidden',
    },
    cardHeaderContent: {
      flex: 1,
      gap: 4,
    },
    exerciseCardName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    levelBadgeContainer: {
      alignSelf: 'flex-start',
    },
    
    // Goal Bar Styles
    goalSection: {
      gap: 8,
    },
    goalLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    currentWeightText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    targetWeightText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    goalBarBg: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    goalBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    goalSubLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    currentLabelText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    targetLabelText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    maxReachedText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
  })

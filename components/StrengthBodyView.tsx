import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import { useTheme } from '@/contexts/theme-context'
import {
  getLevelColor,
  getLevelIntensity,
  useStrengthData,
  type MuscleGroupData
} from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  BODY_PART_DISPLAY_NAMES,
  BODY_PART_TO_DATABASE_MUSCLE,
  type BodyPartSlug
} from '@/lib/body-mapping'
import { LEVEL_POINT_ANCHORS } from '@/lib/overall-strength-score'
import { getProgressDeltaPoints, getStrengthGender } from '@/lib/strength-progress'
import { getStandardsLadder, type StrengthLevel, type StrengthStandard } from '@/lib/strength-standards'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
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

const PROGRESS_DELTA_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000

export function StrengthBodyView({ embedded = false }: { embedded?: boolean } = {}) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { isDark } = useTheme()
  const {
    profile,
    isLoading,
    refreshing,
    onRefresh,
    overallLevel,
    muscleGroups,
    exerciseData,
    getStrengthInfo,
    best1RMSnapshotByExerciseId,
  } = useStrengthData()

  const [showLevelsSheet, setShowLevelsSheet] = useState(false)
  const strengthGender = getStrengthGender(profile?.gender)
  // Compute tracked exercises with their level-up progression info
  const trackedExercisesWithProgress = useMemo(() => {
    if (!strengthGender || !profile?.weight_kg || exerciseData.length === 0) {
      return []
    }

    const now = Date.now()

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
        strengthGender,
      )
      
      let targetWeight: number | null = null
      if (ladder && strengthInfo.nextLevel) {
        const nextLevelName = strengthInfo.nextLevel.level
        const nextLevelStandard = ladder.find((s: StrengthStandard) => s.level === nextLevelName)
        if (nextLevelStandard && profile.weight_kg) {
          targetWeight = Math.ceil(profile.weight_kg * nextLevelStandard.multiplier)
        }
      }

      const snapshot = best1RMSnapshotByExerciseId[exercise.exerciseId]
      const previousBest1RM = snapshot?.previousBest1RM ?? 0
      const previousStrengthInfo =
        previousBest1RM > 0
          ? getStrengthInfo(exercise.exerciseName, previousBest1RM)
          : null
      const progressDelta = getProgressDeltaPoints(
        previousStrengthInfo
          ? {
              level: previousStrengthInfo.level,
              progress: previousStrengthInfo.progress,
            }
          : null,
        {
          level: strengthInfo.level,
          progress: strengthInfo.progress,
        },
      )
      const lastIncreaseAt = snapshot?.lastIncreaseAt
      const lastIncreaseTime = lastIncreaseAt ? new Date(lastIncreaseAt).getTime() : NaN
      const showRecentProgressDelta =
        progressDelta > 0 &&
        Number.isFinite(lastIncreaseTime) &&
        now - lastIncreaseTime <= PROGRESS_DELTA_VISIBILITY_WINDOW_MS

      return {
        ...exercise,
        level: strengthInfo.level,
        progress: strengthInfo.progress,
        nextLevel: strengthInfo.nextLevel?.level || null,
        targetWeight,
        progressDelta,
        showRecentProgressDelta,
      }
    }).filter(e => e.level !== null)
      .sort((a, b) => {
        const intensityA = getLevelIntensity(a.level!)
        const intensityB = getLevelIntensity(b.level!)
        if (intensityA !== intensityB) {
          return intensityB - intensityA
        }
        return b.progress - a.progress
      })
  }, [
    best1RMSnapshotByExerciseId,
    exerciseData,
    getStrengthInfo,
    profile?.weight_kg,
    strengthGender,
  ])

  const showOverallProgressDelta = useMemo(() => {
    if (!overallLevel) return false
    const now = Date.now()
    const lastIncreaseTime = overallLevel.lastIncreaseAt 
      ? new Date(overallLevel.lastIncreaseAt).getTime() 
      : NaN
    
    return (
      overallLevel.progressDelta > 0 &&
      Number.isFinite(lastIncreaseTime) &&
      now - lastIncreaseTime <= PROGRESS_DELTA_VISIBILITY_WINDOW_MS
    )
  }, [overallLevel])

  // Navigate to exercise detail
  const navigateToExercise = useCallback(
    (exerciseId: string) => {
      router.push({
        pathname: '/exercise/[exerciseId]',
        params: { exerciseId },
      })
    },
    [router],
  )

  // Custom colors for the body highlighter based on strength levels
  // ARCHITECTURE NOTE:
  // The body highlighter library uses 1-based intensity to index the colors array.
  // Formula: Color Index = Intensity - 1
  // Index 0: Intensity 1 -> Unranked (Base Color)
  const bodyColors = useMemo(() => {
    // Unranked/Base color:
    // Dark Mode: #2A2A2A (Dark Gray)
    // Light Mode: #4A4A4A (Dark Gray - requested by user to be darker)
    const baseColor = isDark ? '#2A2A2A' : '#4A4A4A'

    return [
      baseColor, // Index 0 - Unranked (Intensity 1)
      '#9CA3AF', // Index 1 - Beginner (Intensity 2)
      '#3B82F6', // Index 2 - Novice (Intensity 3)
      '#10B981', // Index 3 - Intermediate (Intensity 4)
      '#8B5CF6', // Index 4 - Advanced (Intensity 5)
      '#F59E0B', // Index 5 - Elite (Intensity 6)
      '#EF4444', // Index 6 - World Class (Intensity 7)
    ]
  }, [isDark])

  // Generate body data for highlighting
  const bodyData = useMemo(() => {
    const data: {
      slug: BodyPartSlug
      intensity: number
      side?: 'left' | 'right'
    }[] = []

    // Map database muscle names to their data for easy lookup
    const muscleMap = new Map<string, MuscleGroupData>()
    muscleGroups.forEach((mg) => muscleMap.set(mg.name, mg))

    // Iterate over all supported body part slugs
    Object.entries(BODY_PART_TO_DATABASE_MUSCLE).forEach(([slug, dbMuscleName]) => {
      let mgData = muscleMap.get(dbMuscleName)

      // Smart fallbacks for posterior chain and legs to ensure the chart looks "complete"
      // based on the most relevant data available
      if (!mgData) {
        if (slug === 'gluteal' || slug === 'hamstring') {
          // If no specific Glute/Hamstring data, fallback to Lower Back (Deadlifts) or Quads (Squats)
          mgData = muscleMap.get('Lower Back') || muscleMap.get('Quads')
        } else if (slug === 'lower-back') {
          // If no Lower Back specific data, fallback to Back (Rows) or Glutes (Deadlifts/Squats)
          mgData = muscleMap.get('Back') || muscleMap.get('Glutes')
        } else if (slug === 'upper-back') {
          // If no Upper Back data, fallback to Traps or Lower Back
          mgData = muscleMap.get('Traps') || muscleMap.get('Lower Back')
        }
      }

      if (mgData) {
        data.push({
          slug: slug as BodyPartSlug,
          intensity: getLevelIntensity(mgData.level),
        })
      }
    })

    return data
  }, [muscleGroups])

  // Handle body part press - navigate to native formSheet
  const handleBodyPartPress = useCallback(
    (bodyPart: { slug?: string }, _side?: 'left' | 'right') => {
      if (!bodyPart.slug) return
      
      const slug = bodyPart.slug as BodyPartSlug
      const dbMuscleName = BODY_PART_TO_DATABASE_MUSCLE[slug]

      if (!dbMuscleName) {
        return
      }

      const mgData = muscleGroups.find((mg) => mg.name === dbMuscleName)
      const displayName = BODY_PART_DISPLAY_NAMES[slug] || slug

      // Build group data (with fallback for empty state)
      const groupData: MuscleGroupData = mgData || {
        name: dbMuscleName,
        level: 'Beginner',
        progress: 0,
        averageScore: 0,
        exercises: [],
      }

      
      // Navigate to native formSheet with params
      router.push({
        pathname: '/muscle-group-detail',
        params: {
          groupDisplayName: displayName,
          bodyPartSlug: slug,
          groupDataJson: JSON.stringify(groupData),
        },
      })
    },
    [muscleGroups, router],
  )

  const styles = createStyles(colors)

  // Determine gender for body display
  const bodyGender = profile?.gender === 'female' ? 'female' : 'male'

  // When embedded, render content without ScrollView wrapper
  const content = (
    <>

          {/* Body Section */}
          <View style={styles.bodySection}>

            {/* Side-by-Side Body Highlighter */}
            <BodyHighlighterDual
              bodyData={bodyData}
              gender={bodyGender}
              colors={bodyColors}
              onBodyPartPress={handleBodyPartPress}
            />

            {/* Integrated Legend Key - Directly under the chart */}
            <View style={styles.integratedLegend}>
              <View style={styles.legendGrid}>
                {(['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'World Class'] as StrengthLevel[]).map(
                  (level) => (
                    <LevelBadge 
                      key={level}
                      level={level}
                      variant="pill"
                      size="small"
                    />
                  ),
                )}
              </View>
            </View>

            {/* Overall Level Card - Gamified Rank */}
            {overallLevel && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Lifter Level</Text>
                </View>

                <TouchableOpacity
                  style={styles.levelCard}
                  activeOpacity={0.9}
                  onPress={() => setShowLevelsSheet(true)}
                >
                  <View style={styles.levelCardContent}>
                    <View style={styles.levelCardLeft}>
                      <Text style={styles.levelCardValue}>
                        {overallLevel.balancedLevel}
                      </Text>
                      <View style={styles.levelCardMetaRow}>
                        <View style={styles.pointsDisplay}>
                          <Text
                            style={[
                              styles.pointsCurrent,
                              { color: getLevelColor(overallLevel.balancedLevel) },
                            ]}
                          >
                            {Math.round(overallLevel.score)}
                          </Text>
                          {overallLevel.balancedNextLevel ? (
                            <>
                              <Text style={styles.pointsSlash}>/</Text>
                              <Text style={styles.pointsTotal}>
                                {LEVEL_POINT_ANCHORS[overallLevel.balancedNextLevel]}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.pointsTotal}> pts</Text>
                          )}
                        </View>
                        {showOverallProgressDelta && (
                          <Text style={styles.scoreDeltaText}>
                            ▲ {overallLevel.progressDelta}
                          </Text>
                        )}
                      </View>
                    </View>
                    <LevelBadge
                      level={overallLevel.balancedLevel}
                      size="hero"
                      showTooltipOnPress={false}
                    />
                  </View>
                </TouchableOpacity>
            </>
            )}

            {/* Your Exercises Section - Gamified Exercise Progress */}
            {trackedExercisesWithProgress.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Your Exercises</Text>
                </View>

                <View style={styles.exerciseCardsContainer}>
                  {trackedExercisesWithProgress.map((exercise) => {
                    const levelColor = getLevelColor(exercise.level!)
                    const gainColor = getLevelColor('Intermediate')
                    return (
                      <TouchableOpacity
                        key={exercise.exerciseId}
                        style={styles.exerciseCard}
                        onPress={() => navigateToExercise(exercise.exerciseId)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.exerciseInlineHeader}>
                          <ExerciseMediaThumbnail
                            gifUrl={exercise.gifUrl}
                            style={styles.exerciseCardThumbnail}
                          />
                          <View style={styles.exerciseInlineHeaderContent}>
                            <Text style={styles.exerciseCardName} numberOfLines={1}>
                              {exercise.exerciseName}
                            </Text>
                            <View style={styles.exerciseInlineProgressWrap}>
                              <View style={styles.exerciseInlineProgressTopRow}>
                                <View style={styles.exerciseInlineMetaRow}>
                                  <Text
                                    style={[
                                      styles.exerciseInlineLevelLabel,
                                      { color: levelColor },
                                    ]}
                                  >
                                    {exercise.level!}
                                  </Text>
                                  {exercise.showRecentProgressDelta && (
                                    <Text style={[styles.exerciseInlineGainText, { color: gainColor }]}>
                                      ▲ {exercise.progressDelta}%
                                    </Text>
                                  )}
                                </View>
                                <View style={styles.exerciseInlineProgressValueRow}>
                                  <Text style={[styles.exerciseInlineProgressPercent, { color: levelColor }]}>
                                    {Math.round(exercise.progress)}%
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.exerciseInlineBarTrack}>
                                <View
                                  style={[
                                    styles.exerciseInlineBarFill,
                                    {
                                      width: `${Math.max(0, Math.min(100, exercise.progress))}%`,
                                      backgroundColor: levelColor,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </>
            )}
          </View>
    </>
  )

  const modals = (
    <>
      {/* Lifter Levels Sheet */}
      {overallLevel && (
        <LifterLevelsSheet
          isVisible={showLevelsSheet}
          onClose={() => setShowLevelsSheet(false)}
          currentLevel={overallLevel.balancedLevel}
          score={overallLevel.score}
        />
      )}
    </>
  )

  if (embedded) {
    return (
      <>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Loading strength data...</Text>
          </View>
        ) : (
          content
        )}
        {modals}
      </>
    )
  }

  return (
    <View style={styles.container}>
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
            { paddingBottom: 100 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets
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
          {content}
        </ScrollView>
      )}
      {modals}
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

    // Level Card
    levelCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    levelCardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    levelCardLeft: {
      flex: 1,
      justifyContent: 'center',
    },
    levelCardValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    levelCardMetaRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    pointsDisplay: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    pointsCurrent: {
      fontSize: 24,
      fontWeight: '800',
      fontVariant: ['tabular-nums'] as any,
    },
    pointsSlash: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: 2,
    },
    pointsTotal: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'] as any,
    },
    scoreDeltaText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#10B981',
      fontVariant: ['tabular-nums'] as any,
    },
    weakPointContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    weakPointText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.statusWarning,
    },

    // Body Section - consistent 14px horizontal padding
    bodySection: {
      flex: 1,
      paddingHorizontal: 14,
      marginTop: -20,
    },

    // Legend
    integratedLegend: {
      marginTop: 8,
      marginBottom: 0,
      paddingHorizontal: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    legendGrid: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
    },
    legendItemCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDotSmall: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendTextCompact: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },

    // Section Header
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 32,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionHeaderText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },

    // Exercise Cards Section
    exerciseCardsContainer: {
      gap: 12,
    },
    exerciseCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    exerciseInlineHeader: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    exerciseCardThumbnail: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.bg,
      overflow: 'hidden',
    },
    exerciseInlineHeaderContent: {
      flex: 1,
      minHeight: 56,
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    exerciseInlineProgressWrap: {
      gap: 4,
    },
    exerciseInlineProgressTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    exerciseInlineMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    exerciseInlineLevelLabel: {
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    exerciseInlineGainText: {
      fontSize: 10,
      fontWeight: '700',
    },
    exerciseInlineProgressValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    exerciseInlineProgressPercent: {
      fontSize: 14,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    exerciseInlineBarTrack: {
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 999,
      overflow: 'hidden',
    },
    exerciseInlineBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    exerciseCardName: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
      color: colors.textPrimary,
    },
  })

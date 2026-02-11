import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import {
  getLevelColor,
  getLevelIntensity,
  useStrengthData,
  type MuscleGroupData
} from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
  BODY_PART_DISPLAY_NAMES,
  BODY_PART_TO_DATABASE_MUSCLE,
  type BodyPartSlug
} from '@/lib/body-mapping'
import { getStandardsLadder, type StrengthLevel, type StrengthStandard } from '@/lib/strength-standards'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useIsFocused } from '@react-navigation/native'
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
import Svg, { Circle } from 'react-native-svg'

const LIFTER_LEVEL_PROGRESS_KEY = '@lifter_level_progress_v1'
const LIFTER_EXERCISE_PROGRESS_KEY = '@lifter_exercise_progress_v1'


// Simple Progress Ring component for exercise cards
function ProgressRing({
  progress,
  size,
  strokeWidth,
  color,
  trackColor,
  children,
}: {
  progress: number
  size: number
  strokeWidth: number
  color: string
  trackColor: string
  children?: React.ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
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
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  )
}

export function StrengthBodyView({ embedded = false }: { embedded?: boolean } = {}) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { isDark } = useTheme()
  const { user } = useAuth()
  const isFocused = useIsFocused()
  const { weightUnit, formatWeight } = useWeightUnits()
  const {
    profile,
    isLoading,
    refreshing,
    onRefresh,
    overallLevel,
    muscleGroups,
    exerciseData,
    getStrengthInfo,
  } = useStrengthData()

  const [showLevelsSheet, setShowLevelsSheet] = useState(false)
  const [progressDelta, setProgressDelta] = useState<number | null>(null)
  const [exerciseProgressDeltas, setExerciseProgressDeltas] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!isFocused) {
      setProgressDelta(null)
      return
    }
    if (!user?.id || !overallLevel) return

    let isActive = true

    const syncProgressDelta = async () => {
      const currentProgress = Math.round(overallLevel.balancedProgress)
      const currentLevel = overallLevel.balancedLevel
      const storageKey = `${LIFTER_LEVEL_PROGRESS_KEY}:${user.id}`

      let nextDelta: number | null = null

      try {
        const storedValue = await AsyncStorage.getItem(storageKey)
        if (!isActive) return

        let previousProgress: number | null = null
        let previousLevel: StrengthLevel | null = null

        if (storedValue) {
          try {
            const parsed = JSON.parse(storedValue) as unknown
            if (typeof parsed === 'number') {
              previousProgress = parsed
            } else if (parsed && typeof parsed === 'object') {
              const data = parsed as { progress?: number; level?: string }
              if (typeof data.progress === 'number') {
                previousProgress = data.progress
              }
              if (typeof data.level === 'string') {
                previousLevel = data.level as StrengthLevel
              }
            }
          } catch (error) {
            console.warn('[StrengthBodyView] Failed to parse progress cache:', error)
          }
        }

        if (
          overallLevel.balancedNextLevel &&
          previousProgress !== null &&
          (!previousLevel || previousLevel === currentLevel)
        ) {
          const delta = currentProgress - previousProgress
          if (delta !== 0) {
            nextDelta = delta
          }
        }

        setProgressDelta(nextDelta)

        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            progress: currentProgress,
            level: currentLevel,
            updatedAt: Date.now(),
          }),
        )
      } catch (error) {
        console.error('[StrengthBodyView] Failed to sync progress delta:', error)
      }
    }

    syncProgressDelta()

    return () => {
      isActive = false
    }
  }, [
    isFocused,
    user?.id,
    overallLevel?.balancedProgress,
    overallLevel?.balancedLevel,
    overallLevel?.balancedNextLevel,
  ])

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
    }).filter(e => e.level !== null)
      .sort((a, b) => {
        const intensityA = getLevelIntensity(a.level!)
        const intensityB = getLevelIntensity(b.level!)
        if (intensityA !== intensityB) {
          return intensityB - intensityA
        }
        return b.progress - a.progress
      })
  }, [exerciseData, profile, getStrengthInfo])

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

  useEffect(() => {
    if (!isFocused) {
      setExerciseProgressDeltas({})
      return
    }
    if (!user?.id) return
    if (trackedExercisesWithProgress.length === 0) {
      setExerciseProgressDeltas({})
      return
    }

    let isActive = true

    const syncExerciseDeltas = async () => {
      const storageKey = `${LIFTER_EXERCISE_PROGRESS_KEY}:${user.id}`
      let previous: Record<string, { progress?: number; level?: StrengthLevel }> = {}

      try {
        const storedValue = await AsyncStorage.getItem(storageKey)
        if (!isActive) return

        if (storedValue) {
          try {
            const parsed = JSON.parse(storedValue) as unknown
            if (parsed && typeof parsed === 'object') {
              previous = parsed as Record<string, { progress?: number; level?: StrengthLevel }>
            }
          } catch (error) {
            console.warn('[StrengthBodyView] Failed to parse exercise progress cache:', error)
          }
        }

        const nextDeltas: Record<string, number> = {}

        trackedExercisesWithProgress.forEach((exercise) => {
          if (!exercise.nextLevel) return

          const currentProgress = Math.round(exercise.progress)
          const previousEntry = previous[exercise.exerciseId]

          if (previousEntry && typeof previousEntry.progress === 'number') {
            if (!previousEntry.level || previousEntry.level === exercise.level) {
              const delta = currentProgress - previousEntry.progress
              if (delta !== 0) {
                nextDeltas[exercise.exerciseId] = delta
              }
            }
          }
        })

        if (!isActive) return
        setExerciseProgressDeltas(nextDeltas)

        const snapshot: Record<string, { progress: number; level: StrengthLevel; updatedAt: number }> = {}
        trackedExercisesWithProgress.forEach((exercise) => {
          snapshot[exercise.exerciseId] = {
            progress: Math.round(exercise.progress),
            level: exercise.level as StrengthLevel,
            updatedAt: Date.now(),
          }
        })

        await AsyncStorage.setItem(storageKey, JSON.stringify(snapshot))
      } catch (error) {
        console.error('[StrengthBodyView] Failed to sync exercise progress delta:', error)
      }
    }

    syncExerciseDeltas()

    return () => {
      isActive = false
    }
  }, [isFocused, user?.id, trackedExercisesWithProgress])

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
      const mgData = muscleMap.get(dbMuscleName)
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

            {/* Overall Level Card */}
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
                      {overallLevel.balancedNextLevel ? (
                        <View style={styles.levelCardProgressRow}>
                          <Text style={styles.levelCardProgress}>
                            {Math.round(overallLevel.balancedProgress)}% to{' '}
                            {overallLevel.balancedNextLevel}
                          </Text>
                          {progressDelta !== null && (
                            <View
                              style={[
                                styles.progressDeltaPill,
                                progressDelta > 0
                                  ? styles.progressDeltaPillUp
                                  : styles.progressDeltaPillDown,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.progressDeltaText,
                                  progressDelta > 0
                                    ? styles.progressDeltaTextUp
                                    : styles.progressDeltaTextDown,
                                ]}
                              >
                                {progressDelta > 0 ? '+' : ''}
                                {progressDelta}%
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.levelCardProgress}>Max Level Reached</Text>
                      )}
                    </View>
                    <LevelBadge
                      level={overallLevel.balancedLevel}
                      size="large"
                      showTooltipOnPress={false}
                    />
                  </View>

                {/* Progress Bar */}
                {overallLevel.balancedNextLevel && (
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                      <View
                        style={[
                          styles.progressBarFill,
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
            </>
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
                                <View style={styles.goalRightMeta}>
                                  <Text style={styles.targetWeightText}>
                                    {formatWeight(exercise.targetWeight, { maximumFractionDigits: 0 })}
                                  </Text>
                                  {exerciseProgressDeltas[exercise.exerciseId] !== undefined && (
                                    <View
                                      style={[
                                        styles.exerciseDeltaPill,
                                        exerciseProgressDeltas[exercise.exerciseId] > 0
                                          ? styles.exerciseDeltaPillUp
                                          : styles.exerciseDeltaPillDown,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.exerciseDeltaText,
                                          exerciseProgressDeltas[exercise.exerciseId] > 0
                                            ? styles.exerciseDeltaTextUp
                                            : styles.exerciseDeltaTextDown,
                                        ]}
                                      >
                                        {exerciseProgressDeltas[exercise.exerciseId] > 0 ? '+' : ''}
                                        {exerciseProgressDeltas[exercise.exerciseId]}%
                                      </Text>
                                    </View>
                                  )}
                                </View>
                             </View>
                             
                             {/* The Bar */}
                             <View style={styles.goalBarBg}>
                                <View 
                                  style={[
                                    styles.goalBarFill, 
                                    { 
                                      width: `${Math.min(100, Math.max(5, exercise.progress))}%`,
                                      backgroundColor: levelColor 
                                    }
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
          progressToNext={overallLevel.balancedProgress}
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
      paddingTop: 16,
      paddingBottom: 20,
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
    },
    levelCardValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    levelCardProgress: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    levelCardProgressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    progressDeltaPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    progressDeltaPillUp: {
      backgroundColor: colors.statusSuccess + '20',
      borderColor: colors.statusSuccess + '40',
    },
    progressDeltaPillDown: {
      backgroundColor: colors.statusError + '20',
      borderColor: colors.statusError + '40',
    },
    progressDeltaText: {
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    progressDeltaTextUp: {
      color: colors.statusSuccess,
    },
    progressDeltaTextDown: {
      color: colors.statusError,
    },
    progressBarContainer: {
      marginTop: 16,
    },
    progressBarBackground: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
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

    // Body Section
    bodySection: {
      flex: 1,
      paddingHorizontal: 14,
      marginTop: 24,
    },

    // Legend
    integratedLegend: {
      marginTop: 8,
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
      marginTop: 24,
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
    goalRightMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
    exerciseDeltaPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    exerciseDeltaPillUp: {
      backgroundColor: colors.statusSuccess + '20',
      borderColor: colors.statusSuccess + '40',
    },
    exerciseDeltaPillDown: {
      backgroundColor: colors.statusError + '20',
      borderColor: colors.statusError + '40',
    },
    exerciseDeltaText: {
      fontSize: 10,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    exerciseDeltaTextUp: {
      color: colors.statusSuccess,
    },
    exerciseDeltaTextDown: {
      color: colors.statusError,
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

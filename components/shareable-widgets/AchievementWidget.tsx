import { calculateWorkoutStats } from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

const formatStopwatch = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`
}

interface AchievementWidgetProps {
  workout: WorkoutSessionWithDetails
  weightUnit: 'kg' | 'lb'
  prData?: { exerciseName: string; prs: any[] }[]
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const AchievementWidget = React.forwardRef<View, AchievementWidgetProps>(
  ({ workout, weightUnit, prData = [], backgroundMode = 'light' }, ref) => {
    const stats = calculateWorkoutStats(workout, weightUnit)
    const durationDisplay = formatStopwatch(stats.durationSeconds)

    // Get exercises with PRs from computed PR data
    const prExercises = prData
      .filter((exPr) => exPr.prs.some((pr) => pr.isCurrent))
      .map((exPr) => {
        // Find the matching workout exercise
        const workoutExercise = workout.workout_exercises?.find(
          (we) => we.exercise?.name === exPr.exerciseName,
        )
        return {
          exercise: workoutExercise?.exercise,
          sets: workoutExercise?.sets || [],
          prs: exPr.prs.filter((pr) => pr.isCurrent),
        }
      })
      .filter((ex) => ex.exercise) // Only include exercises that exist in workout

    const hasPRs = prExercises.length > 0

    const isDark = backgroundMode === 'dark'
    const isTransparent = backgroundMode === 'transparent'
    const isLight = backgroundMode === 'light'

    // Text colors
    const textColor = isDark || isTransparent ? '#FFFFFF' : '#1C1C1E'
    const subTextColor =
      isDark || isTransparent ? 'rgba(255, 255, 255, 0.6)' : '#8E8E93'
    const cardBg =
      isDark || isTransparent ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F7'
    const cardBorder =
      isDark || isTransparent ? 'rgba(255, 255, 255, 0.1)' : '#E5E5EA'
    const dividerColor =
      isDark || isTransparent ? 'rgba(255, 255, 255, 0.2)' : '#E5E5EA'
    const shadowOpacity = isTransparent ? 0.5 : 0

    const getGradientColors = () => {
      if (isTransparent) return ['transparent', 'transparent'] as const
      if (isDark) return ['#1C1C1E', '#000000'] as const
      // Light mode - keep existing logic for PRs vs no PRs
      return hasPRs
        ? (['#FF6B35', '#FF8C5A'] as const)
        : (['#FFFFFF', '#F2F2F7'] as const)
    }

    // Special handling for PR mode in Light theme (it uses orange background)
    // If light mode AND has PRs, we want white text.
    // If dark/transparent, we always want white text.
    // If light mode AND no PRs, we want black text.
    const useWhiteText = (isLight && hasPRs) || isDark || isTransparent
    const dynamicTextColor = useWhiteText ? '#FFFFFF' : '#000000'
    const dynamicSubTextColor = useWhiteText
      ? 'rgba(255, 255, 255, 0.8)'
      : '#8E8E93'

    return (
      <View ref={ref} style={styles.container} collapsable={false}>
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Top Section: Date */}
          <View style={styles.topSection}>
            <Text
              style={[
                styles.date,
                { color: dynamicSubTextColor, shadowOpacity },
              ]}
            >
              {new Date(workout.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Text
              style={[styles.title, { color: dynamicTextColor, shadowOpacity }]}
            >
              {hasPRs ? 'Personal Records' : 'Workout Complete'}
            </Text>
            <Text
              style={[
                styles.durationText,
                { color: dynamicTextColor, shadowOpacity },
              ]}
            >
              {durationDisplay}
            </Text>
          </View>

          {/* Middle Section: Workout Content */}
          <View style={styles.middleSection}>
            {hasPRs ? (
              /* PR List */
              <View style={styles.prSection}>
                <View style={styles.prCountContainer}>
                  <View
                    style={[
                      styles.prCountCard,
                      { backgroundColor: cardBg, borderColor: cardBorder },
                    ]}
                  >
                    <Text style={styles.prCount}>
                      {prExercises.length} PR{prExercises.length > 1 ? 's' : ''}
                    </Text>
                    <Text
                      style={[styles.prCountSubtext, { color: subTextColor }]}
                    >
                      Achieved Today
                    </Text>
                  </View>
                </View>

                <View style={styles.prList}>
                  {prExercises.slice(0, 2).map((exercise, index) => {
                    // Get the best PR from the computed PR data
                    const exercisePrData = prData.find(
                      (exPr) => exPr.exerciseName === exercise.exercise?.name,
                    )
                    const bestPR = exercisePrData?.prs
                      .filter((pr) => pr.isCurrent)
                      .sort((a, b) => {
                        // Sort by weight first, then reps
                        if (a.weight !== b.weight) return b.weight - a.weight
                        return b.currentReps - a.currentReps
                      })[0]

                    const weight = bestPR?.weight || 0
                    const reps = bestPR?.currentReps || 0

                    return (
                      <View
                        key={index}
                        style={[
                          styles.prItem,
                          { backgroundColor: cardBg, borderColor: cardBorder },
                        ]}
                      >
                        <View style={styles.prBadge}>
                          <Text style={styles.prBadgeText}>PR</Text>
                        </View>
                        <View style={styles.prInfo}>
                          <Text
                            style={[
                              styles.prExerciseName,
                              { color: textColor },
                            ]}
                            numberOfLines={1}
                          >
                            {exercise.exercise?.name || 'Exercise'}
                          </Text>
                          <Text
                            style={[styles.prStats, { color: subTextColor }]}
                          >
                            {weight > 0
                              ? `${Number(weight).toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 1,
                                })} ${weightUnit}`
                              : ''}{' '}
                            {weight > 0 && reps > 0 ? '×' : ''}{' '}
                            {reps > 0 ? `${reps} reps` : ''}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : (
              /* No PRs - Show summary */
              <View style={styles.summarySection}>
                <View style={styles.summaryIconContainer}>
                  <Text style={styles.summaryIcon}>💪</Text>
                </View>
                <Text style={styles.summaryMessage}>
                  Keep pushing! PRs are coming.
                </Text>

                <View style={styles.summaryStats}>
                  <View
                    style={[
                      styles.summaryStatCard,
                      { backgroundColor: cardBg, borderColor: cardBorder },
                    ]}
                  >
                    <Text
                      style={[styles.summaryStatValue, { color: textColor }]}
                    >
                      {stats.totalSets}
                    </Text>
                    <Text
                      style={[styles.summaryStatLabel, { color: subTextColor }]}
                    >
                      Sets Completed
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.summaryStatCard,
                      { backgroundColor: cardBg, borderColor: cardBorder },
                    ]}
                  >
                    <Text
                      style={[styles.summaryStatValue, { color: textColor }]}
                    >
                      {stats.exerciseCount}
                    </Text>
                    <Text
                      style={[styles.summaryStatLabel, { color: subTextColor }]}
                    >
                      Exercises
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Bottom Section: Branding */}
          <View style={styles.bottomSection}>
            <View style={styles.brandContainer}>
              <View
                style={[
                  styles.brandLine,
                  { backgroundColor: dividerColor, shadowOpacity },
                ]}
              />
              <View style={styles.brandContent}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../assets/images/bicep-icon.png')}
                    style={[
                      styles.brandIcon,
                      {
                        tintColor:
                          dynamicTextColor === '#FFFFFF'
                            ? '#FFFFFF'
                            : '#FF6B35',
                        shadowOpacity,
                      },
                    ]}
                    resizeMode="contain"
                  />
                  <Text
                    style={[
                      styles.brandText,
                      {
                        color:
                          dynamicTextColor === '#FFFFFF'
                            ? '#FFFFFF'
                            : '#FF6B35',
                        shadowOpacity,
                      },
                    ]}
                  >
                    REP AI
                  </Text>
                </View>
                {(workout.profile?.user_tag ||
                  workout.profile?.display_name) && (
                  <Text
                    style={[
                      styles.userTagText,
                      { color: dynamicSubTextColor, shadowOpacity },
                    ]}
                  >
                    @
                    {workout.profile?.user_tag || workout.profile?.display_name}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.brandLine,
                  { backgroundColor: dividerColor, shadowOpacity },
                ]}
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    )
  },
)

AchievementWidget.displayName = 'AchievementWidget'

const styles = StyleSheet.create({
  container: {
    width: 360,
    height: 420,
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  topSection: {
    gap: 6,
    marginBottom: 4,
  },
  date: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  dateLight: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
    lineHeight: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  titleLight: {
    color: '#FFFFFF',
  },
  middleSection: {
    flex: 1,
    marginVertical: 16,
    justifyContent: 'center',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  durationTextLight: {
    color: '#FFFFFF',
  },
  prSection: {
    gap: 14,
  },
  prCountContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  prCountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  prCount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: -1.6,
    lineHeight: 46,
  },
  prCountSubtext: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 5,
    letterSpacing: 0.5,
  },
  prList: {
    gap: 8,
  },
  prItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  prBadge: {
    backgroundColor: '#FF6B35',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 32,
    alignItems: 'center',
  },
  prBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  prInfo: {
    flex: 1,
    gap: 2,
  },
  prExerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.3,
  },
  prStats: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  summarySection: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  summaryIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 0,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryIcon: {
    fontSize: 36,
  },
  summaryMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 16,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.7,
  },
  summaryStatLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  bottomSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 2,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  brandIcon: {
    width: 20,
    height: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  brandLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  brandLineLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  brandTextLight: {
    color: '#FFFFFF',
  },
  userTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  userTagTextLight: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
})

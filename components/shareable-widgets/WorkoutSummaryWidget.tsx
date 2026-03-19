import { getColors } from '@/constants/colors'
import { calculateWorkoutStats, formatVolume } from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

const formatStopwatch = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }

  return `${mins}min`
}

interface WorkoutSummaryWidgetProps {
  workout: WorkoutSessionWithDetails
  weightUnit: 'kg' | 'lb'
  workoutTitle?: string
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const WorkoutSummaryWidget = React.forwardRef<
  View,
  WorkoutSummaryWidgetProps
>(({ workout, weightUnit, workoutTitle, backgroundMode = 'light' }, ref) => {
  const stats = calculateWorkoutStats(workout, weightUnit)
  const volume = formatVolume(stats.totalVolume, weightUnit)
  const durationDisplay = formatStopwatch(stats.durationSeconds)

  // Determine colors based on background mode
  const isDark = backgroundMode === 'dark'
  const isTransparent = backgroundMode === 'transparent'

  const colors = getColors(isDark)
  const textColor = isDark || isTransparent ? '#FFFFFF' : '#000'
  const subTextColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.7)' : '#6B7280'
  const brandColor = isDark || isTransparent ? '#FFFFFF' : '#000'
  const highlightColor = colors.shareableHighlight
  const shadowOpacity = isTransparent ? 0.5 : 0

  const getGradientColors = () => {
    if (isTransparent) return ['transparent', 'transparent'] as const
    const bg = getColors(isDark).shareableCardBg
    return [bg, bg] as const
  }

  return (
    <View ref={ref} style={styles.container} collapsable={false}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Top Section: Title */}
        <View style={styles.topSection}>
          <Text style={[styles.title, { color: textColor, shadowOpacity }]} numberOfLines={2}>
            {workoutTitle || 'Workout'}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: subTextColor, shadowOpacity }]}>Duration</Text>
            <Text style={[styles.statValue, { color: textColor, shadowOpacity }]}>{durationDisplay}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: subTextColor, shadowOpacity }]}>Volume</Text>
            <Text style={[styles.statValue, { color: textColor, shadowOpacity }]}>
              {Number(volume.value).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
              })}{' '}
              {volume.unit}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: subTextColor, shadowOpacity }]}>Set</Text>
            <Text style={[styles.statValue, { color: textColor, shadowOpacity }]}>{stats.totalSets}</Text>
          </View>
        </View>

        {/* Middle Section: Detailed Workout Content */}
        <View style={styles.middleSection}>
          <View style={styles.exerciseSection}>
            {workout.workout_exercises?.slice(0, 8).map((exercise, index) => {
              const sets = exercise.sets || []
              const exerciseName = exercise.exercise?.name || 'Exercise'
              const setCount = sets.length

              return (
                <View key={index} style={styles.exerciseRow}>
                  <Text style={[styles.setCount, { color: highlightColor, shadowOpacity }]}>
                    {setCount}x
                  </Text>
                  <Text style={[styles.exerciseName, { color: textColor, shadowOpacity }]} numberOfLines={1}>
                    {exerciseName}
                  </Text>
                </View>
              )
            })}
            {workout.workout_exercises && workout.workout_exercises.length > 8 && (
              <Text style={[styles.moreExercises, { color: subTextColor, shadowOpacity }]}>
                +{workout.workout_exercises.length - 8} more exercises
              </Text>
            )}
          </View>
        </View>

        {/* Bottom Section: Branding */}
        <View style={styles.bottomSection}>
          <View style={styles.brandContainer}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/bicep-icon.png')}
                style={[styles.brandIcon, { tintColor: brandColor, shadowOpacity }]}
                resizeMode="contain"
              />
              <Text style={[styles.brandText, { color: brandColor, shadowOpacity }]}>REP AI</Text>
            </View>
            {(workout.profile?.user_tag || workout.profile?.display_name) && (
              <Text style={[styles.userTagText, { color: textColor, shadowOpacity }]}>
                @{workout.profile?.user_tag || workout.profile?.display_name}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  )
})

WorkoutSummaryWidget.displayName = 'WorkoutSummaryWidget'

const styles = StyleSheet.create({
  container: {
    width: 360,
    height: 420,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  statItem: {
    gap: 4,
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  middleSection: {
    flex: 1,
  },
  exerciseSection: {
    flex: 1,
    gap: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setCount: {
    fontSize: 16,
    fontWeight: '600',
    width: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  exerciseName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  moreExercises: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  bottomSection: {
    paddingTop: 16,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIcon: {
    width: 24,
    height: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  userTagText: {
    fontSize: 16,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
})

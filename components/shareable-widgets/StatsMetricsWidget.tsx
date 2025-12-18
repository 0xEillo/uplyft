import {
    calculateWorkoutStats,
    formatVolume,
    getOrdinalSuffix,
} from '@/lib/utils/workout-stats'
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

interface StatsMetricsWidgetProps {
  workout: WorkoutSessionWithDetails
  weightUnit: 'kg' | 'lb'
  workoutCountThisWeek: number
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const StatsMetricsWidget = React.forwardRef<
  View,
  StatsMetricsWidgetProps
>(
  (
    { workout, weightUnit, workoutCountThisWeek, backgroundMode = 'light' },
    ref,
  ) => {
    const stats = calculateWorkoutStats(workout, weightUnit)
    const volume = formatVolume(stats.totalVolume, weightUnit)
    const durationDisplay = formatStopwatch(stats.durationSeconds)

    // Format date
    const workoutDate = new Date(workout.date)
    const formattedDate = workoutDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

    // Check if workout is in the current week
    const isInCurrentWeek = (() => {
      const now = new Date()
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      const startOfWeek = new Date(now)
      startOfWeek.setDate(diff)
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 7)

      return workoutDate >= startOfWeek && workoutDate < endOfWeek
    })()

    const isTransparent = backgroundMode === 'transparent'
    const isLight = backgroundMode === 'light'

    const textColor = isLight ? '#1C1C1E' : '#FFFFFF'
    const subTextColor = isLight ? '#8E8E93' : '#A8A8A8'
    const badgeBg = isLight
      ? '#F2F2F7'
      : isTransparent
      ? 'rgba(255, 255, 255, 0.1)'
      : '#1C1C1E'
    const badgeBorder = isLight
      ? '#E5E5EA'
      : isTransparent
      ? 'rgba(255, 255, 255, 0.2)'
      : '#2C2C2E'
    const dividerColor = isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.2)'
    const shadowOpacity = isTransparent ? 0.5 : 0

    const getGradientColors = () => {
      if (isTransparent) return ['transparent', 'transparent'] as const
      if (isLight) return ['#FFFFFF', '#F2F2F7'] as const
      return ['#1C1C1E', '#000000'] as const
    }

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
            <Text style={[styles.date, { color: subTextColor, shadowOpacity }]}>
              {formattedDate}
            </Text>
            {isInCurrentWeek && (
              <View style={[styles.workoutCountBadge, { shadowOpacity }]}>
                <Text style={[styles.workoutCount, { shadowOpacity }]}>
                  {getOrdinalSuffix(workoutCountThisWeek)} workout this week
                </Text>
              </View>
            )}
            <View
              style={[
                styles.durationBadge,
                {
                  backgroundColor: badgeBg,
                  borderColor: badgeBorder,
                  shadowOpacity,
                },
              ]}
            >
              <Text style={[styles.durationLabel, { shadowOpacity }]}>
                Duration
              </Text>
              <Text
                style={[
                  styles.durationValue,
                  { color: textColor, shadowOpacity },
                ]}
              >
                {durationDisplay}
              </Text>
            </View>
          </View>

          {/* Middle Section: Workout Content */}
          <View style={styles.middleSection}>
            {/* Main metric - Volume */}
            {/* Main metric - Volume */}
            <View style={styles.mainMetric}>
              <Text
                style={[
                  styles.volumeValue,
                  { color: textColor, shadowOpacity },
                ]}
              >
                {Number(volume.value).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1,
                })}
                <Text style={[styles.volumeUnit, { shadowOpacity }]}>
                  {' '}
                  {volume.unit}
                </Text>
              </Text>
              <Text
                style={[
                  styles.volumeLabel,
                  { color: subTextColor, shadowOpacity },
                ]}
              >
                Total Volume
              </Text>
            </View>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#FF6B35', '#FF8C5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.statCardGradient}
                >
                  <Text style={styles.statNumber}>{stats.totalSets}</Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </LinearGradient>
              </View>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#FF6B35', '#FF8C5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.statCardGradient}
                >
                  <Text style={styles.statNumber}>
                    {stats.totalReps.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Reps</Text>
                </LinearGradient>
              </View>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#FF6B35', '#FF8C5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.statCardGradient}
                >
                  <Text style={styles.statNumber}>{stats.exerciseCount}</Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </LinearGradient>
              </View>
            </View>

            {/* PR badge if any */}
            {stats.prCount > 0 && (
              <View style={styles.prBadge}>
                <LinearGradient
                  colors={['#FF6B35', '#FF8C5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.prBadgeGradient}
                >
                  <Text style={styles.prEmoji}>🏆</Text>
                  <Text style={styles.prText}>
                    {stats.prCount} PR{stats.prCount > 1 ? 's' : ''} hit
                  </Text>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* Bottom Section: Branding */}
          <View style={styles.bottomSection}>
            <View style={styles.brandContainer}>
              <View
                style={[styles.brandLine, { backgroundColor: dividerColor }]}
              />
              <View style={styles.brandContent}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../assets/images/bicep-icon.png')}
                    style={[
                      styles.brandIcon,
                      { tintColor: textColor, shadowOpacity },
                    ]}
                    resizeMode="contain"
                  />
                  <Text
                    style={[
                      styles.brandText,
                      { color: textColor, shadowOpacity },
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
                      { color: subTextColor, shadowOpacity },
                    ]}
                  >
                    @
                    {workout.profile?.user_tag || workout.profile?.display_name}
                  </Text>
                )}
              </View>
              <View
                style={[styles.brandLine, { backgroundColor: dividerColor }]}
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    )
  },
)

StatsMetricsWidget.displayName = 'StatsMetricsWidget'

const styles = StyleSheet.create({
  container: {
    width: 360,
    height: 420,
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    gap: 6,
    marginBottom: 4,
  },
  date: {
    fontSize: 10,
    color: '#A8A8A8',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  workoutCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  workoutCount: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '600',
    letterSpacing: -0.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  durationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  durationLabel: {
    fontSize: 9,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  durationValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  middleSection: {
    flex: 1,
    marginVertical: 16,
    justifyContent: 'center',
  },
  mainMetric: {
    alignItems: 'center',
    marginBottom: 28,
  },
  volumeValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2.5,
    lineHeight: 62,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  volumeUnit: {
    fontSize: 28,
    fontWeight: '600',
    opacity: 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  volumeLabel: {
    fontSize: 12,
    color: '#A8A8A8',
    marginTop: 6,
    fontWeight: '600',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardGradient: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 3,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.7,
  },
  statLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.3,
    opacity: 0.95,
  },
  prBadge: {
    borderRadius: 0,
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  prBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  prEmoji: {
    fontSize: 16,
  },
  prText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
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
    gap: 2,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  brandLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  brandIcon: {
    width: 16,
    height: 16,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  userTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#A8A8A8',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
})

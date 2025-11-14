import { useThemedColors } from '@/hooks/useThemedColors'
import {
  calculateWorkoutStats,
  formatVolume,
  getOrdinalSuffix,
} from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

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
}

export const StatsMetricsWidget = React.forwardRef<
  View,
  StatsMetricsWidgetProps
>(({ workout, weightUnit, workoutCountThisWeek }, ref) => {
  const colors = useThemedColors()
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

  return (
    <View ref={ref} style={styles.container} collapsable={false}>
      <LinearGradient
        colors={['#1A1A1A', '#2A2A2A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Top Section: Date */}
        <View style={styles.topSection}>
          <Text style={styles.date}>{formattedDate}</Text>
          <View style={styles.workoutCountBadge}>
            <Text style={styles.workoutCount}>
              {getOrdinalSuffix(workoutCountThisWeek)} workout this week
            </Text>
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationLabel}>Duration</Text>
            <Text style={styles.durationValue}>{durationDisplay}</Text>
          </View>
        </View>

        {/* Middle Section: Workout Content */}
        <View style={styles.middleSection}>
          {/* Main metric - Volume */}
          <View style={styles.mainMetric}>
            <Text style={styles.volumeValue}>
              {volume.value.toLocaleString()}
              <Text style={styles.volumeUnit}> {volume.unit}</Text>
            </Text>
            <Text style={styles.volumeLabel}>Total Volume</Text>
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
            <View style={styles.brandLine} />
            <Text style={styles.brandText}>REP AI</Text>
            <View style={styles.brandLine} />
          </View>
        </View>
      </LinearGradient>
    </View>
  )
})

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
  },
  workoutCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  workoutCount: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '600',
    letterSpacing: -0.2,
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
  },
  durationLabel: {
    fontSize: 9,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  durationValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
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
  },
  volumeUnit: {
    fontSize: 28,
    fontWeight: '600',
    opacity: 0.7,
  },
  volumeLabel: {
    fontSize: 12,
    color: '#A8A8A8',
    marginTop: 6,
    fontWeight: '600',
    letterSpacing: 0.5,
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
  brandLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 4,
  },
})

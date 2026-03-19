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

interface StatsMetricsWidgetProps {
  workout: WorkoutSessionWithDetails
  weightUnit: 'kg' | 'lb'
  workoutCountThisWeek: number
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const StatsMetricsWidget = React.forwardRef<
  View,
  StatsMetricsWidgetProps
>(({ workout, weightUnit, workoutCountThisWeek, backgroundMode = 'light' }, ref) => {
  const stats = calculateWorkoutStats(workout, weightUnit)
  const volume = formatVolume(stats.totalVolume, weightUnit)
  const durationDisplay = formatStopwatch(stats.durationSeconds)

  const isTransparent = backgroundMode === 'transparent'
  const isDark = backgroundMode === 'dark'

  const textColor = isDark || isTransparent ? '#FFFFFF' : '#000'
  const subTextColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.7)' : '#6B7280'
  const brandColor = isDark || isTransparent ? '#FFFFFF' : '#000'
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
        <View style={styles.middleSection}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: textColor, shadowOpacity }]}>{durationDisplay}</Text>
            <Text style={[styles.statLabel, { color: subTextColor, shadowOpacity }]}>Duration</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: textColor, shadowOpacity }]}>
              {Number(volume.value).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
              })}{' '}
              {volume.unit}
            </Text>
            <Text style={[styles.statLabel, { color: subTextColor, shadowOpacity }]}>Volume</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: textColor, shadowOpacity }]}>{stats.totalSets}</Text>
            <Text style={[styles.statLabel, { color: subTextColor, shadowOpacity }]}>Set</Text>
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

StatsMetricsWidget.displayName = 'StatsMetricsWidget'

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
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  statLabel: {
    fontSize: 18,
    fontWeight: '400',
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

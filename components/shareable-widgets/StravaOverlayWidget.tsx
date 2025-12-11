import { useThemedColors } from '@/hooks/useThemedColors'
import {
    calculateWorkoutStats,
    formatDuration,
    formatVolume,
} from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

interface StravaOverlayWidgetProps {
  workout: WorkoutSessionWithDetails
  weightUnit: 'kg' | 'lb'
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const StravaOverlayWidget = React.forwardRef<
  View,
  StravaOverlayWidgetProps
>(({ workout, weightUnit, backgroundMode = 'transparent' }, ref) => {
  const colors = useThemedColors()
  const stats = calculateWorkoutStats(workout, weightUnit)
  const volume = formatVolume(stats.totalVolume, weightUnit)
  
  // Format duration to match "1h 56m" style
  const durationText = formatDuration(stats.durationSeconds)
    .replace('h ', 'h ')
    .replace('m ', 'm')
    .replace('s', '') // Remove 's' if it's just seconds, though formatDuration usually returns "Xm Ys" or "Xh Ym"

  const isDark = backgroundMode === 'dark'
  const isLight = backgroundMode === 'light'
  const isTransparent = backgroundMode === 'transparent'

  const backgroundColor = isTransparent
    ? 'transparent'
    : isLight
      ? '#FFFFFF'
      : '#1C1C1E'
  
  const textColor = isLight ? '#1C1C1E' : '#FFFFFF'
  const subTextColor = isLight ? '#8E8E93' : 'rgba(255, 255, 255, 0.8)'
  const labelColor = isLight ? '#8E8E93' : 'rgba(255, 255, 255, 0.9)'
  const dividerColor = isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.3)'
  const shadowOpacity = isTransparent ? 0.5 : 0 // Only show shadow on transparent mode

  return (
    <View ref={ref} style={[styles.container, { backgroundColor }]} collapsable={false}>
      <View style={styles.content}>
        {/* Time */}
        <View style={styles.statGroup}>
          <Text style={[styles.value, { color: textColor, shadowOpacity }]}>{durationText}</Text>
          <Text style={[styles.label, { color: labelColor, shadowOpacity }]}>Duration</Text>
        </View>

        {/* Volume */}
        <View style={styles.statGroup}>
          <Text style={[styles.value, { color: textColor, shadowOpacity }]}>
            {Number(volume.value).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 1,
            })} <Text style={styles.unit}>{volume.unit}</Text>
          </Text>
          <Text style={[styles.label, { color: labelColor, shadowOpacity }]}>Volume</Text>
        </View>

        {/* Sets */}
        <View style={styles.statGroup}>
          <Text style={[styles.value, { color: textColor, shadowOpacity }]}>{stats.totalSets}</Text>
          <Text style={[styles.label, { color: labelColor, shadowOpacity }]}>Set{stats.totalSets !== 1 ? 's' : ''}</Text>
        </View>

        {/* Branding */}
        <View style={styles.footer}>
          <View style={styles.brandContainer}>
            <View style={[styles.brandLine, { backgroundColor: dividerColor, shadowOpacity }]} />
            <View style={styles.brandContent}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/bicep-icon.png')}
                  style={[styles.brandIcon, { tintColor: textColor, shadowOpacity }]}
                  resizeMode="contain"
                />
                <Text style={[styles.logoText, { color: textColor, shadowOpacity }]}>REP AI</Text>
              </View>
              {(workout.profile?.user_tag || workout.profile?.display_name) && (
                <Text style={[styles.userHandle, { color: subTextColor, shadowOpacity }]}>
                  @{workout.profile?.user_tag || workout.profile?.display_name}
                </Text>
              )}
            </View>
            <View style={[styles.brandLine, { backgroundColor: dividerColor, shadowOpacity }]} />
          </View>
        </View>
      </View>
    </View>
  )
})

StravaOverlayWidget.displayName = 'StravaOverlayWidget'

const styles = StyleSheet.create({
  container: {
    width: 360,
    height: 420,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  statGroup: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
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
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  brandIcon: {
    width: 20,
    height: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  userHandle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
})

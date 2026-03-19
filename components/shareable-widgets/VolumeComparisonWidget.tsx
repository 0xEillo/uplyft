import { getColors } from '@/constants/colors'
import { calculateWorkoutStats, formatVolume } from '@/lib/utils/workout-stats'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

interface VolumeComparisonWidgetProps {
  workout: WorkoutSessionWithDetails
  weightUnit: 'kg' | 'lb'
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const VolumeComparisonWidget = React.forwardRef<
  View,
  VolumeComparisonWidgetProps
>(({ workout, weightUnit, backgroundMode = 'light' }, ref) => {
  const stats = calculateWorkoutStats(workout, weightUnit)
  const volume = formatVolume(stats.totalVolume, weightUnit)
  
  const isTransparent = backgroundMode === 'transparent'
  const isDark = backgroundMode === 'dark'

  const textColor = isDark || isTransparent ? '#FFFFFF' : '#000'
  const brandColor = isDark || isTransparent ? '#FFFFFF' : '#000'
  const shadowOpacity = isTransparent ? 0.5 : 0

  const getGradientColors = () => {
    if (isTransparent) return ['transparent', 'transparent'] as const
    const bg = getColors(isDark).shareableCardBg
    return [bg, bg] as const
  }

  // Determine comparison object based on volume
  const volumeNum = Number(volume.value)
  let comparisonText = "That's a lot of weight!"
  let comparisonIcon = null
  
  if (volumeNum > 10000) {
    comparisonText = "That's like lifting an elephant!"
    comparisonIcon = '🐘'
  } else if (volumeNum > 5000) {
    comparisonText = "That's like lifting a truck!"
    comparisonIcon = '🛻'
  } else if (volumeNum > 2000) {
    comparisonText = "That's like lifting a car!"
    comparisonIcon = '🚗'
  } else if (volumeNum > 800) {
    comparisonText = "That's like lifting a motorcycle!"
    comparisonIcon = '🏍️'
  } else if (volumeNum > 400) {
    comparisonText = "That's like lifting a piano!"
    comparisonIcon = '🎹'
  } else if (volumeNum > 200) {
    comparisonText = "That's like lifting a gorilla!"
    comparisonIcon = '🦍'
  } else if (volumeNum > 100) {
    comparisonText = "That's like lifting a giant panda!"
    comparisonIcon = '🐼'
  } else {
    comparisonText = "That's like lifting a large dog!"
    comparisonIcon = '🐕'
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
          <Text style={[styles.topText, { color: textColor, shadowOpacity }]}>
            You lifted a total of
          </Text>
          
          <Text style={[styles.volumeValue, { color: textColor, shadowOpacity }]}>
            {Number(volume.value).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 1,
            })}{' '}
            {volume.unit}
          </Text>
          
          <Text style={[styles.comparisonText, { color: textColor, shadowOpacity }]}>
            {comparisonText}
          </Text>
          
          <Text style={[styles.emojiIcon, { shadowOpacity }]}>
            {comparisonIcon}
          </Text>
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

VolumeComparisonWidget.displayName = 'VolumeComparisonWidget'

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
    gap: 16,
  },
  topText: {
    fontSize: 20,
    fontWeight: '600',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  volumeValue: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  comparisonText: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  emojiIcon: {
    fontSize: 80,
    marginTop: 10,
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

import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getColors } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'

interface StreakWidgetProps {
  currentStreak: number
  username?: string
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const StreakWidget = React.forwardRef<View, StreakWidgetProps>(
  ({ currentStreak, username, backgroundMode = 'dark' }, ref) => {
    const isDark = backgroundMode === 'dark'
    const isTransparent = backgroundMode === 'transparent'
    
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
          <View style={styles.content}>
            <View style={styles.flameContainer}>
              <Ionicons
                name="flame"
                size={140}
                color="#FFA500"
                style={styles.flameIcon}
              />
            </View>
            <Text style={[styles.streakTitle, { color: textColor }]}>
              {currentStreak} Week streak!
            </Text>
            <Text style={[styles.streakSubtitle, { color: subTextColor }]}>
              You&apos;ve worked out {currentStreak} week{currentStreak > 1 ? 's' : ''} in a row!
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
              {username && (
                <Text style={[styles.userTagText, { color: textColor, shadowOpacity }]}>
                  @{username}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    )
  }
)

StreakWidget.displayName = 'StreakWidget'

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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  flameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  flameIcon: {
    marginBottom: 10,
  },
  streakTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  streakSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
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

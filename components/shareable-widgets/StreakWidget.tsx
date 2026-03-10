import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
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
    
    const textColor = isDark || isTransparent ? '#FFFFFF' : '#1C1C1E'
    const subTextColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.8)' : '#8E8E93'
    const brandColor = isDark || isTransparent ? '#FFFFFF' : '#1C1C1E'
    const dividerColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.3)' : '#E5E5EA'
    const shadowOpacity = isTransparent ? 0.5 : 0

    const getGradientColors = () => {
      if (isTransparent) return ['transparent', 'transparent'] as const
      if (isDark) return ['#1C1C1E', '#000000'] as const
      return ['#FFFFFF', '#F2F2F7'] as const
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
              <Text style={[styles.flameNumber, { color: textColor }]}>{currentStreak}</Text>
            </View>
            <Text style={[styles.streakTitle, { color: textColor }]}>Week streak!</Text>
            <Text style={[styles.streakSubtitle, { color: subTextColor }]}>
              You&apos;ve worked out {currentStreak} week{currentStreak > 1 ? 's' : ''} in a row!
            </Text>
          </View>

          {/* Bottom Section: Branding */}
          <View style={styles.bottomSection}>
            <View style={styles.brandContainer}>
              <View style={[styles.brandLine, { backgroundColor: dividerColor, shadowOpacity }]} />
              <View style={styles.brandContent}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../assets/images/bicep-icon.png')}
                    style={[styles.brandIcon, { tintColor: brandColor, shadowOpacity }]}
                    resizeMode="contain"
                  />
                  <Text style={[styles.brandText, { color: brandColor, shadowOpacity }]}>REP AI</Text>
                </View>
                {username && (
                  <Text style={[styles.userTagText, { color: subTextColor, shadowOpacity }]}>
                    @{username}
                  </Text>
                )}
              </View>
              <View style={[styles.brandLine, { backgroundColor: dividerColor, shadowOpacity }]} />
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
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  flameIcon: {
    textShadowColor: 'rgba(255, 165, 0, 0.4)',
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 20,
  },
  flameNumber: {
    position: 'absolute',
    fontSize: 60,
    fontWeight: '900',
    marginTop: 20,
  },
  streakTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  streakSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
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
  brandText: {
    fontSize: 14,
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
    color: '#8E8E93',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
})

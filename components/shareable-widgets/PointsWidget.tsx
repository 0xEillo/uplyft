import React, { useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getColors } from '@/constants/colors'
import { LevelBadge } from '@/components/LevelBadge'
import { LEVEL_COLORS } from '@/hooks/useStrengthData'
import { LEVEL_POINT_ANCHORS } from '@/lib/overall-strength-score'
import type { StrengthLevel } from '@/lib/strength-standards'

interface PointsWidgetProps {
  previousScore: number
  currentScore: number
  previousLevel: string
  currentLevel: string
  nextLevel: string | null
  progress: number
  pointsGained: number
  username?: string
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const PointsWidget = React.forwardRef<View, PointsWidgetProps>(
  ({ previousScore, currentScore, previousLevel, currentLevel, nextLevel, progress, pointsGained, username, backgroundMode = 'dark' }, ref) => {
    const isDark = backgroundMode === 'dark'
    const isTransparent = backgroundMode === 'transparent'
    
    const textColor = isDark || isTransparent ? '#FFFFFF' : '#000'
    const subTextColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.7)' : '#6B7280'
    const brandColor = isDark || isTransparent ? '#FFFFFF' : '#000'
    const shadowOpacity = isTransparent ? 0.5 : 0
    
    const isLevelUp = previousLevel !== currentLevel
    const levelColor = LEVEL_COLORS[currentLevel as StrengthLevel] ?? '#FF6B35'

    // Compute previous progress %
    const previousProgress = useMemo(() => {
      if (isLevelUp) return 0 // Start from 0 if we leveled up, for a simpler animation in the widget
      const target = nextLevel as StrengthLevel
      if (!target) return progress
      const levelFloor = LEVEL_POINT_ANCHORS[previousLevel as StrengthLevel]
      const levelCeiling = LEVEL_POINT_ANCHORS[target]
      if (!levelFloor || !levelCeiling) return 0
      const range = levelCeiling - levelFloor
      if (range <= 0) return 0
      const prev = Math.max(0, ((previousScore - levelFloor) / range) * 100)
      return Math.min(prev, 100)
    }, [previousScore, previousLevel, nextLevel, progress, isLevelUp])

    const progressAnim = useRef(new Animated.Value(previousProgress)).current

    useEffect(() => {
      const timeout = setTimeout(() => {
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start()
      }, 500)

      return () => clearTimeout(timeout)
    }, [progress, progressAnim])

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
            <View style={styles.badgeArea}>
              <LevelBadge
                level={currentLevel as StrengthLevel}
                size={isLevelUp ? 'hero' : 'xl'}
              />
            </View>
            {isLevelUp ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.levelUpLabel, { color: levelColor }]}>
                  LEVEL UP!
                </Text>
                <Text style={[styles.newLevelName, { color: levelColor }]}>
                  {currentLevel}
                </Text>
              </View>
            ) : (
              <Text style={[styles.levelName, { color: levelColor }]}>
                {currentLevel}
              </Text>
            )}
            {nextLevel && (
              <View style={styles.progressSection}>
                <View
                  style={[
                    styles.progressTrack,
                    {
                      backgroundColor: isDark || isTransparent
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: levelColor,
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                          extrapolate: 'clamp',
                        }),
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressLabel, { color: levelColor }]}>
                    {currentLevel}
                  </Text>
                  <Text style={[styles.progressLabelNext, { color: subTextColor }]}>{nextLevel}</Text>
                </View>
              </View>
            )}
            <View style={[styles.ptsBadge, { backgroundColor: levelColor }]}>
              <Text style={styles.ptsBadgeText}>+{pointsGained} pts</Text>
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

PointsWidget.displayName = 'PointsWidget'

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
  },
  badgeArea: {
    minHeight: 130,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 24,
  },
  levelUpLabel: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 4,
  },
  newLevelName: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 24,
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  progressTrack: {
    width: '100%',
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressLabelNext: {
    fontSize: 13,
    fontWeight: '700',
  },
  ptsBadge: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  ptsBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
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

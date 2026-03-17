import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getColors } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { LevelBadge } from '@/components/LevelBadge'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { LEVEL_COLORS } from '@/hooks/useStrengthData'
import type { StrengthLevel } from '@/lib/strength-standards'

interface ExerciseUpgradeWidgetProps {
  exerciseName: string
  currentLevel: string
  username?: string
  backgroundMode?: 'light' | 'dark' | 'transparent'
}

export const ExerciseUpgradeWidget = React.forwardRef<View, ExerciseUpgradeWidgetProps>(
  ({ exerciseName, currentLevel, username, backgroundMode = 'dark' }, ref) => {
    const isDark = backgroundMode === 'dark'
    const isTransparent = backgroundMode === 'transparent'
    
    const textColor = isDark || isTransparent ? '#FFFFFF' : '#000'
    const subTextColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.7)' : '#6B7280'
    const brandColor = isDark || isTransparent ? '#FFFFFF' : '#000'
    const shadowOpacity = isTransparent ? 0.5 : 0
    
    const levelColor = LEVEL_COLORS[currentLevel as StrengthLevel] ?? '#FF6B35'
    const tileBg = isDark || isTransparent ? 'rgba(34,37,43,0.86)' : 'rgba(255,255,255,0.94)'

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
            <Text style={[styles.exerciseName, { color: subTextColor }]}>{exerciseName}</Text>
            <Text style={[styles.rankUpLabel, { color: levelColor }]}>
              RANK UP!
            </Text>
            <LiquidGlassSurface
              style={[
                styles.badgeTile,
                {
                  backgroundColor: tileBg,
                  borderColor: levelColor,
                  borderWidth: 2,
                  shadowColor: levelColor,
                },
              ]}
              debugLabel="exercise-rank-new"
            >
              <LinearGradient
                colors={[`${levelColor}40`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                pointerEvents="none"
              />
              <View style={styles.badgeVisualWrap}>
                <LevelBadge
                  level={currentLevel as StrengthLevel}
                  size="hero"
                  showTooltipOnPress={false}
                />
              </View>
              <View style={styles.textStack}>
                <Text style={[styles.badgeName, { color: levelColor }]}>
                  {currentLevel}
                </Text>
              </View>
              <View
                style={[
                  styles.badgeStatusPill,
                  { backgroundColor: `${levelColor}33` },
                ]}
              >
                <Ionicons
                  name="star"
                  size={11}
                  color={levelColor}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.badgeStatusText, { color: levelColor }]}>
                  Unlocked
                </Text>
              </View>
            </LiquidGlassSurface>
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

ExerciseUpgradeWidget.displayName = 'ExerciseUpgradeWidget'

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
  exerciseName: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  rankUpLabel: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 12,
  },
  badgeTile: {
    width: 180,
    minHeight: 212,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  badgeVisualWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStack: {
    gap: 3,
    alignItems: 'center',
    width: '100%',
  },
  badgeName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  badgeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 80,
  },
  badgeStatusText: {
    fontSize: 11,
    fontWeight: '700',
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

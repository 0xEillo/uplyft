import { LevelBadge } from '@/components/LevelBadge'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useTheme } from '@/contexts/theme-context'
import { LEVEL_COLORS } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import type { StrengthLevel } from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    Text,
    View,
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const TILE_SIZE = 180

export interface ExerciseRankUpgrade {
  exerciseName: string
  previousLevel: StrengthLevel
  currentLevel: StrengthLevel
}

interface ExerciseRankOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
  exerciseName: string
  previousLevel: StrengthLevel
  currentLevel: StrengthLevel
}

function ConfettiParticle({
  delay,
  color,
  startX,
  startY,
}: {
  delay: number
  color: string
  startX: number
  startY?: number
}) {
  const translateY = useRef(new Animated.Value(startY ?? -20)).current
  const translateX = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 160
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: (startY ?? -20) + SCREEN_HEIGHT * 0.45, duration: 2400 + Math.random() * 800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: drift, duration: 2400 + Math.random() * 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rotate, { toValue: (Math.random() - 0.5) * 8, duration: 2500, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1400),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      ]),
    ]).start()
  }, [delay, opacity, scale, translateY, translateX, rotate, startY])

  const size = 6 + Math.random() * 6
  const isCircle = Math.random() > 0.5

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: isCircle ? size : size * 2.5,
        backgroundColor: color,
        borderRadius: isCircle ? size / 2 : 2,
        opacity,
        transform: [
          { translateY },
          { translateX },
          { scale },
          { rotate: rotate.interpolate({ inputRange: [-4, 4], outputRange: ['-720deg', '720deg'] }) },
        ],
      }}
      pointerEvents="none"
    />
  )
}

function ExerciseRankOverlayComponent({
  visible,
  onAnimationComplete,
  exerciseName,
  currentLevel,
}: ExerciseRankOverlayProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const contentScale = useRef(new Animated.Value(0.88)).current
  const tileScale = useRef(new Animated.Value(0)).current
  const labelOpacity = useRef(new Animated.Value(0)).current
  const labelScale = useRef(new Animated.Value(0.5)).current

  const latestFadeValue = useRef(0)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAllTimeouts = useCallback(() => {
    for (const t of timeoutsRef.current) clearTimeout(t)
    timeoutsRef.current = []
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    timeoutsRef.current.push(setTimeout(fn, ms))
  }, [])

  const handleClose = useCallback(() => {
    clearAllTimeouts()
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(contentScale, { toValue: 0.88, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onAnimationComplete?.())
  }, [fadeAnim, contentScale, onAnimationComplete, clearAllTimeouts])

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0)
      contentScale.setValue(0.88)
      tileScale.setValue(0)
      labelOpacity.setValue(0)
      labelScale.setValue(0.5)
      return
    }

    clearAllTimeouts()
    fadeAnim.setValue(0)
    contentScale.setValue(0.88)
    tileScale.setValue(0)
    labelOpacity.setValue(0)
    labelScale.setValue(0.5)

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(contentScale, { toValue: 1, tension: 100, friction: 12, useNativeDriver: true }),
    ]).start()

    schedule(() => {
      Animated.spring(tileScale, { toValue: 1, tension: 80, friction: 5, useNativeDriver: true }).start()
    }, 200)

    schedule(() => {
      Animated.parallel([
        Animated.timing(labelOpacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(labelScale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
      ]).start()
    }, 700)

    schedule(() => handleClose(), 2000)
  }, [visible, fadeAnim, contentScale, tileScale, labelOpacity, labelScale, schedule, handleClose, clearAllTimeouts])

  useEffect(() => {
    const id = fadeAnim.addListener(({ value }) => {
      latestFadeValue.current = value
    })
    return () => {
      fadeAnim.removeListener(id)
      clearAllTimeouts()
    }
  }, [fadeAnim, clearAllTimeouts])

  const newLevelColor = LEVEL_COLORS[currentLevel] ?? '#FF6B35'

  const confetti = useMemo(() => {
    if (!visible) return []
    const particleColors = [newLevelColor, '#FFD700', '#FF6B35', '#5FD068', '#42A5F5', '#FF5252', '#AB47BC', '#E040FB']
    return Array.from({ length: 32 }, (_, i) => ({
      id: i,
      delay: 400 + Math.random() * 400,
      color: particleColors[i % particleColors.length],
      startX: SCREEN_WIDTH * 0.2 + Math.random() * SCREEN_WIDTH * 0.6,
      startY: SCREEN_HEIGHT * 0.3 + (Math.random() - 0.5) * 60,
    }))
  }, [visible, newLevelColor])

  if (!visible && latestFadeValue.current === 0) {
    return null
  }

  const tileBg = isDark ? 'rgba(34,37,43,0.86)' : 'rgba(255,255,255,0.94)'
  const styles = createStyles(colors, isDark, newLevelColor)

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
      {confetti.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} startX={p.startX} startY={p.startY} />
      ))}

      <View style={styles.pressArea}>
        <Animated.View style={[styles.card, { transform: [{ scale: contentScale }] }]}>
          <Text style={styles.exerciseName} numberOfLines={2}>{exerciseName}</Text>

          <Animated.View style={{ opacity: labelOpacity, transform: [{ scale: labelScale }], alignItems: 'center', marginBottom: 32 }}>
            <Text style={[styles.rankUpLabel, { color: newLevelColor }]}>RANK UP!</Text>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: tileScale }] }}>
            <LiquidGlassSurface
              style={[styles.badgeTile, { backgroundColor: tileBg, borderColor: newLevelColor, borderWidth: 2 }]}
              debugLabel="exercise-rank-new"
            >
              <LinearGradient
                colors={[`${newLevelColor}40`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                pointerEvents="none"
              />
              <View style={styles.badgeVisualWrap}>
                <LevelBadge level={currentLevel} size="hero" showTooltipOnPress={false} />
              </View>
              <View style={styles.textStack}>
                <Text style={[styles.badgeName, { color: newLevelColor }]} numberOfLines={2}>
                  {currentLevel}
                </Text>
              </View>
              <View style={[styles.badgeStatusPill, { backgroundColor: `${newLevelColor}33` }]}>
                <Ionicons name="star" size={11} color={newLevelColor} style={{ marginRight: 3 }} />
                <Text style={[styles.badgeStatusText, { color: newLevelColor }]}>Unlocked</Text>
              </View>
            </LiquidGlassSurface>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

export const ExerciseRankOverlay = memo(ExerciseRankOverlayComponent)

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
  levelColor: string,
) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: -100,
      left: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT + 200,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.97)' : 'rgba(255, 255, 255, 0.97)',
    },
    pressArea: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: 32,
    },
    exerciseName: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textSecondary,
      textAlign: 'center',
      letterSpacing: 0.2,
      marginBottom: 24,
      textTransform: 'uppercase',
    },
    rankUpLabel: {
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: 4,
      textAlign: 'center',
    },
    badgeTile: {
      width: TILE_SIZE,
      minHeight: TILE_SIZE + 32,
      borderRadius: 22,
      paddingHorizontal: 12,
      paddingVertical: 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      shadowColor: levelColor,
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
  })

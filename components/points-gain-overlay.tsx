import { LevelBadge } from '@/components/LevelBadge'
import { useTheme } from '@/contexts/theme-context'
import { LEVEL_COLORS } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { LEVEL_POINT_ANCHORS } from '@/lib/overall-strength-score'
import type { StrengthLevel } from '@/lib/strength-standards'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    Text,
    View
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const BAR_HORIZONTAL_PADDING = 32

interface PointsGainOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
  previousScore: number
  currentScore: number
  previousLevel: StrengthLevel
  currentLevel: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number
  pointsGained: number
}

// Confetti particle
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
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: (startY ?? -20) + SCREEN_HEIGHT * 0.4,
          duration: 2200 + Math.random() * 800,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: drift,
          duration: 2200 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: (Math.random() - 0.5) * 8,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
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
          {
            rotate: rotate.interpolate({
              inputRange: [-4, 4],
              outputRange: ['-720deg', '720deg'],
            }),
          },
        ],
      }}
      pointerEvents="none"
    />
  )
}

function PointsGainOverlayComponent({
  visible,
  onAnimationComplete,
  previousScore,
  currentScore,
  previousLevel,
  currentLevel,
  nextLevel,
  progress,
  pointsGained,
}: PointsGainOverlayProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const isLevelUp = previousLevel !== currentLevel
  const oldLevelColor = LEVEL_COLORS[previousLevel] ?? '#FF6B35'
  const newLevelColor = LEVEL_COLORS[currentLevel] ?? '#FF6B35'

  // For level-up: the "old" next level is the currentLevel
  // Progress bar should show old level → old next level, and fill to 100%
  const oldNextLevel = isLevelUp ? currentLevel : nextLevel

  // Compute previous progress % within the OLD level's range
  const previousProgress = useMemo(() => {
    const target = oldNextLevel
    if (!target) return progress
    const levelFloor = LEVEL_POINT_ANCHORS[previousLevel]
    const levelCeiling = LEVEL_POINT_ANCHORS[target]
    const range = levelCeiling - levelFloor
    if (range <= 0) return 0
    const prev = Math.max(0, ((previousScore - levelFloor) / range) * 100)
    return Math.min(prev, 100)
  }, [previousScore, previousLevel, oldNextLevel, progress])

  // State for which "phase" we're in for level-up
  const [showNewLevel, setShowNewLevel] = useState(false)
  const [showLevelUpConfetti, setShowLevelUpConfetti] = useState(false)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const contentScale = useRef(new Animated.Value(0.85)).current
  const badgeScale = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const progressSectionOpacity = useRef(new Animated.Value(0)).current
  const gainBadgeScale = useRef(new Animated.Value(0)).current

  // Level-up specific anims
  const barFlashOpacity = useRef(new Animated.Value(0)).current
  const oldBadgeScale = useRef(new Animated.Value(1)).current
  const newBadgeScale = useRef(new Animated.Value(0)).current
  const levelUpTextOpacity = useRef(new Animated.Value(0)).current
  const levelUpTextScale = useRef(new Animated.Value(0.5)).current
  const newProgressAnim = useRef(new Animated.Value(0)).current
  const newProgressOpacity = useRef(new Animated.Value(0)).current

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
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(contentScale, {
        toValue: 0.85,
        duration: 350,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      onAnimationComplete?.()
    })
  }, [fadeAnim, contentScale, onAnimationComplete, clearAllTimeouts])

  // Reset everything
  const resetAnims = useCallback(() => {
    fadeAnim.setValue(0)
    contentScale.setValue(0.85)
    badgeScale.setValue(0)
    progressAnim.setValue(previousProgress)
    progressSectionOpacity.setValue(0)
    gainBadgeScale.setValue(0)
    barFlashOpacity.setValue(0)
    oldBadgeScale.setValue(1)
    newBadgeScale.setValue(0)
    levelUpTextOpacity.setValue(0)
    levelUpTextScale.setValue(0.5)
    newProgressAnim.setValue(0)
    newProgressOpacity.setValue(0)
    setShowNewLevel(false)
    setShowLevelUpConfetti(false)
  }, [
    fadeAnim, contentScale, badgeScale, progressAnim, progressSectionOpacity,
    gainBadgeScale, barFlashOpacity, oldBadgeScale, newBadgeScale,
    levelUpTextOpacity, levelUpTextScale, newProgressAnim, newProgressOpacity,
    previousProgress,
  ])

  useEffect(() => {
    if (!visible) {
      resetAnims()
      return
    }

    clearAllTimeouts()
    resetAnims()

    // === Stage 1: Fade in ===
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        tension: 100,
        friction: 12,
        useNativeDriver: false,
      }),
    ]).start()

    // === Stage 2: Badge pops ===
    schedule(() => {
      Animated.spring(badgeScale, {
        toValue: 1,
        tension: 140,
        friction: 7,
        useNativeDriver: false,
      }).start()
    }, 200)

    // === Stage 3: Progress bar appears ===
    schedule(() => {
      Animated.timing(progressSectionOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start()
    }, 450)

    if (isLevelUp) {
      // ===== LEVEL-UP FLOW =====

      // Stage 4: Bar fills to 100%
      schedule(() => {
        Animated.timing(progressAnim, {
          toValue: 100,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // width animation
        }).start()
      }, 800)

      // Stage 5: Bar flash + confetti burst
      schedule(() => {
        setShowLevelUpConfetti(true)

        // Flash the bar
        Animated.sequence([
          Animated.timing(barFlashOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(barFlashOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start()

        // Shrink old badge
        Animated.timing(oldBadgeScale, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }).start()
      }, 2100)

      // Stage 6: Show new level
      schedule(() => {
        setShowNewLevel(true)

        // Hide old progress bar
        Animated.timing(progressSectionOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start()

        // Pop in new badge BIG
        Animated.spring(newBadgeScale, {
          toValue: 1,
          tension: 80,
          friction: 5,
          useNativeDriver: false,
        }).start()

        // Level-up text
        Animated.parallel([
          Animated.timing(levelUpTextOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.spring(levelUpTextScale, {
            toValue: 1,
            tension: 120,
            friction: 8,
            useNativeDriver: false,
          }),
        ]).start()
      }, 2500)

      // Stage 7: Show new progress bar at new position
      if (nextLevel) {
        schedule(() => {
          Animated.timing(newProgressOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start()

          // Animate from 0 to current progress
          Animated.timing(newProgressAnim, {
            toValue: progress,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false, // width animation
          }).start()
        }, 3200)

        // Stage 8: "+X pts" badge pops in
        schedule(() => {
          Animated.spring(gainBadgeScale, {
            toValue: 1,
            tension: 160,
            friction: 5,
            useNativeDriver: false, // Shared view with progressAnim (left)
          }).start()
        }, 3800)

        schedule(() => handleClose(), 5800)
      }
    } else {
      // ===== NORMAL FLOW (no level-up) =====

      // Stage 4: Bar fills to new position
      schedule(() => {
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // width/left animation
        }).start()
      }, 800)

      // Stage 5: "+X pts" pops
      schedule(() => {
        Animated.spring(gainBadgeScale, {
          toValue: 1,
          tension: 160,
          friction: 5,
          useNativeDriver: false, // Shared view with progressAnim (left)
        }).start()
      }, 1600)

      schedule(() => handleClose(), 3600)
    }
  }, [
    visible,
    isLevelUp,
    previousProgress,
    progress,
    nextLevel,
    fadeAnim,
    contentScale,
    badgeScale,
    progressAnim,
    progressSectionOpacity,
    gainBadgeScale,
    barFlashOpacity,
    oldBadgeScale,
    newBadgeScale,
    levelUpTextOpacity,
    levelUpTextScale,
    newProgressAnim,
    newProgressOpacity,
    clearAllTimeouts,
    resetAnims,
    schedule,
    handleClose,
  ])

  useEffect(() => {
    const id = fadeAnim.addListener(({ value }) => {
      latestFadeValue.current = value
    })
    return () => {
      fadeAnim.removeListener(id)
      clearAllTimeouts()
    }
  }, [fadeAnim, clearAllTimeouts])

  // Regular confetti (initial)
  const confettiParticles = useMemo(() => {
    if (!visible) return []
    const particleColors = [
      oldLevelColor, '#FFD700', '#FF6B35', '#5FD068', '#42A5F5', '#FF5252', '#AB47BC',
    ]
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      delay: 150 + Math.random() * 500,
      color: particleColors[i % particleColors.length],
      startX: Math.random() * SCREEN_WIDTH,
    }))
  }, [visible, oldLevelColor])

  // Level-up confetti burst (many more, from center)
  const levelUpConfetti = useMemo(() => {
    if (!showLevelUpConfetti) return []
    const particleColors = [
      newLevelColor, '#FFD700', '#FF6B35', '#5FD068', '#42A5F5', '#FF5252', '#AB47BC', '#E040FB',
    ]
    const centerX = SCREEN_WIDTH / 2
    const centerY = SCREEN_HEIGHT * 0.35
    return Array.from({ length: 36 }, (_, i) => ({
      id: 1000 + i,
      delay: Math.random() * 300,
      color: particleColors[i % particleColors.length],
      startX: centerX + (Math.random() - 0.5) * 80,
      startY: centerY + (Math.random() - 0.5) * 40,
    }))
  }, [showLevelUpConfetti, newLevelColor])

  if (!visible && latestFadeValue.current === 0) {
    return null
  }

  const displayLevelColor = showNewLevel ? newLevelColor : oldLevelColor
  const displayNextLevel = showNewLevel ? nextLevel : oldNextLevel
  const styles = createStyles(colors, isDark, displayLevelColor)

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Initial confetti */}
      {confettiParticles.map((p) => (
        <ConfettiParticle
          key={p.id}
          delay={p.delay}
          color={p.color}
          startX={p.startX}
        />
      ))}

      {/* Level-up confetti burst */}
      {levelUpConfetti.map((p) => (
        <ConfettiParticle
          key={p.id}
          delay={p.delay}
          color={p.color}
          startX={p.startX}
          startY={p.startY}
        />
      ))}

      <View style={styles.pressArea}>
        <Animated.View
          style={[styles.card, { transform: [{ scale: contentScale }] }]}
        >
          {/* Badge area */}
          <View style={styles.badgeArea}>
            {/* Old badge (shrinks on level-up) */}
            {!showNewLevel && (
              <Animated.View
                style={[
                  styles.badgeWrapper,
                  {
                    transform: [
                      { scale: Animated.multiply(badgeScale, oldBadgeScale) },
                    ],
                  },
                ]}
              >
                <LevelBadge level={previousLevel} size="xl" />
              </Animated.View>
            )}

            {/* New badge (pops in on level-up) */}
            {showNewLevel && (
              <Animated.View
                style={[
                  styles.badgeWrapper,
                  { transform: [{ scale: newBadgeScale }] },
                ]}
              >
                <LevelBadge level={currentLevel} size="hero" />
              </Animated.View>
            )}
          </View>

          {/* Level name */}
          {!showNewLevel ? (
            <Text style={[styles.levelName, { color: oldLevelColor }]}>
              {previousLevel}
            </Text>
          ) : (
            <Animated.View
              style={{
                opacity: levelUpTextOpacity,
                transform: [{ scale: levelUpTextScale }],
              }}
            >
              <Text style={[styles.levelUpLabel, { color: newLevelColor }]}>
                LEVEL UP!
              </Text>
              <Text style={[styles.newLevelName, { color: newLevelColor }]}>
                {currentLevel}
              </Text>
            </Animated.View>
          )}

          {/* OLD Progress Bar (fills to 100% on level-up, or to progress normally) */}
          {!showNewLevel && displayNextLevel && (
            <Animated.View
              style={[styles.progressSection, { opacity: progressSectionOpacity }]}
            >
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: displayLevelColor,
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
                {/* Flash overlay on level-up */}
                {isLevelUp && (
                  <Animated.View
                    style={[
                      styles.progressFlash,
                      { opacity: barFlashOpacity },
                    ]}
                  />
                )}
              </View>

              {/* Labels row */}
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: displayLevelColor }]}>
                  {previousLevel}
                </Text>
                <Text style={styles.progressLabelNext}>{displayNextLevel}</Text>
              </View>

              {/* Floating "+X pts" badge positioned on the bar */}
              {!isLevelUp && (
                <View style={styles.floatingBadgeContainer}>
                  <Animated.View
                    style={[
                      styles.floatingBadgeWrapper,
                      {
                        left: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                        transform: [
                          { translateX: -50 }, // Center offset (half of 100px width)
                          { scale: gainBadgeScale },
                          { translateY: -38 }, // Move up above bar (lowered from -40)
                        ],
                      },
                    ]}
                  >
                    <View style={[styles.floatingBadge, { backgroundColor: displayLevelColor }]}>
                      <Text style={styles.floatingBadgeText}>+{pointsGained} pts</Text>
                    </View>
                    <View style={[styles.floatingBadgeTriangle, { borderTopColor: displayLevelColor }]} />
                  </Animated.View>
                </View>
              )}
            </Animated.View>
          )}

          {/* NEW Progress Bar (after level-up) */}
          {showNewLevel && nextLevel && (
            <Animated.View
              style={[styles.progressSection, { opacity: newProgressOpacity }]}
            >
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: newLevelColor,
                      width: newProgressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: newLevelColor }]}>
                  {currentLevel}
                </Text>
                <Text style={styles.progressLabelNext}>{nextLevel}</Text>
              </View>

              {/* Floating "+X pts" badge on new bar */}
              <View style={styles.floatingBadgeContainer}>
                <Animated.View
                  style={[
                    styles.floatingBadgeWrapper,
                    {
                      left: newProgressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                      transform: [
                        { translateX: -50 },
                        { scale: gainBadgeScale },
                        { translateY: -38 },
                      ],
                    },
                  ]}
                >
                  <View style={[styles.floatingBadge, { backgroundColor: newLevelColor }]}>
                    <Text style={styles.floatingBadgeText}>+{pointsGained} pts</Text>
                  </View>
                  <View style={[styles.floatingBadgeTriangle, { borderTopColor: newLevelColor }]} />
                </Animated.View>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  )
}

export const PointsGainOverlay = memo(PointsGainOverlayComponent)

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
      backgroundColor: isDark ? '#121212' : '#ffffff',
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
      paddingHorizontal: BAR_HORIZONTAL_PADDING,
    },
    badgeArea: {
      minHeight: 150,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: -10,
    },
    badgeWrapper: {},
    levelName: {
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 48,
    },
    levelUpLabel: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 5,
      textAlign: 'center',
      marginBottom: 4,
    },
    newLevelName: {
      fontSize: 42,
      fontWeight: '900',
      letterSpacing: 1,
      textAlign: 'center',
      marginBottom: 48,
    },
    progressSection: {
      width: '100%',
      alignItems: 'center',
      position: 'relative', // Context for floating badge
    },
    progressTrack: {
      width: '100%',
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      overflow: 'visible', // Allow badge to stick out if needed
    },
    progressFill: {
      height: '100%',
      borderRadius: 12,
    },
    progressFlash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#fff',
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
      color: colors.textTertiary,
    },
    // New floating badge styles
    floatingBadgeContainer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'visible',
      zIndex: 10,
    },
    floatingBadgeWrapper: {
      position: 'absolute',
      top: 0, 
      alignItems: 'center',
      width: 100,
    },
    floatingBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      minWidth: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
    },
    floatingBadgeText: {
      color: '#fff', 
      fontSize: 14,
      fontWeight: '900',
    },
    floatingBadgeTriangle: {
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 8, 
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      transform: [{ translateY: -1 }], // Small overlap to hide seam
    },
  })

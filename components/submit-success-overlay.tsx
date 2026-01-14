import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { memo, useEffect, useRef } from 'react'
import {
    Animated,
    Dimensions,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface StreakOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
  currentStreak?: number
  previousStreak?: number
}

/**
 * Premium streak celebration overlay that appears when the streak increases.
 * Inspired by the calendar page's streak hero design.
 * Features a large streak number with flame icon and motivational message.
 */
function StreakOverlayComponent({
  visible,
  onAnimationComplete,
  currentStreak = 0,
  previousStreak = 0,
}: StreakOverlayProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const streakNumberScale = useRef(new Animated.Value(0)).current
  const flameAnim = useRef(new Animated.Value(0)).current
  const messageAnim = useRef(new Animated.Value(20)).current
  const latestFadeValue = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.8)
      streakNumberScale.setValue(0)
      flameAnim.setValue(0)
      messageAnim.setValue(20)

      // Main overlay fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()

      // Streak number springs in with bounce
      setTimeout(() => {
        Animated.spring(streakNumberScale, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }).start()
      }, 200)

      // Flame icon appears with spring
      setTimeout(() => {
        Animated.spring(flameAnim, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }).start()
      }, 350)

      // Message slides up
      setTimeout(() => {
        Animated.timing(messageAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      }, 500)
    } else {
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.8)
      streakNumberScale.setValue(0)
      flameAnim.setValue(0)
      messageAnim.setValue(20)
    }
  }, [visible, fadeAnim, scaleAnim, streakNumberScale, flameAnim, messageAnim])

  useEffect(() => {
    const id = fadeAnim.addListener(({ value }) => {
      latestFadeValue.current = value
    })
    const timeoutId = timeoutRef.current
    return () => {
      fadeAnim.removeListener(id)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [fadeAnim])

  const handleClose = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAnimationComplete?.()
    })
  }

  if (!visible && latestFadeValue.current === 0) {
    return null
  }

  const styles = createStyles(colors)

  // Generate motivational message based on streak
  const getStreakMessage = () => {
    if (currentStreak >= 52) return "Legendary! A full year of consistency! 🏆"
    if (currentStreak >= 26) return "Half a year strong! Unstoppable! 🔥"
    if (currentStreak >= 12) return "3 months of fire! You're on a roll! 💪"
    if (currentStreak >= 8) return "2 months in! Keep crushing it! 🚀"
    if (currentStreak >= 4) return "A month of momentum! Amazing! ⚡"
    if (currentStreak >= 3) return "3 weeks and counting! 🎯"
    if (currentStreak >= 2) return "2 week streak! Building habits! 💫"
    return "Streak started! Here we go! 🌟"
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
          backgroundColor: isDark
            ? 'rgba(18, 18, 18, 0.97)'
            : 'rgba(255, 255, 255, 0.97)',
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Close Button */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Pressable
            style={[
              styles.iconCircle,
              { backgroundColor: `${colors.primary}15` },
            ]}
            onPress={handleClose}
            hitSlop={8}
          >
            <Ionicons name="checkmark" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {/* Streak Number + Flame Container */}
        <View style={styles.streakContainer}>
          <Animated.View
            style={[
              styles.streakNumberWrapper,
              {
                transform: [{ scale: streakNumberScale }],
              },
            ]}
          >
            <Text style={styles.streakNumber}>{currentStreak}</Text>
            <Text style={styles.streakUnit}>week{currentStreak !== 1 ? 's' : ''}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.flameWrapper,
              {
                transform: [
                  {
                    scale: flameAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                  {
                    rotate: flameAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: ['0deg', '-10deg', '0deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons
              name="flame"
              size={80}
              color="#FF5500"
              style={styles.flameIcon}
            />
          </Animated.View>
        </View>

        {/* Streak Label */}
        <Text style={styles.streakLabel}>STREAK!</Text>

        {/* Previous → Current */}
        {previousStreak > 0 && (
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {previousStreak} → {currentStreak} weeks
            </Text>
          </View>
        )}

        {/* Motivational Message */}
        <Animated.View
          style={[
            styles.messageContainer,
            {
              opacity: messageAnim.interpolate({
                inputRange: [0, 20],
                outputRange: [1, 0],
              }),
              transform: [{ translateY: messageAnim }],
            },
          ]}
        >
          <Text style={styles.messageText}>{getStreakMessage()}</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )
}

export const SubmitSuccessOverlay = memo(StreakOverlayComponent)

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
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
    },
    card: {
      backgroundColor: colors.feedCardBackground,
      borderRadius: 28,
      paddingHorizontal: 32,
      paddingVertical: 36,
      width: '85%',
      maxWidth: 360,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
      elevation: 16,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 16,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerSpacer: {
      width: 48,
      height: 48,
    },
    streakContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginBottom: 8,
    },
    streakNumberWrapper: {
      alignItems: 'flex-end',
    },
    streakNumber: {
      fontSize: 96,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 96,
      letterSpacing: -4,
      includeFontPadding: false,
    },
    streakUnit: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: -8,
      letterSpacing: -0.5,
    },
    flameWrapper: {
      marginLeft: 4,
      marginTop: 8,
    },
    flameIcon: {
      textShadowColor: 'rgba(255, 85, 0, 0.4)',
      textShadowOffset: { width: 0, height: 6 },
      textShadowRadius: 16,
    },
    streakLabel: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FF5500',
      letterSpacing: 3,
      marginTop: 4,
      marginBottom: 12,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      marginBottom: 16,
    },
    progressText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    messageContainer: {
      marginTop: 4,
    },
    messageText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 24,
    },
  })

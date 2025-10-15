import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface SubmitSuccessOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
  message?: string
  workoutNumber?: number
  weeklyTarget?: number
}

/**
 * Full-screen overlay that appears when submitting a workout.
 * Provides elegant visual feedback during the transition to feed.
 * Fades in smoothly, shows success indicator, then fades out.
 */
export function SubmitSuccessOverlay({
  visible,
  onAnimationComplete,
  message = 'Well done on completing another workout!',
  workoutNumber = 1,
  weeklyTarget = 3,
}: SubmitSuccessOverlayProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const latestFadeValue = useRef(0)

  useEffect(() => {
    if (visible) {
      // Reset progress animation
      progressAnim.setValue(0)

      // Smooth fade in + scale up animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()

      // Animate progress bar after a short delay
      setTimeout(() => {
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start()
      }, 400)

      // Wait for user to see success, then smooth fade out
      setTimeout(() => {
        // Smooth fade out + scale down animation (mirror of entrance)
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 600,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          onAnimationComplete?.()
        })
      }, 3700) // Show for 3.5 seconds before fade out
    } else {
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.8)
      progressAnim.setValue(0)
    }
  }, [visible, fadeAnim, scaleAnim, progressAnim, onAnimationComplete])

  useEffect(() => {
    const id = fadeAnim.addListener(({ value }) => {
      latestFadeValue.current = value
    })
    return () => {
      fadeAnim.removeListener(id)
    }
  }, [fadeAnim])

  if (!visible && latestFadeValue.current === 0) {
    return null
  }

  const styles = createStyles(colors)
  const progressPercentage = (workoutNumber / weeklyTarget) * 100
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.min(progressPercentage, 100)}%`],
  })

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
          backgroundColor: isDark
            ? 'rgba(18, 18, 18, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.successIndicator,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <View
            style={[styles.iconCircle, { backgroundColor: colors.primary }]}
          >
            <Image
              source={
                isDark
                  ? require('../llm/repai-logo-black.png')
                  : require('../llm/repai-logo-white.png')
              }
              style={styles.bicepIcon}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.workoutCountText}>
            {workoutNumber}
            {workoutNumber === 1
              ? 'st'
              : workoutNumber === 2
              ? 'nd'
              : workoutNumber === 3
              ? 'rd'
              : 'th'}{' '}
            workout logged this week
          </Text>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarBackground,
                { backgroundColor: colors.border },
              ]}
            >
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: progressWidth,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {workoutNumber} / {weeklyTarget} weekly goal
            </Text>
          </View>

          {workoutNumber === weeklyTarget && (
            <Text style={styles.congratsText}>
              🎉 Congratulations on reaching your target!
            </Text>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: -100, // Extend beyond safe area
      left: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT + 200, // Extra height to cover all areas
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    },
    successIndicator: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 36,
      borderRadius: 28,
      backgroundColor: colors.white,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 16,
      minWidth: 320,
    },
    iconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 28,
    },
    iconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    bicepIcon: {
      width: 60,
      height: 60,
    },
    statsContainer: {
      width: '100%',
      alignItems: 'center',
      gap: 16,
    },
    workoutCountText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    progressBarContainer: {
      width: '100%',
      gap: 8,
    },
    progressBarBackground: {
      width: '100%',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
    },
    congratsText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
      marginTop: 8,
    },
  })

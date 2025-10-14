import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef } from 'react'
import { Animated, Dimensions, StyleSheet, View } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface SubmitSuccessOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
}

/**
 * Full-screen overlay that appears when submitting a workout.
 * Provides elegant visual feedback during the transition to feed.
 * Fades in smoothly, shows success indicator, then fades out.
 */
export function SubmitSuccessOverlay({
  visible,
  onAnimationComplete,
}: SubmitSuccessOverlayProps) {
  const colors = useThemedColors()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const pageTranslateX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      // Fade in + scale up animation - slower, more deliberate
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start()

      // Wait longer for user to process success, then smooth page turn
      setTimeout(() => {
        // Book page turn: slide left while fading - ultra smooth, luxurious
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 1000, // Even slower, more elegant fade
            useNativeDriver: true,
          }),
          Animated.timing(pageTranslateX, {
            toValue: -100,
            duration: 1000, // Slower slide for graceful page turn
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 1000, // Slower scale for premium feel
            useNativeDriver: true,
          }),
        ]).start(() => {
          onAnimationComplete?.()
        })
      }, 1000) // Show for full second before page turn
    } else {
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.8)
      pageTranslateX.setValue(0)
    }
  }, [visible, fadeAnim, scaleAnim, pageTranslateX, onAnimationComplete])

  if (!visible && fadeAnim.__getValue() === 0) {
    return null
  }

  const styles = createStyles(colors)

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
          transform: [{ translateX: pageTranslateX }],
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
          <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
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
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    },
    successIndicator: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.white,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 12,
    },
    iconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
  })

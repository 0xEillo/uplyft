import { ReactNode, useEffect, useRef } from 'react'
import { Animated, Dimensions, StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@/contexts/theme-context'
import { getColors } from '@/constants/colors'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface SlideInViewProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Duration of the animation in milliseconds (default: 200) */
  duration?: number
  /** Delay before animation starts in milliseconds (default: 0) */
  delay?: number
  /** Whether to animate on mount (default: true) */
  enabled?: boolean
  /** Whether to include fade effect with slide (default: false) */
  fade?: boolean
  /** Background color (defaults to theme background color) */
  backgroundColor?: string
  /** Trigger exit animation (slides out to the right) */
  shouldExit?: boolean
  /** Callback when exit animation completes */
  onExitComplete?: () => void
}

/**
 * A reusable view component that slides in from the right to left.
 * Creates a smooth page transition effect similar to Strava's navigation.
 *
 * @example
 * ```tsx
 * <SlideInView>
 *   <YourPageContent />
 * </SlideInView>
 * ```
 */
export function SlideInView({
  children,
  style,
  duration = 200,
  delay = 0,
  enabled = true,
  fade = false,
  backgroundColor,
  shouldExit = false,
  onExitComplete,
}: SlideInViewProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const slideAnim = useRef(
    new Animated.Value(enabled ? SCREEN_WIDTH : 0)
  ).current
  const opacityAnim = useRef(new Animated.Value(fade && enabled ? 0 : 1)).current

  // Entry animation
  useEffect(() => {
    if (!enabled) {
      slideAnim.setValue(0)
      if (fade) {
        opacityAnim.setValue(1)
      }
      return
    }

    slideAnim.setValue(SCREEN_WIDTH)
    if (fade) {
      opacityAnim.setValue(0)
    }

    const animations = [
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]

    if (fade) {
      animations.push(
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: duration * 0.7, // Fade completes slightly before slide
          delay,
          useNativeDriver: true,
        })
      )
    }

    Animated.parallel(animations).start(() => {
      // Animation complete
    })
  }, [enabled, slideAnim, opacityAnim, duration, delay, fade])

  // Exit animation
  useEffect(() => {
    if (shouldExit) {
      const animations = [
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration,
          useNativeDriver: true,
        }),
      ]

      if (fade) {
        animations.push(
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: duration * 0.7,
            useNativeDriver: true,
          })
        )
      }

      Animated.parallel(animations).start(() => {
        onExitComplete?.()
      })
    }
  }, [shouldExit, slideAnim, opacityAnim, duration, fade, onExitComplete])

  const bgColor = backgroundColor || colors.background

  return (
    <Animated.View
      style={[
        {
          backgroundColor: bgColor,
          transform: [{ translateX: slideAnim }],
          opacity: fade ? opacityAnim : 1,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  )
}

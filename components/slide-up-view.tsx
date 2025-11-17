import { ReactNode, useEffect, useRef } from 'react'
import { Animated, Dimensions, StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@/contexts/theme-context'
import { getColors } from '@/constants/colors'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface SlideUpViewProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Duration of the animation in milliseconds (default: 400) */
  duration?: number
  /** Delay before animation starts in milliseconds (default: 0) */
  delay?: number
  /** Whether to animate on mount (default: true) */
  enabled?: boolean
  /** Whether to include fade effect with slide (default: true) */
  fade?: boolean
  /** Initial opacity when fade is enabled (default: 0) */
  fadeFrom?: number
  /** Background color (defaults to theme background color) */
  backgroundColor?: string
  /** Trigger exit animation (slides down) */
  shouldExit?: boolean
  /** Callback when exit animation completes */
  onExitComplete?: () => void
  /** Use spring animation instead of timing (default: true) */
  useSpring?: boolean
  /** Spring tension (default: 50) */
  tension?: number
  /** Spring friction (default: 9) */
  friction?: number
}

/**
 * A reusable view component that slides up from bottom to top.
 * Creates a smooth page transition effect for bottom sheets and modals.
 *
 * @example
 * ```tsx
 * <SlideUpView>
 *   <YourPageContent />
 * </SlideUpView>
 * ```
 */
export function SlideUpView({
  children,
  style,
  duration = 2000,
  delay = 0,
  enabled = true,
  fade = true,
  fadeFrom = 0,
  backgroundColor,
  shouldExit = false,
  onExitComplete,
  useSpring = true,
  tension = 40,
  friction = 10,
}: SlideUpViewProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const slideAnim = useRef(
    new Animated.Value(enabled ? SCREEN_HEIGHT : 0)
  ).current
  const opacityAnim = useRef(new Animated.Value(fade && enabled ? fadeFrom : 1)).current


  // Entry animation
  useEffect(() => {
    if (enabled) {
      const animations = []

      if (useSpring) {
        animations.push(
          Animated.spring(slideAnim, {
            toValue: 0,
            tension,
            friction,
            useNativeDriver: true,
          })
        )
      } else {
        animations.push(
          Animated.timing(slideAnim, {
            toValue: 0,
            duration,
            delay,
            useNativeDriver: true,
          })
        )
      }

      if (fade) {
        animations.push(
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: useSpring ? duration : duration * 0.7,
            delay,
            useNativeDriver: true,
          })
        )
      }

      Animated.parallel(animations).start()
    }
  }, [enabled, slideAnim, opacityAnim, duration, delay, fade, useSpring, tension, friction])

  // Exit animation
  useEffect(() => {
    if (shouldExit) {
      const animations = [
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration,
          useNativeDriver: true,
        }),
      ]

      if (fade) {
        animations.push(
          Animated.timing(opacityAnim, {
            toValue: fadeFrom,
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

  if (!enabled) {
    return <Animated.View style={[{ backgroundColor: bgColor }, style]}>{children}</Animated.View>
  }

  return (
    <Animated.View
      style={[
        {
          backgroundColor: bgColor,
          transform: [{ translateY: slideAnim }],
          opacity: fade ? opacityAnim : 1,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  )
}

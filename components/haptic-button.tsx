import { haptic, HapticIntensity } from '@/lib/haptics'
import { ComponentProps, useRef } from 'react'
import { Animated, StyleProp, TouchableOpacity, ViewStyle } from 'react-native'

interface HapticButtonProps extends ComponentProps<typeof TouchableOpacity> {
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  children: React.ReactNode
  hapticEnabled?: boolean
  /** Haptic intensity: 'light' for subtle interactions, 'medium' for important actions */
  hapticIntensity?: HapticIntensity
}

/**
 * A TouchableOpacity with built-in spring scale animation and haptic feedback.
 * Provides consistent premium interaction feel across the app.
 */
export function HapticButton({
  onPress,
  style,
  disabled,
  children,
  hapticEnabled = true,
  hapticIntensity = 'medium',
  ...props
}: HapticButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    if (disabled) return

    // Trigger haptic feedback
    if (hapticEnabled) {
      haptic(hapticIntensity)
    }

    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 300,
      friction: 16,
    }).start()
  }

  const handlePressOut = () => {
    if (disabled) return

    // Scale back up animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 16,
    }).start()
  }

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={1}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  )
}

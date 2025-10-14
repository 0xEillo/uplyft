import * as Haptics from 'expo-haptics'
import { ComponentProps, useRef } from 'react'
import { Animated, StyleProp, TouchableOpacity, ViewStyle } from 'react-native'

interface HapticButtonProps extends ComponentProps<typeof TouchableOpacity> {
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  children: React.ReactNode
  hapticEnabled?: boolean
  hapticStyle?: 'selection' | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
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
  hapticStyle = 'heavy',
  ...props
}: HapticButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    if (disabled) return

    // Trigger haptic feedback
    if (hapticEnabled) {
      switch (hapticStyle) {
        case 'selection':
          Haptics.selectionAsync()
          break
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          break
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          break
        case 'soft':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
          break
        case 'rigid':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
          break
        case 'heavy':
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }
    }

    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start()
  }

  const handlePressOut = () => {
    if (disabled) return

    // Scale back up animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
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

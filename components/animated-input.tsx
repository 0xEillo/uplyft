import { ComponentProps, useRef } from 'react'
import {
  Animated,
  StyleProp,
  TextInput,
  TextStyle,
} from 'react-native'

interface AnimatedInputProps extends ComponentProps<typeof TextInput> {
  style?: StyleProp<TextStyle>
  onFocus?: () => void
  onBlur?: () => void
}

/**
 * A TextInput with subtle scale animation on focus.
 * Provides visual feedback when input is active.
 */
export function AnimatedInput({
  style,
  onFocus,
  onBlur,
  ...props
}: AnimatedInputProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handleFocus = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start()

    onFocus?.()
  }

  const handleBlur = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start()

    onBlur?.()
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TextInput
        {...props}
        style={style}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </Animated.View>
  )
}

import { Ionicons } from '@expo/vector-icons'
import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated'

interface AnimatedFireProps {
  size?: number
  isActive?: boolean
  inactiveColor?: string
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>
}

export function AnimatedFire({
  size = 64,
  isActive = true,
  inactiveColor = '#cccccc',
  style,
}: AnimatedFireProps) {
  // Main flame animation
  const mainScale = useSharedValue(1)
  const mainRotate = useSharedValue(0)

  // Inner flame animation
  const innerScale = useSharedValue(1)
  const innerTranslateY = useSharedValue(0)

  // Spark animations
  const spark1TranslateY = useSharedValue(0)
  const spark1Opacity = useSharedValue(0)
  const spark1Scale = useSharedValue(0.5)

  const spark2TranslateY = useSharedValue(0)
  const spark2Opacity = useSharedValue(0)
  const spark2Scale = useSharedValue(0.5)

  useEffect(() => {
    if (isActive) {
      // Main flame breathing effect
      mainScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite
        true // reverse
      )

      mainRotate.value = withRepeat(
        withSequence(
          withTiming(2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(-2, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )

      // Inner flame moves slightly independently
      innerScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.95, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
      
      innerTranslateY.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )

      // Spark 1 loop
      spark1TranslateY.value = withRepeat(
        withSequence(
          withTiming(-size * 0.4, { duration: 1500, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 }) // reset instantly
        ),
        -1,
        false
      )
      spark1Opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 300 }),
          withTiming(0, { duration: 1200 }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )

      // Spark 2 loop (delayed)
      spark2TranslateY.value = withDelay(
        750,
        withRepeat(
          withSequence(
            withTiming(-size * 0.5, { duration: 1800, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 0 })
          ),
          -1,
          false
        )
      )
      spark2Opacity.value = withDelay(
        750,
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 400 }),
            withTiming(0, { duration: 1400 }),
            withTiming(0, { duration: 0 })
          ),
          -1,
          false
        )
      )
    } else {
      // Reset animations if inactive
      mainScale.value = 1
      mainRotate.value = 0
      innerScale.value = 1
      innerTranslateY.value = 0
      spark1Opacity.value = 0
      spark2Opacity.value = 0
    }
  }, [isActive, size])

  const mainFlameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: mainScale.value },
      { rotate: `${mainRotate.value}deg` },
    ],
  }))

  const innerFlameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: innerScale.value },
      { translateY: innerTranslateY.value },
    ],
  }))

  const spark1Style = useAnimatedStyle(() => ({
    opacity: spark1Opacity.value,
    transform: [
      { translateY: spark1TranslateY.value },
      { scale: spark1Scale.value },
    ],
  }))

  const spark2Style = useAnimatedStyle(() => ({
    opacity: spark2Opacity.value,
    transform: [
      { translateY: spark2TranslateY.value },
      { scale: spark2Scale.value },
    ],
  }))

  if (!isActive) {
    return (
      <View style={[[{ width: size, height: size }, styles.container], style]}>
        <Ionicons name="flame" size={size} color={inactiveColor} />
      </View>
    )
  }

  return (
    <View style={[[{ width: size, height: size }, styles.container], style]}>
      {/* Sparks */}
      <Animated.View style={[styles.sparkContainer, styles.spark1, spark1Style]}>
        <Ionicons name="flame" size={size * 0.25} color="#FFB000" />
      </Animated.View>
      <Animated.View style={[styles.sparkContainer, styles.spark2, spark2Style]}>
        <Ionicons name="flame" size={size * 0.15} color="#FF6A00" />
      </Animated.View>

      {/* Main Back Flame (Red/Dark Orange) */}
      <Animated.View style={[styles.iconContainer, mainFlameStyle]}>
        <Ionicons name="flame" size={size} color="#FF4500" />
      </Animated.View>

      {/* Middle Flame (Orange) */}
      <Animated.View style={[styles.iconContainer, mainFlameStyle, { top: size * 0.1 }]}>
        <Ionicons name="flame" size={size * 0.85} color="#FF8C00" />
      </Animated.View>

      {/* Inner Flame (Yellow) */}
      <Animated.View style={[styles.iconContainer, innerFlameStyle, { top: size * 0.3 }]}>
        <Ionicons name="flame" size={size * 0.6} color="#FFD700" />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkContainer: {
    position: 'absolute',
    bottom: '40%',
  },
  spark1: {
    left: '10%',
  },
  spark2: {
    right: '15%',
  }
})

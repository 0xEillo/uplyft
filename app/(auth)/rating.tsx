import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

// Animated TouchableOpacity with press animation
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

// Animated Button with scale press effect
function AnimatedButton({
  onPress,
  style,
  children,
}: {
  onPress: () => void
  style: any
  children: React.ReactNode
}) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 })
  }

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      {children}
    </AnimatedTouchable>
  )
}

export default function RatingScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const handleNext = () => {
    router.push({
      pathname: '/(auth)/submit-review',
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <Animated.Text
          style={styles.title}
          entering={FadeInUp.delay(100).springify()}
        >
          Give us a rating
        </Animated.Text>

        {/* Rating Stars Visual */}
        <Animated.View
          style={styles.starsWrapper}
          entering={FadeInUp.delay(200).springify()}
        >
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star, index) => (
              <Animated.View
                key={star}
                entering={FadeInUp.delay(300 + index * 80).springify()}
              >
                <Ionicons name="star" size={40} color="#FFD700" />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.Text
          style={styles.subtitle}
          entering={FadeInUp.delay(700).springify()}
        >
          As a solo dev and gym goer, building Rep AI for the lifting community,
          your rating means a lot. It helps Rep AI reach more lifters!
        </Animated.Text>
      </View>

      {/* Actions */}
      <Animated.View
        style={styles.footer}
        entering={FadeInUp.delay(800).springify()}
      >
        <AnimatedButton style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next</Text>
        </AnimatedButton>
      </Animated.View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    starsWrapper: {
      backgroundColor: colors.white,
      paddingHorizontal: 24,
      paddingVertical: 20,
      borderRadius: 16,
      marginBottom: 32,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    starsContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 16,
    },
    footer: {
      paddingHorizontal: 32,
      paddingVertical: 16,
      paddingBottom: 32,
    },
    nextButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nextButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
  })

import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
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

// Sparkle component with individual animation
function Sparkle({ index, colors }: { index: number; colors: any }) {
  const angle = (index / 12) * Math.PI * 2
  const distance = 80

  const opacity = useSharedValue(0)
  const scale = useSharedValue(0)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  useEffect(() => {
    // Sparkle out animation
    opacity.value = withDelay(600, withTiming(1, { duration: 400 }))
    scale.value = withDelay(600, withTiming(1, { duration: 400 }))
    translateX.value = withDelay(
      600,
      withTiming(Math.cos(angle) * distance, { duration: 800 }),
    )
    translateY.value = withDelay(
      600,
      withTiming(Math.sin(angle) * distance, { duration: 800 }),
    )

    // Fade out
    opacity.value = withDelay(1400, withTiming(0, { duration: 400 }))
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="sparkles" size={20} color={colors.primary} />
    </Animated.View>
  )
}

export default function CongratulationsScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  // Parse onboarding data to get user's name
  const onboardingData = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null
  const userName = onboardingData?.name || 'Champion'

  const handleContinue = () => {
    router.push({
      pathname: '/(auth)/rating',
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.celebrationContainer}>
          {/* Checkmark Icon */}
          <Animated.View
            style={styles.iconContainer}
            entering={FadeInDown.delay(100).springify()}
          >
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={colors.primary}
            />

            {/* Sparkles */}
            {Array.from({ length: 12 }).map((_, index) => (
              <Sparkle key={index} index={index} colors={colors} />
            ))}
          </Animated.View>

          {/* Congratulations Text */}
          <Animated.Text
            style={styles.title}
            entering={FadeInDown.delay(200).springify()}
          >
            Congratulations, {userName}!
          </Animated.Text>
          <Animated.Text
            style={styles.subtitle}
            entering={FadeInDown.delay(300).springify()}
          >
            Your Profile is ready
          </Animated.Text>

          {/* Success Message */}
          <Animated.View
            style={styles.messageBox}
            entering={FadeInDown.delay(400).springify()}
          >
            <Ionicons name="checkmark-circle" size={32} color="#10B981" />
            <Text style={styles.messageText}>
              Your personalized AI coach knows your goals, stats, and
              preferences.
            </Text>
          </Animated.View>
        </View>

        {/* Continue Button */}
        <Animated.View
          style={styles.footer}
          entering={FadeInDown.delay(500).springify()}
        >
          <AnimatedButton
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Finish</Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={colors.buttonText}
            />
          </AnimatedButton>
        </Animated.View>
      </View>
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
      justifyContent: 'space-between',
      paddingVertical: 48,
    },
    celebrationContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
      overflow: 'visible',
    },
    sparkle: {
      position: 'absolute',
    },
    title: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 32,
      textAlign: 'center',
    },
    messageBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#10B98120',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 12,
      marginBottom: 32,
      borderLeftWidth: 4,
      borderLeftColor: '#10B981',
    },
    messageText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      lineHeight: 22,
    },
    achievementsContainer: {
      gap: 12,
      width: '100%',
      marginBottom: 24,
    },
    achievementCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
    },
    achievementText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    quoteContainer: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
    },
    quote: {
      fontSize: 15,
      fontStyle: 'italic',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    footer: {
      gap: 16,
    },
    continueButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    continueButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    footerNote: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  })

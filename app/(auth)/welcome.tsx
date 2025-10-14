import { HapticButton } from '@/components/haptic-button'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Link, router } from 'expo-router'
import { useEffect } from 'react'
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function WelcomeScreen() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { width } = useWindowDimensions()
  const styles = createStyles(colors)

  const translateX = useSharedValue(0)
  const savedOffset = useSharedValue(0)
  const isAutoPlaying = useSharedValue(true)

  const startAutoAnimation = () => {
    translateX.value = withRepeat(
      withSequence(
        withDelay(
          2500,
          withTiming(-width, {
            duration: 800,
            easing: Easing.bezier(0.43, 0.13, 0.23, 0.96),
          }),
        ),
        withDelay(
          2500,
          withTiming(0, {
            duration: 800,
            easing: Easing.bezier(0.43, 0.13, 0.23, 0.96),
          }),
        ),
      ),
      -1,
      false,
    )
  }

  useEffect(() => {
    startAutoAnimation()
  }, [width])

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isAutoPlaying.value = false
      cancelAnimation(translateX)
      savedOffset.value = translateX.value
    })
    .onUpdate((event) => {
      translateX.value = savedOffset.value + event.translationX
    })
    .onEnd((event) => {
      const velocity = event.velocityX

      // Use decay for momentum, then snap to nearest screen
      translateX.value = withDecay(
        {
          velocity: velocity,
          deceleration: 0.998,
          clamp: [-width, 0],
        },
        (finished) => {
          if (finished) {
            // Snap to nearest screen
            const currentPosition = translateX.value
            const targetPosition = currentPosition < -width / 2 ? -width : 0

            translateX.value = withSpring(targetPosition, {
              damping: 15,
              stiffness: 100,
              overshootClamping: false,
            })

            savedOffset.value = targetPosition

            // Restart auto-animation after 3 seconds
            translateX.value = withDelay(
              3000,
              withSequence(
                withTiming(translateX.value, { duration: 0 }),
                withRepeat(
                  withSequence(
                    withDelay(
                      2500,
                      withTiming(targetPosition === 0 ? -width : 0, {
                        duration: 800,
                        easing: Easing.bezier(0.43, 0.13, 0.23, 0.96),
                      }),
                    ),
                    withDelay(
                      2500,
                      withTiming(targetPosition === 0 ? 0 : -width, {
                        duration: 800,
                        easing: Easing.bezier(0.43, 0.13, 0.23, 0.96),
                      }),
                    ),
                  ),
                  -1,
                  false,
                ),
              ),
            )
          }
        },
      )
    })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Hero Image */}
        <View style={[styles.header, { width }]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.imageContainer, animatedStyle]}>
              <Image
                source={require('@/docs/notes-screen.png')}
                style={[styles.heroImage, { width }]}
                resizeMode="contain"
              />
              <Image
                source={require('@/docs/workout-screen.png')}
                style={[styles.heroImage, { width }]}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Hook & CTA */}
        <View style={styles.actions}>
          <Text style={styles.subtitle}>Workout tracking made easy</Text>
          <HapticButton
            style={styles.getStartedButton}
            onPress={() => router.push('/(auth)/onboarding')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </HapticButton>
          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.signInLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
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
    },
    header: {
      height: '64%',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      paddingTop: 24,
      overflow: 'hidden',
    },
    imageContainer: {
      flexDirection: 'row',
      height: '100%',
    },
    heroImage: {
      height: '100%',
    },
    subtitle: {
      fontSize: 30,
      color: colors.text,
      fontWeight: '700',
      marginTop: 20,
      marginBottom: 10,
      textAlign: 'center',
    },
    actions: {
      gap: 16,
      paddingHorizontal: 32,
      paddingTop: 64,
      paddingBottom: 48,
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    signInPrompt: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    signInLink: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    getStartedButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    getStartedText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    signInButton: {
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
    },
    signInText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  })

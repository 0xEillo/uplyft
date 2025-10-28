import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const MESSAGES = [
  'Building your AI profile...',
  'Processing your data...',
  'Creating your custom plan...',
  'Analyzing your fitness profile...',
]

const TOTAL_DURATION = 4000 // 4 seconds
const MESSAGE_DURATION = TOTAL_DURATION / MESSAGES.length // ~1000ms per message

export default function ProcessingScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { trackEvent } = useAnalytics()
  const onboardingData = useRef(params.onboarding_data as string).current
  const processingStartTime = useRef(Date.now()).current

  // Animation refs
  const rotationAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [progressPercentage, setProgressPercentage] = useState(0)

  useEffect(() => {
    // Track processing started
    trackEvent(AnalyticsEvents.PROCESSING_STARTED, {})

    // Success haptic when screen appears
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Animate fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()

    // Continuous rotation animation
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    ).start()

    // Update progress percentage every 50ms
    const progressInterval = setInterval(() => {
      setProgressPercentage((prev) => {
        const next = prev + (50 / TOTAL_DURATION) * 100
        return Math.min(next, 100)
      })
    }, 50)

    // Cycle through messages
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % MESSAGES.length)
    }, MESSAGE_DURATION)

    return () => {
      clearInterval(progressInterval)
      clearInterval(messageInterval)
    }
  }, [onboardingData, fadeAnim, rotationAnim, trackEvent])

  // Navigate when progress reaches 100%
  useEffect(() => {
    if (progressPercentage >= 100) {
      const processingDuration = Date.now() - processingStartTime

      trackEvent(AnalyticsEvents.PROCESSING_COMPLETED, {
        duration: processingDuration,
      })

      router.push({
        pathname: '/(auth)/congratulations',
        params: {
          onboarding_data: onboardingData,
        },
      })
    }
  }, [progressPercentage, onboardingData, processingStartTime, trackEvent])

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Progress Circle Container */}
        <View style={styles.progressContainer}>
          {/* Background circle */}
          <View
            style={[
              styles.circleBase,
              {
                borderColor: colors.border,
              },
            ]}
          />

          {/* Rotating progress circle */}
          <Animated.View
            style={[
              styles.circleProgress,
              {
                transform: [{ rotate: rotation }],
                borderTopColor: colors.primary,
                borderRightColor: colors.primary,
                borderBottomColor: colors.border,
                borderLeftColor: colors.border,
              },
            ]}
          />

          {/* Center content with percentage */}
          <View style={styles.centerContent}>
            <Text style={styles.progressText}>
              {Math.round(progressPercentage)}%
            </Text>
          </View>
        </View>

        {/* Loading Message */}
        <Animated.Text
          key={currentMessageIndex}
          style={[
            styles.message,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {MESSAGES[currentMessageIndex]}
        </Animated.Text>
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
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    progressContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 56,
      height: 200,
      width: 200,
      position: 'relative',
    },
    circleBase: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 6,
      backgroundColor: colors.primary + '08',
    },
    circleProgress: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 6,
    },
    centerContent: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressText: {
      fontSize: 40,
      fontWeight: '700',
      color: colors.primary,
    },
    message: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 24,
      minHeight: 60,
    },
  })

import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { requestReview } from '@/lib/rating'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const NATIVE_DIALOG_DELAY = 1000 // 1 second before auto-opening native dialog

export default function ReviewScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, insets)

  const [hasShownReview, setHasShownReview] = useState(false)

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const reviewCardSlideAnim = useRef(new Animated.Value(100)).current
  const reviewCardFadeAnim = useRef(new Animated.Value(0)).current
  const confettiRef = useRef<any>(null)

  useEffect(() => {
    // Track page view
    trackEvent(AnalyticsEvents.REVIEW_PROMPT_ONBOARDING_VIEWED, {})

    // Start confetti celebration!
    setTimeout(() => {
      confettiRef.current?.start()
    }, 200)

    // Animate celebration content in immediately
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start()

    // Animate review card in immediately (slide up from bottom)
    Animated.parallel([
      Animated.spring(reviewCardSlideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
        delay: 300,
      }),
      Animated.timing(reviewCardFadeAnim, {
        toValue: 1,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start()

    // Auto-open the native review dialog after 1.5s
    const dialogTimer = setTimeout(async () => {
      if (!hasShownReview) {
        // Haptic feedback when dialog opens
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          hapticSuccess()
        }

        trackEvent(AnalyticsEvents.REVIEW_PROMPT_ONBOARDING_ACCEPTED, {})

        // Show native review dialog
        await requestReview()

        setHasShownReview(true)
      }
    }, NATIVE_DIALOG_DELAY)

    return () => clearTimeout(dialogTimer)
  }, [
    fadeAnim,
    scaleAnim,
    slideAnim,
    reviewCardSlideAnim,
    reviewCardFadeAnim,
    hasShownReview,
    trackEvent,
  ])

  const handleContinue = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      haptic('medium')
    }

    // Only track as dismissed if they didn't see the review dialog
    if (!hasShownReview) {
      trackEvent(AnalyticsEvents.REVIEW_PROMPT_ONBOARDING_DISMISSED, {})
    }

    // Navigate to signup options
    router.push({
      pathname: '/(auth)/signup-options',
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Confetti Celebration */}
      <ConfettiCannon
        ref={confettiRef}
        count={200}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut
        explosionSpeed={350}
        fallSpeed={3000}
        colors={[colors.brandPrimary, '#FFD700', '#FFA500', '#FF6B35', '#4ECDC4']}
      />

      <View style={styles.wrapper}>
        {/* Celebration Content */}
        <View style={styles.content}>
          {/* Celebration Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="trophy" size={64} color={colors.brandPrimary} />
            </View>
          </Animated.View>

          {/* Headline */}
          <Animated.Text
            style={[
              styles.headline,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            Thank you for joining Rep AI!
          </Animated.Text>

          {/* Subtext */}
          <Animated.Text
            style={[
              styles.subtext,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            Your profile is ready and you&apos;re all set to start your fitness
            journey
          </Animated.Text>
        </View>

        {/* Review Card - Slides up from bottom */}
        <Animated.View
          style={[
            styles.reviewCard,
            {
              opacity: reviewCardFadeAnim,
              transform: [
                {
                  translateY: reviewCardSlideAnim,
                },
              ],
            },
          ]}
        >
          {/* Stars */}
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name="star"
                size={32}
                color={colors.brandPrimary}
                style={styles.star}
              />
            ))}
          </View>

          {/* Message */}
          <Text style={styles.reviewMessage}>
            Support us with a 5-star review
          </Text>

          {/* Benefit Text */}
          <Text style={styles.benefitText}>
            Takes 5 seconds and helps us grow!
          </Text>

          {/* Continue Button */}
          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.onPrimary}
              style={styles.buttonIcon}
            />
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { top: number; bottom: number; left: number; right: number },
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    wrapper: {
      flex: 1,
      justifyContent: 'space-between',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingTop: 60,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },
    iconWrapper: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.brandPrimary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headline: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 38,
    },
    subtext: {
      fontSize: 17,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
      paddingHorizontal: 8,
    },
    reviewCard: {
      backgroundColor: colors.surfaceSubtle,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: Math.max(insets.bottom, 20) + 24,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      gap: 8,
    },
    star: {
      marginHorizontal: 2,
    },
    reviewMessage: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 30,
    },
    benefitText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 22,
    },
    continueButton: {
      height: 56,
      backgroundColor: colors.brandPrimary,
      borderRadius: 28,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    continueButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    continueButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    buttonIcon: {
      marginLeft: 4,
    },
  })

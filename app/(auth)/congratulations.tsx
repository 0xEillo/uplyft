import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CongratulationsScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const [fadeAnim] = useState(new Animated.Value(0))
  const [scaleAnim] = useState(new Animated.Value(0.5))

  // Sparkle animations
  const sparkles = Array.from({ length: 12 }, () => ({
    opacity: new Animated.Value(0),
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0),
    scale: new Animated.Value(0),
  }))

  // Parse onboarding data to get user's name
  const onboardingData = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null
  const userName = onboardingData?.name || 'Champion'

  useEffect(() => {
    // Animate entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After main animation, trigger sparkles
      const sparkleAnimations = sparkles.map((sparkle, index) => {
        const angle = (index / sparkles.length) * Math.PI * 2
        const distance = 80

        return Animated.parallel([
          Animated.timing(sparkle.opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle.scale, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle.translateX, {
            toValue: Math.cos(angle) * distance,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle.translateY, {
            toValue: Math.sin(angle) * distance,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      })

      Animated.sequence([
        Animated.parallel(sparkleAnimations),
        Animated.parallel(
          sparkles.map((sparkle) =>
            Animated.timing(sparkle.opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ),
        ),
      ]).start()
    })
  }, [])

  const handleContinue = () => {
    router.push({
      pathname: '/(auth)/signup',
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.celebrationContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Checkmark Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={colors.primary}
            />

            {/* Sparkles */}
            {sparkles.map((sparkle, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.sparkle,
                  {
                    opacity: sparkle.opacity,
                    transform: [
                      { translateX: sparkle.translateX },
                      { translateY: sparkle.translateY },
                      { scale: sparkle.scale },
                    ],
                  },
                ]}
              >
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              </Animated.View>
            ))}
          </View>

          {/* Congratulations Text */}
          <Text style={styles.title}>Congratulations, {userName}!</Text>
          <Text style={styles.subtitle}>Your Profile is ready!</Text>

          {/* Success Message */}
          <View style={styles.messageBox}>
            <Ionicons name="checkmark-circle" size={32} color="#10B981" />
            <Text style={styles.messageText}>
              Your personalized AI coach knows your goals, stats, and
              preferences.
            </Text>
          </View>
        </Animated.View>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Finish</Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={colors.buttonText}
            />
          </TouchableOpacity>
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

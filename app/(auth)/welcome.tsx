import { HapticButton } from '@/components/haptic-button'
import { SignInBottomSheet } from '@/components/sign-in-bottom-sheet'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { COACH_OPTIONS } from '@/lib/coaches'
import { Asset } from 'expo-asset'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

const IMAGES = [
  require('@/assets/images/user-carousel/Generated Image December 10, 2025 - 1_08PM.jpeg'),
  require('@/assets/images/user-carousel/Generated Image December 10, 2025 - 1_14PM.jpeg'),
  require('@/assets/images/user-carousel/Generated Image December 10, 2025 - 1_12PM.jpeg'),
  require('@/assets/images/user-carousel/Generated Image December 10, 2025 - 1_15PM.jpeg'),
  require('@/assets/images/user-carousel/Generated Image December 10, 2025 - 1_16PM.jpeg'),
  require('@/assets/images/user-carousel/Generated Image December 10, 2025 - 1_17PM.jpeg'),
  require('@/assets/images/user-carousel/Generated Image December 10, 2025 - 1_12PM (1).jpeg'),
]

// Duplicate images to create infinite scroll effect
const CAROUSEL_IMAGES = [...IMAGES, ...IMAGES, ...IMAGES]
const ITEM_WIDTH = 200
const ITEM_SPACING = 20

export default function WelcomeScreen() {
  const [showSignInSheet, setShowSignInSheet] = useState(false)
  const { trackEvent } = useAnalytics()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const translateX = useSharedValue(0)

  useEffect(() => {
    trackEvent(AnalyticsEvents.AUTH_WELCOME_VIEWED, {
      step_name: 'welcome',
      timestamp: Date.now(),
    })
  }, [trackEvent])

  // Preload coach images so they're ready for onboarding
  useEffect(() => {
    const preloadCoachImages = async () => {
      const imageAssets = COACH_OPTIONS.map((coach) =>
        Asset.fromModule(coach.image).downloadAsync(),
      )
      await Promise.all(imageAssets)
    }
    preloadCoachImages()
  }, [])

  useEffect(() => {
    const totalWidth = IMAGES.length * (ITEM_WIDTH + ITEM_SPACING)
    translateX.value = withRepeat(
      withTiming(-totalWidth, {
        duration: 20000,
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false, // Do not reverse
    )
  }, [translateX])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  return (
    <LinearGradient
      colors={['#FFF5F0', '#FFFFFF', '#FFFFFF']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>Rep AI</Text>
          </View>

          {/* Carousel - flex: 1 takes remaining space */}
          <View style={styles.carouselContainer}>
            <Animated.View style={[styles.carouselTrack, animatedStyle]}>
              {CAROUSEL_IMAGES.map((img, index) => {
                // Add some rotation to mimic the "scattered" look
                const rotate = index % 2 === 0 ? '-6deg' : '6deg'
                const translateY = index % 2 === 0 ? -20 : 20
                return (
                  <View
                    key={index}
                    style={[
                      styles.cardContainer,
                      {
                        transform: [{ rotate }, { translateY }],
                      },
                    ]}
                  >
                    <Image
                      source={img}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                  </View>
                )
              })}
            </Animated.View>
          </View>

          {/* Bottom Actions */}
          <View style={styles.actions}>
            <View style={styles.textContainer}>
              <Text style={styles.title}>Your AI personal trainer.</Text>
              <Text style={styles.subtitle}>
                Champions aren&apos;t born. They&apos;re trained.
              </Text>
            </View>

            <HapticButton
              style={styles.getStartedButton}
              onPress={() => router.push('/(auth)/onboarding')}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </HapticButton>

            <View style={styles.signInRow}>
              <TouchableOpacity onPress={() => setShowSignInSheet(true)}>
                <Text style={styles.signInPrompt}>Already a member?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SignInBottomSheet
          visible={showSignInSheet}
          onClose={() => setShowSignInSheet(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      paddingTop: 50,
      zIndex: 10,
    },
    logoText: {
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 4,
      color: '#000',
    },
    carouselContainer: {
      flex: 1,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    carouselTrack: {
      flexDirection: 'row',
      paddingLeft: 20,
      alignItems: 'center',
    },
    cardContainer: {
      width: ITEM_WIDTH,
      height: 280,
      marginRight: ITEM_SPACING,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 5,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardImage: {
      width: '100%',
      height: '100%',
    },
    actions: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    textContainer: {
      marginBottom: 32,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: '#000',
      marginBottom: 8,
      textAlign: 'left',
    },
    subtitle: {
      fontSize: 18,
      color: '#999',
      fontWeight: '500',
      textAlign: 'left',
    },
    getStartedButton: {
      height: 56,
      backgroundColor: '#000',
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    getStartedText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '600',
    },
    signInRow: {
      alignItems: 'center',
    },
    signInPrompt: {
      fontSize: 15,
      color: '#666',
      fontWeight: '500',
    },
  })

import { HapticButton } from '@/components/haptic-button'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function RatingScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

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
        <Text style={styles.title}>Give us a rating</Text>

        {/* Rating Stars Visual */}
        <Animated.View style={[styles.starsWrapper, { opacity: fadeAnim }]}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons key={star} name="star" size={40} color="#FFD700" />
            ))}
          </View>
        </Animated.View>

        <Text style={styles.subtitle}>
          As a solo dev and gym goer, building Rep AI for the lifting community,
          your rating means a lot. It helps Rep AI reach more lifters!
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <HapticButton style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next</Text>
        </HapticButton>
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

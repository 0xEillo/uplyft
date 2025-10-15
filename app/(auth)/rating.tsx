import { HapticButton } from '@/components/haptic-button'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as StoreReview from 'expo-store-review'
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function RatingScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const handleNext = () => {
    router.push({
      pathname: '/(auth)/signup',
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  const handleSubmitReview = async () => {
    // Try native in-app review first
    try {
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview()
        setTimeout(() => handleNext(), 500)
        return
      }
    } catch {
      // ignore and fallback to store URL
    }

    // Fallback to opening the store review page
    try {
      let storeUrl = ''

      if (Platform.OS === 'ios') {
        // TODO: Replace with your actual App Store ID once app is published
        // Get from: https://appstoreconnect.apple.com
        const APP_STORE_ID = 'YOUR_APP_STORE_ID'
        storeUrl = `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`
      } else {
        const PACKAGE_NAME = 'com.anonymous.repai'
        storeUrl = `market://details?id=${PACKAGE_NAME}`
      }

      const canOpen = await Linking.canOpenURL(storeUrl)

      if (canOpen) {
        await Linking.openURL(storeUrl)
        setTimeout(() => handleNext(), 500)
      } else {
        Alert.alert(
          'Thank You!',
          'Your support means a lot! Continue to complete setup.',
          [{ text: 'Continue', onPress: handleNext }],
        )
      }
    } catch (error) {
      console.error('Error opening app store:', error)
      Alert.alert(
        'Thank You!',
        'Your support means a lot! Continue to complete setup.',
        [{ text: 'Continue', onPress: handleNext }],
      )
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Help us grow 😃</Text>

        <Text style={styles.subtitle}>
          As a solo dev and gym goer, building Rep AI for the lifting community,
          your rating means a lot. It helps Rep AI reach more lifters!
        </Text>

        {/* Rating Stars Visual */}
        <View style={styles.starsWrapper}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons key={star} name="star" size={48} color="#FFD700" />
            ))}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <HapticButton style={styles.submitButton} onPress={handleSubmitReview}>
          <Text style={styles.submitButtonText}>Submit Review</Text>
        </HapticButton>

        <HapticButton style={styles.skipButton} onPress={handleNext}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
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
      marginTop: 32,
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
      gap: 12,
    },
    submitButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    skipButton: {
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
  })

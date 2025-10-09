import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as StoreReview from 'expo-store-review'
import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
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
  disabled,
  style,
  children,
}: {
  onPress: () => void
  disabled?: boolean
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
      disabled={disabled}
      activeOpacity={0.9}
    >
      {children}
    </AnimatedTouchable>
  )
}

export default function SubmitReviewScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')

  const handleNext = () => {
    router.push({
      pathname: '/(auth)/trial-offer' as any,
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert(
        'Rating Required',
        'Please select a star rating before submitting.',
        [{ text: 'OK' }],
      )
      return
    }

    // Only open app store for 5-star ratings
    if (rating === 5) {
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
    } else {
      // For ratings < 5 stars, just thank them and continue
      Alert.alert(
        'Thank you!',
        'Your feedback is appreciated. Continue to complete setup.',
        [{ text: 'Continue', onPress: handleNext }],
      )
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Title */}
            <Animated.Text
              style={styles.title}
              entering={FadeIn.delay(100).duration(500)}
            >
              Help us grow😄
            </Animated.Text>

            <Animated.Text
              style={styles.subtitle}
              entering={FadeIn.delay(200).duration(500)}
            >
              Your early support means everything. Tap the stars to rate Rep AI
            </Animated.Text>

            {/* Interactive Rating Stars */}
            <Animated.View
              style={styles.starsWrapper}
              entering={FadeIn.delay(300).duration(500)}
            >
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star, index) => (
                  <Animated.View
                    key={star}
                    entering={FadeIn.delay(400 + index * 60).duration(500)}
                  >
                    <TouchableOpacity
                      onPress={() => setRating(star)}
                      style={styles.starButton}
                    >
                      <Ionicons
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={48}
                        color={star <= rating ? '#FFD700' : colors.border}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            {/* Review Text Input */}
            {rating > 0 && (
              <Animated.View
                style={styles.reviewContainer}
                entering={FadeIn.duration(500)}
              >
                <Text style={styles.reviewLabel}>Add a comment</Text>
                <TextInput
                  style={styles.reviewInput}
                  placeholder="e.g. Great app!"
                  placeholderTextColor={colors.textSecondary}
                  value={review}
                  onChangeText={setReview}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </Animated.View>
            )}
          </View>
        </ScrollView>

        {/* Actions */}
        <Animated.View
          style={styles.footer}
          entering={FadeIn.delay(700).duration(500)}
        >
          <AnimatedButton
            style={[
              styles.submitButton,
              rating === 0 && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitReview}
            disabled={rating === 0}
          >
            <Text style={styles.submitButtonText}>Submit Review</Text>
          </AnimatedButton>

          <AnimatedButton style={styles.skipButton} onPress={handleNext}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </AnimatedButton>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
    },
    starsWrapper: {
      backgroundColor: colors.white,
      paddingHorizontal: 24,
      paddingVertical: 20,
      borderRadius: 16,
      marginBottom: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    starsContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    starButton: {
      padding: 4,
    },
    reviewContainer: {
      width: '100%',
      marginTop: 16,
    },
    reviewLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    reviewInput: {
      minHeight: 100,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.inputBackground,
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
    submitButtonDisabled: {
      opacity: 0.4,
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

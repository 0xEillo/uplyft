import { HapticButton } from '@/components/haptic-button'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type OnboardingData = {
  name: string
  gender: Gender | null
  height_cm: number | null
  weight_kg: number | null
  age: number | null
  goal: Goal[]
  commitment: string | null
  bio: string | null
}

export default function SignupOptionsScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { signInWithGoogle, signInWithApple, user } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)

  // Parse onboarding data from params
  const onboardingData: OnboardingData | null = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null

  const handleAppleSignup = async () => {
    setIsAppleLoading(true)
    try {
      await signInWithApple()

      // After Apple signup, update profile with onboarding data
      // Get the current user from supabase since it might take a moment to update
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (currentUser && onboardingData) {
        try {
          // Generate a unique user_tag based on the display name
          const userTag = await database.profiles.generateUniqueUserTag(
            onboardingData.name,
          )

          await database.profiles.update(currentUser.id, {
            user_tag: userTag,
            display_name: onboardingData.name,
            gender: onboardingData.gender,
            height_cm: onboardingData.height_cm,
            weight_kg: onboardingData.weight_kg,
            age: onboardingData.age,
            goals: onboardingData.goal.length > 0 ? onboardingData.goal : null,
            commitment: onboardingData.commitment,
            bio: onboardingData.bio,
          })
        } catch (profileError) {
          console.error(
            'Error updating profile with onboarding data:',
            profileError,
          )
          // Don't fail the signup if profile update fails
        }
      }

      // Navigate to congratulations
      router.replace({
        pathname: '/(auth)/congratulations',
        params: {
          onboarding_data: params.onboarding_data as string,
        },
      })
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to sign up with Apple',
      )
    } finally {
      setIsAppleLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle()

      // After Google signup, update profile with onboarding data
      // Get the current user from supabase since it might take a moment to update
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (currentUser && onboardingData) {
        try {
          // Generate a unique user_tag based on the display name
          const userTag = await database.profiles.generateUniqueUserTag(
            onboardingData.name,
          )

          await database.profiles.update(currentUser.id, {
            user_tag: userTag,
            display_name: onboardingData.name,
            gender: onboardingData.gender,
            height_cm: onboardingData.height_cm,
            weight_kg: onboardingData.weight_kg,
            age: onboardingData.age,
            goals: onboardingData.goal.length > 0 ? onboardingData.goal : null,
            commitment: onboardingData.commitment,
            bio: onboardingData.bio,
          })
        } catch (profileError) {
          console.error(
            'Error updating profile with onboarding data:',
            profileError,
          )
          // Don't fail the signup if profile update fails
        }
      }

      // Navigate to congratulations
      router.replace({
        pathname: '/(auth)/congratulations',
        params: {
          onboarding_data: params.onboarding_data as string,
        },
      })
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to sign up with Google',
      )
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleEmailSignup = () => {
    router.push({
      pathname: '/(auth)/signup-email',
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Create your account</Text>
            </View>

            <View style={styles.buttonsWrapper}>
              <View style={styles.stepContent}>
                {Platform.OS === 'ios' && (
                  <HapticButton
                    style={[
                      styles.appleButton,
                      isAppleLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleAppleSignup}
                    disabled={isAppleLoading}
                    hapticEnabled={!isAppleLoading}
                  >
                    {isAppleLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                        <Text style={styles.appleButtonText}>
                          Sign up with Apple
                        </Text>
                      </>
                    )}
                  </HapticButton>
                )}

                <HapticButton
                  style={[
                    styles.googleButton,
                    isGoogleLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleGoogleSignup}
                  disabled={isGoogleLoading}
                  hapticEnabled={!isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <>
                      <Ionicons
                        name="logo-google"
                        size={20}
                        color={colors.text}
                      />
                      <Text style={styles.googleButtonText}>
                        Sign up with Google
                      </Text>
                    </>
                  )}
                </HapticButton>

                <HapticButton
                  style={styles.emailButton}
                  onPress={handleEmailSignup}
                  disabled={isGoogleLoading || isAppleLoading}
                  hapticEnabled={!isGoogleLoading && !isAppleLoading}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.buttonText}
                  />
                  <Text style={styles.emailButtonText}>Sign up with Email</Text>
                </HapticButton>
              </View>
            </View>
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
    wrapper: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    backButton: {
      padding: 4,
    },
    placeholder: {
      width: 32,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
    },
    stepContainer: {
      flex: 1,
      justifyContent: 'flex-start',
    },
    stepHeader: {
      paddingTop: 0,
      paddingBottom: 24,
    },
    stepTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'left',
      marginBottom: 8,
    },
    stepSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'left',
      lineHeight: 22,
    },
    buttonsWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    stepContent: {
      gap: 16,
    },
    appleButton: {
      height: 64,
      backgroundColor: '#000000',
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    appleButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },
    googleButton: {
      height: 64,
      backgroundColor: colors.inputBackground,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    googleButtonText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    emailButton: {
      height: 64,
      backgroundColor: colors.primary,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    emailButtonText: {
      color: colors.buttonText,
      fontSize: 17,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  })

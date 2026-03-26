import { HapticButton } from '@/components/haptic-button'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { persistOnboardingWeight } from '@/lib/onboarding-weight'
import {
  resolveOnboardingDisplayName,
  resolveUserTagBase,
} from '@/lib/profile-identity'
import { supabase } from '@/lib/supabase'
import {
  CommitmentDay,
  CommitmentFrequency,
  CommitmentMode,
  ExperienceLevel,
  Gender,
  Goal,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
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
  commitment: CommitmentDay[]
  commitment_frequency: CommitmentFrequency | null
  commitment_mode: CommitmentMode
  experience_level: ExperienceLevel | null
  bio: string | null
}

export default function SignupOptionsScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { signInWithGoogle, signInWithApple } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)

  // Parse onboarding data from params
  const onboardingData: OnboardingData | null = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null

  const updateProfileWithOnboardingData = async (userId: string) => {
    if (!onboardingData) return

    const displayName = resolveOnboardingDisplayName(onboardingData.name)
    const userTagBase = resolveUserTagBase(displayName)
    const existingProfile = await database.profiles
      .getByIdOrNull(userId)
      .catch((error) => {
        console.warn(
          '[SignupOptions] Failed to load existing profile before onboarding sync.',
          error,
        )
        return null
      })

    let userTag: string | null = existingProfile?.user_tag ?? null
    if (!userTag) {
      try {
        userTag = await database.profiles.generateUniqueUserTag(userTagBase)
      } catch (tagError) {
        console.warn(
          '[SignupOptions] Failed to generate user tag from onboarding name. Falling back to Athlete.',
          tagError,
        )
        userTag = await database.profiles.generateUniqueUserTag('Athlete')
      }
    }

    const profileUpdates: {
      id: string
      user_tag?: string
      display_name: string
      gender: Gender | null
      height_cm: number | null
      age: number | null
      goals: Goal[] | null
      commitment: CommitmentDay[] | null
      commitment_frequency: CommitmentFrequency | null
      experience_level: ExperienceLevel | null
      bio: string | null
    } = {
      id: userId,
      display_name: displayName,
      gender: onboardingData.gender,
      height_cm: onboardingData.height_cm,
      age: onboardingData.age,
      goals: onboardingData.goal.length > 0 ? onboardingData.goal : null,
      commitment:
        onboardingData.commitment_mode === 'specific_days'
          ? onboardingData.commitment
          : null,
      commitment_frequency:
        onboardingData.commitment_mode === 'frequency'
          ? onboardingData.commitment_frequency
          : null,
      experience_level: onboardingData.experience_level,
      bio: onboardingData.bio,
    }

    profileUpdates.user_tag = userTag

    await database.profiles.upsert(profileUpdates)
    await persistOnboardingWeight(userId, onboardingData.weight_kg)
  }

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
          await updateProfileWithOnboardingData(currentUser.id)
        } catch (profileError) {
          console.error(
            'Error updating profile with onboarding data:',
            profileError,
          )
          // Don't fail the signup if profile update fails
        }
      }

      // If user wanted to start trial, show trial purchase flow
      if (params.start_trial === 'true') {
        router.replace({
          pathname: '/(auth)/trial-offer',
          params: {
            onboarding_data: params.onboarding_data as string,
            can_purchase: 'true',
          },
        })
      } else {
        router.replace('/(tabs)')
      }
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
          await updateProfileWithOnboardingData(currentUser.id)
        } catch (profileError) {
          console.error(
            'Error updating profile with onboarding data:',
            profileError,
          )
          // Don't fail the signup if profile update fails
        }
      }

      // If user wanted to start trial, show trial purchase flow
      if (params.start_trial === 'true') {
        router.replace({
          pathname: '/(auth)/trial-offer',
          params: {
            onboarding_data: params.onboarding_data as string,
            can_purchase: 'true',
          },
        })
      } else {
        router.replace('/(tabs)')
      }
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

  const handleBack = () => {
    haptic('medium')
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Save your progress</Text>
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
                      <View style={styles.buttonRow}>
                        <Ionicons name="logo-apple" size={30} color="#FFFFFF" />
                        <Text style={styles.appleButtonText}>
                          Sign in with Apple
                        </Text>
                      </View>
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
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <View style={styles.buttonRow}>
                      <Ionicons name="logo-google" size={30} />
                      <Text style={styles.googleButtonText}>
                        Sign in with Google
                      </Text>
                    </View>
                  )}
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
      backgroundColor: colors.bg,
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
      color: colors.textPrimary,
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
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appleButton: {
      height: 64,
      backgroundColor: '#000000',
      borderRadius: 32,
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
      backgroundColor: colors.surfaceInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 32,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    googleButtonText: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
    emailButton: {
      height: 64,
      backgroundColor: colors.brandPrimary,
      borderRadius: 32,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    emailButtonText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  })

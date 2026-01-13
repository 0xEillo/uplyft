import { AnimatedInput } from '@/components/animated-input'
import { HapticButton } from '@/components/haptic-button'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
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
  commitment: string[] | null
  bio: string | null
}

export default function SignupPasswordScreen() {
  const params = useLocalSearchParams()
  const email = params.email as string
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signUp, linkWithEmail, isAnonymous, user } = useAuth()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  // Parse onboarding data from params
  const onboardingData: OnboardingData | null = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null

  const handleSignup = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      let userId: string | undefined

      if (isAnonymous && user) {
        // Link email to existing anonymous account
        await linkWithEmail(email, password)
        userId = user.id

        // Update profile to remove guest status
        try {
          await database.profiles.update(userId, {
            is_guest: false,
          })
        } catch (profileError) {
          console.error('[SignupPassword] Error updating profile guest status:', profileError)
        }
      } else {
        // Create new account
        const result = await signUp(email, password)
        userId = result.userId
      }

      // If we have onboarding data, update the profile
      if (userId && onboardingData) {
        try {
          // Generate a unique user_tag based on the display name
          const userTag = await database.profiles.generateUniqueUserTag(
            onboardingData.name,
          )

          await database.profiles.update(userId, {
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

      // Navigate to trial offer after signup if we have onboarding data
      if (onboardingData) {
        router.replace({
          pathname: '/(auth)/trial-offer',
          params: {
            onboarding_data: params.onboarding_data as string,
          },
        } as Parameters<typeof router.replace>[0])
      } else {
        // For anonymous linking, we don't necessarily need verification, but for fresh signup we might.
        // Assuming linkWithEmail (updateUser) might confirm immediately or ask for verification depending on Supabase config.
        // If it was an anonymous upgrade, we are already logged in as that user, so we can go to tabs/trial.
        
        if (isAnonymous) {
             router.replace('/(tabs)')
        } else {
             Alert.alert(
              'Success',
              'Account created! Please check your email to verify your account.',
              [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(auth)/welcome'),
                },
              ],
            )
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sign up'
      Alert.alert('Error', message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    haptic('medium')
    router.back()
  }

  const canProceed =
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    password === confirmPassword &&
    password.length >= 6

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Sign Up</Text>
                <Text style={styles.stepSubtitle}>
                  Signing up as <Text style={styles.emailText}>{email}</Text>
                </Text>
              </View>

              <View style={styles.buttonsWrapper}>
                <View style={styles.stepContent}>
                  <AnimatedInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    autoFocus
                    secureTextEntry
                    returnKeyType="next"
                    editable={!isLoading}
                  />
                  <AnimatedInput
                    style={styles.passwordInput}
                    placeholder="Confirm Password"
                    placeholderTextColor={colors.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                    editable={!isLoading}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer */}
        <View style={styles.footer}>
          <HapticButton
            style={[
              styles.signUpButton,
              (!canProceed || isLoading) && styles.signUpButtonDisabled,
            ]}
            onPress={handleSignup}
            disabled={!canProceed || isLoading}
            hapticEnabled={canProceed && !isLoading}
            hapticIntensity="medium"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            )}
          </HapticButton>
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
    keyboardView: {
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
    },
    contentContainer: {
      flexGrow: 1,
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
    emailText: {
      fontWeight: '600',
      color: colors.text,
    },
    buttonsWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    stepContent: {
      gap: 16,
    },
    passwordInput: {
      height: 64,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 32,
      paddingHorizontal: 20,
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 32,
      paddingVertical: 16,
      paddingBottom: 32,
    },
    signUpButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    signUpButtonDisabled: {
      opacity: 0.4,
    },
    signUpButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
  })

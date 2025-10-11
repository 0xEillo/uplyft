import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { createAuthStyles } from '@/styles/auth-styles'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
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
  goal: Goal | null
  commitment: string | null
  bio: string | null
}

export default function SignupScreen() {
  const params = useLocalSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const { signUp, signInWithGoogle } = useAuth()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const styles = createAuthStyles(colors)
  const logoSource = isDark
    ? require('@/llm/repai-logo-white.png')
    : require('@/llm/repai-logo-black.png')

  // Parse onboarding data from params
  const onboardingData: OnboardingData | null = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
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
      const { userId } = await signUp(email, password)

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
            goal: onboardingData.goal,
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

      // Navigate to login screen
      Alert.alert(
        'Success',
        'Account created! Please check your email to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sign up'
      Alert.alert('Error', message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle()
      router.replace('/(tabs)')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sign up with Google'
      Alert.alert('Error', message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo/Title */}
          <View style={styles.header}>
            <View style={styles.logoTitleContainer}>
              <Image
                source={logoSource}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Join Rep AI</Text>
            </View>
            <Text style={styles.subtitle}>
              Start tracking your fitness journey
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* Separator */}
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Google Sign Up */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                isGoogleLoading && styles.buttonDisabled,
              ]}
              onPress={handleGoogleSignup}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={colors.text} />
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity disabled={isLoading || isGoogleLoading}>
                  <Text style={styles.link}>Log In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

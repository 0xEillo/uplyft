import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

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
  const { signUp } = useAuth()
  const colors = useThemedColors()
  const styles = createStyles(colors)

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
          console.error('Error updating profile with onboarding data:', profileError)
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
      Alert.alert('Error', error.message || 'Failed to sign up')
    } finally {
      setIsLoading(false)
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
            <Ionicons name="fitness" size={64} color={colors.primary} />
            <Text style={styles.title}>Join Uplyft</Text>
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity disabled={isLoading}>
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

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    title: {
      fontSize: 42,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    form: {
      width: '100%',
    },
    input: {
      height: 54,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      marginBottom: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    button: {
      height: 54,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: 17,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    footerText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    link: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: '600',
    },
  })

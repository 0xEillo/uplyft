import { AnimatedInput } from '@/components/animated-input'
import { HapticButton } from '@/components/haptic-button'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SignInPasswordScreen() {
  const params = useLocalSearchParams()
  const email = params.email as string
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useAuth()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const handleSignIn = async () => {
    if (!password.trim()) {
      return
    }

    setIsLoading(true)
    try {
      await signIn(email, password)
      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to sign in',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    haptic('medium')
    router.back()
  }

  const canProceed = password.trim() !== ''

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Sign In</Text>
                <Text style={styles.stepSubtitle}>
                  Signing in as <Text style={styles.emailText}>{email}</Text>
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
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                    editable={!isLoading}
                  />
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Footer */}
        <View style={styles.footer}>
          <HapticButton
            style={[
              styles.signInButton,
              (!canProceed || isLoading) && styles.signInButtonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={!canProceed || isLoading}
            hapticEnabled={canProceed && !isLoading}
            hapticIntensity="medium"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
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
      backgroundColor: colors.bg,
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
    emailText: {
      fontWeight: '600',
      color: colors.textPrimary,
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
      color: colors.textPrimary,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 32,
      paddingVertical: 16,
      paddingBottom: 32,
    },
    signInButton: {
      height: 64,
      backgroundColor: colors.textPrimary,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    signInButtonDisabled: {
      opacity: 0.5,
      shadowOpacity: 0,
    },
    signInButtonText: {
      color: colors.bg,
      fontSize: 18,
      fontWeight: '700',
    },
  })

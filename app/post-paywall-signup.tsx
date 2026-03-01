import { HapticButton } from '@/components/haptic-button'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function PostPaywallSignupScreen() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { signInWithGoogle, signInWithApple } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)
  const styles = createStyles(colors, isDark)

  const handleAppleSignUp = async () => {
    setIsAppleLoading(true)
    try {
      await signInWithApple(true)
      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert(
        'Sign Up Failed',
        error instanceof Error ? error.message : 'Failed to sign up with Apple',
      )
    } finally {
      setIsAppleLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle(true)
      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert(
        'Sign Up Failed',
        error instanceof Error ? error.message : 'Failed to sign up with Google',
      )
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleEmailSignUp = () => {
    router.replace('/(auth)/signup-email')
  }

  return (
    <View style={styles.container}>
      <LiquidGlassSurface
        style={StyleSheet.absoluteFill}
        fallbackStyle={styles.fallbackSurface}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: NATIVE_SHEET_LAYOUT.topPadding,
            paddingBottom:
              insets.bottom + NATIVE_SHEET_LAYOUT.bottomSafeAreaPadding,
          },
        ]}
      >
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Sign up to sync your workouts and keep your progress safe.
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          {Platform.OS === 'ios' && (
            <HapticButton
              style={[styles.appleButton, isAppleLoading && styles.buttonDisabled]}
              onPress={handleAppleSignUp}
              disabled={isAppleLoading}
              hapticEnabled={!isAppleLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={19} color="#FFFFFF" />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </HapticButton>
          )}

          <HapticButton
            style={[styles.glassButton, isGoogleLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignUp}
            disabled={isGoogleLoading}
            hapticEnabled={!isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
                <Text style={styles.glassButtonText}>Continue with Google</Text>
              </>
            )}
          </HapticButton>

          <HapticButton style={styles.primaryButton} onPress={handleEmailSignUp}>
            <Ionicons name="mail-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryButtonText}>Continue with Email</Text>
          </HapticButton>
        </View>
      </View>
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    fallbackSurface: {
      backgroundColor: isDark
        ? 'rgba(24, 24, 28, 0.84)'
        : 'rgba(248, 249, 255, 0.85)',
    },
    content: {
      flex: 1,
      paddingHorizontal: NATIVE_SHEET_LAYOUT.horizontalPadding,
      gap: 20,
    },
    headerTextBlock: {
      gap: 6,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    buttonsContainer: {
      gap: 10,
    },
    appleButton: {
      height: 54,
      backgroundColor: '#000000',
      borderRadius: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    appleButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    glassButton: {
      height: 54,
      borderRadius: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255,255,255,0.14)'
        : 'rgba(255,255,255,0.62)',
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.46)',
    },
    glassButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    primaryButton: {
      height: 56,
      backgroundColor: colors.brandPrimary,
      borderRadius: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      shadowColor: colors.brandPrimary,
      shadowOpacity: 0.3,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  })

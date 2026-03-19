import { HapticButton } from '@/components/haptic-button'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { schedulePushNotificationPrompt } from '@/hooks/usePushNotifications'
import { useThemedColors } from '@/hooks/useThemedColors'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BENEFITS = [
  'Save workouts and progress across devices',
  'Keep your streak and personal records protected',
] as const

export default function PostPaywallSignupScreen() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { signInWithGoogle, signInWithApple } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)
  const isAnyLoading = isGoogleLoading || isAppleLoading
  const styles = createStyles(colors, isDark)

  const schedulePostSignupPushPrompt = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return
    }

    schedulePushNotificationPrompt({
      userId: user.id,
      delayMs: 600,
      message:
        'Enable notifications to get workout reminders and tips from your coach.',
    })
  }

  const handleAppleSignUp = async () => {
    setIsAppleLoading(true)
    try {
      await signInWithApple(true)
      await schedulePostSignupPushPrompt()
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
      await schedulePostSignupPushPrompt()
      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert(
        'Sign Up Failed',
        error instanceof Error
          ? error.message
          : 'Failed to sign up with Google',
      )
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleEmailSignUp = () => {
    router.replace('/(auth)/signup-email')
  }

  const handleDismiss = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.backdrop}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss sign up prompt"
      >
        <BlurView
          intensity={isDark ? 40 : 34}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          experimentalBlurMethod="dimezisBlurView"
        />
        <View style={styles.backdropTint} />
      </Pressable>

      <Animated.View
        entering={FadeInDown.duration(240)}
        style={[
          styles.popupFrame,
          {
            marginTop: Math.max(insets.top + 10, 14),
            marginBottom: Math.max(insets.bottom + 10, 14),
          },
        ]}
      >
        <View style={[styles.popupSurface, styles.popupSurfaceFallback]}>
          <View style={styles.glassDensityOverlay} />

          <View style={styles.content}>
            <View style={styles.heroBlock}>
              <Text style={styles.title}>Save your progress</Text>
              <Text style={styles.subtitle}>
                You unlocked Pro. Finish account setup so your training data is
                safe.
              </Text>
            </View>

            <View style={styles.benefitsList}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.statusSuccess}
                  />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <View style={styles.buttonsContainer}>
              {Platform.OS === 'ios' && (
                <HapticButton
                  style={[
                    styles.appleButton,
                    isAppleLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleAppleSignUp}
                  disabled={isAppleLoading}
                  hapticEnabled={!isAppleLoading}
                >
                  {isAppleLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.buttonRow}>
                      <Ionicons name="logo-apple" size={19} color="#FFFFFF" />
                      <Text style={styles.appleButtonText}>
                        Continue with Apple
                      </Text>
                    </View>
                  )}
                </HapticButton>
              )}

              <HapticButton
                style={[
                  styles.glassButton,
                  isGoogleLoading && styles.buttonDisabled,
                ]}
                onPress={handleGoogleSignUp}
                disabled={isGoogleLoading}
                hapticEnabled={!isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <View style={styles.buttonRow}>
                    <Ionicons
                      name="logo-google"
                      size={18}
                      color={colors.textPrimary}
                    />
                    <Text style={styles.glassButtonText}>
                      Continue with Google
                    </Text>
                  </View>
                )}
              </HapticButton>

              <HapticButton
                style={[
                  styles.primaryButton,
                  isAnyLoading && styles.buttonDisabled,
                ]}
                onPress={handleEmailSignUp}
                disabled={isAnyLoading}
                hapticEnabled={!isAnyLoading}
              >
                <View style={styles.buttonRow}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={colors.onPrimary}
                  />
                  <Text style={styles.primaryButtonText}>
                    Continue with Email
                  </Text>
                </View>
              </HapticButton>

              <Pressable
                onPress={handleDismiss}
                style={styles.dismissLink}
                accessibilityRole="button"
                accessibilityLabel="Continue as guest"
              >
                <Text style={styles.dismissLinkText}>Continue as guest</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
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
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    backdropTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.42)' : 'rgba(7, 10, 20, 0.2)',
    },
    popupFrame: {
      width: '100%',
      maxWidth: 460,
      maxHeight: '76%',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)',
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.34 : 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 22,
    },
    popupSurface: {
      width: '100%',
      borderRadius: 24,
      overflow: 'hidden',
    },
    popupSurfaceFallback: {
      backgroundColor: isDark
        ? 'rgba(18, 18, 20, 0.84)'
        : 'rgba(255,255,255,0.84)',
    },
    glassDensityOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark
        ? 'rgba(18, 18, 20, 0.24)'
        : 'rgba(255,255,255,0.26)',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      gap: 14,
    },
    heroBlock: {
      gap: 6,
    },
    title: {
      fontSize: 30,
      lineHeight: 32,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.8,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    benefitsList: {
      gap: 8,
    },
    benefitRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      paddingVertical: 2,
    },
    benefitText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: colors.textSecondary,
      marginTop: -1,
    },
    buttonsContainer: {
      gap: 10,
      marginTop: 2,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    primaryButton: {
      height: 54,
      backgroundColor: colors.brandPrimary,
      borderRadius: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      shadowColor: colors.brandPrimary,
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    appleButton: {
      height: 52,
      backgroundColor: '#000000',
      borderRadius: 18,
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
      height: 52,
      borderRadius: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.07)'
        : 'rgba(255,255,255,0.88)',
    },
    glassButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    dismissLink: {
      alignSelf: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 2,
    },
    dismissLinkText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  })

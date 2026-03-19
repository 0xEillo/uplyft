import { HapticButton } from '@/components/haptic-button'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SignInBottomSheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  subtitle?: string
}

export function SignInBottomSheet({
  visible,
  onClose,
  title = 'Welcome back',
  subtitle = 'Sign in to continue your training and pick up where you left off.',
}: SignInBottomSheetProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, isDark)
  const { signInWithGoogle, signInWithApple } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)

  const translateY = useSharedValue(420)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      })
      backdropOpacity.value = withTiming(1, { duration: 260 })
    } else {
      translateY.value = withTiming(420, {
        duration: 240,
        easing: Easing.in(Easing.quad),
      })
      backdropOpacity.value = withTiming(0, { duration: 200 })
    }
  }, [visible, translateY, backdropOpacity])

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true)
    try {
      await signInWithApple(true)
      onClose()
      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert(
        'Sign In Failed',
        error instanceof Error ? error.message : 'Failed to sign in with Apple',
      )
    } finally {
      setIsAppleLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle(true)
      onClose()
      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert(
        'Sign In Failed',
        error instanceof Error
          ? error.message
          : 'Failed to sign in with Google',
      )
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleEmailSignIn = () => {
    onClose()
    router.push('/(auth)/signin-email')
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
          <Pressable style={styles.backdropPress} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetWrapper,
            { paddingBottom: Math.max(insets.bottom + 12, 24) },
            animatedSheetStyle,
          ]}
        >
          <LiquidGlassSurface
            style={styles.sheet}
            glassEffectStyle="regular"
            fallbackStyle={styles.sheetFallback}
          >
            <View style={styles.handleBar} />

            <View style={styles.headerRow}>
              <View style={styles.headerTextBlock}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.buttonsContainer}>
              {Platform.OS === 'ios' && (
                <HapticButton
                  style={[
                    styles.appleButton,
                    isAppleLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleAppleSignIn}
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
                onPress={handleGoogleSignIn}
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
                style={styles.primaryButton}
                onPress={handleEmailSignIn}
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
            </View>
          </LiquidGlassSurface>
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(8, 10, 20, 0.28)',
    },
    backdropPress: {
      flex: 1,
    },
    sheetWrapper: {
      paddingHorizontal: 10,
    },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 10,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(255, 255, 255, 0.56)',
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.28 : 0.14,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: -8 },
    },
    sheetFallback: {
      backgroundColor: isDark
        ? 'rgba(24, 24, 28, 0.84)'
        : 'rgba(248, 249, 255, 0.85)',
    },
    handleBar: {
      width: 42,
      height: 4,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.34)'
        : 'rgba(39, 44, 63, 0.24)',
      borderRadius: 999,
      alignSelf: 'center',
      marginBottom: 14,
    },
    headerRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
      alignItems: 'flex-start',
    },
    headerTextBlock: {
      flex: 1,
      gap: 6,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.6)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(255, 255, 255, 0.75)',
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
      paddingBottom: 4,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.62)',
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

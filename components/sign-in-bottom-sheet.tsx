import { HapticButton } from '@/components/haptic-button'
import { useAuth } from '@/contexts/auth-context'
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface SignInBottomSheetProps {
  visible: boolean
  onClose: () => void
}

export function SignInBottomSheet({
  visible,
  onClose,
}: SignInBottomSheetProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { signInWithGoogle, signInWithApple } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)

  const translateY = useSharedValue(400)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      })
      backdropOpacity.value = withTiming(1, { duration: 200 })
    } else {
      translateY.value = withTiming(400, { duration: 200 })
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
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
          <Pressable style={styles.backdropPress} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, animatedSheetStyle]}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Title */}
          <Text style={styles.title}>Sign In</Text>

          {/* Buttons */}
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
                  <>
                    <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                    <Text style={styles.appleButtonText}>
                      Sign in with Apple
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
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading}
              hapticEnabled={!isGoogleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={colors.text} />
                  <Text style={styles.googleButtonText}>
                    Sign in with Google
                  </Text>
                </>
              )}
            </HapticButton>

            <HapticButton style={styles.emailButton} onPress={handleEmailSignIn}>
              <Ionicons name="mail-outline" size={20} color={colors.buttonText} />
              <Text style={styles.emailButtonText}>Sign in with Email</Text>
            </HapticButton>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdropPress: {
      flex: 1,
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 48,
    },
    handleBar: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 24,
      textAlign: 'center',
    },
    buttonsContainer: {
      gap: 12,
    },
    appleButton: {
      height: 56,
      backgroundColor: '#000000',
      borderRadius: 28,
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
      height: 56,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 28,
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
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 28,
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
